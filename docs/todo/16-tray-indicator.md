# To do 16 — Standalone tray indicator (medium)

Goal in the user's words: "Move standalone tray indicator to a todo" (from "Later, only if the
user asks": a small system-tray process reading the same `session-status/` folder, for a
glanceable waiting count when no VS Code window is focused).

## Problem / Goal
The count of sessions that need you lives in VS Code (status bar, sidebar). When another app has
the screen, the only signal is a `notify.ps1` popup, which goes away. A tray icon next to the clock
would show the count all the time, with or without a VS Code window in front.

Example: three chats, one waiting on a permission and one finished. You are in a browser. The tray
icon shows a yellow badge "2"; hovering it lists the two projects; clicking one opens that project's
VS Code window. With nothing to do it shows a plain icon and "all clear".

Scope (docs/decisions.md 2026-11-01): a small indicator, not a full app. No settings window, no
history, no second copy of the sidebar.

## Read first
- docs/decisions.md: 2026-11-01 "A standalone app is 'Later', and only a lightweight tray
  indicator"; the liveness rule (a status file counts only while `~/.claude/sessions/<pid>.json`
  exists; nothing is hidden if that folder is missing, empty or unreadable); the three states and
  what the inbox counts (`waiting` + `done`).
- `extension/src/statusFolder.ts`: `statusDir()`, `readStatuses()`, `sessionsDir()`,
  `readLiveSessions()`, `onlyLive()`, `countStates()`, `summarize()`, `watchFolder()` — the logic
  the tray must match.
- `extension/src/reveal.ts` and the `.reveal` hand-off: how a click shows the chat's own tab.
- `~/.claude/hooks/notify.ps1`: existing PowerShell + WinForms code (popups, window focus) to
  borrow patterns from. Do not change it.
- docs/research/hooks.md: status file format.

## Approach
- A PowerShell 5.1 script, `tray/session-tray.ps1` in the repo (same "no build" style as the
  hooks), using `System.Windows.Forms.NotifyIcon`: icon + count, tooltip with the summary, a
  right-click menu listing the sessions that need you plus "Exit".
- Poll the status folder every ~2 s (simpler and sturdier than `FileSystemWatcher` for a tiny
  folder), apply the same liveness filter, and redraw only when the count or list changes.
- Click on a session: `code "<project_dir>"` (focuses an open window, like the sidebar's
  `vscode.openFolder`), then write `.reveal` so that window shows the chat's tab.
- One instance only (a named mutex). Started at login by a shortcut in the Startup folder; an
  extension command or Install Hooks could add that shortcut later.
- Main drawback: the liveness and counting rules then exist twice (TypeScript and PowerShell) and
  can drift. Keep the PowerShell version small and add a test that feeds both the same temp folder
  (`SESSION_INBOX_STATUS_DIR`, `SESSION_INBOX_SESSIONS_DIR`) and compares counts.

## Ask the user
- Language: PowerShell script, or a small Node/Electron app? Suggested: PowerShell — no install, no
  build, matches the hooks; Electron would be ~100 MB for one icon.
- Start: at login automatically, or only by hand? Suggested: a Startup-folder shortcut, set up by a
  command, never silently.
- Icon look: a number drawn on the icon, or just two icons (alert / clear) with the count in the
  tooltip? Suggested: number drawn on the icon (the point is "glanceable").
- Show `done` sessions too, or only `waiting`? Suggested: both, same as the status bar.

## Test
- Claude: a temp status folder with `waiting`, `done`, `working` and a leftover (dead pid) file →
  the script's count matches `countStates()`/`onlyLive()`; the shared-folder test above; the
  script starts, shows the icon, and a second start exits.
- User: with real chats, the tray count follows the status bar; clicking a session opens the right
  window and tab; Exit removes the icon; after a restart (if autostart was chosen) it comes back.

## Answers (2026-11-03, user: "Go with your suggestions")
- PowerShell 5.1 script, `tray/session-tray.ps1` in this repo (not a personal hook, not its own
  repo: its data, rules and `.reveal` hand-off all belong to this project).
- Started by the extension when the setting `sessionInbox.trayIcon` is on (default off), not a
  Startup-folder shortcut; the tray exits when no `Code.exe` is left. One instance (named mutex).
- Count drawn on the icon: orange if any `waiting`, blue if only `done`, grey "all clear".
  Tooltip max 63 characters (.NET Framework limit): headline + as many projects as fit.
- Counts `waiting` + `done`, like the status bar.
- Left or right click opens the menu: one item per session that needs you (project, state) →
  `code "<project_dir>"` + `.reveal`; then Exit.

## Progress
- [x] A — the tray script, run by hand; `-Once` prints the counts as JSON; a unit test compares
  it with `countStates(onlyLive(...))` on the same temp folders (drift guard). Built and tested
  by the user 2026-11-03: count and colour follow the status bar, click opens the window and tab,
  a second copy exits, Exit removes the icon. The test also compares label and click folder with
  `sessionLabel`/`sessionFolder`; a planted difference in the script fails it.
- [ ] B — started from the extension: setting `sessionInbox.trayIcon`, the build copies the
  script into `dist/`; unit + GUI test; README, docs. From step A's review: pass the launching
  VS Code's main PID (e.g. `-VsCodePid`) and exit when it ends, instead of looking for a process
  named `Code` / `Code - Insiders` (VSCodium, Cursor etc. have other names).

Step A notes: polling costs ~11 ms per 2 s tick with 547 processes (measured 2026-11-03), so the
full process list stays. Left as-is from the review (the hook never writes these): JSON keys in
another case (PowerShell properties ignore case), a `pid` written as `1234.0`, a folder named
`*.json`, a `%` in a folder name passed through `code.cmd`.
