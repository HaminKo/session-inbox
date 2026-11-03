# Research: Claude Code hooks and session status

What the hooks need to do, which events actually fire in the VS Code extension, and how to verify
the status-writer without a live session. Update in place; mark wrong findings wrong rather than
deleting them.

## Which events fire in the VS Code extension

- **`Notification` does NOT fire in the VS Code extension.** Source: the author's own
  `~/.claude/hooks/notify.ps1`, lines 12-13, measured 2026-10-31 — no `Notification` event in 4
  minutes of idle chats, while `Stop` fired after every reply. Consequence: the "waiting on you"
  state is driven by `PermissionRequest`, not `Notification`. (Measured on this machine's setup; if
  a future Claude Code version starts firing `Notification`, revisit.)
- **`PermissionRequest`** fires on a permission prompt. It also fires for Claude's questions
  (`AskUserQuestion`) — source: the comment in `notify.ps1`'s `PermissionRequest` branch, measured 2026-10-31. For `AskUserQuestion`
  the first question is at `tool_input.questions[0].question`; otherwise `tool_name` is the tool
  needing permission.
- **`Stop`** fires when a reply finishes. Payload has `last_assistant_message`.
- **`UserPromptSubmit`**, **`PostToolUse`**, **`SessionEnd`** — wired by to-do #1 (2026-11-01).
  `UserPromptSubmit` and `PostToolUse` are the `working` signal; `SessionEnd` deletes the status
  file. `PostToolUse` carries `tool_name`; `UserPromptSubmit` and `SessionEnd` do not. Observed live
  in the VS Code extension:
  - `PostToolUse` fires: the building session's own status file was rewritten after each tool call.
  - `SessionEnd` fires when a chat tab is closed: its status file was deleted (user test,
    2026-11-01). Reopening the closed tab fires none of these hooks, so the row stays gone until
    the chat's next prompt or tool call writes it again (expected from the wiring). Intended: a chat
    you just reopened is in front of you. Showing it on reopen would need a `SessionStart` hook.
  - `UserPromptSubmit`: not yet seen on its own (the turn's first `PostToolUse` overwrites its write
    within seconds); the fake-payload test passes.

  (Corrected: an earlier version of this entry said all three were confirmed live; at that point
  only `PostToolUse` was.)

## Hook payload fields (stdin JSON)

Confirmed in use by `notify.ps1`: `cwd`, `hook_event_name`, `last_assistant_message` (Stop),
`tool_name` and `tool_input` (PermissionRequest), `message` (fallback).

Confirmed while building to-do #1 (2026-11-01):
- **`session_id`** is present and is the session UUID — it was the filename for this session's own
  live status file while the hook ran, so the `<session_id>.json` naming works. (`transcript_path`
  not needed yet, so not verified.)
- **`tool_name`** is present on `PermissionRequest` and `PostToolUse`, and is `null`/absent on
  `Stop`, `UserPromptSubmit` and `SessionEnd`.
- For `AskUserQuestion`, the first question is at `tool_input.questions[0].question` (as in
  `notify.ps1`).

## Worktree detection (no git process needed)

A linked git worktree's `.git` is a **file** (containing `gitdir: ...`); a main working tree's
`.git` is a **directory**. So the hook can decide cheaply:

```powershell
$isWorktree = Test-Path -PathType Leaf (Join-Path $cwd '.git')
```

This avoids launching `git` on every `PostToolUse`. The worktree's name can be the leaf of `$cwd`.
(If a folder is not a git repo at all, `.git` is absent and `$isWorktree` is `$false`.)

## Status file

Path: `~/.claude/session-status/<session_id>.json`. Suggested fields: `session_id`, `cwd`,
`project_dir` (the chat's start folder from `Project-Dir`, maybe with forward slashes; since to-do
#6, the folder a sidebar click opens; older files lack it), `folder`, `worktree`, `worktree_name`, `state` (`waiting`/`working`/`done`), `message`,
`tool_name`, `timestamp` (ISO-8601: when this state began for `waiting` and `done`, which fire once;
for `working` it is refreshed on every tool call, so it means "last activity" there; the sidebar
shows an age only for `waiting` and `done`, and "last activity" in the `working` tooltip). `message`
for `done` is the reply's first line only (at most 140 characters, Markdown removed by `Plain-Line`,
a word-for-word copy of the one in `notify.ps1`); the `notify.ps1` popup shows more of the reply
(since 2026-11-01, see docs/decisions.md).

Written UTF-8 without a BOM, to `<session_id>.json.<pid>.tmp` first and then swapped in with
`File.Replace` (or `File.Move` for a new file), so a reader never sees a half-written file.
`Move-Item -Force` was not used: it can delete the target before moving, leaving a moment with no
file at all.

Dead end (measured 2026-11-01): `[System.IO.File]::Replace($tmp, $file, $null)` fails in Windows
PowerShell 5.1 with "The path is not of a legal form", because PowerShell passes `$null` to a .NET
`string` parameter as `""`. Every update to an existing status file failed, so each session stayed
frozen at its first state, and the `catch` hid it. Fix: pass `[NullString]::Value`. Tests must
cover updating an existing file, not only creating new ones.

Keep the writer tiny and WinForms-free — it runs on every `PostToolUse`. The heavy popup work
stays in `notify.ps1`, which this project changes only when the user asks (see docs/decisions.md).

**Measured cost (2026-11-01):** running `session-status.ps1` synchronously costs ~**374 ms**
wall-clock per call (5-run average; measured, not estimated). This is almost entirely
`powershell.exe` 5.1 startup, not the script body. It is wired synchronously on purpose, so events
stay ordered and a late `working` write can't overwrite `done`. If that per-tool-call latency turns
out to be noticeable in real use, options are: throttle `PostToolUse` writes (e.g. skip if the file
was touched < N seconds ago), drop the `PostToolUse` hook entirely (relying on `UserPromptSubmit`
for `working`), or move the writer to a faster runtime. Left unthrottled: the user chose "measure
first, throttle only if noticeable", and noticed no slowdown in the live test (2026-11-01).

**Reader (extension, to-do #4):** `extension/src/statusFolder.ts` reads every `*.json` in the
folder and skips files that don't parse or have no valid `session_id`/`state`, so `.tmp` files and
a file deleted mid-read are harmless. It watches with `fs.watch` (debounced ~100 ms) and waits for
the folder to appear if it doesn't exist yet. `SESSION_INBOX_STATUS_DIR` overrides the folder (tests
only). Since to-do #5 step A, `extension/src/sessionSource.ts` runs the reads, watchers and 30 s
timer once and feeds every view (status bar, later the sidebar).

**Leftover files (user test, 2026-11-01):** status files outlive some closed chats. Two `done`
files (PeacefreeWeb 15:50, sc-map-library 16:30) were still in the folder at 18:14, and the user
confirmed both chat tabs were closed. How they were closed (tab, whole window, VS Code quit) was not
recorded. Closing a single tab is known to delete the file (see above), so the likely gap is a
window close or VS Code quit that never fires `SessionEnd`; not measured yet. Effect: the status bar
counts them as waiting forever, until the file is deleted by hand.

**Is the chat still running? (to-do #10 research, 2026-11-01, measured on Claude Code 2.1.314)**
- Each chat in the VS Code extension is its own `claude.exe` process (the extension's
  `resources/native-binary/claude.exe`, child of a `Code.exe` extension host). Hooks run as
  `claude.exe -> bash.exe -> bash.exe -> powershell.exe` (seen with `notify.ps1` mid-run).
- Claude Code keeps **`~/.claude/sessions/<pid>.json`** per running process:
  `{"pid", "sessionId", "cwd", "startedAt", "procStart", "version", "kind": "interactive",
  "entrypoint": "claude-vscode", "status": "idle", "updatedAt", ...}`. Undocumented, internal
  format. At 18:30 there were 11 such files, each with a live PID, and they matched the 11 status
  files one to one. No stale `<pid>.json` was left from earlier chats that day (including chats
  open before a VS Code restart at 15:41), so Claude removes or cleans them up; whether a killed
  process leaves one behind is not measured.
- Only resumed chats show the session on the command line (`--resume=<first 8 chars>`); new chats
  don't, so the command line can't map every chat.
- One of the two leftovers from the user test (`5dcc3012`, sc-map-library, `done` 16:30) still had
  a live process (PID 38336, started 16:29, `status: "idle"`) at 18:30. So at least that leftover
  is not explained by a process that died without `SessionEnd`. Asked, the user thought the tab
  was probably still open (the chat shows only idle time, no clock time), so it was most likely a
  real open chat, not a leftover. Not settled: whether some way of closing a tab leaves the
  process running.
- **Used by the extension (to-do #10):** a status file counts only if its `session_id` is the
  `sessionId` of a `<pid>.json` whose PID is running. Folder missing or empty, or any file
  unreadable or without a valid `pid`/`sessionId` -> nothing hidden (code review: an empty folder
  first meant "no chat running", which would hide every chat if Claude stopped writing there). First real run (18:40): 11 status files, 12 live sessions,
  nothing hidden. `SESSION_INBOX_SESSIONS_DIR` overrides the folder (tests only).
- `/clear` (raised by the code review): user test 2026-11-01 18:45, after a `/clear` and a new
  prompt in an open chat, every status file (11) still matched a `<pid>.json` sessionId, so no live
  chat was hidden. Both new session ids there had a freshly started process (18:42, 18:43), so
  whether `/clear` rewrites `sessionId` in place or starts a new process was not told apart; either
  way the match held.
- Window close (same user test): after the user closed a whole window with finished chats, the
  count in the Extension Development Host dropped. Both chats of the falconpaladin window
  (`6f8066d5`, `2cd4efc7`) were gone afterwards, as status files and as processes; the status files
  were deleted, so `SessionEnd` likely fired on that window close (which window was closed was not
  recorded).
- Not measured: which close paths (close window, quit VS Code) fire `SessionEnd`. With the process
  check it no longer matters for the count, only for whether the file is deleted or just hidden.
- `<pid>.json` fields (to-do #14, 2026-11-02, Claude Code 2.1.314, measured): `cwd` is the chat's
  start folder and stays so when the shell moves into a subfolder (a chat's shell in `extension/`,
  its file still said the repo root; the file isn't rewritten on `cd`). `startedAt` is Unix ms.
  `status` is `"idle"` or `"busy"` (a chat mid-reply showed `busy`); other values not seen. After a
  VS Code restart the restored chats get new processes (7 of 9 started within ~2 min of the
  reopen) but no status file, because no hook fires until their next prompt; there is no
  `SessionStart` in the writer, so a brand-new tab has no status file either.
- Not every restored tab gets a process (2026-11-02, after a second VS Code restart, measured): 6
  live `<pid>.json`, all started 08:56, one per window/folder, while the user had 4 Claude tabs
  open for session-inbox alone (3 session-inbox processes and 2 sc-map-library before the
  restart). So the other tabs have no process and no `<pid>.json`, and the inbox can't list them.
  Confirmed by the user the same day: clicking each of the other restored tabs (no prompt sent)
  added one "Open" row per tab, so Claude Code starts only the visible tab's chat per window and a
  tab's process starts when it is shown. Listing dormant tabs would need VS Code's per-window
  `window.tabGroups` (title only, no session id), published to a shared file by each window: not
  built, see docs/todo.md Later.

## Verifying without a live session

Pipe a fake payload into the writer and check the file it writes (works, 2026-11-01). Always send a
second event for the same `session_id` too: updating an existing file is a separate code path (see
the dead end above). Delete the test file afterwards:

```powershell
$hook = "$env:USERPROFILE/.claude/hooks/session-status.ps1"
'{"session_id":"test123","cwd":"C:/tmp/demo","hook_event_name":"PermissionRequest","tool_name":"Bash"}' |
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File $hook
Get-Content "$env:USERPROFILE/.claude/session-status/test123.json"   # state: waiting
'{"session_id":"test123","cwd":"C:/tmp/demo","hook_event_name":"Stop","last_assistant_message":"Done."}' |
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File $hook
Get-Content "$env:USERPROFILE/.claude/session-status/test123.json"   # state: done
Remove-Item "$env:USERPROFILE/.claude/session-status/test123.json"
```

## Editing files in `~/.claude/hooks/` (reset incident, 2026-11-01)

Measured: `notify.ps1`, changed in place with Claude's Edit tool, was put back to its exact original
(same bytes, and the original timestamp 01:37:14) within 80 seconds after a turn ended, while the
user reverted nothing. In that window no other Claude session wrote the file (their transcripts show
no write), and every other file edited in the same turns stayed changed. Claude Code's file history
held that exact original as this session's snapshot, and a copy back from it keeps the timestamp.
VS Code also kept reporting diagnostics for the original text after the edits.
Likely cause (not confirmed): the VS Code extension restored that one file, which is outside the open
workspace, from the session's checkpoint.
What to do: build a hook change in a separate file and install it with a shell copy (`Copy-Item`),
keep backups in `~/.claude/hooks/backups/`, and afterwards compare the installed file's hash with
the backup. (The reinstalled version, written this way, is the test of this theory.)

## Popup click refused by Windows (focus fallback, 2026-11-01)

Symptom: clicking a `notify.ps1` popup sometimes leaves the VS Code window behind; the log says
`[clicked: Windows refused the focus change]`. 22 of 203 clicks in `notify.log` (2026-10-31 to
2026-11-01, counted), in runs; seen in sc-map-library and PeacefreeWeb at 14:45, 14:53, 15:10, 15:22.

Candidate causes, and what tested them:
1. The popup is `WS_EX_NOACTIVATE`, so the click may not count as the "last input" for the
   foreground-lock rule. Not tested directly (needs a real click on a refused run); unknown.
2. The empty `SendInput` retry is ignored. **Confirmed.** The log has 0 "after an empty input"
   lines, though the retry existed from the 01:37 version on (7+ refusals since). Live test (below):
   after the empty input, `SetForegroundWindow` returned **true** while Brood War stayed in front.
   So its return value can't be trusted; the hook now checks `GetForegroundWindow()`.
   (Corrects the 2026-11-01 note in `notify.ps1` that the empty input fixed a refused test window.)
3. An elevated window in front (UIPI blocks `SendInput`). Not tested; unlikely, since at 15:22 the
   front window was probably another VS Code window.

Live test (measured 2026-11-01, Brood War in front): one background PowerShell shows a test window
without activating it; a second one (no user input) tries to bring it to front, one method per run:

| Method | Returned | In front after |
|---|---|---|
| plain `SetForegroundWindow` | false | Brood War |
| empty input + retry | true | Brood War |
| Alt tap (`keybd_event(VK_MENU)`) + retry | true | test window |
| `AttachThreadInput` to the front thread + retry | true | test window |
| plain again (control) | true | test window |

The last control passing means the runs affected each other (once one background change got
through, Windows let the next one through too), so "AttachThreadInput alone works" is not proven:
only the Alt tap ran from a clearly refused state. One run each; not repeated, to keep from
pulling the user's game out of focus again.

Fix in `notify.ps1` `BringToFront` (backup before: `~/.claude/hooks/backups/notify.ps1.before-focus-fallback-2026-11-01`;
after: `notify.ps1.focus-fallback-2026-11-01`). Each attempt checks the real foreground (up to
200 ms); the log names the one that worked:
1. `SetForegroundWindow` → `window brought to front`
2. empty input + retry → `... after an empty input` (kept, to see if it ever helps)
3. `AttachThreadInput` to the front window's thread, `SetForegroundWindow` + `BringWindowToTop`,
   detach → `... after attaching to the front window's thread`
4. Alt tap + retry → `... after an Alt tap`. Last because a lone Alt can open the old window's menu
   bar (VS Code) or reach a game.
5. otherwise `Windows refused the focus change`.

The popup itself is unchanged (still `WS_EX_NOACTIVATE`, never takes focus). Open: watch the log for
which line replaces "refused"; if refusals remain, test cause 1 (focus on `MouseUp` instead of
`MouseDown`) or 3.

**Follow-up (2026-11-01, later the same day):** the fallbacks did not save every click. Installed
15:29:41 (hash checked, not reset); of the next 4 clicks on real windows, 3 worked on the first try
and 1 was refused after all four attempts (15:35:19, session-inbox). The user believes another VS
Code window was in front (from memory, not logged).
- Not reproducible on demand: a background process calling the installed `BringToFront` brought
  claude-practice in front of Brood War, and then session-inbox in front of claude-practice, both on
  the **first** attempt (measured). So the lock depends on state not yet known; the earlier
  test's plain refusal was not a permanent condition.
- A wrong-window match was checked: only one visible window matches session-inbox, and the
  Extension Development Host's title (`[Extension Development Host] Welcome - Visual Studio Code`)
  has no folder name. Unlikely, though the windows at 15:35 can't be checked now.
- `ForegroundLockTimeout` in `HKCU:\Control Panel\Desktop` is 1,911,550,888 ms (~22 days; Windows'
  default is 200,000), so on this PC the lock never expires by itself. Left alone: it's a
  system-wide setting.
- Next step taken: a refusal's log line now says what was in front and what each fallback did, e.g.
  `[clicked: Windows refused the focus change; in front: "..." (Code, not admin); attach: attached,
  still refused; Alt tap: refused]`. The front window is read before the fallbacks run. The admin
  check (`TokenElevation`, or "token not readable") was only tried on a non-admin window (Brood War
  → "StarCraft, not admin"). Backup of this version: `notify.ps1.refusal-log-2026-11-01`.

**Found: Start/Search in front (2026-11-01, measured).** The first refusal with the new log line
(15:53:21) said `in front: "Search" (SearchHost, not admin); attach: failed; Alt tap: refused`.
User test: opening Start with the Windows key and then clicking a test popup was refused 2 of 2
times, same line. The popup never takes focus, so a click on it doesn't close Start; while
Start/Search is in front, Windows refuses every attempt (plain, empty input, attach, Alt).
Likely the cause of other refusals too, e.g. the Windows key pressed to leave a full-screen game,
or the 15:35 one remembered as "VS Code in front"; not provable for those, they weren't logged.
- Test of the fix (user ran it once): with Search in front, an Escape key press closed it (VS Code
  was in front 300 ms later), and then `BringToFront` worked on the plain first attempt.
- Fix: `BringToFront` first checks the front window's process; if it is `SearchHost` or
  `StartMenuExperienceHost`, it presses Escape (only then, since the key goes to the front window)
  and waits up to 300 ms for it to close. The log line then starts with
  `Start/Search closed with Escape, then ...`. Backup: `notify.ps1.close-start-2026-11-01`.
- Real popup click with Start open after this install: passed once (user test, 16:00:31, log
  `[clicked: Start/Search closed with Escape, then window brought to front] claude-howto`).
  Two earlier tries logged "no VS Code window found": the target window had been closed, so they
  never reached the new check.

## Popup named after a subfolder: `cwd` follows the shell (2026-11-01, measured)

Symptom: a click logged `[clicked: no VS Code window found] extension`; the popup said
"Claude: extension" for a session-inbox chat. Cause, confirmed: the payload's `cwd` is the chat's
current shell folder, not where it started. That chat's transcript has `cwd` = `...\extension` on
282 of 364 lines (after a `cd extension` for npm), while its `~/.claude/sessions/<pid>.json` still
says `cwd` = the repo root. `notify.ps1` names the popup `Split-Path -Leaf $data.cwd`, and the
window match needs that name as a whole title part, so "extension" matches no window. The same
name drives the focus check, one-popup-per-project and the auto-close, so all of those miss too.
`session-status.ps1` has the same `Split-Path -Leaf $cwd` (sidebar would show "extension").

Fix (installed 21:11, hashes checked): both hooks use `Project-Dir` (docs/decisions.md):
`$env:CLAUDE_PROJECT_DIR`, else the matching `~/.claude/sessions/*.json` `cwd`, else payload `cwd`.
- Measured: `CLAUDE_PROJECT_DIR` is set for hooks in the VS Code extension, as
  `c:/Users/.../session-inbox` (forward slashes, lowercase drive). After the chat's PowerShell moved
  into `extension/`, the payload `cwd` was `...\extension` and `CLAUDE_PROJECT_DIR` still the root.
  (The Bash tool resets its folder before the hook runs, so it never showed the subfolder.)
- Fake payloads on copies writing to a temp folder: session-file fallback → "session-inbox"; env set →
  its leaf; unknown session → payload `cwd` leaf. `notify.ps1` copy: `[Stop] session-inbox`.
- Status writer time, 3 runs each, old vs new: 404-499 ms vs 413-462 ms (no difference).
- Real popup click, passed once (user test, 21:16-21:17): this chat's PowerShell in `extension/`,
  log `[Stop] session-inbox`, then `[clicked: window brought to front] session-inbox`.

## Sidebar click opens the project's window (to-do #6, 2026-11-01)

- The status file gained `project_dir`; a fake payload with `CLAUDE_PROJECT_DIR=C:/demo/proj` and
  `cwd` `C:\demo\proj\sub` wrote `"project_dir":"C:/demo/proj"` (measured). Note: the hook always
  writes to the real `~/.claude/session-status/`; `SESSION_INBOX_STATUS_DIR` is read only by the
  extension, so delete the test file afterwards.
- The extension runs `vscode.openFolder` with `forceNewWindow: true`. GUI test (VS Code 1.144,
  measured): a folder no window has opens a second window; clicking a row for a folder that is
  already open (the other window's or the clicking window's own) adds no window. Whether the OS
  actually raises the other window is for the user test (Playwright's clicks are not OS input).

## Popup click shows the chat's own tab: the `.reveal` file (to-do #9, 2026-11-01)

- On a popup click, `notify.ps1` (`Write-RevealRequest`, before `BringToFront`) writes
  `~/.claude/session-status/.reveal`: `{"session_id":"…","project_dir":"…","at":<ms since 1970>}`,
  UTF-8 without BOM, under a temp name then renamed. Only if that folder exists; any failure is
  swallowed so the window still comes up. Not `*.json`, so status readers skip it.
- Every window's Session Inbox watches the folder; the window with `project_dir` among its workspace
  folders (case and slash direction ignored) runs Claude Code's `claude-vscode.primaryEditor.open`
  with the id, if `at` is at most 15 s old. A sidebar click on another window's chat writes the same
  file. Why a file and not a URI: docs/research/claude-tabs.md.
- Measured: the PowerShell writer, run against a temp `USERPROFILE`, wrote
  `{"project_dir":"c:/Projects/demo","session_id":"abc-123","at":1793589147470}`, first bytes
  `{"p` (no BOM), no temp file left. GUI test (stand-in Claude Code in `test/gui/fake-claude`): a
  request for the window's folder is shown, one for another folder ignored. User test with the real
  Claude Code 2.1.314 (2026-11-01, extension installed from the `.vsix`): passed; the click showed the
  chat's own tab.

## Re-notify: a reminder through `notify.ps1` (to-do #7, 2026-11-01)

- `extension/src/renotify.ts`: a `waiting` chat past `sessionInbox.renotifyMinutes` (default 10,
  `0` = off), counted from its status `timestamp`, gets one reminder per wait (session id +
  timestamp; a new permission prompt is a new wait). Checked on every status read, so also on the
  30 s re-read. Only the window that has the chat's `project_dir` open sends it. Kept in memory, so
  a reload reminds a chat already past the threshold once more. While that window has focus the
  reminder is held back, not spent (`notify.ps1` would skip it as "window in focus"); it goes out
  on the first read after you leave the window. The GUI test can't take focus from its window
  (`blur()`, `minimize()` and a faked DOM blur with `document.hasFocus` overridden all failed,
  2026-11-01), so `SESSION_INBOX_IGNORE_FOCUS` turns the hold off there.
- Known gap (code review): a prompt cancelled with Esc may leave the status `waiting` (not
  measured which events fire then); such a chat would get a reminder for a prompt that's gone.
- Payload on stdin, `CLAUDE_PROJECT_DIR` set to the project folder:
  `{"hook_event_name":"SessionInboxReminder","session_id":"…","cwd":"<project_dir>","message":"Still waiting (12 min): Needs permission to use Bash"}`.
  `notify.ps1` (unchanged) sends an unknown event to its `default` branch, which shows `message`
  and `notify-images/default.png`; it still skips the popup when the project's window has focus,
  closes an older popup for the same folder, and honours `notify.off`.
- Started as `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <notify.ps1>` with
  `windowsHide`. Measured 2026-11-01 (Node 26 spawning PowerShell 5.1): with `detached: true` the
  script never runs at all, whether stdin is a pipe or a file (dead end). Without it, the script
  gets the payload, and the real popup showed with `windowsHide` (logged `[SessionInboxReminder]`,
  then clicked). Not settled: a child started from this tool's shell died when its Node parent
  exited, but that shell may kill whole process trees, so whether a reminder popup survives a window
  close or reload is a user-test item.
- `SESSION_INBOX_NOTIFY_SCRIPT` overrides the script path (tests only; the GUI tests default it to
  a missing file, so no test shows a real popup).

## Character picture in the popup (to-do #11, 2026-11-01)

`notify.ps1` shows `~/.claude/hooks/notify-images/<event>.png` (`Stop.png`, `PermissionRequest.png`),
else `default.png` there, left of the text; with neither the popup is text only and 420 px wide,
as before. With a picture it is 524 px wide (the text keeps its width and line count). The picture
is 96 px wide and as tall as its shape: taller than the popup, it is top-aligned and the popup cuts
off the bottom; shorter, it is bottom-aligned. (First version: a 96 px square, bottom-aligned,
shrunk to fit because at 125/150/200% the smallest popup is 1-2 px under `px(96)`, rounded parts,
142 px at 150%, measured; replaced by the taller cut the same day.) Loaded once from bytes (the
file isn't locked), shared by all monitors, disposed after the popups close; a broken file is logged
as `[picture not loaded: ...]` and the popup shows without it.
- `default.png` is cut from the user's `orange-tsundere.png` (832×1216, 1.3 MB): source square
  x 120–720, y 30–630 (head and a bit of neck), saved at 192×192 so it stays sharp up to 200%
  scaling; 91 KB (measured). Tighter (face only) filled the frame with hair; looser made the face small.
  Mirrored (user's choice after the first test): in the original her head turns away from the text.
  Then taller (user's follow-up): source x 120–720, y 30–855, saved at 192×264 (96×132, the 4-line
  popup), 125 KB. Measured render: fills 524×132 at 100% and 786×194 at 150% (picture 198 px, the
  bottom 4 px cut off); 2-line popups show the same head-and-shoulders view as the square did.
- Measured, live run of three fake payloads (21:23): popups 524×96 with the picture and 420×96
  without at 100%; 786×142 and 630×142 at 150%; no errors. Two popups started in the same instant
  landed on one spot (the known limitation in the code, not new).
- Testing tips: a form never shown draws only its background with `DrawToBitmap`; show it
  off-screen first (it never takes focus). `Start-Process -WindowStyle Hidden` still showed the
  popups. To screenshot real popups, call `SetProcessDPIAware` first and use the popup's
  `GetWindowRect`: a DPI-unaware shell gets scaled screen coordinates.
- Not built: a "talking" GIF (needs 2–3 frames of art that don't exist yet; WinForms would play
  a GIF in the same `PictureBox` with no code change, but holding it on one frame would need code).

## Stacked popups fall down (to-do #13, 2026-11-02)

On each 500 ms tick, `ClaudePopup.Fall()` moves a popup down to 8 px (`px(8)`) above the nearest
other folder's popup below it in its column (horizontal overlap, higher `Top`), or to the corner.
It never moves up, and it skips the tick while the cursor is inside any popup's `GetWindowRect`
or inside the span from its own top to the bottom of the spot it would fall to (the process is
per-monitor DPI aware, so `Cursor.Position` uses the same pixels). A newer notification of the same
folder closes the older popups only after its own show, so it takes their slot. Why gravity and
not "lowest free spot": docs/decisions.md.
- Measured, live run of fake `Stop` payloads for folders `fall-a`..`fall-d` (scratch script:
  `GetWindowRect` of each popup, `WM_CLOSE` to one folder's popups, `SetCursorPos` for the guard),
  two monitors at 100% (popups 524×96) and 150% (786×142):
  - `a b c`, close `b`: `c` dropped 104 px at 100% and 154 px at 150% (height + gap), to just
    above `a`, within 1.5 s.
  - Cursor over `a`, close the middle one: the top one stayed; it dropped within 1 s of the cursor
    moving away.
  - `a b c d`, close `b`: `c` and `d` each ended one slot lower, no overlap, within 2 s.
  - After the review fixes: `a c d` stacked, `c` notified again: the new `c` showed in the old
    one's slot, `d` stayed. Cursor in the gap of a closed popup: the one above stayed (logged by a
    debug copy of the script: the guard held while the cursor was in the gap, and the popup fell on
    the next tick after the real mouse moved away).
  - No errors in `notify.log`.
- Testing tips: the real mouse moving during a run moves the cursor the test set, so a guard case
  can look failed; log `Cursor.Position` from a scratch copy of the script to tell. A scratch copy
  whose C# doesn't compile still reaches `Application.Run` with no window and never exits (stop it
  by hand); compile-check the type alone first.

## Install Hooks command (to-do #15, 2026-11-02)
- The build (`npm run bundle`) copies `hooks/session-status.ps1` to `extension/dist/`, which the
  `.vsix` includes (`.vscodeignore`); the extension reads it from `<extensionPath>/dist/`.
- `extension/src/installHooks.ts` does the check and the install; `SESSION_INBOX_CLAUDE_DIR` points it
  at a stand-in `~/.claude/` (unit tests, and every GUI test window, which gets one with the hooks
  installed so it shows no warning).
- Measured: install into a temp `.claude` folder, then the payload test above run against the
  installed copy with `USERPROFILE` set to that temp folder: `waiting`, then `done`.
- The command's message says chats already running may need a restart for new `settings.json`
  entries (estimated, not measured: Claude Code reads hooks when a chat starts). A replaced hook
  file takes effect at once, since every event starts the script anew.

## Sources
- `~/.claude/hooks/notify.ps1` (author's existing hook; comments carry dated measurements).
- Claude Code hooks reference: https://docs.claude.com/en/docs/claude-code/hooks
