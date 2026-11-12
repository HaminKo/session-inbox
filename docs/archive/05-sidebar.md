# 5. Sidebar view: all sessions across windows (large)

Tree view, waiting first then done then working, each with folder, how long it has waited, and a
worktree badge.

## Design (agreed with the user, 2026-11-01)
- Own Activity Bar container (inbox icon, `media/inbox.svg`) with a badge: the waiting + done count.
- Group headers `Waiting (n)` / `Done (n)` / `Working (n)`, in that order; empty groups hidden;
  all expanded. To-do #8 sorts inside the groups later.
- Row: label = `folder`; icon by state (warning / check / spinning); description =
  `worktree · 12 min · <message>` (`worktree` only for worktrees). Tooltip: full path, state, full
  message, clock time the state began.
- `working` rows show no time: their `timestamp` means last activity, not waiting since.
- Time format: `<1 min`, `12 min`, `1 h 20 min`, `2 d`; refreshed by the existing 30 s timer.
- Click does nothing yet (to-do #6). Empty view: welcome text "No Claude Code sessions running."
- Same data as the status bar: one shared source (read, live filter, watchers, timer).

## Progress
- [x] **A. Refactor (no visible change), done 2026-11-01:** `SessionSource` in
  `extension/src/sessionSource.ts` owns the read, the latest-run guard, both watchers and the 30 s
  timer; `onChange(listener)` calls back after every read with the live statuses, and replays the
  last read to a new subscriber. The status bar subscribes in `extension.ts`. After code review:
  a throwing listener doesn't stop the others, each subscription is its own entry, the loop runs on
  a copy. Not done on purpose: skipping unchanged reads (step B needs the 30 s tick to update the
  age text). Tests: 3 new unit tests (17 pass), GUI test 5/5 unchanged; user test passed with
  Ctrl+F5 (F5 crashed the host again, see docs/research/extension-toolchain.md).
- [x] **B. Sidebar, done 2026-11-01:** `extension/src/sessionList.ts` (pure: groups, order, label,
  age, description, tooltip), `extension/src/sidebar.ts` (TreeDataProvider + Activity Bar badge,
  hidden at 0), a second `source.onChange` subscriber in `extension.ts`, package.json container /
  view / `viewsWelcome`, own icon `media/inbox.svg` (shipped via `.vscodeignore`). Choices (user:
  "go with your suggestions"): oldest first inside a group, no timestamp last (to-do #8 builds on
  it); label falls back `folder` → end of `cwd` → session id; tooltip adds the date when the state
  began on an earlier day. After code review: fields of the wrong type are ignored (only
  `session_id`/`state` are checked on read), session rows have no `id` (VS Code rejects duplicate
  ids), `update` after dispose is ignored, GUI reads retry when a row re-renders. Left: the welcome
  text can flash before the first read. Tests: 24 unit pass (7 new), GUI test 9/9 (4 new sidebar
  steps), `sidebar` screenshot; user test passed. Open: a click on the status bar item opening the
  sidebar was suggested in the user test; not decided (see to-do #6).
