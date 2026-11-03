# 22 — README: popups come from a hook that isn't shipped (small)

User's words (accepting the suggestion in to-do #21): finding 1 of docs/research/readme-check.md
becomes its own to-do, as "a real decision: ship a popup hook, or say popups are optional and need
your own hook".

## Problem / Goal
The README promises things that come from `~/.claude/hooks/notify.ps1`: desktop popups, clicking a
popup to open the chat, and re-notify reminders ("its `notify.ps1` popup once more"). That hook
isn't in the repo, so a new user gets none of them. Re-notify only logs "no reminder, … not
found". Requirements doesn't say so. README line 21 ("The hooks extend an existing
desktop-notification hook") is also wrong: `hooks/session-status.ps1` never touches `notify.ps1`.
Example: someone installs the `.vsix`, runs Install Hooks, lets a chat wait 10 minutes in another
window, and no reminder ever shows.

## Read first
- docs/research/readme-check.md, finding 1 (README lines and code locations).
- README.md lines 18, 21, 59–62, 74.
- `extension/src/renotify.ts` (`notifyScript`, `sendReminder`), `extension/src/extension.ts:152-180`.
- CLAUDE.md: "never modify or replace" `notify.ps1` in project work; docs/decisions.md entries on
  `notify.ps1` (2026-11-01, 2026-11-02).

## Approach
Two options for the build session to put to the user:
- A. **Document it** (smallest): the README says popups and reminders need a separate
  `notify.ps1` hook that the user provides. It also gives the payload/arguments re-notify passes,
  so someone can write one, and fixes line 21. The extension could also show a one-time hint when
  `notify.ps1` is missing, instead of only logging.
- B. **Ship a minimal popup hook** in `hooks/` (plus Install Hooks support). This is a much bigger
  job: new hook, installer changes, tests, and it must never overwrite an existing `notify.ps1`.
  It could become its own medium to-do.

## Ask the user
- A or B? Suggested: A now; B only if the release should work for people without their own hook.
- With A, a one-time "notify.ps1 not found, reminders are off" message in the extension?
  Suggested: yes, shown once per window and only when `renotifyMinutes` > 0. Otherwise the
  feature silently does nothing.

## Test
- Claude: the README no longer promises popups without saying where they come from; for a hint,
  a unit or GUI test with no `notify.ps1` in a temp hooks folder.
- The user reads the changed README lines.

## Done (2026-11-03)
- Option A, with the warning: shown on the first reminder that can't be sent, once per window
  (again only after the script was found), button **Turn Off Reminders**; failed reminders aren't
  spent and go out once a `notify.ps1` exists. No "Learn More" button (no repository URL yet).
- Checks: lint, tsc, 80 unit tests, 22 GUI tests (new `renotify-missing.gui.ts`), `.vsix` builds.
- Review notes left: the warning appears in a background window; a `notify.ps1` that exists but
  fails isn't detected; a `.vsix`-only user has no README link until release.
