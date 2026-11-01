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
  (`AskUserQuestion`) — source: `notify.ps1` line 47, measured 2026-10-31. For `AskUserQuestion`
  the first question is at `tool_input.questions[0].question`; otherwise `tool_name` is the tool
  needing permission.
- **`Stop`** fires when a reply finishes. Payload has `last_assistant_message`.
- **`UserPromptSubmit`**, **`PostToolUse`**, **`SessionEnd`** — used for working/cleanup. Confirmed
  while building to-do #1 (`session-status.ps1`, 2026-11-01): all three fire in the VS Code
  extension. `UserPromptSubmit` and `PostToolUse` are the `working` signal; `SessionEnd` is where the
  status file is deleted. `PostToolUse` carries `tool_name`; `UserPromptSubmit` and `SessionEnd` do
  not. (`SessionEnd` was wired but not yet observed on a live session end — verify in the live test.)

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
for `working` it is refreshed on every tool call, so it means "last activity" there).

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
for `working`), or move the writer to a faster runtime. Left unthrottled for now pending the live
test — the user chose "measure first, throttle only if noticeable".

## Verifying without a live session

Pipe a fake payload into the writer and check the file it writes. Example to confirm when built:

```powershell
'{"session_id":"test123","cwd":"C:/tmp/demo","hook_event_name":"PermissionRequest","tool_name":"Bash"}' |
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE/.claude/hooks/session-status.ps1"
Get-Content "$env:USERPROFILE/.claude/session-status/test123.json"
```

## Sources
- `~/.claude/hooks/notify.ps1` (author's existing hook; comments carry dated measurements).
- Claude Code hooks reference: https://docs.claude.com/en/docs/claude-code/hooks
