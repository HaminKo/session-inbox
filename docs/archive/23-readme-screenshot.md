# 23 — Screenshot of the status bar + sidebar in the README (small)

User's words: "Add a screenshot of the status bar + sidebar to the README (from \"Before a public
release\")".

## Problem / Goal
The README describes the UI only in words (`⚠ N waiting`, a sidebar grouped by state, worktree
badges). Someone landing on the repo can't see what they would get before installing. Goal: one
or two pictures near the top of README.md, right after the "It has two parts" list, showing the
status bar item and the open sidebar with sample sessions (one waiting 12 min in a worktree, one
done, one working).

## Read first
- `extension/test/gui/screenshots.ts`: `npm run screenshots -- statusbar` / `-- sidebar` already
  crop both shots from a real VS Code with sample data, written to the temp folder (never the
  repo). Sample names come from `extension/test/gui/samples.ts` (`demo-a`, `C:/projects/demo-a`),
  so nothing private shows.
- README.md lines 1–25 (where the picture goes); `extension/README.md` (the Marketplace page, its
  own short text; `.vsix` includes it via `extension/.vscodeignore`).
- `extension/package.json` `"package"` script: `vsce package --allow-missing-repository`. vsce
  rewrites or rejects relative image links in the packaged README when there's no `repository`
  field, which is left out on purpose (docs/decisions.md; the URL holds the GitHub login).
- docs/research/gui-testing.md (screenshot notes), docs/research/private-info-check.md.

## Approach
1. Run `npm run screenshots -- statusbar sidebar`; Claude reads both PNGs and checks they look
   right (no real names, paths, or other extensions' items; readable size).
2. Copy the chosen PNGs into a tracked folder, e.g. `docs/images/statusbar.png` and
   `docs/images/sidebar.png` (not `extension/`, so they stay out of the `.vsix`).
3. Add them to README.md with relative links and short alt text. If the shots need tweaking
   (crop, theme, more sample rows), change `screenshots.ts`, not the PNG by hand, so a later
   re-take gives the same picture.
4. Leave `extension/README.md` without images for now (relative links break on the Marketplace
   without `repository`); note it under "Decide how to distribute" in docs/todo.md.

## Ask the user
- Two separate pictures, or one combined (status bar under the sidebar)? Suggested: two, as the
  script already takes them; combine only if they look lost side by side.
- Dark (default VS Code theme in the test window) or light theme? Suggested: whatever the test
  window uses now (dark); GitHub shows it fine in both of its themes.
- Also a picture of the tray icon or a popup? Suggested: no, both are optional features; keep the
  README picture to what every user gets.
- Folder for the images: `docs/images/`? Suggested: yes.

## Test
- Claude: the README renders the images (open README.md preview in VS Code, or check the links
  resolve to tracked files with `git ls-files docs/images`); the PNGs hold no private info (read
  them); `npm run package` still passes; lint, tsc, unit and GUI tests pass if `screenshots.ts`
  changed.
- User: look at the README preview (Ctrl+Shift+V) and say if the pictures are clear and the right
  size; after pushing, check them on GitHub.

## Done (2026-11-03)
- Two pictures, one above the other, after the "Desktop popups are not part of Session Inbox"
  paragraph (it belongs to the list, so the pictures go after it): `docs/images/statusbar.png`
  (410×42) and `docs/images/sidebar.png` (747×389), dark theme, no tray or popup picture.
- `screenshots.ts`: the sidebar shot drags the sidebar 150 px wider (the message was cut to
  "Needs permis…"); the status bar shot waits for VS Code's problems counter; the sidebar shot
  freezes the spinner. Two takes in a row are byte-identical.
- `extension/README.md` keeps no pictures: `vsce package` stops on a relative image link without
  `repository` (noted under "Decide how to distribute").
- Checks: lint, tsc, 80 unit tests, 22 GUI tests (~76 s), `.vsix` builds without the images.
- Review notes left: the drag assumes the sidebar is on the left and the window wide enough (true
  for the test window); `npm run screenshots` with no names takes `window` after `sidebar`, so it
  shows the widened sidebar.
