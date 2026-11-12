# 18 — Each project's current focus in the sidebar (medium)

User's words: "Show each project's current focus in the sidebar. ... when I switch between
projects I lose track of what I was building. Each project can keep a short "Where we are" block
in a markdown file; Session Inbox should show it under that project's header in the Group by
project view." (They estimated it as small: roughly 50-100 lines plus tests. It is listed as
medium here because it also adds a setting, a file watcher and a GUI test step.)

## Problem / Goal
A project opts in by naming a markdown file that holds a "Where we are" section. That project's
own finish-step skill writes the section; sc-map-library is the first to use it, in
docs/todo.md:

```markdown
## Where we are
- Now: To do 31, step F3b4b (Run translated)
- Next: To do 37, 11, 59
- Updated: 2026-11-03
```

With Group by project on, the sidebar shows "To do 31, step F3b4b (Run translated)" under the
sc-map-library header. Hovering it shows the whole block, and also a stale note when "Updated" is
more than 14 days old. Group by state does not change.

## Read first
- `extension/src/sidebar.ts`: `getChildren` / `getTreeItem`. The project header's `description`
  already holds the state counts, which is one reason to put the focus on its own row (see Ask).
- `extension/src/sessionList.ts`: `groupSessions` (the project group: label, description,
  sessions, and each session's `project_dir`).
- `extension/src/projectLook.ts`: reads `sessionInbox.projects` (the `icon` key). The new `focus`
  key sits next to it.
- `extension/package.json`: the `sessionInbox.projects` schema (add `focus`, a string).
- `extension/test/gui/sidebar.gui.ts`: it already covers Group by project (the test "the
  title-bar button switches ..."), so the GUI step goes there.
- To-do #17 is changing `sidebar.ts` and `projectLook.ts` right now. Build this one after #17 is
  committed.

## Approach
- Setting: `"sessionInbox.projects": { "sc-map-library": { "icon": "map", "focus": "docs/todo.md" } }`.
  The path is relative to the project folder, and the key is matched the way `icon` is (case
  ignored). With no `focus` key nothing extra is shown, so each project opts in by itself.
- Parser: a pure function in its own module, e.g. `focus.ts`, with
  `parseFocus(text) → { now?, block, updated? } | undefined`. It takes the lines from
  `## Where we are` up to the next `## ` heading or the end of the file. `now` is the text after
  `Now:`. It handles CRLF, and leading `- ` is optional. `isStale(updated, today, 14)` is
  separate, so tests can pass in the date.
- Folder: use the project_dir of the group's first session. Sessions with the same folder name but
  different folders are already merged into one group.
- Showing it: only when `now` is found. Tooltip: a `MarkdownString` of the block, plus "Not
  updated for N days" when stale.
- Watching: one watcher per focus file that is shown, made with
  `vscode.workspace.createFileSystemWatcher(new RelativePattern(Uri.file(projectDir), path))`.
  The file is usually outside the window's workspace, so the build session checks this works there
  and falls back to `fs.watch` if not. When the file changes, re-read it and refresh the tree.
  Watchers are disposed when a project leaves the list or the setting changes.
- Missing file, missing section or no `Now:`: nothing is shown, no popup, at most one line in the
  output channel (once per file, not on every refresh).
- Read-only: the extension never writes the focus file.

## Ask the user
- Where does the "Now" line go? Suggested: its own row, the first child under the project header
  (icon `target`, not clickable). The header's description already holds the state counts and
  gets cut off when the sidebar is narrow. Other option: replace the counts in the description.
- Also show a project that has no running session? Suggested (the user's own suggestion): no, for
  now only projects that already appear.
- Should "Next:" show anywhere besides the hover? Suggested: hover only.

## Test
- Unit (`test/unit/focus.test.ts`): normal block; missing section; section without `Now:`; CRLF
  line endings; section at the end of the file (no next heading); stale and not stale around
  14 days.
- GUI step in `sidebar.gui.ts`: a temp project folder with a focus file and the setting pointing
  at it. Group by project shows the Now row. Edit the file, and the row changes. Group by state
  shows no such row.
- User, by hand from the installed `.vsix`: add `"focus": "docs/todo.md"` for sc-map-library,
  check the row and the hover, then commit a change to that file there and see the row update.

## Done (2026-11-03)
Built in one step. `focus.ts` parses the section (ends at a `#` or `##` heading; CRLF; `- `
optional) and `staleDays` (impossible dates ignored); `projectFocus()` in `projectLook.ts`. The
sidebar re-reads shown projects' focus files on every update instead of watching them
(docs/decisions.md 2026-11-03); unusable files log one line per problem in a new "Session Inbox"
output channel. Unit tests in `focus.test.ts`, a GUI step in `sidebar.gui.ts`; tested by the user
from the `.vsix` with sc-map-library. Left from the review: two folders with the same leaf share one
group and focus file; the block is rendered as markdown; absolute or `../` paths are allowed.
