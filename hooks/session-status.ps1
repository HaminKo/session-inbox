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
# The inbox counts waiting + done (see docs/decisions.md).
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

# The one-line message for the states that have one. Copied (not imported) from notify.ps1:
# importing it would run its popup. For Stop, the first meaningful line of the reply; for a
# question, the question itself.
function First-Line([string]$text) {
    foreach ($line in ($text -split "`r?`n")) {
        $plain = ($line -replace '^\s*(#+|>|[-*]|\d+\.)\s+', '' -replace '\*\*|`', '').Trim()
        if ($plain) {
            if ($plain.Length -gt 140) { $plain = $plain.Substring(0, 139) + [char]0x2026 }
            return $plain
        }
    }
    return ''
}

$message = ''
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
    }
    default { $state = 'working' }  # UserPromptSubmit, PostToolUse
}

$cwd = $data.cwd
$folder = if ($cwd) { Split-Path -Leaf $cwd } else { '' }
$isWorktree = $false
if ($cwd) { $isWorktree = Test-Path -PathType Leaf (Join-Path $cwd '.git') }

$status = [ordered]@{
    session_id    = $sessionId
    cwd           = $cwd
    folder        = $folder
    worktree      = $isWorktree
    worktree_name = $folder
    state         = $state
    message       = $message
    tool_name     = $data.tool_name
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
