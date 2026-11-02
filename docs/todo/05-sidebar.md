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
- [ ] **B. Sidebar (next):** subscribe with `source.onChange` in `extension.ts`;
  `extension/src/sessionList.ts` (pure: groups, order, age and description
  text, with unit tests), `extension/src/sidebar.ts` (TreeDataProvider + badge), package.json
  contributions, GUI-test step (headers, order, row text, badge), `sidebar` screenshot. Docs:
  README, docs/research/hooks.md, CLAUDE.md Status.
