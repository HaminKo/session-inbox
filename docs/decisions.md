# Decisions

Newest first. Each entry: the date and decision as the heading; then the reason, who decided, and
what was rejected and why.

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
