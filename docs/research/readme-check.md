# README check against the code (to-do #21)

Line numbers below refer to the README of 2026-11-03, before #21's fixes; to-do #26 later reorganized
it into sections (docs/decisions.md 2026-11-04), so they no longer match.

2026-11-03. A fresh general-purpose subagent that had not seen the project read README.md and
checked its claims against `extension/`, `hooks/` and `tray/` (read only, nothing run). For
`docs/todo.md` and `docs/research/hooks.md` it checked only that the references exist. Claude then
re-read the code behind every finding: all 13 are **confirmed** (file:line below were looked at),
except where a line says *estimated*.

Kinds: **wrong** (says something the code doesn't do), **outdated**, **unclear**, **missing** (a
user-visible thing the README doesn't say).

## Findings, most important first

1. **Missing — `notify.ps1` isn't shipped** (README lines 18, 21, 59–62, 74).
   - The README says you can click "its desktop popup", re-notify shows "its `notify.ps1`
     popup once more", and "the hooks extend an existing desktop-notification hook".
   - `notify.ps1` isn't in the repo (`git ls-files`). Re-notify calls
     `~/.claude/hooks/notify.ps1`, and without it only logs "no reminder, … not found"
     (`extension/src/extension.ts:176-177`).
   - So a new user gets no popups, no popup click and no reminders, and Requirements doesn't
     mention this.
   - Line 21 is also misleading: `hooks/session-status.ps1:5-6` says the status hook never
     touches `notify.ps1`. It's a separate hook, not an extension of it.
2. **Missing — how to install the extension for real use** (lines 80–115).
   - Install Hooks is a Command Palette command, but the README says it before saying how to get
     the extension at all.
   - `npm run package` builds a `.vsix`, but the README never says how to install it.
   - F5 starts with `--disable-extensions` (`.vscode/launch.json:8`), so Claude Code is off there
     and showing a chat's tab can't work under F5. The README doesn't say this.
3. **Outdated — the GUI test "checks the status bar"** (line 117–118).
   - `extension/test/gui/` also has sidebar, hooks, open, renotify, reveal and tray tests.
   - "with only this extension" isn't exact either: some tests load a stand-in Claude extension
     (`extension/test/gui/fake-claude/`).
4. **Unclear — re-notify conditions** (lines 60–62). The README leaves out three things:
   - only a window that has the chat's folder open sends the reminder, so with no such window
     none is sent;
   - the window must not have focus;
   - it can come up to ~30 s late.

   Code: `extension/src/extension.ts:152-171`.
5. **Unclear — "`⚠ N waiting`" counts done too** (lines 15, 26). N is waiting + done
   (`extension/src/statusFolder.ts:150-151`), so one finished reply shows "1 waiting". The README
   explains this for the badge only, not for the status bar.
6. **Missing — tray details** (lines 63–69).
   - A tray click needs VS Code's `code` command on PATH. Without it, a balloon says "Can't open the
     window…" (`tray/session-tray.ps1:410-414`).
   - The menu has an **Exit** item (`tray/session-tray.ps1:465`). After Exit, the icon comes back
     only when the setting is turned off and on again, or a VS Code window starts
     (`extension/src/extension.ts:72-82`).
7. **Unclear — where the hand-added hook entry goes** (lines 99–109).
   - In `settings.json`, each event holds a list of groups, and each group has its own `hooks`
     list. Install Hooks adds `{ "hooks": [entry] }` to that event's list of groups
     (`extension/src/installHooks.ts:160-162`).
   - A full nested example would make this clear.
8. **Missing — minimum versions** (line 76: "VS Code and Node.js").
   - The extension needs VS Code `^1.100.0` (`extension/package.json:9`).
   - `npm test` runs `.ts` files directly with `node --test` (`extension/package.json:187`). That
     needs a Node that strips TypeScript types without a flag. *Estimated*, from memory, not
     measured: Node 22.18+ / 23.6+.
9. **Unclear — "Both are built as numbered to-dos"** (line 70). "Both" means the two parts named
   at the top, but the tray is now a third part. Also, the to-dos themselves are in
   `docs/todo/NN-*.md`; `docs/todo.md` only lists them.
10. **Unclear — "the Windows notification APIs"** (line 74). The repo's own hook uses no
    notification API; only the unshipped `notify.ps1` does. The tray uses WinForms.
11. **Missing (minor) — other dev commands** (lines 113–116). `npm run lint` and
    `npm run check-types` (`extension/package.json:181-182`) aren't mentioned.
12. **Missing (minor) — small user-visible bits:**
    - an empty sidebar shows "No Claude Code sessions running." (`extension/package.json:173`);
    - clicking a session whose folder is gone shows "Folder not found: …", and one with no known
      folder shows "Folder not known yet…" (`extension/src/extension.ts:203,207-209`);
    - `npm run screenshots -- statusbar|sidebar|window`;
    - a project header can also be grey, for open sessions (`extension/src/sidebar.ts:33,42`),
      but line 31 lists only yellow / green / blue.
13. **Outdated, outside README.md — `extension/README.md:8`** says "this version only shows a
    placeholder status bar item". That file ships in the `.vsix`, so Marketplace and Extensions
    view readers would see it.

## Checked and found correct (by the subagent)

- Hook events, the status-file path and fields, and the hand-added entry (`timeout: 10`, no
  `async`).
- Install Hooks:
  - adds only missing entries and refuses invalid JSON;
  - backs up `settings.json` once and a replaced hook to `hooks/backups/`;
  - the startup warning, "Don't ask again", and "restart chats already running".
- Status bar text, highlight, hover and click. Hiding chats whose process ended. Badge = waiting +
  done.
- Sidebar:
  - groups and their order, row contents;
  - grouping by project (A-Z, case-insensitive, colour of the most urgent state, summary line);
  - Set Icon… / Reset Icon (25 icons, setting `sessionInbox.projects`, colour stays the state);
  - the focus row (`docs/todo.md` → `Now:`, hover, 14-day note, `focus` path / `false`, only a
    hand-set path logs);
  - open sessions (grey, last, collapsed, not counted).
- A click opens the folder or focuses its window and shows the chat's tab via `.reveal`.
- `sessionInbox.renotifyMinutes` (default 10, `0` off, message text). `sessionInbox.trayIcon`
  (default off, colours, dark menu, codicons, ends with its VS Code).
- npm scripts `compile`, `package`, `test`, `test:gui`, `screenshots`; temp folders;
  `.vscode-test/` download.
- The `docs/research/hooks.md` payload-test reference ("Verifying without a live session") and
  `docs/todo.md` both exist. Credits match the dev dependencies. LICENSE exists.

## Not checked

- Anything that depends on `notify.ps1` itself (it isn't in the repo).
- The README screenshot: that's the next "Before a public release" item.

## Decision

Report first, then the user picked (2026-11-03, accepting Claude's suggestion):
- Finding 1 → its own to-do, #22 (docs/todo/22-popups-not-shipped.md): ship a popup hook or
  document it as the user's own. README lines on `notify.ps1` (incl. line 21 and the Credits entry)
  are left for it.
  Done 2026-11-03: documented as the user's own hook (README "Optional: desktop popups"), plus a
  one-time warning when a reminder can't be sent (docs/decisions.md).
- Findings 2–13 → fixed in to-do #21 by wording edits in README.md and extension/README.md. The
  Node minimum (22.18) written into README Requirements is still the estimate from finding 8, not
  tested on an older Node.
