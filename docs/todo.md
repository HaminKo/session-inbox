## Where we are
- Now: Before a public release (README screenshot of the status bar + sidebar)
- Next: the rest of "Before a public release"
- Updated: 2026-11-03

Next number: 23

## To do

## Before a public release
- License: **MIT** — done (LICENSE file written, README points to it).
- Search all tracked files for the "Never in tracked files" list — done (to-do #20, nothing to
  fix; docs/research/private-info-check.md).
- A fresh subagent that hasn't seen the project checks README.md and the docs it links against the
  code, and only reports (the user decides fixes) — done (to-do #21, findings 2–13 fixed;
  docs/research/readme-check.md). Finding 1 was To do 22 — done (popups stay the user's own
  `notify.ps1`; README "Optional: desktop popups").
- Add a screenshot of the status bar + sidebar to the README (the extension has a UI).
- Start CHANGELOG.md (Keep a Changelog: Unreleased first, then versions newest first) with the
  first version.
- Decide how to distribute: VS Code Marketplace (create the `session-inbox` publisher first) or a
  `.vsix` attached to a GitHub release. Then decide the `repository` link in
  `extension/package.json` (left out because the repo URL holds the GitHub login).
- Add a 128×128 PNG icon (`"icon"` in `extension/package.json`) if publishing to the Marketplace.

## Later, only if the user asks
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
