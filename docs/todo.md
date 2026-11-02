Next number: 12

## To do

### 6. Click a session to focus/open its VS Code window (medium)
Reuse the window-finding approach from `notify.ps1` (find the VS Code window whose title ends in
`<folder> - Visual Studio Code`, restore and bring to front; open the folder if none).
Also ask: should a click on the status bar item open the sidebar (a command running
`workbench.view.extension.sessionInbox`, ~5 lines)? Suggested by Claude in the #5 user test (the
user clicked it expecting that); not decided yet.

### 9. Open the session's own Claude tab, not just its window (medium; research first)
Goal, in the user's words: "change the tab that gets brought up" — a popup click brought the right
window up, but it showed a different Claude chat ("Build-todo item 4"), which was confusing.

- **Problem / Goal:** `notify.ps1` (and #6) can only bring a VS Code *window* to the front; Windows
  can't see or pick tabs inside it. With two Claude chats in one window, the click shows whichever
  tab was last active. Wanted: the click shows the chat that finished or is waiting.
- **Read first:** `BringToFront` and the click handler in `~/.claude/hooks/notify.ps1`;
  `session_id` in the payload and the status file (docs/research/hooks.md); VS Code API:
  `window.registerUriHandler`; the Claude Code extension's `package.json` (`contributes.commands`,
  any URI handler) in the installed extensions folder.
- **Approach:** research before any code, into docs/research/claude-tabs.md:
  1. Can another extension open or reveal a specific Claude Code session tab (a command or URI
     that takes a session id)? If not, stop and report: the to-do can't be done well.
  2. With several VS Code windows open, which one receives a `vscode://` URI? If not the one for
     that folder, the receiving window has to hand it on (or the popup first brings the right
     window up, then opens the URI).
  Then, if both are workable: the popup click opens
  `vscode://session-inbox.session-inbox/open?session=<id>`, and our extension reveals that tab.
  The same "show this session" action serves the sidebar click from #6.
- **Ask the user:** if only the window can be brought up, keep today's behaviour (suggested: yes);
  if a session's tab was closed, reopen it or just show the window (suggested: just the window).
- **Test:** Claude: a unit test of URI parsing; a GUI-test step if the extension gets a command.
  User: two Claude chats in one window, switch to chat A, let chat B finish, click its popup and
  see chat B's tab come up.

### 7. Re-notify past a configurable threshold (medium)
If a session has waited longer than a configurable number of minutes (default 10), re-trigger the
notification — re-invoke `notify.ps1` with a synthesized payload so it reuses the real popup.

### 11. A talking character picture in the notification popup (small)
Goal, in the user's words: "add an anime girl talking picture next to the notifications".

- **Problem / Goal:** the popups are text only (accent bar, title, 2-4 lines of the reply). Wanted:
  a character portrait on the left of the popup, as if she is saying the message, to match the
  persona opening line. Example: a `Stop` popup for `my-app` shows her picture beside "Hmph, fine
  — to-do #1 is finished and committed."
- **Doable:** yes. The popup is a custom WinForms window (`ClaudePopup : Form`), so a `PictureBox`
  can show a PNG, or an animated GIF, which WinForms plays by itself.
- **Read first:** the `ClaudePopup` constructor in `~/.claude/hooks/notify.ps1` (size from the
  text's line count, the stacking loop, `px()` DPI scaling, the accent panel and label bounds);
  the two `notify.ps1` exceptions in docs/decisions.md (2026-11-01: backups, install with a shell
  copy, not the Edit tool).
- **Approach:** this edits `notify.ps1`, so it needs the user's go-ahead as a third exception in
  docs/decisions.md, with a backup first. A square picture (~96 px at 100%) docked left after the
  accent bar; the text moves right and the popup widens by that much (or the text gets narrower).
  The image path from a setting at the top of the script (e.g.
  `~/.claude/hooks/notify-images/`), and with no image there the popup is exactly as today. One
  picture per event is cheap (`done.png`, `waiting.png`). "Talking": a 2-3 frame GIF (mouth
  open/closed) played a few seconds, then held on one frame, since popups stay until clicked.
  Dispose the image when the popup closes. The user supplies the art.
- **The picture (given):** `~/.claude/hooks/notify-images/orange-tsundere.png`, outside the repo.
  Measured: 832×1216 portrait PNG, transparent background with a white sticker outline, 1.3 MB,
  waist-up. Shrunk whole into ~96 px the face would be ~25 px, so crop to head and shoulders
  (face roughly x 230–640, y 100–560) and save a small pre-sized copy next to it, rather than
  loading and scaling 1.3 MB on every popup.
- **Ask the user:** how to crop (suggested: head and shoulders, square); still or animated (suggested: start still, add the GIF after); one picture or one per event
  (suggested: one per event, so "waiting" looks different from "done"); popup wider or text
  narrower (suggested: wider by the picture, so 4 lines still fit, but check that stacked popups
  still fit the side monitor).
- **Test:** Claude: pipe a fake `Stop` and `PermissionRequest` payload (docs/research/hooks.md)
  with and without the image folder, and check notify.log for errors. User: see the picture in
  both popup kinds on both monitors (100% and the other scaling), several popups stacked, and that
  click and X still work.

## Before a public release
- License: **MIT** — done (LICENSE file written, README points to it).
- Search all tracked files for the "Never in tracked files" list (real name, personal paths,
  GitHub login). If old commits hold any of it, publish a fresh repo with one clean commit rather
  than rewriting history.
- A fresh subagent that hasn't seen the project checks README.md and the docs it links against the
  code, and only reports (the user decides fixes).
- Add a screenshot of the status bar + sidebar to the README (the extension has a UI).
- Start CHANGELOG.md (Keep a Changelog: Unreleased first, then versions newest first) with the
  first version.
- Decide how to distribute: VS Code Marketplace (create the `session-inbox` publisher first) or a
  `.vsix` attached to a GitHub release. Then decide the `repository` link in
  `extension/package.json` (left out because the repo URL holds the GitHub login).
- Add a 128×128 PNG icon (`"icon"` in `extension/package.json`) if publishing to the Marketplace.

## Later, only if the user asks
- **Standalone tray indicator** (not a full app): a small system-tray process reading the same
  `session-status/` folder, for a glanceable waiting count when no VS Code window is focused. See
  docs/decisions.md (2026-11-01) for why it's deferred and scoped down.
- Cross-machine sync of session status.
- Editors other than VS Code.
- Claude-desktop-app / CLI sessions (currently VS-Code-extension sessions only).
- History / analytics of past waits.

## Writing a to-do
Each to-do starts as an entry here. When one grows past ~10 lines, move it into its own file,
docs/todo/NN-name.md. Template:

- **Title** with size (small / medium / large) and the goal in the user's words.
- **Problem / Goal:** what is wrong or wanted, with an example. For a bug or research to-do, also
  what the user has seen (it exists, where, what works) and what is already ruled out.
- **Read first:** files and functions to look at, outside references.
- **Approach:** the suggested design, what to reuse.
- **Ask the user:** open questions, each with a suggested answer.
- **Test:** what Claude checks, and what the user tests by hand.
