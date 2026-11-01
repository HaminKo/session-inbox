Next number: 9

## To do

### 2. Extension skeleton: build, lint, and a hello-world status bar item (medium)
Goal: a compiling, lintable VS Code extension in `extension/` with a clean Marketplace-ready
`package.json`, showing a placeholder status bar item.

- **Problem / Goal:** stand up the extension project so later features have a home and all checks
  run green.
- **Read first:** VS Code Extension API getting-started; CLAUDE.md "Build specifics".
- **Approach:** `extension/` with TypeScript + esbuild bundling + ESLint; `package.json` with
  publisher, name `session-inbox`, display name "Session Inbox", MIT license, repo link, no
  unused scaffolding. Activate on startup; add one status bar item showing a placeholder.
- **Ask the user:** the Marketplace **publisher id** (needed in package.json; suggested: create
  one and record it in docs/local.md).
- **Test:** `npm run lint`, `npm run compile`, `npx tsc --noEmit` all pass; `F5` launches the
  Extension Development Host and the status bar item appears.

### 3. GUI test + screenshots for the extension (small)
Set up the gui-test skill for the Extension Development Host (`@vscode/test-electron`) and capture
a first screenshot. Do this right after the skeleton (#2).

### 4. Status bar: real counts from the status folder (medium)
Watch `~/.claude/session-status/`, show `⚠ N waiting` / `✓ all clear` (N = `waiting` + `done`),
tooltip with a breakdown. Handle the folder not existing yet.

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
