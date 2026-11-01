# Session Inbox

A persistent "waiting on you" inbox for Claude Code sessions across VS Code windows.
Status files written by global hooks; a VS Code extension shows them in a status bar and
sidebar so a session that needs you stays visible until you actually act.

Don't build what's under "Later" in docs/todo.md until asked.

## User and environment
- OS: Windows 11 Home. Shell: PowerShell in the VS Code terminal (give copy-ready commands).
- Node v26.13.0 / npm 11.20.0, installed at `C:\Program Files\nodejs\` (may not be on every
  shell's PATH; it is in the VS Code terminal).
- Extension language: TypeScript, bundled with esbuild, linted with ESLint, packaged with
  `@vscode/vsce`.
- Hooks: Windows PowerShell 5.1 scripts in `~/.claude/hooks/`, wired in `~/.claude/settings.json`.
- Real/personal paths: docs/local.md (gitignored). This project is *about* `~/.claude/`, so all
  tracked files use generic `~/.claude/...` paths, never a real user folder.

## Working style
- One to-do per chat, built with the /build-todo skill (`/build-todo N`, or
  `/build-todo N, step B` for one step of a bigger to-do). New to-dos via /add-todo.
- Commit after each working step. End a step with the finish-step skill.
- Extend the existing notification hook (`~/.claude/hooks/notify.ps1`); never modify or replace it.

## Build specifics
- **Checks** (run from the `extension/` folder once it exists):
  - Fast, after edits: `npm run lint` (~5s).
  - Per step: `npm run compile` + `npx tsc --noEmit` (~10s); `npm test` once tests exist.
  - Hooks have no build; verify by piping a fake payload and checking the written file
    (see docs/research/hooks.md).
  - GUI test + screenshots (gui-test skill) once the extension UI exists: it runs in the VS Code
    Extension Development Host via `@vscode/test-electron`.
- **Dev port:** N/A — a VS Code extension runs in the Extension Development Host, no web server.
- **Docs to update when behaviour changes:** README.md (headline features, install/run steps,
  Credits), docs/research/hooks.md (hook/event behaviour), CHANGELOG.md once it exists.
- **Must keep working:** the existing `notify.ps1` popups must still fire unchanged; the
  status-writer must stay fast (it runs on every PostToolUse).
- **Review checklist:** none yet — use the built-in code-review skill. Add docs/review.md once
  the project has its own rules.

## Status
To-do #1 (hooks) is built, installed and committed as a check-in. Waiting on the user's live test:
does `SessionEnd` delete the status file when a chat closes, and do tool calls feel slower (~374 ms
each)? Then finish #1 (README install steps, remove it from docs/todo.md) and go on to to-do #2.

## Decisions
One line each; reasons, who decided and what was rejected: docs/decisions.md.
- "Waiting" is driven by the `PermissionRequest` event, not `Notification` (which never fires in
  the VS Code extension).
- Three session states: `waiting` (blocked on permission/question), `done` (reply finished, your
  turn), `working`. The inbox counts `waiting` + `done`.
- The status hook runs synchronously so events stay in order; `notify.ps1` stays async.
- `hooks/session-status.ps1` in the repo is the source: edit it there, then copy it to
  `~/.claude/hooks/`.

## Project docs
README.md, docs/local.md, docs/todo.md, docs/decisions.md, docs/research/ (one file per topic).

## Never in tracked files
- Real name, pseudonym-to-keep-separate, and personal paths (always → docs/local.md).
- The GitHub login used for pushes: write "gh (signed in)" / "a personal account"; it goes in
  docs/local.md. Current files only — old commits that hold it are fine.
