// Unit tests for the sidebar's groups and row text. Plain Node, no VS Code: `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatAge, groupSessions, sessionDescription, sessionLabel, sessionTooltip } from "../../src/sessionList.ts";
import type { SessionStatus } from "../../src/statusFolder.ts";

const now = new Date(2026, 10, 1, 12, 0).getTime();
const minute = 60_000;

function status(id: string, state: SessionStatus["state"], extra: Partial<SessionStatus> = {}): SessionStatus {
  return { session_id: id, state, folder: `demo-${id}`, ...extra };
}

function ago(ms: number): string {
  return new Date(now - ms).toISOString();
}

void test("groups come waiting, done, working; empty ones are left out", () => {
  const groups = groupSessions([status("a", "working"), status("b", "waiting"), status("c", "working")]);
  assert.deepEqual(
    groups.map((group) => [group.label, group.sessions.map((s) => s.session_id)]),
    [
      ["Waiting (1)", ["b"]],
      ["Working (2)", ["a", "c"]],
    ],
  );
  assert.deepEqual(groupSessions([]), []);
});

void test("inside a group the oldest comes first, no timestamp last", () => {
  const groups = groupSessions([
    status("new", "done", { timestamp: ago(minute) }),
    status("none", "done"),
    status("bad", "done", { timestamp: "not a date" }),
    status("old", "done", { timestamp: ago(60 * minute) }),
  ]);
  assert.deepEqual(
    groups[0].sessions.map((s) => s.session_id),
    ["old", "new", "none", "bad"],
  );
});

void test("age text", () => {
  assert.equal(formatAge(-5 * minute), "<1 min");
  assert.equal(formatAge(59_999), "<1 min");
  assert.equal(formatAge(minute), "1 min");
  assert.equal(formatAge(59 * minute), "59 min");
  assert.equal(formatAge(60 * minute), "1 h");
  assert.equal(formatAge(80 * minute), "1 h 20 min");
  assert.equal(formatAge(24 * 60 * minute - 1), "23 h 59 min");
  assert.equal(formatAge(2 * 24 * 60 * minute + 5 * minute), "2 d");
});

void test("label falls back from folder to the end of cwd to the session id", () => {
  assert.equal(sessionLabel(status("a", "done")), "demo-a");
  assert.equal(sessionLabel({ session_id: "a", state: "done", cwd: "C:\\projects\\shop\\" }), "shop");
  assert.equal(sessionLabel({ session_id: "a", state: "done" }), "a");
});

void test("description: worktree, age, message; working shows no age", () => {
  const timestamp = ago(12 * minute);
  assert.equal(
    sessionDescription(status("a", "waiting", { worktree: true, timestamp, message: "Needs permission to use Bash" }), now),
    "worktree · 12 min · Needs permission to use Bash",
  );
  assert.equal(sessionDescription(status("a", "done", { timestamp, message: "Line one\n  line two" }), now), "12 min · Line one line two");
  assert.equal(sessionDescription(status("a", "working", { timestamp, message: "" }), now), "");
  assert.equal(sessionDescription(status("a", "done", { message: "Finished" }), now), "Finished");
});

void test("tooltip: path, state with clock time, message", () => {
  const timestamp = new Date(2026, 10, 1, 9, 5).toISOString();
  assert.equal(
    sessionTooltip(status("a", "waiting", { cwd: "C:/projects/demo-a", timestamp, message: "Needs permission to use Bash" }), now),
    "C:/projects/demo-a\nWaiting (permission or question) since 09:05\nNeeds permission to use Bash",
  );
  assert.equal(
    sessionTooltip(status("a", "working", { cwd: "C:/projects/demo-a", timestamp }), now),
    "C:/projects/demo-a\nWorking, last activity 09:05",
  );
  assert.equal(sessionTooltip(status("a", "done"), now), "demo-a\nDone (your turn)");
  const yesterday = new Date(2026, 9, 31, 23, 50).toISOString();
  assert.equal(sessionTooltip(status("a", "done", { timestamp: yesterday }), now), "demo-a\nDone (your turn) since 2026-10-31 23:50");
});

void test("fields of the wrong type are left out, not a crash", () => {
  const odd = { session_id: "x", state: "done", folder: 5, cwd: {}, message: 42, timestamp: 7, worktree: "yes" };
  const status = odd as unknown as SessionStatus;
  assert.equal(sessionLabel(status), "x");
  assert.equal(sessionDescription(status, now), "");
  assert.equal(sessionTooltip(status, now), "x\nDone (your turn)");
});
