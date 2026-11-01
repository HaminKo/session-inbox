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
