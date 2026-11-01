Next number: 11

## To do

### 10. Leftover status files keep the count up forever (medium; research first)
Goal, in the user's words: "Those tabs were closed" — yet their `done` files stayed, so the status
bar counted them as waiting.

- **Problem / Goal:** a status file can outlive its chat. Seen 2026-11-01: two `done` files
  (PeacefreeWeb 15:50, sc-map-library 16:30) were still there at 18:14 with both tabs closed. Closing
  a single tab is known to delete the file, so the gap is probably closing a whole window or quitting
  VS Code (not measured). The count must drop when a chat is really gone.
- **Read first:** docs/research/hooks.md ("Leftover files", `SessionEnd` notes);
  `extension/src/statusFolder.ts` (`readStatuses`); `hooks/session-status.ps1` (`SessionEnd`).
- **Approach:** first measure which close paths fire `SessionEnd` (close tab, close window, quit VS
  Code, kill the process), e.g. with a log line in a test copy of the hook. Then pick a cleanup:
  remove files whose chat is gone, if anything in the payload or on disk tells that (research);
  else an age limit for `done` files, or a "Clear" command / sidebar button.
- **Ask the user:** delete leftovers or only hide them (suggested: hide in the extension, so a
  wrong guess never loses a still-open chat); an age limit, and how long (suggested: only if no
  "is the chat gone" signal exists, 24 h); a manual "clear" too (suggested: yes, in the sidebar
  from #5).
- **Test:** Claude: unit test of the cleanup rule on sample files in a temp folder. User: close a
  window with a finished chat, and see the count drop (or the file cleared) as designed.

### 5. Sidebar view: all sessions across windows (large)
Tree view, waiting first then done then working, each with folder, how long it has waited, and a
worktree badge.

### 8. Sidebar: sort the list by project name or by time (small)
Goal, in the user's words: "2 ways to order the list - by the name of the project and by time".

- **Problem / Goal:** #5 has one fixed order (waiting, then done, then working). With several
  sessions open you either look for one project (by name: `my-app`, `my-app-todo12`, `website`)
  or want to see what has waited longest (by time).
- **Read first:** the sidebar's tree provider from #5; `timestamp` in docs/research/hooks.md
  ("Status file": for `working` it means last activity, not when the state began); VS Code API:
  `view/title` menus, `TreeDataProvider.onDidChangeTreeData`, `ExtensionContext.globalState`.
- **Approach:** one toggle button in the sidebar's title bar (two commands; a context key shows
  only the inactive one), the choice saved in `globalState`, the sort applied inside each state
  group. By project: `folder` A-Z, ignoring case, ties by time. By time: oldest `timestamp` first.
- **Ask the user:** keep the state groups and sort inside each (suggested: yes, so `waiting` always
  stays on top); by time, longest-waiting or newest first (suggested: longest-waiting); default
  mode (suggested: by time); same choice in every window (suggested: yes, `globalState`); sort
  worktrees by their own folder name (suggested: yes, `my-app-todo12` already lands next to
  `my-app`).
- **Test:** Claude: a unit test of the sort (both modes, ties, case, groups kept in order) and a
  GUI-test step that switches the mode. User: with 3+ sessions in different folders, click the
  toggle and see the order change; reload the window and the choice is still set.

### 6. Click a session to focus/open its VS Code window (medium)
Reuse the window-finding approach from `notify.ps1` (find the VS Code window whose title ends in
`<folder> - Visual Studio Code`, restore and bring to front; open the folder if none).

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
