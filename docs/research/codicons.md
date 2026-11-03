# Codicons outside VS Code (to-do #17)

How the tray draws the sidebar's icons. Measured 2026-11-03 on VS Code 1.144.0 (the GUI test's
pinned build) and the installed one.

- The font ships with VS Code at `<appRoot>/out/media/codicon.ttf` (`appRoot` =
  `vscode.env.appRoot`, the `resources/app` folder), ~150 KB. It is not in any public API, so the
  path may move in a future VS Code; then the tray shows text only.
- Tables: `GSUB OS/2 cmap glyf head hhea hmtx loca maxp name post`. `post` is format 2 and names
  every glyph (650 glyphs, 649 named codicons). `cmap` maps the Private Use Area characters to
  glyphs. Name -> glyph -> character gives e.g. `warning` U+EA6C (matches VS Code's own
  `codicon.css`), `check` U+EAB2, `folder` U+EA83, `library` U+EB9C, `game` U+EC17.
- Aliases have no glyph name: VS Code's codicon list gives two names one character
  (`zap` and `symbol-event` are both 60038 = U+EA86 in `workbench.desktop.main.js`). Only the
  aliases among the icon pick's choices are listed by hand (`codicons.ts`); the test checks every
  choice resolves.
- Drawing: `System.Drawing.Text.PrivateFontCollection.AddFontFile`, then `Graphics.DrawString` with
  a pixel-sized font of the row height and `StringFormat.GenericTypographic` puts the glyph inside
  the square (checked by zooming the saved PNGs). `ToolStripMenuItem.Image` with
  `ImageScaling = None` shows a two-icon picture (36 x 16 at 100 %) and the menu widens its image
  margin to fit (checked by rendering a sample menu with `DrawToBitmap`).
- Dark menu: Windows' app mode is `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`
  `AppsUseLightTheme` (0 = dark). A `ProfessionalColorTable` override alone still drew the selected
  row in the system highlight blue (seen in a `DrawToBitmap` render), so the renderer also draws
  the row background itself. `DwmSetWindowAttribute(handle, 33, 2)` (round corners) is called on
  every `Opened`.
- Theme colours (VS Code's defaults, from `workbench.desktop.main.js`): `list.warningForeground`
  dark #CCA700 / light #855F00; `charts.green` dark #89D185 / light #388A34.
- Licence: Codicons are CC BY 4.0 (Microsoft); credited in README.
