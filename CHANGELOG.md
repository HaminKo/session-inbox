# Changelog

All notable changes to Session Inbox are listed here, newest first.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and version numbers
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Set a project's status by hand: right-click a project (or run **Session Inbox: Set Status of
  This Project…**) for **Set Project Status…**: "On hold", "Come back later" or your own text. It
  shows after the project's name, in a colour you pick with **Set Status Color…**. A project with
  a status stays listed as **Closed** after its last chat ends; click it to open its folder.
  **Clear Project Status** removes it.
- A project with a status is parked: its finished chats aren't counted in the badge, the status
  bar or the tray, and are listed under **Parked** when grouped by state. One waiting on a
  permission or a question still counts.

### Changed
- A reply that ends while Claude still runs a background task (a command, an agent or a monitor)
  is shown as working, marked "background task", and not counted until Claude's next reply with
  no task running, a restart of the chat, or 45 minutes. Needs the updated hook: run **Session
  Inbox: Install Hooks** again.

### Fixed
- A finished reply or a permission prompt could stay shown as working: the hook's write failed
  when another program had the status file open at that moment, and nothing wrote it again. The
  hook now tries again for up to about a quarter of a second. Needs the updated hook: run
  **Session Inbox: Install Hooks** again.

## [0.1.0] - 2026-11-03

First version.

### Added
- A status hook for Claude Code chats in VS Code (`session-status.ps1`) that keeps one small file
  per chat in `~/.claude/session-status/`: whether it is waiting on you (a permission prompt or a
  question), done (its reply is finished) or working, with its project folder, worktree, message
  and time.
- **Session Inbox: Install Hooks** command: copies the hook into `~/.claude/hooks/` and adds it to
  `~/.claude/settings.json` next to the hooks already there, with backups of what it replaces. At
  startup, a warning when the hook is missing, differs from the extension's copy, or isn't in
  `settings.json`.
- A status bar item in every VS Code window: `⚠ N waiting` (highlighted) or `✓ all clear`, where N
  counts sessions waiting on you and finished replies. Hover for the numbers per state; click to
  open the sidebar.
- A Session Inbox sidebar (Activity Bar icon with the same count as a badge) listing the running
  chats of all windows in groups Waiting / Done / Working, each with its folder, a `worktree` tag,
  how long it has waited and its message.
- Group the sidebar by project instead of by state (a button in its title bar, saved for all
  windows; others take it on reload): one header per project, A–Z, coloured by its most urgent
  chat, with a summary such as `1 waiting · 1 done`.
- A project's own icon on its header: right-click it for **Set Icon…** / **Reset Icon**, or set it
  in `sessionInbox.projects`.
- Grouped by project, the first row under a header shows the `Now:` line of the project's
  `docs/todo.md` ("Where we are" section); hover for the whole section, with a note when its
  `Updated:` date is more than 14 days old. Another file, or none, with `focus` in
  `sessionInbox.projects`.
- Chats that are open but haven't reported yet are shown as grey "Open" and not counted. Chats
  whose process has ended are hidden (their files are left alone).
- Click a session to bring up the VS Code window that has its folder open (or open the folder in a
  new window) and show that chat's own Claude tab.
- Reminders: a session still waiting on you after 10 minutes gets its popup once more
  (`sessionInbox.renotifyMinutes`, `0` turns it off). Needs your own popup hook,
  `~/.claude/hooks/notify.ps1`; without one, the first reminder says so once, with a **Turn Off
  Reminders** button. A click on such a popup can show the chat's tab, too.
- A Windows tray icon next to the clock (`sessionInbox.trayIcon`, off by default) with the same
  count in the sidebar's colours, also when no VS Code window is in front. Click it for the
  sessions that need you; one opens its window and tab.

[Unreleased]: https://github.com/HaminKo/session-inbox/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/HaminKo/session-inbox/releases/tag/v0.1.0
