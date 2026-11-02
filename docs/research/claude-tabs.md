# Opening a specific Claude Code tab (to-do #9)

Researched 2026-11-01, Claude Code extension 2.1.314, VS Code build `2c33b50b16`. Everything below
was **read from the bundled code**, not tried live yet (marked "untested" where it matters).

## 1. Can another extension reveal a given session's tab? Yes.

The Claude Code extension (`~/.vscode/extensions/anthropic.claude-code-<version>/extension.js`) has:

- **A URI handler** (registered in code, not in `package.json`):
  `vscode://anthropic.claude-code/open?session=<id>[&prompt=<text>]` runs
  `claude-vscode.primaryEditor.open(<id>, <prompt>)`. `session` must be a non-empty string without
  `/`, `\`, `..` or NUL (a filename-safe id); an invalid one is ignored silently.
- **Commands taking a session id** as the first argument (undocumented, positional):
  `claude-vscode.primaryEditor.open(sessionId, prompt?)` and
  `claude-vscode.editor.open(sessionId, prompt?, ...)` (the latter honours the "open in sidebar"
  preference).
- Both end in `createPanel(sessionId, ...)`, which:
  1. tab already open for that session in this window → `panel.reveal()` (no new tab);
  2. the session is in the Claude sidebar → shows it there;
  3. a tab remembered from before a reload → revives it;
  4. otherwise → opens a **new tab that resumes the session** (in this window).

The id is the same `session_id` the hooks get (status files are named `<session_id>.json`, and
`~/.claude/sessions/<pid>.json` has the same value as `sessionId`).

Risk: the commands and their argument order are internal and may change with a Claude Code update.
The URI handler is the more stable entry point (it exists for links), but see 2.

## 2. Which window receives a `vscode://` URI? The focused one.

VS Code's main process (`out/mainImpl.js`, `URLHandlerRouter#routeCall`): if the URI's query has
`windowId=<n>` it goes to that Electron window; otherwise to the **active (last focused) window**.
The Electron window id isn't visible to a hook, so in practice: the focused window.

Consequences:
- Popup click: `BringToFront` first, then open the URI, and it should reach the right window
  (untested; a race if the focus change hasn't registered yet).
- If it reaches the **wrong** window, case 4 above opens a second tab resuming the same session in
  that window: two clients on one chat. Anything that calls Claude's command must first check the
  session belongs to this window (its `project_dir` is one of the window's workspace folders).
- Sidebar click on a session of another window: `vscode.openFolder` focuses that window, but our
  code runs in the *clicking* window and can't call a command in the other one.

## 3. Confirmation prompt

A URI addressed to an extension shows "Allow '<extension>' to open this URI?" once per extension
unless it's listed in the user setting `extensions.confirmedUriHandlerExtensionIds` (or "don't ask
again" was ticked). Calling a command from our own extension has no prompt.

## Testing it by hand

F5 starts the Extension Development Host with `--disable-extensions` (`.vscode/launch.json`), so
Claude Code doesn't run there. Test with the extension installed from `npm run package`'s `.vsix` in
the normal VS Code instead. User test 2026-11-01: popup and sidebar clicks showed the right tab.

## Chosen design (built 2026-11-01)

Both conditions of the to-do hold. A hand-off that reaches the right window without URI routing: a
request file, `~/.claude/session-status/.reveal`, in the folder every window's Session Inbox already
watches. The window whose workspace holds the session's `project_dir` reveals the tab with
`claude-vscode.primaryEditor.open(<id>)`; others ignore it. Format and measurements:
docs/research/hooks.md, "Popup click shows the chat's own tab"; the decision: docs/decisions.md.
