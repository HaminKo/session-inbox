# Session Inbox

A persistent **"waiting on you"** inbox for Claude Code sessions across VS Code windows.

Desktop notifications from Claude Code are one-shot: you click one, get distracted, and forget
to go back and respond. Session Inbox keeps a visible indicator in every VS Code window that
stays until you actually act on each session.

It has two parts:

1. **Global hooks** (in `~/.claude/settings.json`) that write a small status file per session to
   `~/.claude/session-status/<session_id>.json` — project folder, worktree, state, message, and
   timestamp — and update it as the session moves between waiting, working, and done.
2. **A VS Code extension** that watches that folder and shows, in every window:
   - a status bar item: `⚠ N waiting` or `✓ all clear`;
   - a sidebar listing every session across all windows (waiting first, with how long each has
     waited, and a badge for worktrees);
   - click a session (or its desktop popup) to bring up its VS Code window and its own Claude tab;
   - a re-notification if a session has waited longer than a configurable threshold.

The hooks extend an existing desktop-notification hook rather than replacing it.

## Status

The status-writer hook works. The extension's status bar item shows the live count from the status
folder (`⚠ N waiting`, highlighted, or `✓ all clear`; hover for waiting / done / working). A chat
whose process has ended (window closed or VS Code quit without the hook's cleanup) is not counted.
The Session Inbox icon in the Activity Bar (badge: waiting + done) opens a sidebar listing every
running session in groups Waiting / Done / Working, each with its folder, a `worktree` tag, how long
it has waited, and its message. A button in the sidebar's title bar switches to grouping by project:
one header per project folder A-Z (a folder icon in the colour of its most urgent state: yellow
waiting, green done, blue working), with a summary such as `1 waiting · 1 done`, and its sessions underneath, each named by
its state. The choice is saved for all windows (others pick it up when they reload).
Right-click a project header for "Set Icon…" (a pick of ~25 icons, e.g. a map or a globe) or
"Reset Icon"; the icon keeps the state colour and changes in every open window at once. It's stored
in the user setting `sessionInbox.projects` (`{ "sc-map-library": { "icon": "map" } }`), where any
other [codicon](https://code.visualstudio.com/api/references/icons-in-labels#icon-listing) name can
be typed by hand.
A chat that is open but hasn't written a status yet (after a VS Code restart, or a new tab before
its first prompt) is shown as grey "Open", last (grouped by state: an "Open" group that starts
collapsed), not counted in the badge or the status bar; it moves to its real state with its next
prompt or tool call.
Clicking a session brings up the VS Code window that has its project folder open, or opens the
folder in a new window if none has, and shows that chat's own Claude tab (not whichever Claude tab
was last active); clicking a `notify.ps1` popup does the same. Clicking the status bar item opens
the sidebar. A session still waiting on a permission prompt or a question after 10 minutes gets its
`notify.ps1` popup once more ("Still waiting (12 min): …"); the setting
`sessionInbox.renotifyMinutes` changes the minutes, `0` turns it off.
With the setting `sessionInbox.trayIcon` on (default off), a Windows tray icon next to the clock
shows the same count, also when no VS Code window is in front: orange if any session is waiting,
blue if only finished replies are, grey when all clear; hover for a summary. Click it for the list
of sessions that need you; one opens its window and tab like a sidebar click. It closes when the
VS Code that started it quits, or when the setting is turned off (turn it off before uninstalling;
otherwise the icon stays until VS Code quits).
Both are built as numbered to-dos (see `docs/todo.md`); nothing is published yet.

## Requirements

- Windows (the hooks use Windows PowerShell and the Windows notification APIs).
- [Claude Code](https://docs.claude.com/en/docs/claude-code) with the VS Code extension.
- VS Code and Node.js (for building the extension).

## Install and run

> Build steps land here as they're implemented. For now:

- **Hooks:** run **Session Inbox: Install Hooks** from the Command Palette. It copies the
  status-writer (bundled in the extension from `hooks/session-status.ps1`) into `~/.claude/hooks/`
  and adds it to `PermissionRequest`, `Stop`, `UserPromptSubmit`, `PostToolUse` and `SessionEnd`
  in `~/.claude/settings.json`, next to any hooks already there. It never changes other hooks or
  settings, refuses a `settings.json` that isn't valid JSON, saves the original once as
  `settings.json.before-session-inbox`, and backs up a replaced hook to `~/.claude/hooks/backups/`.
  At startup the extension warns when the hook is missing, differs from its own copy, or isn't in
  `settings.json` ("Install Hooks" / "Don't ask again", the latter until the bundled hook changes).
  New chats pick up the `settings.json` entries; restart chats already running.

  By hand instead (in PowerShell, from this folder):

  ```powershell
  New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\hooks" | Out-Null
  Copy-Item hooks\session-status.ps1 "$env:USERPROFILE\.claude\hooks\"
  ```

  Then, in `~/.claude/settings.json`, add this entry to the `hooks` list of each of those 5 events,
  next to any hooks already there. Leave out `"async": true`: the hook has to run in order, so that
  a late `working` can't overwrite `done`.

  ```json
  {
    "type": "command",
    "command": "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"$USERPROFILE/.claude/hooks/session-status.ps1\"",
    "timeout": 10
  }
  ```

  Each session then keeps a status file in `~/.claude/session-status/`. Verify with the payload
  test in `docs/research/hooks.md`.
- **Extension:** run `npm install` once in `extension/`. Then open the repo folder in VS Code and
  press `F5`: it builds the extension (`npm run compile`) and starts an Extension Development Host
  with it loaded. Package a `.vsix` with `npm run package` (from `extension/`).
- **Tests** (from `extension/`): `npm test` runs the unit tests (plain Node, about a second).
- **GUI test and screenshots** (from `extension/`): `npm run test:gui` starts a separate VS Code
  window with only this extension and checks the status bar, using sample status files in temp
  folders (`SESSION_INBOX_STATUS_DIR`, `SESSION_INBOX_SESSIONS_DIR`), never your real
  `~/.claude/session-status/` or `~/.claude/sessions/`; `npm run screenshots` saves PNGs to
  the temp folder (`session-inbox-shots`). The first run downloads VS Code (~350 MB) into
  `extension/.vscode-test/`.

## Credits

- Builds on the project author's own Claude Code desktop-notification hook (`notify.ps1`), which
  this project extends rather than replaces.
- [Visual Studio Code Extension API](https://code.visualstudio.com/api) — Microsoft, MIT.
- [esbuild](https://esbuild.github.io/) — Evan Wallace, MIT.
- [ESLint](https://eslint.org/) — OpenJS Foundation, MIT.
- [typescript-eslint](https://typescript-eslint.io/) — typescript-eslint team, MIT.
- [TypeScript](https://www.typescriptlang.org/) — Microsoft, Apache-2.0.
- [@types/vscode and @types/node](https://github.com/DefinitelyTyped/DefinitelyTyped) —
  DefinitelyTyped contributors, MIT.
- [@vscode/vsce](https://github.com/microsoft/vscode-vsce) — Microsoft, MIT.
- [@vscode/test-electron](https://github.com/microsoft/vscode-test) — Microsoft, MIT.
- [Playwright](https://playwright.dev/) (`playwright-core`) — Microsoft, Apache-2.0.
- [Node.js](https://nodejs.org/) — OpenJS Foundation, MIT.

## License

MIT — see [LICENSE](LICENSE).
