# Session Inbox

A persistent "waiting on you" inbox for Claude Code sessions across VS Code windows.
Status files written by global hooks; a VS Code extension shows them in a status bar and
sidebar so a session that needs you stays visible until you actually act.

Don't build what's under "Later" in docs/todo.md until asked.

## User and environment
- OS: Windows 11 Home. Shell: PowerShell in the VS Code terminal (give copy-ready commands).
- Node v26.13.0 / npm 11.20.0, installed at `C:\Program Files\nodejs\`, which is on the Machine
  PATH. A VS Code started before that PATH change passes the old PATH to every terminal, task (F5)
  and Claude shell ("npm is not recognized") until VS Code is fully quit and restarted
  (Reload Window is not enough). Seen 2026-11-01.
- Extension language: TypeScript, bundled with esbuild, linted with ESLint, packaged with
  `@vscode/vsce`.
- Hooks: Windows PowerShell 5.1 scripts in `~/.claude/hooks/`, wired in `~/.claude/settings.json`.
- Real/personal paths: docs/local.md (gitignored). This project is *about* `~/.claude/`, so all
  tracked files use generic `~/.claude/...` paths, never a real user folder.

## Working style
- One to-do per chat, built with the /build-todo skill (`/build-todo N`, or
  `/build-todo N, step B` for one step of a bigger to-do). New to-dos via /add-todo.
- Commit after each working step. End a step with the finish-step skill.
- Extend the existing notification hook (`~/.claude/hooks/notify.ps1`); never modify or replace it
  in project work. (Exceptions, asked for by the user: taller popups, the focus fallback,
  naming by start folder, the popup picture and the `.reveal` click hand-off, docs/decisions.md
  2026-11-01; stacked popups fall down, 2026-11-02.)

## Build specifics
- **Checks** (run from the `extension/` folder once it exists):
  - Fast, after edits: `npm run lint` (~5s).
  - Per step: `npm run compile` (esbuild bundle only, ~1s) + `npx tsc --noEmit` (type-check,
    ~2s); `npm test` (unit tests, `test/unit/*.test.ts`, ~1s). `npm run package` builds a `.vsix` (Marketplace manifest
    check).
  - Run the extension: `F5` from the repo root (`.vscode/launch.json`). F5 disables other
    extensions, so anything that needs Claude Code is tested from the installed `.vsix`.
  - Hooks have no build; verify by piping a fake payload and checking the written file
    (see docs/research/hooks.md).
  - GUI test, every step (~16–25 s): `npm run test:gui` (`test/gui/*.gui.ts`; opens a VS Code window
    briefly). A UI change gets a step in it. Details: docs/research/gui-testing.md.
  - Screenshots: `npm run screenshots` (or `-- statusbar` / `-- sidebar` / `-- window`) → PNGs in
    `$env:TEMP\session-inbox-shots\`, paths printed. Estimated cost: statusbar ~25 tokens,
    sidebar ~270, window ~2,900.
- **Dev port:** N/A — a VS Code extension runs in the Extension Development Host, no web server.
- **Docs to update when behaviour changes:** README.md (headline features, install/run steps,
  Credits), docs/research/hooks.md (hook/event behaviour), CHANGELOG.md once it exists.
- **Must keep working:** the existing `notify.ps1` popups must still fire (taller since
  2026-11-01, see docs/decisions.md); the
  status-writer must stay fast (it runs on every PostToolUse).
- **Review checklist:** none yet — use the built-in code-review skill. Add docs/review.md once
  the project has its own rules.

## Status
Next: no to-dos left (to-do #12, a project header's own icon, is done). Add one with /add-todo,
or work through "Before a public release" in docs/todo.md.

## Decisions
One line each; reasons, who decided and what was rejected: docs/decisions.md.
- "Waiting" is driven by the `PermissionRequest` event, not `Notification` (which never fires in
  the VS Code extension).
- Three session states: `waiting` (blocked on permission/question), `done` (reply finished, your
  turn), `working`. The inbox counts `waiting` + `done`. A fourth, `open` (running VS Code chat
  with no status file yet), is made by the extension only and never counted.
- The status hook runs synchronously so events stay in order; `notify.ps1` stays async.
- `hooks/session-status.ps1` in the repo is the source: edit it there, then copy it to
  `~/.claude/hooks/`.
- Hooks name the project by the chat's start folder (`CLAUDE_PROJECT_DIR`), never the payload
  `cwd`, which follows the shell into subfolders.
- TypeScript stays on `~6.0.x` until typescript-eslint supports 7. VS Code minimum `^1.100.0`,
  with `@types/vscode` pinned to the same version and `@types/node` to `~20.17` (not newer).
- Publisher id `session-inbox`; no `repository` field in package.json until release.
- Tests never read the real status folder: they set `SESSION_INBOX_STATUS_DIR` to a temp folder
  (and `SESSION_INBOX_SESSIONS_DIR` for `~/.claude/sessions/`).
- A status file counts only while its chat process runs (`~/.claude/sessions/<pid>.json`);
  leftovers are hidden, never deleted, and nothing is hidden if that folder is missing, empty or
  unreadable.
- Sidebar: one title-bar button switches grouping by state (default) / by project, saved in
  `globalState`; a project is the row label (folder leaf), case-insensitive, A-Z.
- Sidebar click opens `project_dir` with `vscode.openFolder` (VS Code focuses an open window), not
  `notify.ps1`'s window search.
- A click shows the chat's own tab via `~/.claude/session-status/.reveal`, acted on only by the
  window that has its `project_dir` open (Claude's `claude-vscode.primaryEditor.open`), not a URI.
- A project header can get its own icon (setting `sessionInbox.projects`), never its own colour:
  the colour stays the state.
- GUI test: Playwright drives a VS Code pinned in `test/gui/launch.ts` (bump by hand), downloaded
  by `@vscode/test-electron`.

## Project docs
README.md, docs/local.md, docs/todo.md, docs/decisions.md, docs/research/ (one file per topic).

## Never in tracked files
- Real name, pseudonym-to-keep-separate, and personal paths (always → docs/local.md).
- The GitHub login used for pushes: write "gh (signed in)" / "a personal account"; it goes in
  docs/local.md. Current files only — old commits that hold it are fine.
