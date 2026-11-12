# Session Inbox

A persistent **"waiting on you"** inbox for Claude Code sessions across VS Code windows.

Claude Code's desktop notifications are one-shot. Session Inbox keeps a status bar item in every
VS Code window that stays until you act on each session that is waiting for you.

It shows a status bar count, a sidebar of every session across windows (click one to bring up its
window and chat tab), and an optional Windows tray icon. All features, settings and install steps:
[main README](https://github.com/HaminKo/session-inbox).

![Status bar item reading "2 waiting"](https://github.com/HaminKo/session-inbox/raw/HEAD/docs/images/statusbar.png)

![Session Inbox sidebar: Sessions grouped Waiting, Done and Working, with a session waiting 12 min in a worktree; a closed project on hold, named in purple](https://github.com/HaminKo/session-inbox/raw/HEAD/docs/images/sidebar.png)

## Requirements

- Windows.
- Claude Code with its VS Code extension, plus the Session Inbox status hook in
  `~/.claude/settings.json` (setup steps are in the
  [main README](https://github.com/HaminKo/session-inbox#install-and-run)).
- Optional: desktop popups and reminders need your own popup hook at
  `~/.claude/hooks/notify.ps1` (not included; the
  [main README](https://github.com/HaminKo/session-inbox#optional-desktop-popups) says what it receives).

## License

MIT — see [LICENSE](LICENSE).
