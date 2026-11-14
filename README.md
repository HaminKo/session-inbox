# Session Inbox

A persistent **"waiting on you"** inbox for Claude Code sessions across VS Code windows.

Desktop notifications from Claude Code are one-shot: you click one, get distracted, and forget
to go back and respond. Session Inbox keeps a visible indicator in every VS Code window that
stays until you actually act on each session.

![Status bar item reading "2 waiting"](docs/images/statusbar.png)

![Session Inbox sidebar: Sessions grouped Waiting, Done and Working, with a session waiting 12 min in a worktree; a closed project on hold, named in purple](docs/images/sidebar.png)

## Features

- **[Status bar](docs/guide.md#status-bar):** every VS Code window shows how many sessions need
  you: waiting on a permission prompt or a question, or done with a reply.
- **[Sidebar](docs/guide.md#sidebar):** every running session across all windows, grouped by state
  or by project, with how long it has waited and its message. A project can get its own icon.
- **[Where a project stands](docs/guide.md#where-a-project-stands):** grouped by project, a row
  with the `Now:` line from the `## Where we are` section of the project's `docs/todo.md`.
- **[Project status](docs/guide.md#project-status):** mark a project "On hold" or any text, in a
  colour you pick. It stays listed when closed, and its finished chats aren't counted.
- **[Clicking a session](docs/guide.md#clicking-a-session):** brings up its VS Code window and
  shows that chat's own Claude tab.
- **[Reminders](docs/guide.md#reminders):** a session still waiting after 10 minutes gets its popup
  once more. Needs [your own popup hook](docs/guide.md#your-own-popup-hook).
- **[Tray icon (optional)](docs/guide.md#tray-icon-optional):** the same count next to the Windows
  clock, with a list of the sessions that need you.

Every feature in detail: the [user guide](docs/guide.md).

## How it works

- **A global hook** (in `~/.claude/settings.json`) writes a small status file per session to
  `~/.claude/session-status/<session_id>.json` (project folder, worktree, state, message and
  timestamp) and updates it as the session moves between waiting, working and done.
- **The VS Code extension** watches that folder and shows what's in it in every window.
- Desktop popups are not part of Session Inbox: the status hook works on its own, next to any
  popup hook you already have, and never changes it.

## Requirements

- Windows (the hook and the tray icon are Windows PowerShell scripts).
- [Claude Code](https://docs.claude.com/en/docs/claude-code) with the VS Code extension.
- VS Code 1.100 or newer.
- Optional, for desktop popups and reminders: your own `~/.claude/hooks/notify.ps1` (not included).

## Install and run

1. **Extension:** download the `.vsix` file (such as `session-inbox-0.1.0.vsix`) from the
   [latest release](https://github.com/HaminKo/session-inbox/releases/latest) and install it with
   `code --install-extension session-inbox-0.1.0.vsix` (or Extensions view → `…` → Install from
   VSIX…).
2. **Hooks:** run **Session Inbox: Install Hooks** from the Command Palette (`Ctrl+Shift+P`).
3. New chats pick up the hook; restart chats already running. Each session then keeps a status file
   in `~/.claude/session-status/`.

Install Hooks adds its hook next to any you already have and changes no other hooks or settings.
It keeps a copy of your original `settings.json` and of any hook it replaces. At startup the
extension warns if the hook is missing, differs, or isn't in `settings.json`. Details:
[What Install Hooks does](docs/guide.md#what-install-hooks-does).

<details>
<summary>Setting up the hook by hand instead</summary>

In PowerShell, from a copy of this repo:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\hooks" | Out-Null
Copy-Item hooks\session-status.ps1 "$env:USERPROFILE\.claude\hooks\"
```

Then, in `~/.claude/settings.json`, add a group with this entry to each of 5 events, next
to any groups already there (shown for `Stop`; the same for `PermissionRequest`,
`UserPromptSubmit`, `PostToolUse` and `SessionEnd`). Leave out `"async": true`: the hook has to run
in order, so that a late `working` can't overwrite `done`.

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"$USERPROFILE/.claude/hooks/session-status.ps1\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Verify with the payload test in [docs/research/hooks.md](docs/research/hooks.md) ("Verifying
without a live session").

</details>

## Settings

All three are user settings (the same in every window): change them in Settings (`Ctrl+,`, search
"Session Inbox") or in VS Code's user `settings.json`.

| Setting | Default | What it does |
|---|---|---|
| `sessionInbox.renotifyMinutes` | `10` | Minutes a session may wait on a permission prompt or a question before its popup is shown once more; `0` turns reminders off. See [Reminders](docs/guide.md#reminders). |
| `sessionInbox.trayIcon` | `false` | The Windows tray icon next to the clock. See [Tray icon](docs/guide.md#tray-icon-optional). |
| `sessionInbox.projects` | `{}` | Per project, keyed by the name its header shows (case ignored): `icon`, a codicon name (see [Sidebar](docs/guide.md#sidebar)); `focus`, another file for the focus row or `false` (see [Where a project stands](docs/guide.md#where-a-project-stands)); `status`, `folder` and `statusColor`, set by **Set Project Status…** and **Set Status Color…** (see [Project status](docs/guide.md#project-status)). Example: `{ "sc-map-library": { "icon": "map", "focus": "notes/status.md" } }`. |

## Optional: desktop popups

Session Inbox doesn't ship a desktop-popup hook. Reminders, and a popup click that shows its chat,
need one of your own at `~/.claude/hooks/notify.ps1`. What it gets, and what it writes for a
click: [Your own popup hook](docs/guide.md#your-own-popup-hook) in the user guide.

## Development

- **Build from source:** run `npm install` once in `extension/`, then `npm run package` (from
  `extension/`) for a `.vsix`. Needs Node.js 22.18 or newer (the unit tests run `.ts` files
  directly with `node --test`).
- **Run:** open the repo folder in VS Code and press `F5`: it type-checks and builds the extension
  (`npm run compile`) and starts an Extension Development Host with it loaded. That window has all
  other extensions turned off, Claude Code included, so showing a chat's own tab only works from
  the installed `.vsix`.
- **Checks** (from `extension/`): `npm run lint` (ESLint), `npm run check-types` (TypeScript),
  `npm test` (unit tests, plain Node, about a second).
- **GUI test** (from `extension/`): `npm run test:gui` starts a separate VS Code window with this
  extension (some tests add a stand-in for Claude Code) and checks the status bar, sidebar, Install
  Hooks, opening a session, its tab, reminders and the tray icon. It uses sample status files in
  temp folders (`SESSION_INBOX_STATUS_DIR`, `SESSION_INBOX_SESSIONS_DIR`), never your real
  `~/.claude/session-status/` or `~/.claude/sessions/`.
- **Screenshots** (from `extension/`): `npm run screenshots` (or `-- statusbar`, `-- sidebar`,
  `-- window` for one) saves PNGs to the temp folder (`session-inbox-shots`). The first run of this
  or the GUI test downloads VS Code (~350 MB) into `extension/.vscode-test/`.
- **How it's built:** each part is a numbered to-do, listed in [docs/todo.md](docs/todo.md); each
  has its own file in docs/todo/ while open and [docs/archive/](docs/archive/) once finished.

## Changelog

What changed in each version: [CHANGELOG.md](CHANGELOG.md).

## Credits

- Grew out of the project author's own Claude Code desktop-notification hook (`notify.ps1`, not
  included), which it works next to rather than replaces.
- [Visual Studio Code Extension API](https://code.visualstudio.com/api) — Microsoft, MIT.
- [esbuild](https://esbuild.github.io/) — Evan Wallace, MIT.
- [Codicons](https://github.com/microsoft/vscode-codicons) — Microsoft, CC BY 4.0: the tray menu
  draws them from the font that ships with VS Code (not copied into this project).
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
