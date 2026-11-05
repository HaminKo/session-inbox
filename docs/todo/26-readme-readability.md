# 26 — README readability pass (medium)

User's words: "Do parts 2 and 3", part 3 being Claude's suggestion: "A README readability pass —
turn the \"Status\" section into short, scannable feature subsections".

## Problem / Goal
README.md is correct (to-do #21 checked it against the code) but hard to scan now that the repo is
public. After the pictures comes "## Status": one 55-line block (lines 30–86) that reads like a
build log ("The status-writer hook works. …") and mixes the status bar, sidebar, grouping, project
icons, the focus row, "Open" chats, clicks, reminders, empty states and the tray icon. "Install and
run" mixes what a user needs (download, Install Hooks) with contributor steps (F5, checks, GUI
test). Goal: a visitor finds what it does, how to install it and which settings exist in a minute;
every user-relevant fact stays, reorganized and shortened, not removed.

## Read first
- README.md (whole file, ~200 lines).
- `extension/package.json` `contributes`: the three settings (`renotifyMinutes`, `trayIcon`,
  `projects`) and the commands, for a settings table.
- docs/research/readme-check.md: what #21 found, so the fixes it made aren't undone.
- CLAUDE.md "Build specifics" → Docs to update; decisions on README pictures (#23) and popups (#22).

## Approach
New order, docs only:
1. Pitch and problem paragraph (as now), then the two pictures.
2. **Features**, short `###` subsections with 2–5 bullets each: status bar; sidebar (by state, by
   project, project icons); where a project stands (focus row, with the `docs/todo.md` example);
   clicking a session; reminders; tray icon (optional). The "Open" chats and empty-state lines go
   under the sidebar.
3. **Requirements** and **Install** (user only): download the `.vsix`, Install Hooks; the by-hand
   hook setup in a collapsed `<details>` block.
4. **Settings**: a table of the three settings with defaults.
5. **Optional: desktop popups** (as now; anchors other docs link to stay the same:
   `#optional-desktop-popups`, `#install-and-run` is linked from `extension/README.md`).
6. **Development**: build from source, F5, checks, GUI test and screenshots, Node version.
7. Changelog link, Credits, License (as now).

## Ask the user
1. That order? Suggested: yes.
2. By-hand hook steps in a collapsed `<details>` block? Suggested: yes (most people use Install
   Hooks).
3. A settings table? Suggested: yes.
4. Anchors linked from elsewhere (`#install-and-run` from `extension/README.md`, which is inside
   the released `.vsix`): keep a heading with that exact name? Suggested: yes, keep
   "## Install and run" as the heading for the user install, so 0.1.0's link keeps working.

## Test
- Claude: every fact in the old "Status" and "Install and run" sections appears in the new text
  (a line-by-line check list); all links and anchors resolve (relative files exist; headings match
  `#optional-desktop-popups`, `#install-and-run`); the README pictures still show.
- User: read it in the Markdown preview (`Ctrl+Shift+V`) or on GitHub after pushing.
