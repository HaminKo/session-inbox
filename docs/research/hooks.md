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
`folder`, `worktree`, `worktree_name`, `state` (`waiting`/`working`/`done`), `message`,
`tool_name`, `timestamp` (ISO-8601: when this state began for `waiting` and `done`, which fire once;
for `working` it is refreshed on every tool call, so it means "last activity" there). `message`
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
stays in `notify.ps1`, which this project does not touch.

**Measured cost (2026-11-01):** running `session-status.ps1` synchronously costs ~**374 ms**
wall-clock per call (5-run average; measured, not estimated). This is almost entirely
`powershell.exe` 5.1 startup, not the script body. It is wired synchronously on purpose, so events
stay ordered and a late `working` write can't overwrite `done`. If that per-tool-call latency turns
out to be noticeable in real use, options are: throttle `PostToolUse` writes (e.g. skip if the file
was touched < N seconds ago), drop the `PostToolUse` hook entirely (relying on `UserPromptSubmit`
for `working`), or move the writer to a faster runtime. Left unthrottled: the user chose "measure
first, throttle only if noticeable", and noticed no slowdown in the live test (2026-11-01).

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

## Sources
- `~/.claude/hooks/notify.ps1` (author's existing hook; comments carry dated measurements).
- Claude Code hooks reference: https://docs.claude.com/en/docs/claude-code/hooks
