## Where we are
- Now: none (the Later list only when asked)
- Next: none
- Updated: 2026-11-08

Next number: 28

## To do
(none)

## Before a public release — done
0.1.0 released on 2026-11-03: tag `v0.1.0`, `session-inbox-0.1.0.vsix` on the GitHub release page.
What was done: to-dos #20–#25 (docs/todo/) and docs/decisions.md; the license is MIT. Steps for the
next release: docs/research/distribution.md, "Release steps".

## Later, only if the user asks
- VS Code Marketplace too (from to-do #25): create the `session-inbox` publisher, add a 128×128
  PNG `"icon"`, package with `--target win32-x64` and `win32-arm64` (Windows only), and upload by
  hand on the publisher page or set up GitHub Actions Trusted Publishing (Azure DevOps global
  tokens retire 2026-12-01). Open VSX (VSCodium, Cursor) would be a similar step. See
  docs/research/distribution.md.
- Cross-machine sync of session status.
- Editors other than VS Code.
- Claude-desktop-app / CLI sessions (currently VS-Code-extension sessions only).
- History / analytics of past waits.
- List dormant Claude tabs too (from to-do #14): after a VS Code restart only the visible tab
  per window starts a chat process; the others have no `<pid>.json` until shown. Would need each
  window to publish `window.tabGroups` (title only, no session id) to a shared file. See
  docs/research/hooks.md, "Not every restored tab gets a process".
- "Talking" popup picture (from to-do #11): a 2-3 frame GIF (mouth open/closed) played a few
  seconds, then held on one frame. Needs the frames drawn first; see docs/research/hooks.md,
  "Character picture in the popup".
- Custom colour for a project header (from to-do #12): rejected for now because it hides the state
  colour (see docs/decisions.md 2026-11-02); would be a `color` field next to `icon` in
  `sessionInbox.projects`.
- Projects overview (from to-do #18): a webview panel in the extension with Now/Next for every
  project that has a `focus` file, running or not. Try it after #18 has been used for a while.
  A standalone app was rejected for this (docs/decisions.md 2026-11-03).

## Writing a to-do
Each to-do starts as an entry here. When one grows past ~10 lines, move it into its own file,
docs/todo/NN-name.md. Template:

- **Title** with size (small / medium / large) and the goal in the user's words.
- **Problem / Goal:** what is wrong or wanted, with an example. For a bug or research to-do, also
  what the user has seen (it exists, where, what works) and what is already ruled out.
- **Read first:** files and functions to look at, outside references.
- **Approach:** the suggested design, what to reuse.
- **Ask the user:** open questions, each with a suggested answer.
- **Test:** what Claude checks, and what the user tests by hand.
