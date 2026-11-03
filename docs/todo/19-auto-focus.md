# 19 — Find the focus file automatically (small)

User's words: "I feel like I shouldn't need to add the focus entry manually into the json. It
should be something I can do from the session extension itself, for example by rightclicking or
selecting a button." Agreed with Claude's suggestion: no step at all, the extension finds the file.

## Problem / Goal
To-do #18 shows a project's "Now:" line only when its `sessionInbox.projects` entry has
`"focus": "docs/todo.md"`. Every project of the user's will keep its "Where we are" block in
`docs/todo.md` (the new-project, finish-step, build-todo and add-todo skills now put it there), so
the setting is busywork: six projects to opt in by hand, plus one per new project.

Goal: with no setting, a project shown in the sidebar (grouped by project) gets its Now row when
`<project folder>/docs/todo.md` has a `## Where we are` section with a `Now:` line. Example:
PeacefreeWeb gets its block and shows its row with no change to settings.json.

## Read first
- `extension/src/sidebar.ts`: `focusPath`, `focusNode`, `reportFocus`.
- `extension/src/projectLook.ts`: `projectFocus` (today: a string or undefined).
- `extension/package.json`: the `focus` schema and the `sessionInbox.projects` description.
- docs/decisions.md 2026-11-03 (focus re-read on every update) and docs/todo/18-project-focus.md.
- README.md, the paragraph on `"focus"`.

## Approach
- `projectFocus` returns the path to read: the setting's string when there is one, `undefined`
  when it is `false` (hidden), else the default `docs/todo.md`.
- Schema: `focus` is a string or `false`. Description: the default and how to turn it off.
- Logging: a default file that's missing, or has no section, is normal (a project that hasn't got
  the block yet), so it logs nothing. Only a path set by hand logs, as today.
- Docs: README (no setting needed), a decisions.md entry (opt-in per project replaced by a
  default; the right-click "Set Focus File…" rejected as six clicks plus one per new project),
  the CLAUDE.md Decisions line, and drop the settings.json line from step 5 of
  `~/.claude/skills/new-project/SKILL.md` (added 2026-11-03, not needed any more).

## Ask the user
- Should the default path be fixed at `docs/todo.md`, or a setting of its own? Suggested: fixed;
  the per-project `focus` string covers a project that differs.
- Keep logging for a hand-set path that can't be used? Suggested: yes, as in #18.

## Test
- Unit: `projectFocus` gives `docs/todo.md` with no entry, no `focus` key, or an entry with only an
  icon; the string when set; `undefined` for `false`.
- GUI step in `sidebar.gui.ts`: a project folder with `docs/todo.md` and no setting shows the Now
  row; with `"focus": false` it doesn't.
- User, from the installed `.vsix`: remove the `focus` key from sc-map-library's entry; the row
  stays. A project without the block shows no row and nothing in the output channel.
