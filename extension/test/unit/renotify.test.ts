// Unit tests for re-notify: which waits are due, the payload, and starting the script. Plain Node,
// no VS Code: `npm test`.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { dueReminders, notifyScript, reminderEvent, reminderPayload, sendReminder } from "../../src/renotify.ts";
import type { SessionState, SessionStatus } from "../../src/statusFolder.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "session-inbox-unit-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

const now = Date.parse("2026-11-01T12:00:00Z");
const minute = 60_000;

function status(id: string, state: SessionState, waitedMinutes: number): SessionStatus {
  return {
    session_id: id,
    state,
    message: "Needs permission to use Bash",
    timestamp: new Date(now - waitedMinutes * minute).toISOString(),
  };
}

void test("dueReminders picks waiting chats past the threshold, once per wait", () => {
  const sent = new Set<string>();
  const statuses = [status("old", "waiting", 12), status("new", "waiting", 3), status("done", "done", 60)];
  assert.deepEqual(dueReminders(statuses, now, 10, sent).map((s) => s.session_id), ["old"]);
  assert.deepEqual(dueReminders(statuses, now + 30_000, 10, sent), []);
  // `new` reaches the threshold later.
  assert.deepEqual(dueReminders(statuses, now + 7 * minute, 10, sent).map((s) => s.session_id), ["new"]);
});

void test("dueReminders treats a new permission prompt as a new wait", () => {
  const sent = new Set<string>();
  dueReminders([status("a", "waiting", 12)], now, 10, sent);
  // Answered, working, then waiting again: a new timestamp.
  dueReminders([status("a", "working", 0)], now + minute, 10, sent);
  assert.equal(sent.size, 0);
  const again = status("a", "waiting", 0);
  assert.deepEqual(dueReminders([again], now + minute, 10, sent), []);
  assert.deepEqual(dueReminders([again], now + 11 * minute, 10, sent).map((s) => s.session_id), ["a"]);
});

void test("dueReminders is off at 0 minutes and skips a missing or bad timestamp", () => {
  assert.deepEqual(dueReminders([status("a", "waiting", 600)], now, 0, new Set()), []);
  const bad = [{ ...status("x", "waiting", 0), timestamp: "soon" }, { session_id: "y", state: "waiting" as const }];
  assert.deepEqual(dueReminders(bad, now, 1, new Set()), []);
});

void test("reminderPayload names the wait and keeps the status message", () => {
  assert.deepEqual(reminderPayload(status("a", "waiting", 12.5), "c:/Projects/demo", now), {
    hook_event_name: reminderEvent,
    session_id: "a",
    cwd: "c:/Projects/demo",
    message: "Still waiting (12 min): Needs permission to use Bash",
  });
  const noMessage = { ...status("a", "waiting", 10), message: "" };
  assert.equal(reminderPayload(noMessage, "", now).message, "Still waiting (10 min): Needs your attention");
});

void test("notifyScript is the user's notify.ps1 unless the tests override it", () => {
  assert.match(notifyScript({}), /[\\/]\.claude[\\/]hooks[\\/]notify\.ps1$/);
  assert.equal(notifyScript({ SESSION_INBOX_NOTIFY_SCRIPT: "x.ps1" }), "x.ps1");
});

void test("sendReminder hands the payload and the project folder to the script", async () => {
  const script = join(root, "fake-notify.ps1");
  const out = join(root, "received.txt");
  // WriteAllText writes UTF-8 without a BOM; the strip below is only a guard.
  writeFileSync(
    script,
    `[Console]::InputEncoding = [System.Text.Encoding]::UTF8\n` +
      `$text = [Console]::In.ReadToEnd()\n` +
      `[System.IO.File]::WriteAllText('${out}', $env:CLAUDE_PROJECT_DIR + "\`n" + $text)\n`,
  );
  const payload = { hook_event_name: reminderEvent, session_id: "a", cwd: "c:/demo", message: "Still waiting: é" };
  assert.equal(sendReminder(script, payload, "c:/demo"), true);
  const end = Date.now() + 15_000;
  while (!existsSync(out) && Date.now() < end) await new Promise((r) => setTimeout(r, 100));
  const [dir, json] = readFileSync(out, "utf8").replace(/^\uFEFF/, "").split("\n");
  assert.equal(dir, "c:/demo");
  assert.deepEqual(JSON.parse(json ?? ""), payload);
});

void test("sendReminder does nothing without the script", () => {
  assert.equal(sendReminder(join(root, "missing.ps1"), {}, ""), false);
});
