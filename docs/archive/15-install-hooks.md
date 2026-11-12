# To do 15 — "Install hooks" command (medium)

Goal in the user's words: "Yes" to the suggestion of a command that installs the hooks for you,
with a warning when the installed hook is out of date (asked: "Is there anything else you think we
should add to this project?").

## Problem / Goal
Setup is manual: copy `hooks/session-status.ps1` into `~/.claude/hooks/`, then paste the same hook
entry into 5 event lists in `~/.claude/settings.json` (README, "Install and run"). That is the step
most likely to stop someone else using the extension, and a forgotten copy after editing the repo's
hook leaves the old version running with no sign of it.

Example: a fresh install of the `.vsix` shows `✓ all clear` forever because no hook writes status
files. With this to-do, a command "Session Inbox: Install Hooks" sets everything up, and the
extension says so when the hooks are missing or out of date.

## Read first
- README.md, "Install and run": the exact copy step, the 5 events (`PermissionRequest`, `Stop`,
  `UserPromptSubmit`, `PostToolUse`, `SessionEnd`), the hook entry, and "no `async`".
- docs/decisions.md: the status hook runs synchronously; `notify.ps1` must never be changed or
  replaced by project work; the repo's `hooks/session-status.ps1` is the source.
- docs/research/hooks.md: payload test to verify the installed hook.
- `extension/.vscodeignore`: the `.vsix` holds only `dist/`, `package.json`, `media/`, README,
  LICENSE, so the hook has to be bundled in (e.g. copied into the package at build time).
- `extension/src/renotify.ts` (`notifyScript()`, `SESSION_INBOX_NOTIFY_SCRIPT`): pattern for an
  env-overridable path under `~/.claude/`, so tests never touch the real one.
- `extension/src/extension.ts`, `extension/package.json` `"commands"`: where commands are registered.

## Approach
- Bundle `session-status.ps1` into the `.vsix` (a build step copies it; the repo file stays the
  source).
- A pure module (no `vscode` import, unit-testable) that:
  - reads `~/.claude/settings.json` (missing file → `{}`), adds the entry to each of the 5 event
    lists only if an entry running `session-status.ps1` isn't already there, leaves every other
    hook and setting as is, and writes it back;
  - refuses (and says why) if the file isn't valid JSON, rather than overwriting it;
  - backs up the old settings.json once before the first write;
  - copies the hook file if missing or different (compare contents).
- On startup: check "hook file missing / differs from the bundled one / entries missing" and show
  one warning with an "Install Hooks" button. Paths overridable by env vars for tests, like
  `SESSION_INBOX_STATUS_DIR`.

## Ask the user
- Prompt on startup when hooks are missing or out of date, or only offer the command? Suggested:
  one warning with an "Install Hooks" button, plus a "Don't ask again" saved in `globalState`.
- Keep `settings.json` formatting (comments, key order)? Suggested: Claude's settings.json is plain
  JSON, so parse and rewrite with 2-space indent; refuse if it doesn't parse.
- An "Uninstall Hooks" command too? Suggested: no, until someone asks.

## Test
- Claude: unit tests for the merge (empty file, missing file, other hooks present, already
  installed → unchanged, invalid JSON → refused) and the out-of-date check, all in temp folders.
  GUI test: the warning shows with sample temp folders. Payload test on a temp install.
- User: install the `.vsix`, run the command against the real `~/.claude/`, check settings.json
  still holds the `notify.ps1` hooks, and that popups and the inbox still work. Then edit the
  repo hook, rebuild, and see the out-of-date warning.

## Progress
- [x] **Done 2026-11-03, one step.** Command "Session Inbox: Install Hooks" and a startup warning
  (`extension/src/installHooks.ts`); the build bundles the hook into `dist/`. Choices: the user's
  "go with your suggestions" (docs/decisions.md 2026-11-02, Install Hooks). Checks: 62 unit tests,
  19 GUI tests, payload test on a temp install. User test on the real `~/.claude/`: already
  installed → no warning, "already installed", no settings backup; an edited bundled hook →
  "differs" warning, install made a backup, then restoring gave a matching hash; `notify.ps1`
  entries, popups and the inbox count still work. "Don't ask again" not user-tested (skipped).
- Left from the review: an entry with `async: true` or pointing elsewhere still counts as
  installed; `npm run watch` copies the hook only at start; `claudeDir()` doesn't share a base
  with `statusDir()`/`sessionsDir()`.
