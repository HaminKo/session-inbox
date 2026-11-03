# Decisions

Newest first. Each entry: the date and decision as the heading; then the reason, who decided, and
what was rejected and why.

## 2026-11-02 — Install Hooks: "differs", not "out of date"; back up before replacing (to-do #15)
- Decision: a command "Session Inbox: Install Hooks" copies the bundled `session-status.ps1` into
  `~/.claude/hooks/` and adds a new group `{ "hooks": [entry] }` to each of the 5 events in
  `~/.claude/settings.json` that has no hook naming `session-status.ps1` (any path counts). Other
  groups, including `notify.ps1`'s, are not touched. `settings.json` is parsed and rewritten with a
  2-space indent; one that doesn't parse (or whose `hooks` has the wrong shape) is refused and left
  as it is. It is saved once as `settings.json.before-session-inbox` (never overwritten). A hook
  file that differs from the bundled one is backed up to `~/.claude/hooks/backups/` before it is
  replaced. At startup each window shows one warning when something is missing or differs, with
  "Install Hooks" and "Don't ask again" (saved in `globalState` for that bundled hook's hash, so a
  new version asks again). No Uninstall command.
- Reason: a differing hook isn't necessarily older: while developing, the installed hook can be
  newer than the one in the `.vsix`. So the warning only says "differs", and the button (itself the
  confirmation) never loses a version thanks to the backup.
- Decided by: the user ("go with your suggestions" on Claude's questions).
- Rejected: calling it "out of date" (can't be told from the bytes); a version number in the hook
  (one more thing to bump by hand); a second confirmation before replacing (the backup covers it);
  editing inside the existing `notify.ps1` group (touches another hook's entry); keeping comments /
  formatting of `settings.json` (it's plain JSON); an Uninstall command (not asked for).

## 2026-11-02 — A project header gets its own icon, not its own colour (to-do #12)
- Decision: right-click a project header (grouped by project) for "Set Icon…" (a QuickPick of ~25
  curated codicons) or "Reset Icon". Stored in the user setting `sessionInbox.projects`
  (`{ "<project>": { "icon": "map" } }`, scope `application`, key matched ignoring case), so every
  open window redraws at once (`onDidChangeConfiguration`) and it can be edited by hand. The icon
  keeps its state colour. A malformed name falls back to the folder; a well-formed unknown name
  draws an empty icon (VS Code doesn't tell an extension which codicons exist). The entry is an
  object so more fields (colour, display name, pinning) can be added later without a format change.
- Reason: the goal is to tell projects apart at a glance; an icon's shape does that, and leaving the
  colour to the state keeps the "needs you" glance intact.
- Decided by: the user, after asking for the honest drawbacks of custom colours.
- Rejected: a custom colour per project (with yellow forced back while waiting): it hides "done"
  (green, your turn), most of the usable theme colours (`charts.*`) already mean a state, a
  QuickPick can't show colour swatches, and it was ~a third of the work. In "Later" in
  docs/todo.md. `globalState` for the setting: no change event, so other windows would only update
  on reload. Colouring the header text (`FileDecorationProvider`): still in reserve (2026-11-01).

## 2026-11-02 — Stacked popups fall down to fill a gap, by gravity (to-do #13)
- Decision: `notify.ps1` was edited in place (fifth exception: `ClaudePopup.Fall()`, a few fields,
  one line in the 500 ms timer tick). On every tick each popup rests 8 px above the nearest other
  folder's popup below it in its column, or in the corner if none; it only moves down, as a jump,
  and not while the mouse is over any popup or over the gap it would fall into. Placement of a new
  popup is unchanged, but the older popup of the same folder now closes after the new one shows
  (`CloseOlder` skips this process's own popups), not before. Backup:
  `~/.claude/hooks/backups/notify.ps1.before-fall-down-2026-11-02`.
- Reason: closing a middle popup left a gap until a new popup happened to land there. The mouse
  guard keeps a popup from dropping under the cursor after an X click (the clicked popup is gone at
  once, so "over a popup" alone missed that case; found in review). Closing the older popup first
  would let the popups above fall into its slot before the replacement shows: the stack would
  reshuffle on every re-notify, or overlap for good if the replacement had already picked that
  slot (found in review).
- Decided by: the user, on Claude's suggestions.
- Rejected: one shared "lowest free spot" rule for placement and ticks (the to-do's first approach):
  each popup is its own process, so with `a b c d` and `b` closed, `c` and `d` would both jump into
  `b`'s slot on the same tick. Gravity moves a stack one level per tick, so they can't collide. A
  slide animation (more code for little gain); a delay after the mouse leaves (the next tick is enough).

## 2026-11-02 — Running chats with no status file are shown as `open`, not counted (to-do #14)
- Decision: a running `~/.claude/sessions/<pid>.json` with `entrypoint: "claude-vscode"` and
  `kind: "interactive"` whose session has no status file is listed with a fourth state, `open`
  (made by the extension, never read from a status file): project from its `cwd`, time from
  `startedAt`. Grey, last, no age in the row; grouped by state the "Open" group starts collapsed.
  Not in the badge or status-bar count; the status-bar tooltip adds "Open (no status yet): N".
  The `status` field (`idle`/`busy`) is not used.
- Reason: after a VS Code restart the restored chats run but no hook fires until their next prompt,
  so the inbox was empty. Their old state is lost; counting 8 "needs you" after a restart is noise.
  `cwd` in `<pid>.json` stays the start folder (measured, docs/research/hooks.md).
- Decided by: the user, on Claude's suggestions.
- Rejected: a `SessionStart` event in the status hook (more hook surface; new tabs showing "Open"
  is accurate anyway); using `status: busy` as `working` (undocumented, and a busy chat writes a
  real status within seconds); collapsing project headers too (VS Code keeps a header's collapse by
  id, so a project could stay collapsed after a waiting chat joins it); CLI chats (Later).
- Known gaps: an open chat in a worktree has no `worktree` tag until its first hook event; a
  leftover `<pid>.json` whose PID is reused by another process would show a ghost "Open" row (no
  leftover file seen so far).

## 2026-11-01 — Re-notify once per wait, from the chat's own window, through `notify.ps1` (to-do #7)
- Decision: a chat in `waiting` longer than `sessionInbox.renotifyMinutes` (default 10, `0` = off)
  gets one more `notify.ps1` popup per wait, sent by the window that has its `project_dir` open, with
  the made-up event `SessionInboxReminder` ("Still waiting (N min): <message>"). `done` chats get
  none. What was sent is kept in memory only. `notify.ps1` is not changed.
- Reason: `notify.ps1` popups already stay up until acted on, so a reminder only covers a popup
  dismissed with X or a window looked at and left; once is enough for that. `done` can sit for hours
  on purpose. The folder rule (as for `.reveal`) keeps several windows from each sending one.
- Decided by: the user, on Claude's suggestions.
- Rejected: repeating reminders (noise over a popup that stays); reminding `done` chats; saving
  "sent" to disk (state for the reload edge case); a new event branch in `notify.ps1` (its `default`
  branch already shows the message).
- Known limit, kept (2026-11-02, user went with Claude's suggestion): `notify.ps1` keeps one popup
  per folder, so a reminder replaces any popup that project shows, also a newer one from another
  chat in the same folder. Rare (two chats in one folder overlapping) and the sidebar lists both;
  merging reminders or changing `notify.ps1` was rejected as more code than the case is worth.

## 2026-11-01 — A click shows the chat's own Claude tab through a `.reveal` file (to-do #9)
- Decision: a popup click (`notify.ps1`) and a sidebar click on another window's chat write
  `~/.claude/session-status/.reveal` (`session_id`, `project_dir`, `at`). Each window's Session Inbox
  watches it; the window that has `project_dir` open, for a request at most 15 s old, runs Claude
  Code's internal command `claude-vscode.primaryEditor.open(<session id>)`, which brings that chat's
  tab to the front (or reopens it as a tab). A sidebar click on a chat of its own window calls the
  command directly. If the command fails or is gone, the window still comes up as before (error
  logged). `notify.ps1` was edited in place for this (fourth exception: `Write-RevealRequest`, a few
  lines in the click handler).
- Reason: Claude Code can reveal a session by id (docs/research/claude-tabs.md), but a `vscode://`
  URI goes to the focused window, and in the wrong one Claude Code opens a second copy of the chat.
  The file reaches the right window, needs no "Allow this URI?" prompt and serves both clicks.
- Decided by: the user, on Claude's suggestions.
- Rejected: opening `vscode://anthropic.claude-code/open?session=<id>` from the popup (simpler, but
  races the focus change, can duplicate the chat, prompts once, and can't serve the sidebar);
  our own URI handler (same routing problem). Known risk: the command is undocumented and may
  change with a Claude Code update.

## 2026-11-01 — A sidebar click opens the folder through VS Code, not `notify.ps1`'s window search (to-do #6)
- Decision: a session row's click runs `vscode.openFolder` on the session's `project_dir` (new
  status-file field) with `forceNewWindow: true`. VS Code focuses the window that already has the
  folder open, or opens a new window. Files without `project_dir` use `cwd` only while its last part
  is the project folder; otherwise a message says the folder isn't known yet. Only session rows
  react; project headers keep expand/collapse. Sessions from a plain terminal open the same way. The
  status bar item's click opens the sidebar (`workbench.view.extension.sessionInbox`).
- Reason: all VS Code windows run in one main process, and the user's click in one of them lets it
  take the foreground, so none of `notify.ps1`'s focus fallbacks are needed; "open if no window"
  comes free. Reusing `notify.ps1`'s method would start PowerShell and compile C# per click (~1 s)
  and copy ~100 lines of focus code.
- Decided by: the user, on Claude's suggestions.
- Rejected: `notify.ps1`'s title search + `SetForegroundWindow` (slower, duplicated); a click on a
  project header (it already expands/collapses). Known limit: a window opened from a
  `.code-workspace` file isn't matched by folder, so a click opens a second window; left for now.

## 2026-11-01 — Exception: `notify.ps1` popups show a character picture (to-do #11)
- Decision: `notify.ps1` was edited in place (third exception). A 96 px picture sits left of the
  text: `notify-images/<event>.png`, else `notify-images/default.png`, else no picture and the popup
  exactly as before. With a picture the popup is 104 px wider (524 px at 100%); the text keeps its
  width. Still, not animated. `default.png` is a 192 px head-and-neck crop of the user's picture,
  kept next to the 1.3 MB original. Details: docs/research/hooks.md, "Character picture in the popup".
- Reason: the user wanted "an anime girl talking picture next to the notifications", as if she says
  the persona opening line.
- Decided by: the user (approved editing it and all of Claude's suggestions: crop, per-event names
  with a default fallback, still first, wider popup).
- Rejected: narrower text instead of a wider popup (4 lines would no longer fit); a separate
  picture per event now (only one picture exists; per-event files need no code later); the
  animated GIF for now (no frames exist; noted under Later in docs/todo.md); scaling the 1.3 MB
  original on every popup (a small pre-cut copy loads faster).
- Backups: `~/.claude/hooks/backups/notify.ps1.before-picture-2026-11-01` and
  `notify.ps1.picture-2026-11-01`. Installed with a shell copy; hash checked.
- Addendum, same day (user's follow-up, "since it's tall enough, shouldn't we use the bigger
  original picture?"): `default.png` is now a taller cut, 96×132 (saved 192×264), top-aligned and cut
  off by the popup, so she fills a 4-line popup and a 2-line one looks as before. Any picture is
  96 px wide and as tall as its shape. Rejected: loading the 1.3 MB original (decoded on every
  popup, and resolution was not the problem); a bigger square that grows with the popup (the popup
  would widen with its height and stacked popups would have ragged left edges). Backups:
  `notify.ps1.before-tall-picture-2026-11-01`, `notify.ps1.tall-picture-2026-11-01`,
  `default.png.square-2026-11-01`.

## 2026-11-01 — Exception: both hooks name the project by the folder the chat started in
- Decision: `notify.ps1` and `session-status.ps1` take the project folder from
  `$env:CLAUDE_PROJECT_DIR`, else from the chat's `~/.claude/sessions/*.json` (matched by
  `sessionId`, its `cwd`), else the payload `cwd` as before. One `Project-Dir` function, copied
  word for word into both. The status file's `cwd` stays the payload's (current shell folder);
  `folder`, `worktree` and `worktree_name` come from the start folder.
- Reason: the payload `cwd` follows the chat's shell; after a `cd extension` a click logged
  `no VS Code window found` because the popup was named "extension" (docs/research/hooks.md).
  `CLAUDE_PROJECT_DIR` was measured set for hooks in the VS Code extension and stayed on the
  repo root while `cwd` was the subfolder; the session-file fallback was tested with a fake payload.
  No measurable cost on the status writer (404-499 ms per run either way, mostly powershell.exe start).
- Decided by: the user, on Claude's suggestion (asked to fix the window not coming to front).
  Changing `notify.ps1` is an exception to "never modify it"; backups in `~/.claude/hooks/backups/`:
  `*.before-project-dir-2026-11-01` and `notify.ps1.project-dir-2026-11-01`.
- Rejected: walking up the folders until a VS Code window matches (fixes only the click, and a
  window search is too slow for the status writer); the git root (wrong when a window opens a
  subfolder of a repo).

## 2026-11-01 — To-do #8 groups by project instead of sorting by name
- Decision: the sidebar's title-bar button switches between grouping by state (Waiting / Done /
  Working, oldest first; the default) and grouping by project: one header per row label (the
  folder; a worktree is its own project), A-Z ignoring case with numbers by value, the header's
  description summing up its states (`1 waiting · 1 done`), sessions underneath ordered waiting,
  done, working, oldest first. Two levels, no state sub-groups. Saved in `globalState`; other open
  windows follow only after a reload (`globalState` has no change event). Headers get a folder
  icon in the colour of their most urgent state; row icons are coloured too (waiting
  `list.warningForeground`, done `charts.green`, working `charts.blue`); rows under a project are
  labelled with their state, not the project name again.
- Reason: the user wants a quick glance at one project's status; a name sort inside state groups
  (built first) still scatters a project over three groups.
- Decided by: the user, on Claude's suggestions (to-do #8, after testing the sort).
- Header look: the user asked for clearer headers (indent, bold, colour or dividers). A tree view
  can't set bold, label colour, dividers or indent (`workbench.tree.indent` is a global user
  setting), so: an icon on headers and no repeated names in rows; then, asked for colour, coloured
  icons. Kept in reserve, user to decide after seeing the icons: colouring the header text through
  a `FileDecorationProvider` (a workaround, ~25 lines; a list of green names may feel loud).
- Rejected: project > state > sessions (three levels): most projects have one or two sessions, so
  a state level mostly repeats the row's state icon; sorting by name inside the state groups (the
  original plan): replaced by the grouping; projects needing you first: positions would jump, which
  defeats the glance; worktrees under their main repo: the status file doesn't record the main
  repo, so it needs a hook change (possible later to-do).

## 2026-11-01 — Sidebar sorts oldest first inside each state group
- Decision: inside Waiting / Done / Working, the session with the oldest `timestamp` comes first;
  rows without a readable timestamp go last.
- Reason: the session that has waited longest is the one most likely forgotten; one line of code,
  and to-do #8 (sort by name or time) keeps it as its "by time" mode.
- Decided by: the user, on Claude's suggestion (to-do #5 step B).
- Rejected: file-name order (what the status bar read gives): looks random to the user.

## 2026-11-01 — Leftover status files are hidden when their chat process is gone
- Decision: the extension reads Claude Code's own `~/.claude/sessions/<pid>.json` files (`pid`,
  `sessionId`) and counts a status file only if its session has a running process (checked with
  `process.kill(pid, 0)`). It hides, never deletes. Fail-safe: if that folder is missing or empty, or
  any of its files can't be read (mid-write) or lacks a valid `pid`/`sessionId`, nothing is
  hidden on that refresh. It watches that folder too (a process that
  exits removes its file) and re-checks every 30 s (a killed process may leave its file). No age
  limit; no manual "clear" now (fits the sidebar, to-do #5). Tests use
  `SESSION_INBOX_SESSIONS_DIR`.
- Reason: a process check works however a chat ended (tab, window, quit, crash), so the close
  paths that skip `SessionEnd` don't have to be known; hiding means a wrong guess never loses an
  open chat. Research: docs/research/hooks.md.
- Decided by: the user, on Claude's suggestions (to-do #10).
- Rejected: the hook recording its own `claude.exe` PID by walking up its parent processes
  (independent of Claude's internal format, but a process lookup on every `PostToolUse`, est. a
  few hundred ms, not measured); matching `--resume=` on the command line (new chats don't have
  it); an age limit for `done` files (a chat left open overnight really is waiting); deleting the
  files (a wrong guess would lose a live chat's status).
- Risk: `~/.claude/sessions/` is undocumented and may change in a Claude Code update; the fail-safe
  then shows leftovers again rather than hiding live chats.

## 2026-11-01 — GUI test: Playwright drives a pinned VS Code
- Decision: `@vscode/test-electron` only downloads VS Code `1.144.0` (pinned, bumped by hand);
  `playwright-core` launches it with the extension and checks and screenshots the real workbench
  DOM. Test files are `*.gui.ts`, run by `node --test` with Node's type stripping.
- Reason: tests inside the extension host can't see the rendered window or take screenshots.
  Pinning avoids re-downloading ~350 MB after every VS Code release.
- Decided by: the user, on Claude's suggestion.
- Rejected: extension-host tests only (no screenshots, no check of what's drawn); downloading
  "stable" (re-download per release); 1.100.0 as the test version (it could be added later as a
  second run); a separate build step for the test files (Node 26 runs them directly).

## 2026-11-01 — Publisher id `session-inbox`; no `repository` link until release
- Decision: `extension/package.json` uses publisher `session-inbox` (not created on the Marketplace
  yet) and has no `repository` field; `npm run package` passes `--allow-missing-repository`.
- Reason: both are public. The publisher id must not be the GitHub login or real name, nor contain
  "claude" (it would look official). The only repo URL contains the GitHub login, which tracked
  files must not hold. Whether to publish at all is open ("Before a public release" in
  docs/todo.md).
- Decided by: the user, on Claude's suggestion.
- Rejected: the GitHub login as publisher id; the GitHub repo URL in package.json now.

## 2026-11-01 — TypeScript pinned to `~6.0.x`; VS Code minimum `^1.100.0`
- Decision: `typescript ~6.0.3`; `engines.vscode ^1.100.0` with `@types/vscode ~1.100.0` and
  `@types/node ~20.17.0` (no 20.18 types exist; see docs/research/extension-toolchain.md).
- Reason: typescript-eslint 8.72.1 supports only `typescript <6.1.0` (npm `latest` is 7.0.2;
  docs/research/extension-toolchain.md). The APIs this project needs are old, so a lower VS Code
  minimum lets more installs use it; matching the types to the minimum makes the compiler reject
  newer APIs.
- Decided by: the user, on Claude's suggestion.
- Rejected: TypeScript 7 (outside typescript-eslint's peer range); `^1.144.0`, the installed
  version (would exclude older VS Code for no gain).

## 2026-11-01 — Exception: `notify.ps1` popups are taller and show more of the reply
- Decision: `notify.ps1` was edited in place. The `Stop` popup now shows the start of the reply:
  the first line (the headline) on its own line, then the next lines as one paragraph, up to 280
  characters, stopping at a code block, an insight block or a table. The popup fits its text: 2 to 4
  body lines, 420×96 to 420×132 px at 100% scale (it was always 420×96 with 2 lines; a fixed 4 lines
  left short messages mostly empty). The log stays one line per call. The rule "never modify
  `notify.ps1`" still holds for regular project work.
- Reason: the user wanted more information in the popup, next to the persona opening line. It is
  the user's own hook.
- Decided by: the user (approved editing it, and Claude's suggested size).
- Rejected: a much bigger popup (popups of several projects stack on the side monitor); dropping
  the "persona + headline" first-line rule in the user's output styles (without it, extra lines
  would mostly show more flavor and Markdown).
- Backups (the file is untracked): `~/.claude/hooks/backups/notify.ps1.original-2026-11-01` and
  `notify.ps1.taller-2026-11-01`. Install a new version with a shell copy, not the Edit tool: the
  first in-place edit was silently reset to the original once (docs/research/hooks.md, "Editing
  files in `~/.claude/hooks/`").

## 2026-11-01 — Exception: `notify.ps1` gets a focus fallback when a popup click is refused
- Decision: `BringToFront` in `notify.ps1` checks that the window really came to the front, and
  when Windows refuses, it tries `AttachThreadInput` to the front window's thread, then an Alt tap.
  The log names the attempt that worked. The popup itself still never takes focus.
- Reason: 22 of 203 popup clicks were refused. The existing empty-input retry never rescued one
  (0 in the log), and in a live test it returned success while the old window stayed in front.
  Alt tap and `AttachThreadInput` both brought a refused window to the front (one run each;
  docs/research/hooks.md, "Popup click refused by Windows").
- Decided by: the user asked for the fix (either fallback); Claude chose to use both, attach first.
- Rejected: leaving it as it was (the empty-input retry doesn't work); the Alt tap first (a lone
  Alt can open the old window's menu bar or reach a game, so it goes last); changing the system's
  foreground-lock timeout (a system-wide setting, for one script).
- Backups: `~/.claude/hooks/backups/notify.ps1.before-focus-fallback-2026-11-01` and
  `notify.ps1.focus-fallback-2026-11-01`. Installed with a shell copy; hash checked.

## 2026-11-01 — The status hook runs synchronously, not `async`
- Reason: a turn fires `PostToolUse` (`working`) and then `Stop` (`done`). With `async: true`, a
  slow `working` process can finish after `done` and leave a finished session stuck as `working`.
  A synchronous hook finishes before the next event fires, so the last state wins. Cost: ~374 ms
  per call (measured 2026-11-01), almost all of it `powershell.exe` startup.
- Decided by: the user, on Claude's suggestion.
- Rejected: `async: true` like `notify.ps1` (out-of-order writes). `notify.ps1` stays async: it
  only shows popups, so its order doesn't matter.

## 2026-11-01 — `PostToolUse` writes on every tool call, no throttle yet
- Reason: measure before adding complexity. Revisit if ~374 ms per tool call is noticeable in real
  use; the options are in docs/research/hooks.md ("Measured cost").
- Decided by: the user.
- Rejected: throttling up front (complexity before any evidence of a problem).

## 2026-11-01 — The status hook lives in the repo; `~/.claude/hooks/` holds an installed copy
- Decision: `hooks/session-status.ps1` in the repo is the source; install or update it by copying it
  to `~/.claude/hooks/`. Status files go to `~/.claude/session-status/`.
- Reason: the hook is a project deliverable, so it should be version-controlled and shippable.
  `notify.ps1` is the user's own pre-existing hook and stays untracked.
- Decided by: the user, on Claude's suggestion.
- Rejected: keeping the script only in `~/.claude/hooks/` (no version control, nothing to ship).

## 2026-11-01 — "Waiting" is driven by the `PermissionRequest` event, not `Notification`
- Reason: the build spec asked to hook the `Notification` event, but the author's own `notify.ps1`
  documents (measured 2026-10-31) that the VS Code extension never fires `Notification` — no event
  in 4 minutes of idle chats, while `Stop` fired after every reply. Permission prompts and Claude's
  questions (AskUserQuestion) arrive through `PermissionRequest`.
- Decided by: the user.
- Rejected: hooking `Notification` as literally written (it would never fire, so no status would
  ever be written on a permission prompt).

## 2026-11-01 — Three session states; the inbox counts `waiting` + `done`
- Decision: a session is `waiting` (blocked on a permission prompt or a question — urgent, shown
  with `⚠`), `done` (reply finished, your turn — also counts toward the inbox, shown dimmer), or
  `working` (actively running — not counted). The status bar count and sidebar include both
  `waiting` and `done`.
- Reason: the real problem is forgetting to go back *after Claude finishes a reply*, not only at a
  permission prompt. Counting only permission prompts would miss the most common case.
- Decided by: the user (chose option A over "only permission/question counts as waiting").
- Rejected: `Stop` = done and dropped from the inbox (the author's literal spec) — it would hide
  the finished-reply sessions that are the main thing being forgotten.

## 2026-11-01 — A standalone app is "Later", and only a lightweight tray indicator
- Decision: no standalone app in the first versions. If revisited, scope it to a small system-tray
  indicator that reads the same `session-status/` folder, not a full application.
- Reason: the persistent cross-window signal is already covered by the existing `notify.ps1` popups
  plus the planned sidebar; a full app would duplicate them and add a second process to maintain.
  The one genuine gain — a glanceable count when no VS Code window is focused — is cheap to add
  later because the status files are plain files any process can read.
- Decided by: the user asked; Claude recommended deferring and scoping down.
- Rejected: building a standalone app now.

## 2026-11-01 — The status bar watches the status folder; leftover files are not handled yet
(Leftover files: handled since to-do #10, see "Leftover status files are hidden" above.)
- Decision: the extension watches `~/.claude/session-status/` with Node's `fs.watch` and re-reads
  the whole folder ~100 ms after a change. While the folder is missing it checks every 5 s. The
  item shows `$(warning) N waiting` on the yellow warning background, or `$(check) all clear`; the
  tooltip holds the counts only. Tests point the extension at a temp folder through the
  `SESSION_INBOX_STATUS_DIR` environment variable (test-only, not a user setting).
- Reason: the count should change when the popup fires; a few small files make a full re-read
  cheap, and re-reading avoids tracking single file events (Windows sends several per write).
- Decided by: the user, on Claude's suggestions (to-do #4).
- Rejected: polling every 2 s (simpler, but up to 2 s late); listing sessions in the tooltip (the
  sidebar, to-do #5, does that); ignoring old `done` files by age now (guessing: first check
  whether files really get left behind when a window closes without `SessionEnd`).
