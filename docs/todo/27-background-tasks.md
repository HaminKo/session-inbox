# 27 — A reply that ends with a background task running is not "your turn" (medium)

User's words: "a reply that ends with a background task running is not \"your turn\": not counted
until the task ends, back to done if the chat restarted or after 45 min".

## Problem / Goal
`Stop` fires when a reply ends, also when Claude left a background command, agent or monitor
running and will report on it by itself ("…still running in the background. I'll report it when it
finishes."). The hook writes `done`, so the inbox counts the chat as "needs you" while it is really
still working. Measured over 7 days: 11% of replies (122 of 1,077) ended like that; the task's end
notice came after a median 4.7 min, 90% within 13.6 min, longest 38.4 min. A background task dies
with its Claude process (seen after a VS Code restart), and then no hook fires at all, so the chat
must fall back to `done` by itself. Details: docs/research/hooks.md, `Stop`.

Goal: such a reply shows as working and is not counted until the task ends (Claude's next reply
then ends with a normal `Stop`). It falls back to `done` (counted) when the chat's process
restarted since that reply, or 45 minutes after it.

## Read first
- docs/research/hooks.md, the `Stop` entry (what was measured, how a background task and its end
  notice look in a transcript).
- `hooks/session-status.ps1`: the `'Stop'` case and the status object.
- `extension/src/statusFolder.ts`: `SessionStatus`, `readLiveSessions` / `onlyLive` (`startedAt`
  of the live process), `countStates`, `summarize`.
- `extension/src/sessionSource.ts`: the 30-s refresh timer (re-checks the 45 min with no file
  event). `extension/src/sessionList.ts`: row description per state.
- `tray/session-tray.ps1` `Read-Inbox`, and `test/unit/tray.test.ts` (keeps its rules equal to
  `statusFolder.ts`).

## Approach
- Hook, on `Stop` only (PostToolUse stays as fast as now): read the transcript at the payload's
  `transcript_path` as text, no per-line JSON parse; count background tasks with no end notice yet;
  write the count as a new field, e.g. `background: 2`. `state` stays `done`, so an older extension
  or tray still counts it, as today.
- Reader, one function in `statusFolder.ts`: `done` with `background > 0` counts as `working`,
  unless its live process (`~/.claude/sessions/<pid>.json` `startedAt`) started after the status
  `timestamp` (restarted: the task died) or the status is older than 45 min. Then it is `done`
  again, with the reply's own line and time.
- Tray: the same rule in `Read-Inbox`; `tray.test.ts` keeps the two equal.
- A background task's result text starts with "Command running in background with ID:" (Bash,
  PowerShell), "Async agent launched successfully." (Agent, also without `run_in_background`) or
  "Monitor started (task …" (measured 2026-11-05, hooks.md); its end is a `<task-notification>`
  with its `<tool-use-id>`. (Built differently after the review: matched by task id, and a
  `TaskStop` call also ends a task; hooks.md.)
- A task that ends normally starts a turn by itself (no `UserPromptSubmit`; its tool calls and its
  `Stop` fire as usual), so that `Stop` recounts (measured 2026-11-05, hooks.md). Ruled out:
  Claude's own `status` in the sessions file (turns `idle` at `Stop`). A text scan with two
  regexes takes 111 ms on the largest transcript (20.8 MB); patterns in hooks.md.

## Ask the user
1. How does it look? Suggested: as Working (same group, icon and colour), the row text saying
   "background task running"; no new state.
2. Which tasks count? Suggested: background Bash/PowerShell, agents and monitors (a monitor can run
   long; the 45 min caps it).
3. The `notify.ps1` popup still fires at that `Stop`. Suggested: leave it; it is your hook (a
   separate to-do if wanted).
4. 45 min fixed or a setting? Suggested: fixed (longest measured 38.4 min); a setting later if
   needed.

## Test
- Unit: transcript text → count (started, ended, never ended, an agent without
  `run_in_background`); the reader rule (fresh → working and not counted; restarted → done;
  45 min → done; `background: 0` → done); tray rule equal.
- Hook: pipe a fake `Stop` payload with a temp transcript, check `background` in the written file.
- GUI test: a background row is under Working and the status bar doesn't count it.
- By hand: ask a chat to run a 90-second sleep in the background and end its reply → the row shows
  Working, not counted; when the task ends and Claude replies → done, counted. Start another,
  then restart VS Code → done.

## Done (2026-11-05)
- Built as suggested (all four questions: the suggested answers): looks like Working with
  "background task · <reply line>" and a "Working on a background task since HH:MM" tooltip;
  commands, agents and monitors count; the popup is untouched; 45 min fixed.
- Hook (`hooks/session-status.ps1`, `Background-Count`): on `Stop`, scans `transcript_path` as text
  and writes `background: N` (0 for other events); `state` stays `done`. Installed into
  `~/.claude/hooks/` (the old copy differed from the repo only in line endings).
- Readers: `backgroundAsWorking` in `statusFolder.ts` (applied in `SessionSource.refresh`) and
  `On-BackgroundTask` in the tray; `done` + `background` > 0 → `working`, unless the chat's live
  process started after the reply or 45 min passed; no timestamp → `done`.
- Changed after the review: tasks are matched by task id and `TaskStop` ends one (21 of 22
  TaskStops leave no notice, measured); two end regexes instead of one with `|` (312 ms → 19 ms on
  20.8 MB). Left: dev servers (3 wrong of 92 in a 1,087-reply simulation; "since the last prompt"
  was no better), the extension switching up to 30 s late at 45 min, timestamp parsing that could
  differ between JS and .NET for formats the hook never writes. docs/research/hooks.md,
  docs/decisions.md 2026-11-05.
- Checks: lint, compile, tsc, 84 unit tests (new: the rule, row text, tray equal, the real hook on
  a sample transcript), 23 GUI tests (new: a background row under Working, badge not counting
  it). The user tested it by hand from the installed `.vsix`: "Tests look good".
