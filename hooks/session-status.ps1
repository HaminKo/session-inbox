# Session Inbox status-writer hook.
# Wired in ~/.claude/settings.json on UserPromptSubmit, PostToolUse, PermissionRequest, Stop and
# SessionEnd. Reads the hook payload (JSON on stdin) and keeps one status file per session at
# ~/.claude/session-status/<session_id>.json, so the Session Inbox extension can show which sessions
# are still waiting after their one-shot popup is gone. notify.ps1 owns the popups and is never
# touched by this script.
#
# State comes from hook_event_name:
#   PermissionRequest -> waiting   (blocked on a permission prompt or a question)
#   Stop              -> done      (reply finished, your turn)
#   UserPromptSubmit  -> working
#   PostToolUse       -> working
#   SessionEnd        -> the status file is deleted
# The inbox counts waiting + done (see docs/decisions.md). On Stop it also writes `background`: the
# number of background tasks still running; the readers show such a `done` as working for a while.
#
# Wired synchronously (not async) so the events stay in order: a late 'working' write must never
# land after 'done' and leave a finished session stuck as working. The body is tiny and does no
# popup / WinForms work, so the only real cost per PostToolUse is powershell.exe startup.
#
# Keep this file ASCII-only: Windows PowerShell 5.1 reads it in the ANSI codepage, so a typed
# special character turns into garbage (same note as notify.ps1).

[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$data = [Console]::In.ReadToEnd() | ConvertFrom-Json

$sessionId = $data.session_id
if (-not $sessionId) { exit 0 }  # can't name the file without it

$dir = Join-Path $env:USERPROFILE '.claude\session-status'
$file = Join-Path $dir "$sessionId.json"
$event = $data.hook_event_name

if ($event -eq 'SessionEnd') {
    if (Test-Path $file) { Remove-Item $file -ErrorAction SilentlyContinue }
    exit 0
}

# One Markdown line as plain text. A word-for-word copy of Plain-Line in notify.ps1 (not
# imported: importing it would run its popup); keep the two the same.
function Plain-Line([string]$line) {
    ($line -replace '^\s*(#+|>|[-*]|\d+\.)\s+', '' -replace '!?\[([^\]]+)\]\([^)]*\)', '$1' -replace '\*\*|`', '').Trim()
}

# The message for Stop: only the first meaningful line of the reply (a list row has room for one
# line; the popup shows more). Never cut between the two halves of an emoji.
function First-Line([string]$text) {
    foreach ($line in ($text -split "`r?`n")) {
        $plain = Plain-Line $line
        if ($plain) {
            if ($plain.Length -gt 140) {
                $cut = if ([char]::IsHighSurrogate($plain[138])) { 138 } else { 139 }
                $plain = $plain.Substring(0, $cut) + [char]0x2026
            }
            return $plain
        }
    }
    return ''
}

# How many background tasks (commands, agents, monitors) the chat's transcript shows started and not
# yet ended, so a reply that ends while Claude still waits for one isn't "your turn". A start is a
# tool result beginning with one of the three launch texts, which name the task id; an end is a
# <task-notification> for that task id, or a TaskStop call on it (which writes no notification).
# Read as text with regexes, no JSON parse: a Stop on the largest transcript seen (20.8 MB) took
# 0.1-0.15 s longer than a PostToolUse (docs/research/hooks.md, Stop). Words quoted inside a message
# have escaped quotes (\") and don't match. 0 when the transcript can't be read.
function Background-Count([string]$path) {
    if (-not $path) { return 0 }
    try {
        # Claude may be appending to it: share read, write and delete.
        $stream = [System.IO.File]::Open($path, 'Open', 'Read', 'ReadWrite, Delete')
        try { $text = (New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)).ReadToEnd() }
        finally { $stream.Dispose() }
    }
    catch { return 0 }
    $running = New-Object 'System.Collections.Generic.HashSet[string]'
    # The agent text has a sentence before its id: (?:[^"\\]|\\.)*? stays inside the JSON string.
    $start = '"tool_use_id":"[^"]+","type":"tool_result","content":(?:"|\[\{"type":"text","text":")(?:Command running in background with ID: (\w+)|Monitor started \(task (\w+)|Async agent launched successfully\.(?:[^"\\]|\\.)*?agentId: (\w+))'
    foreach ($m in [regex]::Matches($text, $start)) {
        foreach ($group in 1..3) { if ($m.Groups[$group].Success) { [void]$running.Add($m.Groups[$group].Value) } }
    }
    # \\n: the file holds JSON's escape, a backslash and an n, not a line break. Two regexes, not one
    # with a top-level |: that one took 312 ms instead of 19 on a 20.8 MB transcript (measured).
    $ends = @('<task-notification>\\n<task-id>([^<]+)</task-id>', '"name":"TaskStop","input":\{"task_id":"([^"]+)"')
    foreach ($end in $ends) {
        foreach ($m in [regex]::Matches($text, $end)) { [void]$running.Remove($m.Groups[1].Value) }
    }
    return $running.Count
}

$message = ''
$background = 0
switch ($event) {
    'PermissionRequest' {
        $state = 'waiting'
        # Claude's question dialog (AskUserQuestion) also arrives as a permission request.
        if ($data.tool_name -eq 'AskUserQuestion') {
            $question = if ($data.tool_input.questions) { @($data.tool_input.questions)[0].question } else { $null }
            $message = if ($question) { "Has a question: $question" } else { 'Has a question for you' }
        }
        else { $message = "Needs permission to use $($data.tool_name)" }
    }
    'Stop' {
        $state = 'done'
        $line = First-Line $data.last_assistant_message
        $message = if ($line) { $line } else { 'Finished' }
        $background = Background-Count $data.transcript_path
    }
    default { $state = 'working' }  # UserPromptSubmit, PostToolUse
}

# The folder the chat started in, which is its VS Code window's folder. The payload's cwd follows the
# chat's shell, so after a "cd extension" it names a subfolder (measured 2026-11-01). Claude Code sets
# CLAUDE_PROJECT_DIR for hooks to the start folder (measured in the VS Code extension, 2026-11-01, with
# forward slashes); failing that, the chat's file in ~/.claude/sessions/ keeps the start folder. A word-for-word copy of Project-Dir in notify.ps1; keep the two the same.
function Project-Dir($data) {
    if ($env:CLAUDE_PROJECT_DIR) { return $env:CLAUDE_PROJECT_DIR }
    $sessions = Join-Path $env:USERPROFILE '.claude\sessions'
    if ($data.session_id) {
        foreach ($f in (Get-ChildItem -LiteralPath $sessions -Filter '*.json' -ErrorAction SilentlyContinue)) {
            try {
                $text = [System.IO.File]::ReadAllText($f.FullName)
                if (-not $text.Contains($data.session_id)) { continue }  # skip the JSON parse for other chats
                $s = $text | ConvertFrom-Json
                if ($s.sessionId -eq $data.session_id -and $s.cwd) { return $s.cwd }
            }
            catch { }
        }
    }
    return $data.cwd
}

$cwd = $data.cwd
$projectDir = Project-Dir $data
$folder = if ($projectDir) { Split-Path -Leaf $projectDir } else { '' }
$isWorktree = $false
if ($projectDir) { $isWorktree = Test-Path -PathType Leaf (Join-Path $projectDir '.git') }

$status = [ordered]@{
    session_id    = $sessionId
    cwd           = $cwd
    project_dir   = $projectDir  # full start folder, may use forward slashes; the sidebar click opens it
    folder        = $folder
    worktree      = $isWorktree
    worktree_name = $folder
    state         = $state
    message       = $message
    tool_name     = $data.tool_name
    background    = $background  # running background tasks; set on Stop only, 0 otherwise
    timestamp     = (Get-Date).ToString('o')
}

if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
# Write UTF-8 with no BOM (a BOM would break the extension's JSON.parse), to a temp file first and
# then swap it in, so a reader never sees a half-written file. File.Replace swaps in one step;
# Move-Item -Force would delete the old file first, leaving a moment with no file at all.
# The .tmp name doesn't end in .json, so a reader watching *.json ignores it.
$tmp = "$file.$PID.tmp"
[System.IO.File]::WriteAllText($tmp, ($status | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding $false))
try {
    # [NullString]::Value, not $null: PowerShell passes $null to a .NET string parameter as "", and
    # File.Replace rejects "" as a backup path ("The path is not of a legal form"), measured 2026-11-01.
    if (Test-Path $file) { [System.IO.File]::Replace($tmp, $file, [NullString]::Value) }
    else { [System.IO.File]::Move($tmp, $file) }
}
catch { Remove-Item $tmp -ErrorAction SilentlyContinue }  # e.g. the file is locked: the next event rewrites it
