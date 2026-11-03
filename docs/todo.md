Next number: 16

## To do
(none)

## Before a public release
- License: **MIT** — done (LICENSE file written, README points to it).
- Search all tracked files for the "Never in tracked files" list (real name, personal paths,
  GitHub login). If old commits hold any of it, publish a fresh repo with one clean commit rather
  than rewriting history.
- A fresh subagent that hasn't seen the project checks README.md and the docs it links against the
  code, and only reports (the user decides fixes).
- Add a screenshot of the status bar + sidebar to the README (the extension has a UI).
- Start CHANGELOG.md (Keep a Changelog: Unreleased first, then versions newest first) with the
  first version.
- Decide how to distribute: VS Code Marketplace (create the `session-inbox` publisher first) or a
  `.vsix` attached to a GitHub release. Then decide the `repository` link in
  `extension/package.json` (left out because the repo URL holds the GitHub login).
- Add a 128×128 PNG icon (`"icon"` in `extension/package.json`) if publishing to the Marketplace.

## Later, only if the user asks
- **Standalone tray indicator** (not a full app): a small system-tray process reading the same
  `session-status/` folder, for a glanceable waiting count when no VS Code window is focused. See
  docs/decisions.md (2026-11-01) for why it's deferred and scoped down.
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
