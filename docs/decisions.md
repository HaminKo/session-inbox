# Decisions

Newest first. Each entry: the date and decision as the heading; then the reason, who decided, and
what was rejected and why.

## 2026-11-11 — A project status set by hand, in its own colour, listed as "Closed" when no chat runs (to-do #28 A)
- Decision: **Set Project Status…** (right-click a project header; grouped by state, a session row
  or a closed row) or the palette's **Set Status of This Project…** (the window's folder; several:
  VS Code's folder pick) sets free text: "On hold", "Come back later", or "Type your own…" (an
  input box). Stored in the user setting `sessionInbox.projects` → `status`, with `folder` from
  the session's start folder (`sessionFolder`) or the window's folder; an unknown folder keeps the
  one saved before. The status follows the project's name in the label (`PeacefreeWeb · On hold`).
  **Set Status Color…** picks one of 9 theme colours by name (`statusColor`, a theme colour id;
  any other id by hand) for the label: a `FileDecorationProvider` colours rows given a made-up
  `session-inbox-project:/<name>` URI, the only way to colour a tree row's text. The icon keeps the
  state colour. A project with a status and no running chat stays in the Sessions tree: grouped by
  project its header (with its focus row) and a grey **Closed** row; grouped by state a **Closed**
  group at the end; a click opens the saved folder (`vscode.openFolder`, no tab reveal); never
  counted. **Clear Project Status** removes status, folder and colour. Only cleared by hand. Every
  status means the same: parked (what that does to the count is step B).
- Reason: the user wants to park projects and still see them when their windows are closed, and
  to tell them apart by a colour of their own, in the Sessions tree they already look at. A user
  setting like the icon: every window redraws at once, it outlives the windows, it can be edited by
  hand.
- Decided by: the user. First round ("Go with your suggestions"): free text, a separate view.
  After testing it the user asked for a colour of their own, then for the colour on the Sessions
  text and no separate view ("I don't think having a projects tab is giving me much value"), and
  took Claude's suggestions for how (status in the label, closed projects as "Closed" rows).
- Rejected: a separate "Projects" view (built first, then dropped by the user: little value, and
  with two views VS Code hides the "Group by" button until the mouse is over the view); the status
  in the grey description (VS Code can't colour it); only the status text in colour (VS Code gives a
  row's label one colour; a status row of its own under the header was offered, the user kept the
  coloured name and status); a colour on the icon (it stays the state's,
  2026-11-02); hex codes (VS Code colours only by theme colour id); coloured dots in the colour pick
  (the pick draws them grey, measured in 1.144); colours fixed per preset (the user wants to pick);
  one colour per status text for all projects (statuses are free text, often with a note); a fixed
  list of statuses; clearing by itself when you work in the project again; a folder picker for a
  project never opened (open its window, use the palette); one pick that also takes typed text (VS
  Code sorts the typed entry above a preset it partly matches, and `QuickPick.sortByLabel` is
  proposed API, so "on h" + Enter would save "on h").
- Found while building: on a row with a URI, VS Code draws the file icon theme's folder in place of
  the `folder` (and `file`) codicon, without the state colour; such rows use `symbol-folder` /
  `symbol-file`, the same glyphs (seen in a probe screenshot, VS Code 1.144). With a URI and no
  tooltip the hover would show the made-up URI, so project headers get one (folder and status).

## 2026-11-05 — A `done` whose reply left a background task running counts as `working` (to-do #27)
- Decision: on `Stop` the hook counts the background tasks (commands, agents, monitors) that the
  chat's transcript shows started and not ended (ended: a `<task-notification>` or a `TaskStop` on
  that task id), and writes it as `background`; `state` stays `done`. The extension and the tray show a `done` with `background` > 0 as `working` (row text
  "background task · <the reply's line>"), not counted, until the file changes (Claude's next reply
  ends with its own `Stop`), the chat's process started after the reply (restarted: the task died,
  and no hook fires for that), or 45 minutes after the reply. With no timestamp it stays `done`.
  The `notify.ps1` popup still fires at that `Stop`.
- Reason: 11% of replies (measured over 7 days) ended with a task running, and Claude reports on
  it by itself, so "your turn" was wrong for them. Keeping `state: "done"` in the file means an
  older extension or tray counts it as before, and the fallback needs no hook. 45 min covers every
  measured wait (longest 38.4 min). docs/research/hooks.md, `Stop`.
- Decided by: the user ("go with your suggestions", to-do #27).
- Rejected: Claude's own `status` in `~/.claude/sessions/<pid>.json` as the signal (it turns
  `idle` at `Stop` with a task running, measured); a fourth state or group "Background" (more UI
  and colours for a short wait); `run_in_background` alone (misses agents, which run in the
  background without it); 45 min as a setting (a fixed number until someone needs another);
  skipping the popup (it's the user's own hook); counting only tasks started since the user's last
  prompt, against dev servers (simulated over 1,087 replies: the same 3 wrong, 5 right ones lost);
  scanning only the transcript's new part since the last `Stop` (a Stop costs at most 0.15 s more
  than a PostToolUse today, measured).

## 2026-11-04 — README order: Features, How it works, Install and run, Settings, popups, Development (to-do #26)
- Decision: README.md goes pitch, pictures, **Features** (`###` subsections: status bar, sidebar,
  where a project stands, clicking a session, reminders, tray icon), **How it works** (the old
  "It has two parts" list without its feature bullets), Requirements (user only), **Install and
  run** (user only; the by-hand hook steps in a collapsed `<details>` block), **Settings** (a table
  of every setting with its default), Optional: desktop popups, **Development** (build from source,
  F5, checks, GUI test, screenshots, Node version), Changelog, Credits, License. The headings
  "Install and run" and "Optional: desktop popups" keep their names: the `extension/README.md`
  inside the released 0.1.0 `.vsix` links to `#install-and-run` and `#optional-desktop-popups`.
  The `.vsix` file name in the install example is updated at each release (a release step in
  docs/research/distribution.md). No CHANGELOG line: the extension doesn't change, and README.md
  isn't in the `.vsix`.
- Reason: the old "Status" section was one 55-line block that read like a build log, and
  "Install and run" mixed what a user needs with contributor steps, so a visitor couldn't find
  what it does, how to install it and which settings exist at a glance. Every user-relevant fact
  was kept (checked one by one against the old text).
- Decided by: the user, on Claude's suggestions.
- Rejected: a commands table (only Install Hooks is in the Command Palette; the other commands are
  a title-bar button, a click or a right-click, named where they're used); renaming "Install and
  run" to "Install" with a hand-made `<a id>` anchor (works on GitHub only through its
  `user-content-` id rewriting, so less safe than keeping the heading); a version-free install
  example (`code --install-extension` needs the real file name).

## 2026-11-03 — A `.vsix` on a GitHub release; the repo URL is allowed in tracked files (to-do #25)
- Decision: releases are a `.vsix` attached to a GitHub release, tagged `v<version>` (`v0.1.0`
  first). `extension/package.json` gets `repository` (the GitHub URL, `directory: extension`) and
  `npm run package` drops `--allow-missing-repository`. That URL, which holds the GitHub login, is
  allowed in tracked files where a link to the repo is needed: `repository`, README.md's release
  link, CHANGELOG.md's link references and `extension/README.md`. `extension/README.md` shows the
  two `docs/images/` pictures by absolute `…/raw/HEAD/…` URLs and links to the main README; LICENSE
  stays a relative link (vsce rewrites it to the root LICENSE, measured). CHANGELOG.md gets
  `[Unreleased]` (compare `v0.1.0...HEAD`) and `[0.1.0]` (`releases/tag/v0.1.0`). The Marketplace
  (publisher, PNG icon, Windows-only targets) and Open VSX moved to "Later". No line under
  Unreleased for the extension page's pictures and links: 0.1.0 isn't released yet, so the first
  GitHub release is v0.1.0 and they ship in it (Claude's choice; the user can change it).
- Reason: a GitHub release needs no new account, token or icon, and makes nothing new public. The
  Marketplace's gains (search, automatic updates) can come later; Azure DevOps global tokens retire
  on 2026-12-01, so publishing there would mean a hand upload or a GitHub Actions setup
  (docs/research/distribution.md). The login in the URL shows people nothing new: they get the
  `.vsix` from that repo page, and the public commits are linked to the account anyway (measured).
- Decided by: the user, on Claude's suggestions.
- Rejected: the Marketplace now; moving the repo to a GitHub organization (takes the login out of
  URLs but not off the repo page, where the latest commit shows the linked account); relative
  picture paths in `extension/README.md` (vsce ignores `repository.directory` and resolves them
  from the repo root, so `../docs/images/…` breaks in the `.vsix` and `docs/images/…` breaks on
  GitHub's view of the file); picture links tied to the tag with `--githubBranch` (needs the
  version in the npm script; `HEAD` shows the current look, fine for screenshots); Open VSX now.

## 2026-11-03 — CHANGELOG.md at the root, first version 0.1.0, copied into the `.vsix` by `npm run package` (to-do #24)
- Decision: one CHANGELOG.md for the whole repo (extension, hook, tray) at the root, in the Keep a
  Changelog 1.1.0 shape: an empty `## [Unreleased]`, then `## [0.1.0] - 2026-11-03` with one
  `### Added` list of what the user sees (no to-do numbers). `extension/package.json` goes from
  `0.0.1` to `0.1.0` to match. The `vscode:prepublish` script (run by `npm run package`) copies
  it to `extension/CHANGELOG.md` (gitignored; `.vscodeignore` has `!CHANGELOG.md`), so the `.vsix`
  has VS Code's "Changelog" tab (measured: vsce packs it as `extension/changelog.md` and lists it
  in the manifest as `Microsoft.VisualStudio.Services.Content.Changelog`). No link references at
  the bottom yet.
- Reason: `0.0.1` reads as a placeholder, and the user asked for the first version now rather than
  everything under Unreleased until a release. finish-step adds lines to the root file only, so a
  copy made by the build can't fall behind. Link references need the repo URL, which holds the
  GitHub login and is undecided (same as the `repository` field).
- Decided by: the user, on Claude's suggestions.
- Rejected: everything under Unreleased until the public release (Keep a Changelog dates a version
  by its release, but the user wanted a first version now); a hand-kept copy in `extension/` like
  `extension/LICENSE` (falls behind at every step); a changelog for the extension only (the hook
  and tray ship inside the `.vsix`); the copy in the `bundle` script next to the `.ps1` files
  (rewrites the file on every compile, GUI test and screenshot run, though only packaging needs
  it; found by the code review).

## 2026-11-03 — README pictures come from `npm run screenshots` (to-do #23)
- Decision: README.md shows two pictures, `docs/images/statusbar.png` and
  `docs/images/sidebar.png`, one above the other after the feature list, copied unedited from
  `npm run screenshots -- statusbar sidebar` (dark theme, sample sessions `demo-a/b/c`). A change
  to a picture is made in `extension/test/gui/screenshots.ts`, never in the PNG, so a re-take gives
  the same picture (measured: two takes in a row are byte-identical with VS Code 1.144, the version
  pinned in `test/gui/launch.ts`; a version bump may change them). The sidebar shot drags the
  sidebar 150 px wider so the waiting message isn't cut off. `extension/README.md` (the Marketplace
  page) has no pictures for now.
- Reason: the shots already come from a real VS Code with sample data, so nothing private shows;
  `docs/` keeps them out of the `.vsix`. `vsce package` stops on a relative image link when there
  is no `repository` field (read in `@vscode/vsce/out/package.js`), and that field is left out on
  purpose (see "Decide how to distribute" in docs/todo.md).
- Decided by: the user, on Claude's suggestions.
- Rejected: one combined picture (the status bar and the sidebar are far apart in the window, so
  one shot is mostly empty); side by side (too wide for GitHub's column, it wraps); a light theme;
  pictures of the tray icon or a popup (both optional, the pictures show what every user gets);
  the default sidebar width (cuts the message to "Needs permis…").

## 2026-11-03 — Popups stay the user's own hook; the README says so (to-do #22)
- Decision: Session Inbox ships no desktop-popup hook. The README says reminders and popup clicks
  need your own `~/.claude/hooks/notify.ps1` and gives what it receives (reminder payload) and what
  a click writes (`.reveal`). The first reminder that can't be sent shows one warning per window,
  with **Turn Off Reminders** (sets `sessionInbox.renotifyMinutes` to 0).
- Reason: the author's `notify.ps1` is mostly focus-fallback code tuned to one machine; a shipped
  hook would be its own medium to-do (design, installer, tests, never overwrite an existing one),
  and the status bar, sidebar and tray already do the inbox's job without popups.
- Decided by: the user, on Claude's suggestions.
- Rejected: shipping a minimal popup hook now (option B; can be a later to-do); a warning at
  startup (would nag every window, also for people who never let a chat wait); a VS Code
  notification as fallback reminder (the reminding window is by design not in front, so it would
  go unseen); a "Learn More" button (the extension has no repository URL to link yet).

## 2026-11-03 — Private-info check: nothing to fix, no fresh repo (to-do #20)
- Decision: the repo stays as it is. No edits to current files, no history rewrite or fresh repo,
  the commit identity (name and email) stays, and the names of the user's other projects stay in
  docs and tests. Findings: docs/research/private-info-check.md.
- Reason: current files hold none of the "Never in tracked files" items. History holds only the
  login (once, in the first LICENSE, removed since) and the commit identity on every commit, which
  the global rule allows; the repo was already public with most commits pushed, so a rewrite
  couldn't take anything back. The other project names link the pseudonym to this repo; the user
  is fine with that ("these are under the pseudonym but I'm fine with that").
- Decided by: the user, on Claude's suggestions.
- Rejected: a fresh one-commit repo (nothing in history calls for it, and pushed commits are
  already public); a GitHub `noreply` commit email (the address is already on the public commits;
  the user can still switch it in git config later); generic names for the other projects (the
  user accepts the link).

## 2026-11-03 — Every project's focus file is `docs/todo.md` by default; `focus` only overrides (to-do #19)
- Decision: with no setting, grouped by project, a project gets its Now row from
  `<project folder>/docs/todo.md`. `sessionInbox.projects` → `focus` is only for a project that
  differs: another path (string), or `false` for no row. The default path is fixed, not a setting
  of its own. Only a path set by hand logs a problem in the output channel; a default file that's
  missing or has no `## Where we are` section is a project without the block yet, so it's silent.
- Reason: the user's skills (new-project, finish-step, build-todo, add-todo) put the block in
  `docs/todo.md` in every project, so opting in per project was busywork (user: "I shouldn't need
  to add the focus entry manually into the json").
- Decided by: the user, on Claude's suggestions.
- Rejected: a right-click "Set Focus File…" on the project header (the user's first idea: still
  six clicks now plus one per new project, for a value that's the same everywhere); a setting for
  the default path (the per-project string covers the odd one out); logging default files too
  (one warning per project that hasn't got the block).

## 2026-11-03 — A project's focus file is re-read on every sidebar update, not watched (to-do #18)
- Decision: the sidebar's "Now" row (grouped by project) comes from the file named by
  `sessionInbox.projects` → `focus`, read again (async, only for projects shown that have `focus`)
  on every sidebar update: each hook event from any chat, and the 30 s re-read. (Since to-do #19
  every project shown has a focus file, `docs/todo.md` unless `focus` says otherwise; see the
  entry above.) The row is its own
  first child under the project header (icon `target`, not clickable); "Next:" shows only in the
  hover; only projects that already have a session appear. A file that can't be used shows no row
  and logs one line per file in a "Session Inbox" output channel (new in this to-do).
- Reason: the file is written by that project's finish-step skill through Claude's Edit tool,
  whose PostToolUse hook event already makes the sidebar update, so the row changes almost at
  once. A hand edit shows within 30 s. This saves the watcher create/dispose code and the open
  question of `createFileSystemWatcher` on folders outside the window's workspace.
- Decided by: the user ("Go with your suggestions"), on Claude's suggestions.
- Rejected: one file watcher per focus file (the to-do's first Approach: instant but more code to
  keep right); the focus in the header's description (it already holds the counts and gets cut off
  in a narrow sidebar).

## 2026-11-03 — Project focus goes in the extension's sidebar, not a standalone app (to-do #18)
- Decision: show each project's "Where we are" line in the sidebar (to-do #18). A richer overview
  (Now/Next for every opted-in project, running or not) goes under "Later" as a webview panel
  inside the extension.
- Reason: projects are switched inside VS Code, where the sidebar already lists every window's
  sessions. A standalone app would be a third copy of the counting rules (after `statusFolder.ts`
  and the tray script) and would need its own install, autostart, updates and GUI tests. The
  tray (to-do #16/#17) already covers "outside VS Code".
- Decided by: the user asked about a standalone GUI app; Claude recommended this, and the user
  agreed ("Go with your suggestions").
- Rejected: a standalone app (Electron is ~100 MB, Tauri needs Rust, WinForms gets clumsy past a
  menu). Revisit only if the overview is often wanted while VS Code is closed.

## 2026-11-03 — Tray looks like the sidebar: codicons from VS Code's font, via `.tray-looks` (to-do #17)
- Decision: the tray badge uses the sidebar's state colours at VS Code's Dark values
  (`list.warningForeground` #CCA700, `charts.green` #89D185, grey for clear) with a black number;
  the menu rows get the state's and the project's codicon. The menu follows Windows' app mode
  (`AppsUseLightTheme`): dark grey with a thin outline, white text and the Dark icon values in dark
  mode (a custom `ToolStripProfessionalRenderer`), WinForms' own look with the Light values
  (#855F00, #388A34) in light mode; rounded corners on Windows 11 (`DwmSetWindowAttribute`). One row per session, the project icon always shown (folder
  by default). The extension reads `codicon.ttf` (`vscode.env.appRoot`/out/media) itself (`cmap` +
  `post` tables, `codicons.ts`) and writes `.tray-looks` into the status folder: font path, the
  state icons, project label (lowercase) -> icon name, and icon name -> character. It does so at
  start and when `sessionInbox.trayIcon` or `sessionInbox.projects` changes. Without the file or
  the font the menu shows text only.
- Reason: one look for both; the name -> character work stays in TypeScript (unit-tested, reuses
  `projectIcon()`), so the PowerShell copy of the rules doesn't grow; no settings.json parsing in
  PowerShell. Characters are read from the installed font, not copied.
- Decided by: the user ("go with your suggestions").
- Rejected: project headers in the menu (a short menu, extra clicks); a hand-copied table of
  characters (drifts with VS Code; only the alias `zap` is listed by hand, as the font has no
  name for it); passing the icons as start arguments (the first tray copy wins and the setting can
  change later); white number on the badge (hard to read on yellow); a OneDrive-style panel (its
  own window with header and two-line rows: far more code than the rest of the tray for a list of
  1-3 rows; can become its own to-do if the dark menu isn't enough).

## 2026-11-03 — Tray: ends with the VS Code that started it; the setting off closes it (to-do #16 B)
- Decision: the extension passes its parent process (VS Code's main process) as `-VsCodePid`, and
  the tray exits when that process ends, instead of when no process named `Code` is left. Started
  by hand without it, it runs until its Exit item. Turning `sessionInbox.trayIcon` off runs the
  script with `-Stop`, which sets a named event (`<mutex>-stop`) the tray checks every tick. Exit
  from the tray menu lasts until a window starts or the setting is turned on again.
- Reason: a process name misses VSCodium, Cursor and other builds (step A's review); a handle to
  the PID can't be fooled by Windows reusing it. The setting must work whichever window started
  the tray.
- Decided by: the user ("go with your suggestions").
- Rejected: restarting the tray from every window regularly (a PowerShell start each time) to
  cover a second VS Code app (Insiders) still running when the first quits; stopping the tray
  when a window's extension host shuts down (that also happens on every reload and window close).

## 2026-11-03 — Tray indicator: a PowerShell script in this repo, started by the extension (to-do #16)
- Decision: the tray icon is `tray/session-tray.ps1` in this repo (WinForms `NotifyIcon`, polls the
  status folder every 2 s, same filter and count as `statusFolder.ts`). It is started by the
  extension when the setting `sessionInbox.trayIcon` is on (default off); a named mutex keeps one
  copy, and it exits when no `Code.exe` is running (replaced, see the entry above). A unit test runs it with `-Once` and compares
  its counts with `countStates(onlyLive(...))`, so the two copies of the rules can't drift apart
  silently.
- Reason: every chat lives in VS Code, so a tray without VS Code always shows 0; tying it to VS
  Code needs nothing in Windows startup. Its data (status files), rules and click hand-off
  (`.reveal`) all belong to this project, so it lives here, not with the personal `notify.ps1`.
- Decided by: the user ("go with your suggestions"; asked whether it belongs in its own repo).
- Rejected: Electron/Node app (~100 MB for one icon, needs a build); a Startup-folder shortcut
  (writes into the user's Startup folder, runs with no VS Code); its own repo (the drift test and
  the status format would span two repos); default on (a public extension shouldn't start a
  background process nobody asked for).

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
