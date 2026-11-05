# Distribution: VS Code Marketplace or a `.vsix` on a GitHub release

For to-do #25 (docs/todo/25-distribution.md). Started 2026-11-03.
Decision: a `.vsix` on a GitHub release, `repository` set (docs/decisions.md 2026-11-03).

## VS Code Marketplace (read in the docs, 2026-11-03)
Source: https://code.visualstudio.com/api/working-with-extensions/publishing-extension (page dated
2026-10-28).
- Publisher: created at https://marketplace.visualstudio.com/manage with a Microsoft account. ID
  (in extension URLs, can't be changed) and display Name (shown next to every extension) are public.
- Publishing from the command line (`vsce publish`) used an Azure DevOps personal access token
  (scope Marketplace (Manage)). **Global PATs are retired on 2026-12-01.** What remains: upload the
  `.vsix` by hand on the publisher page, or GitHub Actions "Trusted Publishing" (OIDC,
  `vsce publish --oidc`, a policy set up on the publisher first), or Azure Pipelines with Entra ID.
- Icon: `"icon"` in `package.json` must be a PNG of at least 128×128, not an SVG. (The activity
  bar's `media/inbox.svg` is a different thing and is allowed.)
- Images in README.md / CHANGELOG.md must be https URLs and not SVG (except trusted badges).
- Platform-specific packages: `vsce publish --target win32-x64 win32-arm64`. A package without a
  target is the fallback for every platform, so the Windows-only extension would be offered on
  macOS and Linux too unless it is published with Windows targets only.
- Verified-publisher badge: needs an owned domain and 6 months of history; not relevant now.
- Gain over a GitHub release: found by search in VS Code, one-click install, automatic updates.

## `.vsix` on a GitHub release (known; no research needed)
- `gh release create v0.1.0 extension/session-inbox-0.1.0.vsix --title ... --notes ...` uploads
  the file; users install it with `code --install-extension` or "Install from VSIX…".
- No account beyond GitHub, no icon needed, nothing new public. No automatic updates: a user
  re-downloads each version.
- A plain `.vsix` (no `--target`) installs on any platform; README.md already says Windows only.

## Release steps (each version)
First done for 0.1.0 on 2026-11-03 (release published 2026-11-04 03:12 UTC, the evening of the 3rd
local time; tag `v0.1.0`, one asset `session-inbox-0.1.0.vsix`; measured with `gh release view`).
1. CHANGELOG.md: the lines under `## [Unreleased]` become `## [x.y.z] - YYYY-MM-DD` (release day);
   add `[x.y.z]: …/releases/tag/vx.y.z` at the bottom and change `[Unreleased]` to compare from
   `vx.y.z`.
2. `"version"` in `extension/package.json` (and `package-lock.json`, via
   `npm version x.y.z --no-git-tag-version` in `extension/`) to the same number.
3. Commit and push; then `npm run package`, tag `vx.y.z`, push the tag, `gh release create` with
   the `.vsix` (copy-ready commands in docs/local.md, written for 0.1.0).
4. Check: download the asset from the release page and install it.

## Open VSX (note only)
Registry used by VSCodium, Cursor and similar editors; needs an Eclipse account and its publisher
agreement, published with `ovsx`. Not looked into further.

## `repository` field and links in the `.vsix` (measured: read in `@vscode/vsce` 4.1.0, `out/package.js`)
- vsce guesses the base URLs from `repository` (string or `.url`):
  `https://github.com/<owner>/<repo>/blob/HEAD` for links and `.../raw/HEAD` for images.
  `repository.directory` is **ignored**, so relative links in `extension/README.md` are resolved
  against the repo root, not `extension/` (`../docs/images/x.png` would break).
- `--baseContentUrl` / `--baseImagesUrl` override the guess; `--githubBranch` replaces `HEAD`.
- Absolute https links need no repository at all.
- Without a repository or base URLs, any relative link or image stops `vsce package` (the
  "Couldn't detect the repository" error), which is why `extension/README.md` had none before.
- Packaged with `repository` set (2026-11-03): `LICENSE` in `extension/README.md` became
  `…/blob/HEAD/LICENSE` (the root file); the manifest's Source / Issues / Learn links come from
  `repository` (vsce adds `.git` to the URL; GitHub redirects that to the repo page). The two
  `…/raw/HEAD/docs/images/*.png` URLs answered 200 `image/png`.
- With a GitHub `repository`, vsce turns `#12` in README/CHANGELOG into issue links; neither file
  has one.

## The GitHub login in the repo URL (measured 2026-11-03)
- The public commits are linked to the personal account (GitHub API `commits/<sha>`: `author` and
  `committer` are set), so the repo's front page shows that account next to the latest commit
  wherever the repo lives. Moving the repo to an organization would take the login out of URLs but
  not off the page, unless the commit email changes (rejected in to-do #20, docs/decisions.md).
- The organization name `session-inbox` was free (`api.github.com/users/session-inbox`: 404).
