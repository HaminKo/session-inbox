# 24 — Start CHANGELOG.md with the first version (small)

User's words: "Start CHANGELOG.md (Keep a Changelog: Unreleased first, then versions newest first)
with the first version, from \"Before a public release\"".

## Problem / Goal
There is no record of what the extension does per version. A user who installs a later `.vsix`
can't see what changed, and the finish-step skill already says "If CHANGELOG.md exists ... add one
plain-language line under Unreleased", so nothing gets written until the file exists. Goal: a
CHANGELOG.md in the Keep a Changelog 1.1.0 shape: a short header, `## [Unreleased]` first (empty
for now), then the first version listing what the extension does today in plain language (the
sidebar, the status bar count, the hooks, the tray icon, ...), not a list of to-dos.

## Read first
- README.md lines 1–30 (the feature list) and "Install and run": the plain-language source for the
  first version's entries.
- `git log --format='%h %ad %s' --date=short`: the "To do N:" / "Finish to-do" commits, to check
  nothing user-visible is missed (to-dos 1–23; skip refactors, tests, docs-only).
- `extension/package.json`: `"version"` (now `0.0.1`), `contributes` (commands and settings to
  name), the `"package"` script (`vsce package --allow-missing-repository`).
- `extension/.vscodeignore`: a whitelist; a `CHANGELOG.md` in `extension/` is packed only with
  `!CHANGELOG.md` (vsce shows it as the Marketplace "Changelog" tab).
- `extension/README.md` and `extension/LICENSE`: tracked copies kept by hand next to the root ones.
- `.claude/skills/finish-step/SKILL.md` (the Unreleased rule), CLAUDE.md "Build specifics"
  (CHANGELOG.md is already in "Docs to update ... once it exists").
- https://keepachangelog.com/en/1.1.0/ (sections Added / Changed / Fixed / Removed; dates
  YYYY-MM-DD; link references at the bottom).

## Approach
1. Write CHANGELOG.md at the repo root: header, `## [Unreleased]`, then the first version with an
   `### Added` list grouped by what the user sees (status bar, sidebar, click to open, hooks and
   Install Hooks, tray icon, focus row, settings). One line each, no to-do numbers.
2. No link references at the bottom (`[Unreleased]: https://github.com/...compare...`): they need
   the repo URL, which holds the GitHub login and is undecided (same reason as the missing
   `repository` field). Add them under "Decide how to distribute".
3. For the `.vsix` (VS Code's "Changelog" tab on the extension page, and the Marketplace's): the
   `vscode:prepublish` script (run by `npm run package`) copies `../CHANGELOG.md` into
   `extension/`, the way `bundle` copies the two `.ps1` files into `dist/`;
   `extension/CHANGELOG.md` is gitignored and `.vscodeignore` gets `!CHANGELOG.md`. One source,
   no hand copy to forget.
4. CLAUDE.md "Docs to update": drop "once it exists".

## Ask the user
- Number and date of the first version? Suggested: `0.1.0` (first release-ready state; `0.0.1`
  reads as a placeholder), bump `extension/package.json` to match, dated the day it is written;
  a later public release that adds more moves Unreleased into the next number as usual.
- Root only, or also in the `.vsix` (the "Changelog" tab)? Suggested: also in the `.vsix`, copied
  by `vscode:prepublish` (Approach 3), not by hand like `extension/LICENSE`: finish-step only
  updates the root file, so a hand copy would fall behind at every step.
- List the hooks and tray (outside the extension) in the same file? Suggested: yes, one changelog
  for the whole repo; they ship inside the `.vsix` (`dist/session-status.ps1`,
  `dist/session-tray.ps1`).

## Test
- Claude: every line matches the code and README (no feature that doesn't exist, none missing
  from the README feature list); `npm run package` still builds and the `.vsix` holds
  `extension/CHANGELOG.md` equal to the root one (open the `.vsix` as a zip);
  `git status` doesn't show the copy.
- User: read CHANGELOG.md on GitHub's preview (or VS Code's Markdown preview) and say whether
  every line is clear without knowing the project's history.

## Done (2026-11-03)
- CHANGELOG.md at the root: an empty `## [Unreleased]`, then `## [0.1.0] - 2026-11-03` with 12
  `### Added` lines written from the README feature list and checked against the to-do commits and
  `package.json` (commands, settings). No link references (they wait for the repo URL).
- Version `0.0.1` → `0.1.0` in `extension/package.json` and `package-lock.json`; README install
  commands follow.
- `vscode:prepublish` copies the file to `extension/CHANGELOG.md` (gitignored, `!CHANGELOG.md` in
  `.vscodeignore`). The first build copied it in `bundle`; the review moved it, because `bundle`
  also runs on every compile, GUI test and screenshot run.
- Checks: lint, tsc, 80 unit tests, 22 GUI tests; the `.vsix` holds `extension/changelog.md`,
  byte-identical to the root file, listed as the manifest's Changelog asset. The user saw the
  Changelog tab in VS Code's extension page.
- Review fixes: "remembered for all windows" → "others take it on reload"; the stale-date note on
  the focus row added; a release note under "Before a public release".
