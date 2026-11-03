// Re-notify: a chat that has waited (permission or question) longer than `sessionInbox.renotifyMinutes`
// gets one more notify.ps1 popup, through a payload that looks like a hook call
// (docs/research/hooks.md). notify.ps1 isn't changed: an event name it doesn't know shows `message`.
// No `vscode` import, so the unit tests run in plain Node.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { formatAge, since } from "./sessionList.ts";
import type { SessionStatus } from "./statusFolder.ts";

export const reminderEvent = "SessionInboxReminder";

// SESSION_INBOX_NOTIFY_SCRIPT is for the tests only: a stand-in that records what it was sent.
export function notifyScript(env: NodeJS.ProcessEnv = process.env): string {
  return env.SESSION_INBOX_NOTIFY_SCRIPT || join(homedir(), ".claude", "hooks", "notify.ps1");
}

// One wait is a chat in `waiting` since one timestamp; a new permission prompt is a new wait.
export function waitKey(status: SessionStatus): string {
  return `${status.session_id}@${status.timestamp ?? ""}`;
}

// The waiting chats past the threshold that haven't had their reminder yet; 0 minutes (or less) is
// off. `sent` holds the waits already reminded (waitKey) and is updated here; waits that are over
// are dropped from it, so it doesn't grow.
export function dueReminders(
  statuses: readonly SessionStatus[],
  now: number,
  minutes: number,
  sent: Set<string>,
): SessionStatus[] {
  const current = new Set(statuses.map(waitKey));
  for (const key of sent) if (!current.has(key)) sent.delete(key);
  if (!(minutes > 0)) return [];
  const due = statuses.filter((status) => {
    if (status.state !== "waiting" || sent.has(waitKey(status))) return false;
    const start = since(status);
    return start !== undefined && now - start >= minutes * 60_000;
  });
  for (const status of due) sent.add(waitKey(status));
  return due;
}

// What notify.ps1 reads from stdin. `cwd` is only its fallback: CLAUDE_PROJECT_DIR comes first. The
// wait reads like the sidebar's age.
export function reminderPayload(status: SessionStatus, projectDir: string, now: number): Record<string, string> {
  const waited = formatAge(now - (since(status) ?? now));
  const what = status.message || "Needs your attention";
  return {
    hook_event_name: reminderEvent,
    session_id: status.session_id,
    cwd: projectDir,
    message: `Still waiting (${waited}): ${what}`,
  };
}

// Starts notify.ps1 the way the hook settings do and hands it the payload; the popup stays up until
// clicked like any other. Not `detached`: PowerShell then never runs the script (measured
// 2026-11-01, docs/research/hooks.md). False if the script isn't there.
export function sendReminder(script: string, payload: Record<string, string>, projectDir: string): boolean {
  if (!existsSync(script)) return false;
  const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script], {
    stdio: ["pipe", "ignore", "ignore"],
    windowsHide: true,
    // Not the extension host's ELECTRON_RUN_AS_NODE, which a hook call doesn't have either.
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, CLAUDE_PROJECT_DIR: projectDir },
  });
  child.on("error", (error) => console.error("Session Inbox: couldn't start notify.ps1", error));
  child.stdin?.on("error", () => undefined);
  child.stdin?.end(JSON.stringify(payload), "utf8");
  child.unref();
  return true;
}
