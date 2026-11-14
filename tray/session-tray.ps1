# Session Inbox tray indicator (to-do #16, docs/decisions.md 2026-11-03).
# A system-tray icon with the number of sessions that need you (waiting + done, a parked project's
# done left out), for when no VS Code window is in front. Reads the same ~/.claude/session-status/
# folder as the extension, every 2 s.
# Click the icon for a menu: a session opens its VS Code window (`code <folder>`) and asks that window
# to show the chat's tab (the `.reveal` hand-off, docs/research/claude-tabs.md); Exit closes the tray.
#
# The reading, liveness filter, background-task rule and count are a PowerShell copy of
# extension/src/statusFolder.ts (readStatuses, readLiveSessions, onlyLive, backgroundAsWorking,
# countStates; parkedTest in sessionList.ts). Keep the two the same: the unit test
# test/unit/tray.test.ts runs this script with -Once and compares its result with the TypeScript.
#
# One copy runs at a time (a named mutex). The extension starts it (setting sessionInbox.trayIcon,
# extension/src/tray.ts) and every window tries; the copies after the first exit at once.
#
#   -VsCodePid N  exit when that process (the VS Code that started it) ends. Without it, the tray
#                 runs until its Exit item.
#   -Stop         close the running tray (the setting was turned off), then exit.
#   -Once         print the counts and the sessions that need you as JSON, then exit (for the tests).
#   -RowImages D  with -Once: also save each menu row's picture as D\<n>.png (for the tests).
#
# The menu icons are the sidebar's codicons, drawn with VS Code's own font. The extension writes what
# to draw into <status folder>/.tray-looks (extension/src/tray.ts, trayLooks); without that file or
# the font the menu shows text only.
#
# SESSION_INBOX_STATUS_DIR, SESSION_INBOX_SESSIONS_DIR and SESSION_INBOX_TRAY_MUTEX are for the tests
# only, like in the extension.
#
# Keep this file ASCII-only: Windows PowerShell 5.1 reads it in the ANSI codepage.
param([switch]$Once, [int]$VsCodePid = 0, [switch]$Stop, [string]$RowImages = '')

$statusDir = if ($env:SESSION_INBOX_STATUS_DIR) { $env:SESSION_INBOX_STATUS_DIR } else { Join-Path $env:USERPROFILE '.claude\session-status' }
$sessionsDir = if ($env:SESSION_INBOX_SESSIONS_DIR) { $env:SESSION_INBOX_SESSIONS_DIR } else { Join-Path $env:USERPROFILE '.claude\sessions' }
$fileStates = @('waiting', 'done', 'working')

# The parsed contents of every *.json in $dir ($null for a file that can't be read or parsed), or
# $null if the folder can't be read. Like Node's JSON.parse, a file starting with a BOM doesn't parse.
function Read-JsonFiles([string]$dir) {
    try { $paths = [System.IO.Directory]::GetFiles($dir) } catch { return $null }
    $files = New-Object System.Collections.ArrayList
    foreach ($path in $paths) {
        if (-not $path.EndsWith('.json')) { continue }
        $data = $null
        try {
            $bytes = [System.IO.File]::ReadAllBytes($path)
            if (-not ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)) {
                $data = (New-Object System.Text.UTF8Encoding $false).GetString($bytes) | ConvertFrom-Json
            }
        }
        catch { $data = $null }
        [void]$files.Add($data)
    }
    # The comma keeps an empty or one-item list a list.
    return , $files.ToArray()
}

# Only a JSON object counts: an array has no fields, even if PowerShell would read them off its items.
function Is-Object($data) { $data -is [System.Management.Automation.PSCustomObject] }

function Is-Status($data) {
    (Is-Object $data) -and $data.session_id -is [string] -and $data.state -is [string] -and $fileStates -ccontains $data.state
}

function Is-Session($data) {
    (Is-Object $data) -and ($data.pid -is [int] -or $data.pid -is [long]) -and $data.pid -gt 0 -and $data.sessionId -is [string]
}

# The session ids whose chat process still runs, each with the earliest start time (ms) of its
# running processes (-Infinity for one whose `startedAt` isn't a number), or $null when that can't be
# told, so nothing gets hidden: folder missing or empty, or any file unreadable or not in the
# expected format.
function Read-LiveIds([string]$dir, $runningPids) {
    $files = Read-JsonFiles $dir
    if ($null -eq $files -or $files.Count -eq 0) { return $null }
    foreach ($file in $files) { if (-not (Is-Session $file)) { return $null } }
    $ids = New-Object 'System.Collections.Generic.Dictionary[string,double]'
    foreach ($file in $files) {
        if (-not $runningPids.Contains([int]$file.pid)) { continue }
        $start = if (Is-Number $file.startedAt) { [double]$file.startedAt } else { [double]::NegativeInfinity }
        if (-not $ids.ContainsKey($file.sessionId) -or $start -lt $ids[$file.sessionId]) { $ids[$file.sessionId] = $start }
    }
    return , $ids
}

function Is-Number($value) {
    $value -is [int] -or $value -is [long] -or $value -is [double] -or $value -is [decimal]
}

# A `done` whose reply ended with a background task still running counts as working, unless the
# chat's process restarted after the reply or the reply is $backgroundLimitMs old. A copy of
# backgroundAsWorking in extension/src/statusFolder.ts. $live: Read-LiveIds' result.
$backgroundLimitMs = 45 * 60000
function On-BackgroundTask($status, $live, [double]$now) {
    if ($status.state -cne 'done' -or -not (Is-Number $status.background) -or $status.background -le 0) { return $false }
    $reply = [DateTimeOffset]::MinValue
    if ($status.timestamp -isnot [string] -or -not [DateTimeOffset]::TryParse($status.timestamp, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$reply)) { return $false }
    $replyMs = [double]$reply.ToUnixTimeMilliseconds()
    if ($now - $replyMs -ge $backgroundLimitMs) { return $false }
    if ($null -eq $live -or -not $live.ContainsKey($status.session_id)) { return $true }
    return $live[$status.session_id] -le $replyMs
}

# The last part of a path, either slash; '' for none.
function Path-Leaf($path) {
    if (-not ($path -is [string])) { return '' }
    $parts = @($path -split '[\\/]' | Where-Object { $_ })
    if ($parts.Count -gt 0) { $parts[-1] } else { '' }
}

# The row label, like sessionLabel in sessionList.ts: folder, else the last part of cwd, else the id.
function Session-Label($status) {
    if ($status.folder -is [string] -and $status.folder) { return $status.folder }
    $leaf = Path-Leaf $status.cwd
    if ($leaf) { return $leaf }
    return $status.session_id
}

# The folder a click opens, like sessionFolder in sessionList.ts: project_dir, else cwd while it is
# the folder itself (cwd follows the shell into subfolders); '' for none.
function Session-Folder($status) {
    if ($status.project_dir -is [string] -and $status.project_dir) { return $status.project_dir }
    $leaf = Path-Leaf $status.cwd
    if ($leaf -and $status.folder -is [string] -and $leaf -eq $status.folder) { return $status.cwd }
    return ''
}

# The menu-icon file the extension writes, parsed: $null when missing or unreadable. Its text is kept
# in $script:looksText, for telling whether it changed.
$script:looksText = ''
function Read-Looks {
    $script:looksText = ''
    try {
        $bytes = [System.IO.File]::ReadAllBytes((Join-Path $statusDir '.tray-looks'))
        $script:looksText = (New-Object System.Text.UTF8Encoding $false).GetString($bytes)
        $looks = $script:looksText | ConvertFrom-Json
        if ((Is-Object $looks) -and (Is-Object $looks.projects) -and (Is-Object $looks.chars) -and (Is-Object $looks.states)) { return $looks }
    }
    catch { }
    $null
}

# A project's icon name, like projectIcon in projectLook.ts: the extension has already matched the
# setting, so only the lowercase label is looked up (PowerShell properties ignore case anyway).
function Project-Icon($looks, [string]$label) {
    $default = 'folder'
    if (-not $looks) { return $default }
    if ($looks.default -is [string]) { $default = $looks.default }
    $entry = $looks.projects.PSObject.Properties[$label.ToLowerInvariant()]
    if ($entry -and $entry.Value -is [string]) { $entry.Value } else { $default }
}

# The character for an icon name, or $null when the font has none.
function Icon-Char($looks, $name) {
    if (-not $looks -or -not ($name -is [string])) { return $null }
    $entry = $looks.chars.PSObject.Properties[$name]
    if ($entry -and $entry.Value -is [string]) { $entry.Value } else { $null }
}

# A `done` of a project with a hand-set status (to-do #28) is parked: not your turn, so not counted
# as done or listed. Like parkedTest in sessionList.ts: the extension writes those projects' labels,
# lowercase; a looks file without them parks nothing.
function Is-Parked($looks, $status) {
    if ($status.state -cne 'done' -or -not $looks -or $null -eq $looks.parked) { return $false }
    @($looks.parked) -ccontains (Session-Label $status).ToLowerInvariant()
}

# One reading of the folder: counts of the live sessions, and the ones that need you (waiting first,
# then done, each A-Z by label).
function Read-Inbox {
    $processes = [System.Diagnostics.Process]::GetProcesses()
    $runningPids = New-Object 'System.Collections.Generic.HashSet[int]'
    foreach ($process in $processes) {
        [void]$runningPids.Add($process.Id)
        $process.Dispose()
    }
    $files = Read-JsonFiles $statusDir  # assigned first: piping the call would pass the list as one item
    $statuses = @($files | Where-Object { Is-Status $_ })
    $live = Read-LiveIds $sessionsDir $runningPids
    if ($null -ne $live) { $statuses = @($statuses | Where-Object { $live.ContainsKey($_.session_id) }) }
    $now = [double][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    foreach ($status in $statuses) { if (On-BackgroundTask $status $live $now) { $status.state = 'working' } }

    $looks = Read-Looks
    $counts = [ordered]@{ waiting = 0; done = 0; working = 0; parked = 0 }
    foreach ($status in $statuses) { if (Is-Parked $looks $status) { $counts.parked++ } else { $counts[$status.state]++ } }
    $needs = @($statuses | Where-Object { $_.state -ne 'working' -and -not (Is-Parked $looks $_) } | ForEach-Object {
            [pscustomobject]@{
                session_id  = $_.session_id
                state       = $_.state
                label       = Session-Label $_
                project_dir = Session-Folder $_
                icon        = Project-Icon $looks (Session-Label $_)
            }
        } | Sort-Object @{ Expression = { if ($_.state -eq 'waiting') { 0 } else { 1 } } }, label, session_id)
    [pscustomobject]@{ counts = $counts; needs = $needs; looks = $looks }
}

# The menu's state colours, the sidebar's (list.warningForeground, charts.green) at VS Code's Light
# or Dark theme values, matching the menu, which follows Windows' app mode.
$menuColors = @{
    light = @{ waiting = '#855F00'; done = '#388A34' }
    dark  = @{ waiting = '#CCA700'; done = '#89D185' }
}

# True when Windows is set to dark apps (Settings > Personalization > Colors); light when unknown.
function Test-DarkApps {
    try {
        $value = Get-ItemPropertyValue -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' -Name AppsUseLightTheme -ErrorAction Stop
        $value -eq 0
    }
    catch { $false }
}

# VS Code's icon font, loaded once per path; $null when it can't be loaded. The collection is kept
# too: its families are only valid while it lives.
$script:fontPath = $null
$script:fontCollection = $null
$script:fontFamily = $null
function Get-IconFont($looks) {
    $path = if ($looks -and $looks.font -is [string]) { $looks.font } else { '' }
    if ($path -ne $script:fontPath) {
        $script:fontPath = $path
        $script:fontFamily = $null
        if ($script:fontCollection) { $script:fontCollection.Dispose() }
        $script:fontCollection = $null
        if ($path -and (Test-Path -LiteralPath $path -PathType Leaf)) {
            try {
                $script:fontCollection = New-Object System.Drawing.Text.PrivateFontCollection
                $script:fontCollection.AddFontFile($path)
                $script:fontFamily = $script:fontCollection.Families[0]
            }
            catch { $script:fontFamily = $null }
        }
    }
    $script:fontFamily
}

# A row's picture, like the sidebar: the state's icon, then the project's, both in the state's
# colour; $size high, for a dark or light menu. $null when there is nothing to draw (no font, or no
# state icon in it).
function New-RowImage($session, $looks, [int]$size, [bool]$dark = $false) {
    $family = Get-IconFont $looks
    $stateChar = if ($looks) { Icon-Char $looks $looks.states.($session.state) } else { $null }
    if (-not $family -or -not $stateChar) { return $null }
    $projectChar = Icon-Char $looks $session.icon
    $gap = [int][Math]::Ceiling($size / 4)
    $bitmap = New-Object System.Drawing.Bitmap (2 * $size + $gap), $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    $font = New-Object System.Drawing.Font $family, $size, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($menuColors[$(if ($dark) { 'dark' } else { 'light' })][$session.state]))
    $format = [System.Drawing.StringFormat]::GenericTypographic
    $graphics.DrawString($stateChar, $font, $brush, 0, 0, $format)
    if ($projectChar) { $graphics.DrawString($projectChar, $font, $brush, ($size + $gap), 0, $format) }
    $format.Dispose()  # GenericTypographic hands out a new copy each time
    $brush.Dispose()
    $font.Dispose()
    $graphics.Dispose()
    $bitmap
}

if ($Once) {
    $inbox = Read-Inbox
    [pscustomobject]@{
        waiting  = $inbox.counts.waiting
        done     = $inbox.counts.done
        working  = $inbox.counts.working
        parked   = $inbox.counts.parked
        needsYou = $inbox.counts.waiting + $inbox.counts.done
        needs    = @($inbox.needs)
    } | ConvertTo-Json -Compress -Depth 4
    if ($RowImages) {
        Add-Type -AssemblyName System.Drawing
        $n = 0
        foreach ($session in $inbox.needs) {
            $image = New-RowImage $session $inbox.looks 16
            if ($image) {
                $image.Save((Join-Path $RowImages "$n.png"), [System.Drawing.Imaging.ImageFormat]::Png)
                $image.Dispose()
            }
            $n++
        }
    }
    exit 0
}

$mutexName = if ($env:SESSION_INBOX_TRAY_MUTEX) { $env:SESSION_INBOX_TRAY_MUTEX } else { 'Local\SessionInboxTray' }
# Named after the mutex, so a test's -Stop never closes the real tray. A -Stop before the tray has
# made the event does nothing (a tray still starting up, under a second).
$stopName = "$mutexName-stop"
if ($Stop) {
    $stopEvent = $null
    if ([System.Threading.EventWaitHandle]::TryOpenExisting($stopName, [ref]$stopEvent)) {
        [void]$stopEvent.Set()
        $stopEvent.Dispose()
    }
    exit 0
}

$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, $mutexName, [ref]$createdNew)
if (-not $createdNew) {
    # Another copy shows the icon: leave it, unless it was just told to stop (the setting turned off
    # and on again quickly). It notices on its next tick (2 s), so wait for it to let go.
    $owned = $false
    $quitting = $null
    if ([System.Threading.EventWaitHandle]::TryOpenExisting($stopName, [ref]$quitting) -and $quitting.WaitOne(0)) {
        try { $owned = $mutex.WaitOne(5000) } catch [System.Threading.AbandonedMutexException] { $owned = $true }
    }
    if ($quitting) { $quitting.Dispose() }
    if (-not $owned) { exit 0 }
}
$script:stopEvent = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::ManualReset, $stopName)
[void]$script:stopEvent.Reset()  # still set if this copy waited for a stopping one

# A handle to the VS Code that started the tray, held from the start so a PID that Windows reuses
# later can't keep the tray alive. Gone already: nothing to show for.
$script:vsCode = $null
if ($VsCodePid) {
    try {
        $script:vsCode = [System.Diagnostics.Process]::GetProcessById($VsCodePid)
        [void]$script:vsCode.Handle  # opens and keeps the handle; HasExited then asks that one
    }
    catch { exit 0 }
}

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -Namespace SessionInbox -Name Native -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
[DllImport("user32.dll")] public static extern bool DestroyIcon(System.IntPtr icon);
[DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(System.IntPtr window, int attribute, ref int value, int size);
'@
# The menu in dark mode, like Windows 11's own dark menus: dark grey, a thin light outline, white
# text. In light mode the menu keeps WinForms' own look.
Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @'
using System.Drawing;
using System.Windows.Forms;
namespace SessionInbox {
    public class DarkColors : ProfessionalColorTable {
        static readonly Color Back = Color.FromArgb(44, 44, 44);
        static readonly Color Hover = Color.FromArgb(61, 61, 61);
        static readonly Color Line = Color.FromArgb(80, 80, 80);
        public override Color ToolStripDropDownBackground { get { return Back; } }
        public override Color ImageMarginGradientBegin { get { return Back; } }
        public override Color ImageMarginGradientMiddle { get { return Back; } }
        public override Color ImageMarginGradientEnd { get { return Back; } }
        public override Color MenuBorder { get { return Line; } }
        public override Color MenuItemBorder { get { return Hover; } }
        public override Color MenuItemSelected { get { return Hover; } }
        public override Color MenuItemSelectedGradientBegin { get { return Hover; } }
        public override Color MenuItemSelectedGradientEnd { get { return Hover; } }
        public override Color MenuItemPressedGradientBegin { get { return Hover; } }
        public override Color MenuItemPressedGradientEnd { get { return Hover; } }
        public override Color SeparatorDark { get { return Line; } }
        public override Color SeparatorLight { get { return Back; } }
    }
    public class DarkRenderer : ToolStripProfessionalRenderer {
        public DarkRenderer() : base(new DarkColors()) { RoundedEdges = false; }
        // Drawn here: the base class takes the system highlight (blue) for a selected row.
        protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e) {
            if (!e.Item.Selected || !e.Item.Enabled) return;
            using (var brush = new SolidBrush(Color.FromArgb(61, 61, 61))) {
                e.Graphics.FillRectangle(brush, new Rectangle(2, 0, e.Item.Width - 4, e.Item.Height));
            }
        }
        protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e) {
            e.TextColor = e.Item.Enabled ? Color.FromArgb(240, 240, 240) : Color.FromArgb(150, 150, 150);
            base.OnRenderItemText(e);
        }
    }
}
'@
# Without this Windows reports a 16 px icon size on a scaled screen and stretches the picture, blurry.
[void][SessionInbox.Native]::SetProcessDPIAware()

# The sidebar's state colours, VS Code's Dark theme values (the taskbar is usually dark):
# list.warningForeground and charts.green.
$colors = @{
    waiting = [System.Drawing.Color]::FromArgb(204, 167, 0)    # yellow: a permission or question
    done    = [System.Drawing.Color]::FromArgb(137, 209, 133)  # green: only finished replies
    clear   = [System.Drawing.Color]::FromArgb(140, 140, 140)  # grey: nothing needs you
}

# A filled circle in the state's colour with the count in black ("9+" above 9; white on yellow is
# hard to read); grey and empty for none. The caller destroys the old icon's handle: Icon.FromHandle doesn't own it.
function New-CountIcon([int]$count, [System.Drawing.Color]$color) {
    $size = [System.Windows.Forms.SystemInformation]::SmallIconSize.Width
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $brush = New-Object System.Drawing.SolidBrush $color
    $graphics.FillEllipse($brush, 0, 0, $size - 1, $size - 1)
    if ($count -gt 0) {
        $text = if ($count -gt 9) { '9+' } else { [string]$count }
        $fontSize = if ($text.Length -gt 1) { $size * 0.45 } else { $size * 0.62 }
        $font = New-Object System.Drawing.Font 'Segoe UI', $fontSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
        $format = New-Object System.Drawing.StringFormat
        $format.Alignment = [System.Drawing.StringAlignment]::Center
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center
        $graphics.DrawString($text, $font, [System.Drawing.Brushes]::Black, (New-Object System.Drawing.RectangleF 0, 0, $size, $size), $format)
        $font.Dispose()
        $format.Dispose()
    }
    $brush.Dispose()
    $graphics.Dispose()
    $handle = $bitmap.GetHicon()
    $bitmap.Dispose()
    [System.Drawing.Icon]::FromHandle($handle)
}

# The hover text: at most 63 characters in .NET Framework, so the headline and as many projects as fit.
function Tooltip-Text($inbox) {
    $needsYou = $inbox.needs.Count
    if ($needsYou -eq 0) { return 'Session Inbox: all clear' }
    $headline = if ($needsYou -eq 1) { '1 session needs you' } else { "$needsYou sessions need you" }
    $text = "Session Inbox: $headline`n" + ((@($inbox.needs | ForEach-Object { $_.label }) | Select-Object -Unique) -join ', ')
    if ($text.Length -gt 63) { $text = $text.Substring(0, 60) + '...' }
    $text
}

# Asks the window that has the chat's folder open to show the chat's tab; the same file and format
# notify.ps1 writes. A failure must not keep the window from coming up.
function Write-RevealRequest($session) {
    $temp = $null
    try {
        if (-not (Test-Path -LiteralPath $statusDir)) { return }
        $json = @{
            session_id  = $session.session_id
            project_dir = $session.project_dir
            at          = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        } | ConvertTo-Json -Compress
        # Written under a temp name and renamed, so the extension never reads half a file; no BOM.
        $temp = Join-Path $statusDir ".reveal.$PID.tmp"
        [System.IO.File]::WriteAllText($temp, $json)
        Move-Item -LiteralPath $temp -Destination (Join-Path $statusDir '.reveal') -Force
    }
    catch { if ($temp) { Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue } }
}

# `code <folder>` focuses the window that has it open, or opens one, like the sidebar's click.
function Open-Session($session) {
    if (-not (Test-Path -LiteralPath $session.project_dir -PathType Container)) {
        $script:icon.ShowBalloonTip(5000, 'Session Inbox', "Folder not found: $($session.project_dir)", [System.Windows.Forms.ToolTipIcon]::Warning)
        return
    }
    Write-RevealRequest $session
    $code = Get-Command code.cmd -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $code) {
        $script:icon.ShowBalloonTip(5000, 'Session Inbox', "Can't open the window: VS Code's 'code' command isn't on PATH.", [System.Windows.Forms.ToolTipIcon]::Warning)
        return
    }
    # Forward slashes: a backslash before the closing quote (a drive root, D:\) would escape it.
    Start-Process -FilePath $code.Source -ArgumentList ('"' + ($session.project_dir -replace '\\', '/') + '"') -WindowStyle Hidden
}

$script:icon = New-Object System.Windows.Forms.NotifyIcon
$script:menu = New-Object System.Windows.Forms.ContextMenuStrip
$script:icon.ContextMenuStrip = $script:menu
$script:dark = $false
# Windows 11 rounds the menu's corners and gives it the system shadow; Windows 10 ignores the call.
$script:menu.add_Opened({
        $round = 2  # DWMWCP_ROUND
        [void][SessionInbox.Native]::DwmSetWindowAttribute($script:menu.Handle, 33, [ref]$round, 4)  # DWMWA_WINDOW_CORNER_PREFERENCE
    })
$script:shown = $null       # what the icon shows now, to redraw only on a change
$script:exited = $false
$script:iconHandle = [IntPtr]::Zero
$script:context = New-Object System.Windows.Forms.ApplicationContext

$exitTray = {
    if ($script:timer) { $script:timer.Stop() }
    $script:icon.Visible = $false
    $script:icon.Dispose()
    $script:exited = $true
    $script:context.ExitThread()
}

function Update-Menu($inbox) {
    foreach ($old in @($script:menu.Items)) { if ($old.Image) { $old.Image.Dispose() } }
    $script:menu.Items.Clear()
    $script:menu.Renderer = if ($script:dark) { New-Object SessionInbox.DarkRenderer } else { New-Object System.Windows.Forms.ToolStripProfessionalRenderer }
    $size = [System.Windows.Forms.SystemInformation]::SmallIconSize.Height
    if ($inbox.needs.Count -eq 0) {
        $item = $script:menu.Items.Add('Nothing needs you')
        $item.Enabled = $false
    }
    foreach ($session in $inbox.needs) {
        $what = if ($session.state -eq 'waiting') { 'waiting' } else { 'done, your turn' }
        # '&&': a single '&' would underline the next letter instead of showing.
        $item = $script:menu.Items.Add("$($session.label.Replace('&', '&&')) - $what")
        $item.Tag = $session
        $image = New-RowImage $session $inbox.looks $size $script:dark
        if ($image) {
            $item.Image = $image
            $item.ImageScaling = [System.Windows.Forms.ToolStripItemImageScaling]::None
        }
        if ($session.project_dir) { $item.add_Click({ param($clicked) Open-Session $clicked.Tag }) }
        else { $item.Enabled = $false }
    }
    [void]$script:menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    [void]$script:menu.Items.Add('Exit', $null, $exitTray)
}

$refresh = {
    try {
        if ($script:stopEvent.WaitOne(0) -or ($script:vsCode -and $script:vsCode.HasExited)) { & $exitTray; return }
        $inbox = Read-Inbox
        $key = ($inbox.needs | ForEach-Object { "$($_.session_id)|$($_.state)|$($_.label)|$($_.project_dir)|$($_.icon)" }) -join "`n"
        $script:dark = Test-DarkApps
        $key += "`n" + $script:looksText + "`n" + $script:dark
        if ($key -eq $script:shown) { return }
        $color = if ($inbox.counts.waiting -gt 0) { $colors.waiting } elseif ($inbox.needs.Count -gt 0) { $colors.done } else { $colors.clear }
        $newIcon = New-CountIcon $inbox.needs.Count $color
        $script:icon.Icon = $newIcon
        if ($script:iconHandle -ne [IntPtr]::Zero) { [void][SessionInbox.Native]::DestroyIcon($script:iconHandle) }
        $script:iconHandle = $newIcon.Handle
        $script:icon.Text = Tooltip-Text $inbox
        Update-Menu $inbox
        $script:shown = $key  # only once all of it is drawn, so a failure is retried on the next tick
    }
    catch { }  # a file changing mid-read: the next tick reads it again
}

# A left click opens the same menu as a right click. NotifyIcon has no public way to do that; this
# private method is what the right click uses.
$script:showMenu = [System.Windows.Forms.NotifyIcon].GetMethod('ShowContextMenu', [System.Reflection.BindingFlags]'Instance, NonPublic')
$script:icon.add_MouseUp({
        param($clicked, $e)
        if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left -and $script:showMenu) { [void]$script:showMenu.Invoke($script:icon, $null) }
    })

# The first reading before the icon shows, so it never flashes an empty picture; with its VS Code
# gone already it exits right away.
& $refresh
if (-not $script:exited) {
    $script:icon.Visible = $true
    $script:timer = New-Object System.Windows.Forms.Timer
    $script:timer.Interval = 2000
    $script:timer.add_Tick($refresh)
    $script:timer.Start()
    [System.Windows.Forms.Application]::Run($script:context)
}

if ($script:iconHandle -ne [IntPtr]::Zero) { [void][SessionInbox.Native]::DestroyIcon($script:iconHandle) }
$script:stopEvent.Dispose()
$mutex.ReleaseMutex()
$mutex.Dispose()
