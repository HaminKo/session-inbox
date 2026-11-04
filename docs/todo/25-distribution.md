# 25 — Decide how to distribute, then the repository link (medium)

User's words: "Decide how to distribute (VS Code Marketplace or a .vsix on a GitHub release), then
the repository link, from \"Before a public release\"".

## Problem / Goal
Today the only way to get the extension is to clone the repo and run `npm run package`. A public
release needs one place to get it: the VS Code Marketplace (search and install in VS Code,
automatic updates) or a `.vsix` attached to a GitHub release (download, then
`code --install-extension`). Several things wait on that choice:
- `extension/package.json` has no `repository` field and `npm run package` passes
  `--allow-missing-repository` (docs/decisions.md 2026-11-01), because the only repo URL holds the
  GitHub login, which tracked files must not hold.
- Without a repository, `vsce package` stops on relative links, so `extension/README.md` (the
  extension's own page in VS Code and on the Marketplace) has no pictures and no links (decisions
  2026-11-03, to-do #23; docs/research/extension-toolchain.md).
- CHANGELOG.md has no Keep a Changelog link references at the bottom (to-do #24).
- README.md "Install and run" only describes building the `.vsix` yourself.
- The 128×128 PNG icon item in docs/todo.md is only needed for the Marketplace.

Goal: the choice made and written down, and the repo link (or its replacement) in place, so the
release itself is only "tag, build, upload".

## Read first
- docs/decisions.md: 2026-11-01 "Publisher id `session-inbox`; no `repository` link until
  release", 2026-11-03 to-do #20 (the repo is already public; history keeps the login), #23, #24.
- docs/todo.md "Before a public release" (the icon and "At the release" items).
- `extension/package.json`: `publisher`, `"package"` and `"vscode:prepublish"` scripts;
  `extension/.vscodeignore`; `extension/README.md` (21 lines); CHANGELOG.md; README.md lines
  86–120 (requirements: Windows only; "Install and run").
- docs/local.md "GitHub" and "VS Code Marketplace" (the remote, the publisher not created yet).
- `@vscode/vsce` docs or `node_modules/@vscode/vsce/out/package.js`: how relative links and images
  are rewritten from `repository` (and its `directory`, since the extension is in `extension/`),
  `--baseContentUrl` / `--baseImagesUrl`, `--githubBranch`, `--target`.
- Outside: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
  (publisher, token or manual upload, platform-specific extensions), `gh release create --help`,
  https://keepachangelog.com/en/1.1.0/ (link references).

## Approach
1. Short research into docs/research/distribution.md (with sources): what each way needs from the
   user (accounts, tokens, an icon), what becomes public (publisher page, links), updates, and
   that the extension is Windows-only (Marketplace: `--target win32-x64` / `win32-arm64` so other
   platforms aren't offered it). Open VSX (Cursor, VSCodium) as a note.
2. The user decides; an entry in docs/decisions.md, and the 2026-11-01 one-liner in CLAUDE.md
   Decisions replaced.
3. Follow-ups for the chosen link: `repository` in `extension/package.json` (with `directory`),
   `--allow-missing-repository` dropped, the two `docs/images/` pictures and the LICENSE link in
   `extension/README.md`, CHANGELOG.md link references (`[Unreleased]`, `[0.1.0]`), README.md
   "Install and run" pointing at the release page (or the Marketplace), and the "Before a public
   release" items updated (icon kept or dropped).
4. The release itself (tag, `gh release create` or `vsce publish`) is not built here: Claude
   writes the copy-ready commands into docs/local.md, the user runs them.

## Ask the user
1. Marketplace or a `.vsix` on a GitHub release? Suggested: a GitHub release first: no Microsoft
   account, publisher or token, nothing new made public, and a Windows-only extension for Claude
   Code users is a small audience. The Marketplace can follow later (its real gain is automatic
   updates).
2. The repository link holds the login. Suggested: for a GitHub release, allow it in
   `package.json` as a written exception: people get the `.vsix` from that same repo page, so the
   link shows nothing they haven't seen. Alternative: move the repo to a free GitHub organization
   (old links redirect) so no URL holds the login; worth it mainly for the Marketplace.
3. Tag names: `v0.1.0` style? Suggested: yes (Keep a Changelog's example uses it).
4. Open VSX as well? Suggested: not now.

## Test
- Claude: `npm run package` passes without `--allow-missing-repository`; in the `.vsix`
  (`extension/readme.md`) the picture and LICENSE links point to the right `github.com/.../raw/`
  and `blob/` URLs; CHANGELOG.md link references match the tag names; lint, unit and GUI tests
  still pass (no code change expected).
- User: install the new `.vsix`, open the extension's page in the Extensions view: the pictures
  show (once `docs/images/` is pushed), the repository link opens the repo, the Changelog tab is
  there.
