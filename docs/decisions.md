# Decisions

Newest first. Each entry: the date and decision as the heading; then the reason, who decided, and
what was rejected and why.

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
