# Session Inbox

A persistent **"waiting on you"** inbox for Claude Code sessions across VS Code windows.

Desktop notifications from Claude Code are one-shot: you click one, get distracted, and forget
to go back and respond. Session Inbox keeps a visible indicator in every VS Code window that
stays until you actually act on each session.

It has two parts:

1. **Global hooks** (in `~/.claude/settings.json`) that write a small status file per session to
   `~/.claude/session-status/<session_id>.json` — project folder, worktree, state, message, and
   timestamp — and update it as the session moves between waiting, working, and done.
2. **A VS Code extension** that watches that folder and shows, in every window:
   - a status bar item: `⚠ N waiting` or `✓ all clear`;
   - a sidebar listing every session across all windows (waiting first, with how long each has
     waited, and a badge for worktrees);
   - click a session to focus or open its VS Code window;
   - a re-notification if a session has waited longer than a configurable threshold.

The hooks extend an existing desktop-notification hook rather than replacing it.

## Status

Early setup. The hooks and extension are built as numbered to-dos (see `docs/todo.md`); nothing
is published yet.

## Requirements

- Windows (the hooks use Windows PowerShell and the Windows notification APIs).
- [Claude Code](https://docs.claude.com/en/docs/claude-code) with the VS Code extension.
- VS Code and Node.js (for building the extension).

## Install and run

> Build steps land here as they're implemented. For now:

- **Hooks:** copy the status-writer script into `~/.claude/hooks/` and add its entries to
  `~/.claude/settings.json` (see the hooks to-do). Verify with the payload test in
  `docs/research/hooks.md`.
- **Extension:** from `extension/`, run `npm install`, then `npm run compile`, then press `F5` in
  VS Code to launch an Extension Development Host. Package a `.vsix` with `npx vsce package`.

## Credits

- Builds on the project author's own Claude Code desktop-notification hook (`notify.ps1`), which
  this project extends rather than replaces.
- [Visual Studio Code Extension API](https://code.visualstudio.com/api) — Microsoft, MIT.
- [esbuild](https://esbuild.github.io/) — Evan Wallace, MIT.
- [ESLint](https://eslint.org/) — OpenJS Foundation, MIT.
- [@vscode/vsce](https://github.com/microsoft/vscode-vsce) — Microsoft, MIT.
- [Node.js](https://nodejs.org/) — OpenJS Foundation, MIT.

## License

MIT — see [LICENSE](LICENSE).
