# Extension toolchain

Versions and compatibility facts for the VS Code extension in `extension/`.

## Versions checked (2026-11-01, `npm view`)
Measured from the npm registry, not estimated.

| Package | Latest | Notes |
|---|---|---|
| typescript | 7.0.2 | **Don't use 7.x yet** — see below. Latest 6.x: 6.0.3. |
| typescript-eslint | 8.72.1 | peer `typescript >=4.8.4 <6.1.0`, `eslint ^8.57 \|\| ^9 \|\| ^10` |
| eslint | 10.14.0 | flat config only; node `^20.19 \|\| ^22.13 \|\| >=24` |
| @eslint/js | 10.0.1 | |
| esbuild | 0.28.2 | |
| @types/vscode | 1.144.0 | 1.100.0 also exists |
| @types/node | 26.6.6 | |
| @vscode/vsce | 4.1.0 | node `>= 22` |

Installed on this PC: VS Code 1.144.0, Node 26.13.0, npm 11.20.0.

## TypeScript is pinned to 6.0.x
typescript-eslint 8.72.1 (and its parser, `@typescript-eslint/typescript-estree`) declares
`typescript <6.1.0` as a peer dependency, so TypeScript 7 (`latest` on npm since 7.0.x) is outside
its supported range. Pin `typescript` to `~6.0.3` until a typescript-eslint release supports 7.
Check with: `npm view typescript-eslint peerDependencies`.

## Findings from building the skeleton (2026-11-01, measured)
- **npm 11 skips install scripts by default** (`allowScripts`): `npm install` warns that
  `esbuild` and `@vscode/vsce-sign` postinstall scripts did not run. Not needed so far: esbuild
  finds its platform binary (`@esbuild/win32-x64`) without it, and `vsce package` works.
  `vsce-sign` is only for signing/publishing; recheck if publishing ever fails.
- **vsce rejects relative links in README.md without a `repository` field** ("The link 'LICENSE'
  will be broken"). `extension/README.md` therefore uses plain text instead of relative links.
- **vsce renames files in the .vsix**: `LICENSE` → `LICENSE.txt`, `README.md` → `readme.md`.
  The .vsix holds only `dist/extension.js`, `package.json`, README and LICENSE (`.vscodeignore`
  is an allow-list).
- **`npm audit`: 12 moderate**, all one advisory: `minimatch <11.0.1` (ReDoS, GHSA-g3hv-75wg-m249),
  pulled in by `eslint`, `typescript-eslint` and `@vscode/vsce`; the other 11 entries are packages
  that depend on it. Dev-only; none of it ships (esbuild bundles only `src/`). The offered fix is
  `--force` (breaking) — not applied. Recheck when those packages update.
- **`@types/node` has no 20.18.x** (20.x minors published: 0–17, then 19). Pinned to `~20.17.0`
  as a subset of the Node in VS Code 1.100's Electron, which is 20.18 or later (estimated from
  the Electron 34 release line, not checked).
- **`tseslint.config()` is deprecated**; the config uses ESLint's `defineConfig` from
  `eslint/config` instead.
- **F5: the Dev Host window closed right away** (2026-11-01, from VS Code's logs in
  `%APPDATA%\Code\logs\<session>\main.log` and `windowN\exthost\exthost.log`). First try: the
  extension activated, then the window sent "terminate" 64 ms later. Next three tries: the
  extension host aborted with exit code 134 within ~1 s. Launching the same Dev Host *without*
  the debugger (`code --new-window --extensionDevelopmentPath=...`), with and without
  `--disable-extensions`, stayed open and activated the extension, so the extension code and the
  other installed extensions are not the cause; the debugger-attached launch is. First change:
  `--disable-extensions` in `.vscode/launch.json` (also keeps Claude Code, and its hooks, from
  running inside the Dev Host). Result: F5 works with it (user test, 2026-11-01). Not checked
  why the debugger plus the installed extensions crashed; not needed while they stay disabled.
- Timings: `npm run lint` 3.9 s, `npm run compile` 0.7 s, `npx tsc --noEmit` 2.0 s.

## Sources
- npm registry via `npm view <package> version|peerDependencies|engines`, 2026-11-01.
