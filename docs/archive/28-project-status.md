# To do 28: Set a project's status by hand, kept while it's closed (large)

User, 2026-11-11: "I want to make it so you can right click a project and put a status manually -
for now, I have 2 projects I want to put on hold - PeacefreeWeb and slide-out - so I want to be able
to right click them and put an on hold status." Then: "I want to be able to manually set a status of
a project, even when it is closed and open. I might [have] a task already completed but might want
to return to it later for example."

## Problem / Goal
The sidebar only knows projects that have a running chat, and only the states the hooks write.
There is no way to note "this project is parked": a paused project with an open chat keeps counting
as "your turn", and once its window is closed it disappears, so nothing reminds you to come back.

Wanted: set a status on a project by hand ("On hold", "Come back later", ...), kept when the project
is closed, and seen in the sidebar whether it is open or closed. Clear it by hand when you're back.

Example: PeacefreeWeb's task is finished, but there's more to do later. Right-click its header →
"Set Status…" → "Come back later". Close the window. The sidebar still lists PeacefreeWeb with
"Come back later"; a click opens its folder. slide-out gets "On hold" the same way.

Limits today:
- A project shows only while one of its chats runs (docs/decisions.md, "A status file counts only
  while its chat process runs"; 2026-11-03: "only projects that already have a session appear").
- A project is the folder leaf, matched ignoring case; a worktree is its own project
  (sessionList.ts, `groupByProject`). The setting `sessionInbox.projects` is keyed by that label
  and holds no folder path, so a closed project can't be opened from it yet.

## Read first
- `extension/src/sidebar.ts`: `getTreeItem` (project header, `contextValue = "project"`),
  `pickProjectIcon` / `setProjectIcon`: the right-click "Set Icon…" this copies; `focusPath` (a
  project's `docs/todo.md`, found from a session's folder).
- `extension/src/projectLook.ts`: `projectEntry`, `projectIcon`, `withIcon` (one entry per project
  in `sessionInbox.projects`, other fields kept).
- `extension/src/sessionList.ts`: `sessionLabel`, `sessionFolder`, `groupByState`, `groupByProject`.
- `extension/package.json`: `views`, `commands`, `menus` → `view/item/context`, `commandPalette`.
- `extension/src/extension.ts`: command registration, `openSession` (`vscode.openFolder` with
  `forceNewWindow: true`, which focuses a window that already has the folder).
- `extension/src/statusFolder.ts`: `countStates`, `summarize`; `extension/src/tray.ts`
  (`trayLooks`, `.tray-looks`) and `tray/session-tray.ps1` (`Read-Inbox`), kept equal by
  `test/unit/tray.test.ts`. Only needed for step B.
- docs/decisions.md: 2026-11-02 project icon (right-click, stored in the setting); 2026-11-03 focus
  row and "Project focus goes in the extension's sidebar"; "The inbox counts waiting + done".
- docs/todo.md, Later: "Projects overview (from to-do #18)", a webview with Now/Next for every
  project. This to-do is a smaller piece of that idea; keep it a tree view.
- `extension/test/gui/sidebar.gui.ts`: "right-click on a project header sets its icon" (the GUI
  test to copy).

## Approach
Store it like the icon, in the user setting, so every window sees it and it survives restarts:
`sessionInbox.projects` → `{ "PeacefreeWeb": { "status": "Come back later", "folder": "<path>" } }`.
`folder` is saved when the status is set (the session's `project_dir`, or the window's folder), so a
closed project can be opened and its `docs/todo.md` found. A `withStatus` next to `withIcon`.

Step A: the status and where it shows.
- "Set Status…" (QuickPick: presets "On hold", "Come back later", or type your own) and "Clear
  Status" on a project header's right-click; on a session row too when grouped by state. A
  Command Palette command "Session Inbox: Set Status of This Project" for the current window's
  folder, so a project with no chat open can get one.
- A second view under "Sessions" in the same sidebar: "Projects", listing every project with a
  status, open or closed, A-Z, the status as its description, the project's icon. Click opens the
  folder (like `openSession`); the hover has the folder and the focus "Now:" line if there is one.
  Clearing the status removes it from the view. The Sessions tree keeps its rules; a project header
  there only gets the status in its description.
- New decision in docs/decisions.md (projects with a status are listed even when closed; where the
  folder comes from).

Step B: what a status changes in the count.
- A project with a status is "parked": its `done` chats no longer count in the badge, status bar and
  tray; `waiting` still counts (see "Ask the user"). Reminders follow the same rule.
- The tray copies the counting rules, so add `parked` (lowercase labels) to `.tray-looks` and the same
  rule in `Read-Inbox`. `.tray-looks` is written only while the tray is on, which is fine: it only
  matters then.
- Decision entry (changes "The inbox counts waiting + done").

Both steps: README (Sidebar feature, `sessionInbox.projects` row in the Settings table), CHANGELOG.

## Ask the user
1. Statuses: fixed list or free text? Suggested: free text with two presets ("On hold", "Come back
   later"), and every status means the same thing: the project is parked. One rule instead of one
   per status; the text doubles as a note ("Come back later: the login bug").
2. Where closed projects show: a separate "Projects" view under "Sessions", or at the bottom of the
   Sessions tree? Suggested: a separate view. The Sessions tree's two groupings both list chats, and
   a closed project has none; mixing them needs new row types in both groupings.
3. Does a parked project still count (step B)? Suggested: `done` no, `waiting` yes: a permission
   prompt means something you started is stuck. (Alternatives: nothing counts; or status is only a
   label.)
4. Should a status clear itself when you work in that project again? Suggested: no, manual only;
   the header shows it, so it's hard to forget.
5. A closed project that never had a status: set it from where? Suggested: open its window and use
   the palette command; a folder picker only if that turns out to be a bother.

Answers (user, 2026-11-11): "Go with your suggestions": 1 free text with two presets, all
meaning parked; 2 a separate "Projects" view (Claude found one cost first: the "Group by" button
moves to the Sessions header, shown on hover); 3 a parked project's `done` doesn't count, `waiting`
does; 4 cleared by hand only; 5 the palette command, no folder picker. Also: Clear removes the saved
folder too; the menu says "Set Project Status…" (it's on session rows too).
Changed after testing (2026-11-12): the user wants to pick the colour, on the text in Sessions,
and no Projects view. So: status in the label, coloured by a file decoration; closed projects as
"Closed" rows in the Sessions tree (answer 2 replaced).

## Progress
- [x] Step A: set / clear a status (right-click, palette command), shown after the project's name
  in a colour the user picks (**Set Status Color…**, `statusColor`, a file decoration on the
  label), closed projects kept as "Closed" rows (click opens the saved folder). Built 2026-11-11/12:
  `projectStatus.ts`, `projectSetting.ts` (the setting's read/write, shared with the icon),
  closed rows in `sessionList.ts` / `sidebar.ts`; typed text goes through an input box ("Type your
  own…"). A "Projects" view was built first and dropped after the user's test (docs/decisions.md
  2026-11-11). Colouring only the status text was offered as a status row of its own; the user
  kept the coloured name and status. Tested by the user from the installed `.vsix`; 93 unit and
  26 GUI tests pass. Committed 2026-11-12.
- [x] Step B: a parked project's `done` chats don't count (badge, status bar, tray); `waiting`
  still does, and reminders (only for `waiting`) needed no change. Built 2026-11-14:
  `countStates(statuses, isParked)` counts them as `parked`; `parkedTest` (sessionList.ts) matches
  the project name ignoring case; grouped by state they get a **Parked (N)** group after Open,
  before Closed (grouped by project nothing moves); the status bar hover says "Parked (done, not
  counted): N"; `.tray-looks` gets `parked` (lowercase names) and `Read-Inbox` the same rule. User
  answers ("go with your suggestions"): the Parked group, the hover line, the tray leaving them
  out. A status set or cleared re-counts from the last read (badge in `regroup()`, the status bar
  keeps its last read): an extra folder read made a second tree redraw that cancelled a hover in
  `open.gui.ts` (docs/research/gui-testing.md). Review: 2 fixes (the status bar reads the setting
  only when it changes; a test comment); left as notes: the by-project header still says "done",
  JS vs .NET lowercasing of non-ASCII names, parked rows keep the done icon. Tested by the user
  from the installed `.vsix`; 96 unit and 26 GUI tests pass.

## Test
- Unit: `withStatus` (set, clear, folder saved, other fields kept, spellings), the Projects view's
  list (open and closed, A-Z, no folder saved), the count with a parked `done` and `waiting` (step
  B), the tray script reading `parked` (tray.test.ts keeps the two counts equal).
- GUI (`sidebar.gui.ts`): right-click a header → "Set Status…" → "On hold" → the header's
  description and a row in the Projects view; the chat's process ends → the row stays; click → the
  folder opens; "Clear Status" → gone. Step B: the badge drops for a parked `done`. Screenshot of
  the sidebar.
- By hand (installed `.vsix`): set PeacefreeWeb and slide-out to "On hold", close their windows,
  check they stay listed in another window, open one by clicking, clear its status.
