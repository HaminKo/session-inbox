Next number: 14

## To do

### 7. Re-notify past a configurable threshold (medium)
If a session has waited longer than a configurable number of minutes (default 10), re-trigger the
notification — re-invoke `notify.ps1` with a synthesized payload so it reuses the real popup.

### 13. Stacked popups fall down to fill a gap (small)
Goal, in the user's words: "if you close a notification in a stack, it leaves a gap. Should we
leave it that way or should stacks fall down?" (agreed: fall down).

- **Problem / Goal:** popups of different projects stack upward on each side monitor. Closing one
  in the middle leaves an empty slot until a new popup happens to land there. Wanted: the popups
  above it move down. Example: `a` (bottom), `b`, `c` stacked; close `b`, and `c` drops to just
  above `a` with the usual 8 px gap.
- **Read first:** in `~/.claude/hooks/notify.ps1`: the placement loop in the `ClaudePopup`
  constructor (`taken`, `spot`, the jump to just above the popup in the way), `Popups()` /
  `IsPopupFor`, and the 500 ms `$checkFocus` timer. Also the `notify.ps1` exceptions in
  docs/decisions.md (backup first, install with a shell copy).
- **Approach:** each popup is its own process, so each one moves itself. Move the placement rule
  into one method (e.g. `LowestFreeSpot()`), used by the constructor and on each timer tick. If the
  spot is lower than the popup's current place, move there. Guard: move only while the mouse is
  over no popup, so a popup never drops under the cursor right after an X click (a quick second
  click would hit the wrong project). ~20-25 lines. Needs the user's go-ahead as another
  `notify.ps1` exception in docs/decisions.md.
- **Ask the user:** jump or slide (suggested: jump, as placement does today; a slide animation
  adds code for little gain); wait a moment after the mouse leaves before moving (suggested: no,
  the next 500 ms tick is enough).
- **Test:** Claude: three fake payloads for three folders (docs/research/hooks.md, "Character
  picture in the popup", for the testing tips), close the middle popup's process window by
  message, and check the top one's window rectangle moved down by the right amount, on both
  monitors. User: stack three, close the middle one with X, and see the top one drop only after
  the mouse leaves; click and X still work.

### 12. Customize a project's header in the sidebar: colour, icon (medium)
Goal, in the user's words: "customize the parent folder - change the color, choose icon, etc".

- **Problem / Goal:** grouped by project (#8), every header is a folder icon coloured by its most
  urgent state. Wanted: a project of your choice looks different, e.g. `sc-map-library` with a
  purple map icon, `website` with a globe, so a project is found by its look, not just its name.
- **Read first:** `getTreeItem`, `colors` and `urgency` in `extension/src/sidebar.ts`;
  `groupByProject` in `extension/src/sessionList.ts` (the project key is the lowercased label);
  docs/decisions.md 2026-11-01 "To-do #8 groups by project" (what a tree view can and can't
  colour); VS Code API: `view/item/context` menus with `contextValue`, `window.showQuickPick`,
  `workspace.getConfiguration().update(..., ConfigurationTarget.Global)`, `ThemeIcon`/`ThemeColor`.
- **Approach:** right-click a project header: "Set icon…", "Set colour…", "Reset". Each opens a
  QuickPick: a short curated list of codicons (shown with their icon) and of theme colours
  (`charts.red/orange/yellow/green/blue/purple`, plus "By state", the default). Stored in a user
  setting, `sessionInbox.projects`: `{ "sc-map-library": { "icon": "map", "color": "charts.purple" } }`,
  so it can also be edited by hand in settings.json, applies to every window at once (settings
  have a change event, unlike `globalState`) and syncs with Settings Sync. Unknown icon or colour
  names fall back to today's look. Only the project grouping uses it.
- **Drawback to weigh:** today the folder's colour *is* the state (yellow = waiting). A custom
  colour hides that, which was the point of the glance. Hence the first question below.
- **Ask the user:** what a custom colour does to the state signal (suggested: the custom icon and
  colour are kept, but a project with a waiting session still turns its icon yellow, so "needs
  you" always shows); anything besides icon and colour, e.g. a display name, pinning a project to
  the top, hiding a project (suggested: icon and colour now; the others as later to-dos if wanted);
  icon list curated or any codicon name typed in (suggested: a curated ~20 in the QuickPick, plus
  any name by hand in settings.json); also colour the header text with a `FileDecorationProvider`
  (suggested: no, the decision of 2026-11-01 keeps that in reserve).
- **Test:** Claude: a unit test of reading the setting (known, unknown and missing names; key
  matching ignores case) and of the waiting override; a GUI-test step that writes the setting in
  the test profile and checks the header's icon class and colour. User: right-click a project,
  pick an icon and a colour, see it change in this window and another open window; a waiting
  session in that project still shows yellow; "Reset" brings back the folder.

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
- "Talking" popup picture (from to-do #11): a 2-3 frame GIF (mouth open/closed) played a few
  seconds, then held on one frame. Needs the frames drawn first; see docs/research/hooks.md,
  "Character picture in the popup".

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
