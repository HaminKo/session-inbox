# GUI testing the extension

How the extension's UI is tested in a real VS Code window, and what was measured. Decision:
docs/decisions.md (2026-11-01, "GUI test: Playwright drives a pinned VS Code").

## Setup (to-do #3, 2026-11-01)
- `@vscode/test-electron` (`downloadAndUnzipVSCode`) downloads a pinned VS Code (`1.144.0`, in
  `extension/test/gui/launch.ts`) into `extension/.vscode-test/` (gitignored cache).
- `playwright-core` `_electron.launch()` starts that `Code.exe` with `--disable-extensions`,
  `--extensionDevelopmentPath=extension/`, and a temp `--user-data-dir` / `--extensions-dir`
  (deleted on close). It returns the workbench window as a Playwright `Page`.
- The test (`test/gui/*.gui.ts`, run by `node --test`) reads the real DOM: the status bar item
  has the id `<publisher>.<name>` = `session-inbox.session-inbox`; its label text, the
  `.codicon-inbox` icon, and the hover tooltip (`.monaco-hover`) after a real mouse hover.
- Flaky, 2026-11-02 (to-do #14, measured): `statusbar.gui.ts` "hovering the item shows the
  breakdown" failed 4 runs in a row, also at commit 7d7e81c without the #14 changes (run from a
  separate worktree): the first visible `.monaco-hover` read "Open Folder", another hover, not the
  item's tooltip. ~~Fails every run~~ (wrong): the full suite passed 17/17 later the same day,
  after a VS Code restart. Cause not looked into. Same day `open.gui.ts` timed out once (3 tests, 30 s each) and
  passed the 2 runs after it: flaky, cause unknown.
- Test files are TypeScript run directly by Node 26 (type stripping; no build).
  `extension/test/package.json` sets `"type": "module"` for that folder only. The root
  package.json stays CommonJS because `dist/extension.js` is a CJS bundle. tsconfig gets
  `allowImportingTsExtensions` + `erasableSyntaxOnly` so `tsc` accepts `./launch.ts` imports and
  rejects syntax Node can't strip.

## Measured (2026-11-01, this PC)
- `npm install` of both packages: 3.6 s, node_modules 128 → 145 MB (+17 MB). No browser download
  (`playwright-core` uses VS Code's own Electron).
- VS Code 1.144.0 win32-x64 archive download: 347 MB, once.
- `npm run test:gui`: ~8 s total (compile, launch ~2.5–4.5 s, 2 tests). That's under 15 s, so it
  runs every step.
- Our status bar item appears a few seconds after the window (activation is `onStartupFinished`).
  It was missing at 3 s once and present at 12 s, so the test waits for it, up to 20 s.
- `npm run screenshots`: ~5.6 s. `statusbar.png` 447×42 px (931 bytes); `window.png` 1800×1200 px
  (35 KB). The window is 1200×800 CSS px at 150 % display scaling.
- Token cost (estimate, width × height / 750): statusbar ≈ 25 tokens, window ≈ 2,900 tokens.

## Sidebar (to-do #5 step B, 2026-11-01, VS Code 1.144)
- Activity Bar entry: `.activitybar .action-item` whose `.action-label` has
  `aria-label="Session Inbox - <badge tooltip>"` (e.g. `Session Inbox - 2 sessions need you`). The
  badge number is `.badge-content` inside it, and shows before the view was ever opened.
- The `.badge` div covers the `.action-label` link, so Playwright's click on the link times out
  ("intercepts pointer events"). Click the `.action-item` instead.
- Tree rows: `#workbench\.parts\.sidebar .monaco-list-row` (role `treeitem`), text in
  `.label-name` and `.label-description`, icon `.custom-view-tree-node-item-icon` with
  `codicon-<name>` (`loading~spin` becomes `codicon-loading codicon-modifier-spin`). Rows appear a
  moment after the click: a count taken 1.5 s later in a probe was 0 once, so the test polls.
- A row's `aria-label` is its tooltip when the tooltip is a plain string.
- Empty tree: the `viewsWelcome` text is in `.welcome-view-content`.
- `locator.evaluateAll((el) => ...)` fails lint here: tsconfig has no DOM lib, so `el` is
  unresolved (`no-unsafe-member-access`). Use `locator.all()` with `innerText` / `getAttribute`.
- Measured: `npm run test:gui` 16–25 s for 9 tests (two VS Code launches, one per `.gui.ts` file;
  the first launch took 5.5 s in one run, 12.9 s in the next).
  `sidebar.png` 522×389 px; estimated ≈ 270 tokens. (Out of date since to-do #23: the shot widens
  the sidebar, now 747×389 px, ≈ 390 tokens; see "README pictures" below.)

## README pictures (to-do #23, 2026-11-03, VS Code 1.144)
- `docs/images/statusbar.png` and `docs/images/sidebar.png` are copies of
  `npm run screenshots -- statusbar sidebar`, unedited (docs/decisions.md 2026-11-03).
- At VS Code's default sidebar width the waiting row's message is cut to "Needs permis…". The
  `sidebar` shot widens it: a Playwright mouse drag from the sidebar's right edge
  (`x + width`, its sash) 150 CSS px to the right (`mouse.down`, `move` in 5 steps, `up`). It works
  at the first try; the shot throws if the sidebar didn't grow by at least 100 px. Each launch has
  its own temp `--user-data-dir`, so the width doesn't carry over to the GUI test.
- VS Code's problems counter (`⊗ 0 ⚠ 0`, `[id="status.problems"]`) sits right of our item and is
  drawn a moment later: in the first take it was there, in the next not yet. The `statusbar` shot
  now waits for it, so it is always in the picture. The crop is `item + 150 px` either way.
- The working row's spinner made two sidebar takes differ; `screenshot({ animations: "disabled" })`
  stops it at its first frame. Measured after both fixes: two takes in a row are byte-identical
  (`cmp`), for both PNGs.
- Measured: `sidebar.png` 747×389 px (8.2 KB, ≈ 390 tokens estimated); `statusbar.png` 410×42 px
  (1.2 KB).
- Both PNGs hold only `IHDR`, `IDAT`, `IEND` chunks: no text or EXIF metadata.
- A VS Code bump in `launch.ts` may change the pictures: re-take them and compare.

## Row clicks and windows (to-do #6, 2026-11-01, VS Code 1.144)
- `launchVsCode(env, folder)` opens a folder in the test window. Window titles come from the main
  process: `app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => w.getTitle()))`
  (Electron's types aren't installed: type the argument by hand).
- Dead end: `.label-name:text-is("demo-other")` never matches a tree row's label (measured: count 0
  while `innerText` is exactly `demo-other`); `filter({ hasText: "demo-other" })` works.

## Dead end: `ELECTRON_RUN_AS_NODE`
The first launch failed with "Process failed to launch!". Running with `DEBUG=pw:browser*` showed
`Code.exe: bad option: --disable-extensions` (and the same for every VS Code flag). A shell inside
VS Code (terminal, task, Claude) inherits `ELECTRON_RUN_AS_NODE=1`, so Code.exe ran as plain
Node. Fix: `launch.ts` passes `env` without that variable. Playwright's own `--inspect=0` /
`--remote-debugging-port=0` flags work with VS Code 1.144, so the `connectOverCDP` fallback wasn't
needed.

## Failure shown on purpose
With `item.text` changed to `"$(inbox) Session Inbx"`, the test failed with
`AssertionError: status bar item text was "Session Inbx"`. The source was restored afterwards.

## Sources
- https://github.com/microsoft/vscode-test (`downloadAndUnzipVSCode`)
- https://playwright.dev/docs/api/class-electron
- VS Code's own smoke tests drive the workbench with Playwright (microsoft/vscode, `test/automation`).
