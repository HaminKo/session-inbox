# To do 17 — The tray looks like the sidebar (medium)

Goal in the user's words: "update the visuals of session inbox tray icon to match how it looks in
vscode" (with a screenshot of the sidebar grouped by project: each project with its own codicon,
e.g. `</>`, a game pad, books, a database, a plain folder; a green check for done, a grey circle
for open).

## Problem / Goal
The tray (to-do #16) uses its own look: an orange badge for waiting, blue for only done, grey for
all clear, and a plain text menu ("sc-map-library - done, your turn"). The sidebar uses other
colours (yellow `warning` for waiting, green `check` for done) and shows each project's own icon
(setting `sessionInbox.projects`). Seen side by side they look like two different tools.

Example: `sc-map-library` has a finished reply. The sidebar shows the books icon in green with a
green check under it. The tray badge should be green, not blue, and its menu row should show the
books icon and a green check next to "sc-map-library".

## Read first
- `extension/src/sidebar.ts`: `colors` and `icons` (the state colours and codicons), the project
  header's icon (`projectIcon`, around line 123).
- `extension/src/projectLook.ts`: `projectIcon()`, how `sessionInbox.projects` is read.
- `tray/session-tray.ps1`: `$colors`, `New-CountIcon`, `Update-Menu`.
- docs/decisions.md 2026-11-03 (tray), and the "a project header gets its own icon, never its own
  colour" rule in CLAUDE.md Decisions.

## Approach
- Badge colours: the sidebar's state colours (waiting yellow, done green, clear grey). The tray has
  no VS Code theme, so pick fixed values close to the Dark Modern theme's `list.warningForeground`
  and `charts.green`.
- Menu rows: the state's codicon (`warning` / `check`) in its colour, then the project's codicon if
  one is set, and the label. The codicons are drawn from VS Code's own font,
  `resources/app/out/media/codicon.ttf` (in VS Code's install folder), with
  `System.Drawing.Text.PrivateFontCollection`, onto small bitmaps for `ToolStripMenuItem.Image`.
  The font's location can be passed by the extension (`vscode.env.appRoot`) as a script argument,
  so the tray needs no searching.
- The project icons: the tray reads `sessionInbox.projects` how? The extension passes it (e.g. it
  writes a small JSON next to the status files, or as an argument on start). Settled in the build.
- Keep the drift test: the -Once JSON may gain an `icon` per session; compare it with
  `projectIcon()`.
- Codicons are CC BY 4.0 (Microsoft): add to README Credits if the font is used.

## Ask the user
- Should the menu rows group by project like the sidebar (headers), or stay one row per session?
  Suggested: one row per session, with the project icon in front; a tray menu is short.
- Light theme: the tray menu is always the Windows look, not the VS Code theme. Suggested: fixed
  colours that read on both the light and dark Windows menu.
- How does the tray learn the project icons? Suggested: the extension writes
  `~/.claude/session-status/.tray-looks.json` when the setting changes (no settings.json parsing in
  PowerShell); the folder watcher must then ignore that file.
- Also the badge shape: keep the filled circle with a number? Suggested: yes, only its colours
  change.

## Test
- Claude: unit test, -Once includes the project icon and it matches `projectIcon()`; the menu
  builds with the font missing (falls back to text only). Screenshot of the menu if it can be
  captured (the tray menu is outside VS Code's window, so maybe by hand).
- User: tray badge colour matches the sidebar's state colour; menu rows show the same icons as the
  sidebar's project headers; changing a project's icon in the sidebar updates the tray menu.

## Progress
- [x] Built in one step and tested by the user 2026-11-03. Badge in the sidebar's colours (Dark
  values, black number); each menu row shows the state's and the project's codicon, drawn from
  VS Code's own `codicon.ttf`, which the extension reads (`codicons.ts`) and passes on in
  `.tray-looks`. The menu follows Windows' app mode (dark menu with outline, rounded corners on
  Windows 11). Choices and what was rejected (headers, a OneDrive-style panel): docs/decisions.md
  2026-11-03. Alias `zap` has no glyph name in the font and is listed by hand. Unit tests: the
  font reader, the drift test for `icon`, row pictures with and without the font.
