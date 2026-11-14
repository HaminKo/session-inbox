// Unit tests for the sidebar's groups and row text. Plain Node, no VS Code: `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatAge,
  groupFolder,
  groupSessions,
  parkedTest,
  rowLabel,
  sessionDescription,
  sessionFolder,
  sessionLabel,
  sessionTooltip,
} from "../../src/sessionList.ts";
import type { SessionStatus } from "../../src/statusFolder.ts";

const now = new Date(2026, 10, 1, 12, 0).getTime();
const minute = 60_000;

function status(id: string, state: SessionStatus["state"], extra: Partial<SessionStatus> = {}): SessionStatus {
  return { session_id: id, state, folder: `demo-${id}`, ...extra };
}

function ago(ms: number): string {
  return new Date(now - ms).toISOString();
}

void test("groups come waiting, done, working, open; empty ones are left out", () => {
  const groups = groupSessions([status("o", "open"), status("a", "working"), status("b", "waiting"), status("c", "working")]);
  assert.deepEqual(
    groups.map((group) => [group.id, group.label, group.sessions.map((s) => s.session_id)]),
    [
      ["state:waiting", "Waiting (1)", ["b"]],
      ["state:working", "Working (2)", ["a", "c"]],
      ["state:open", "Open (1)", ["o"]],
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

void test("by project: one group per folder ignoring case, A-Z, numbers by value, with a summary", () => {
  const groups = groupSessions(
    [
      status("a0", "open", { folder: "my-app", timestamp: ago(60 * minute) }),
      status("a1", "working", { folder: "my-app", timestamp: ago(minute) }),
      status("a2", "done", { folder: "my-app", timestamp: ago(5 * minute) }),
      status("a3", "waiting", { folder: "my-app", timestamp: ago(2 * minute) }),
      status("a4", "done", { folder: "my-app", timestamp: ago(30 * minute) }),
      status("t12", "done", { folder: "my-app-todo12", worktree: true }),
      status("t9", "working", { folder: "my-app-todo9", worktree: true }),
      status("b2", "done", { folder: "beta" }),
      status("b", "waiting", { folder: "Beta" }),
      status("c", "done", { folder: undefined, cwd: "C:\\projects\\alpha" }),
    ],
    "project",
  );
  assert.deepEqual(
    groups.map((group) => [group.id, group.label, group.description, group.sessions.map((s) => s.session_id)]),
    [
      ["project:alpha", "alpha", "1 done", ["c"]],
      ["project:beta", "Beta", "1 waiting · 1 done", ["b", "b2"]],
      ["project:my-app", "my-app", "1 waiting · 2 done · 1 working · 1 open", ["a3", "a4", "a2", "a1", "a0"]],
      ["project:my-app-todo9", "my-app-todo9", "1 working", ["t9"]],
      ["project:my-app-todo12", "my-app-todo12", "1 done", ["t12"]],
    ],
  );
  assert.deepEqual(groupSessions([], "project"), []);
});

void test("grouping by state is the default; its ids and descriptions", () => {
  const statuses = [status("a", "working"), status("b", "waiting")];
  assert.deepEqual(groupSessions(statuses), groupSessions(statuses, "state"));
  assert.deepEqual(
    groupSessions(statuses).map((group) => [group.id, group.description]),
    [
      ["state:waiting", ""],
      ["state:working", ""],
    ],
  );
});

void test("row label: the project grouped by state, the state grouped by project", () => {
  assert.equal(rowLabel(status("a", "waiting"), "state"), "demo-a");
  assert.equal(rowLabel(status("a", "waiting"), "project"), "Waiting");
  assert.equal(rowLabel(status("a", "open"), "project"), "Open");
  assert.equal(rowLabel(status("a", "done"), "project"), "Done");
  assert.equal(rowLabel(status("a", "working"), "project"), "Working");
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
  assert.equal(sessionDescription(status("a", "open", { timestamp }), now), "", "open shows no age");
  assert.equal(sessionDescription(status("a", "done", { message: "Finished" }), now), "Finished");
  const reply = { timestamp, message: "Tests run in the background." };
  assert.equal(
    sessionDescription(status("a", "working", { ...reply, background: 1, worktree: true }), now),
    "worktree · background task · Tests run in the background.",
  );
  assert.equal(
    sessionDescription(status("a", "done", { ...reply, background: 1 }), now),
    "12 min · Tests run in the background.",
    "fallen back to done: a plain done",
  );
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
  assert.equal(
    sessionTooltip(status("a", "working", { cwd: "C:/projects/demo-a", timestamp, background: 2, message: "Started it." }), now),
    "C:/projects/demo-a\nWorking on a background task since 09:05\nStarted it.",
  );
  assert.equal(
    sessionTooltip(status("a", "open", { cwd: "C:/projects/demo-a", timestamp }), now),
    "C:/projects/demo-a\nOpen (no status yet), chat started 09:05",
  );
  assert.equal(sessionTooltip(status("a", "open"), now), "demo-a\nOpen (no status yet)");
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

void test("a click opens project_dir; an older file uses cwd only while it is the project folder", () => {
  assert.equal(sessionFolder(status("a", "done", { project_dir: "C:/p/demo-a", cwd: "C:\\p\\demo-a\\sub" })), "C:/p/demo-a");
  assert.equal(sessionFolder(status("a", "done", { cwd: "C:\\p\\Demo-A" })), "C:\\p\\Demo-A");
  assert.equal(sessionFolder(status("a", "done", { cwd: "C:\\p\\demo-a\\sub" })), undefined);
  assert.equal(sessionFolder(status("a", "done", { folder: undefined })), undefined);
});

void test("a project with a status and no chat running is listed as closed, in both groupings", () => {
  const parked = [
    { label: "Beta", status: "On hold", folder: "C:/p/Beta", color: undefined },
    { label: "PeacefreeWeb", status: "Come back later", folder: "C:/p/PeacefreeWeb", color: "charts.purple" },
    { label: "zeta", status: "Later", folder: undefined, color: undefined },
  ];
  // beta has a chat (any spelling), so it is open: its sessions, no closed row; its done is parked.
  const statuses = [status("b", "done", { folder: "beta" }), status("m", "working", { folder: "my-app" })];
  const byState = groupSessions(statuses, "state", parked);
  assert.deepEqual(
    byState.map((group) => [group.id, group.label, group.sessions.length, group.closed.map((p) => p.label)]),
    [
      ["state:working", "Working (1)", 1, []],
      ["state:parked", "Parked (1)", 1, []],
      ["state:closed", "Closed (2)", 0, ["PeacefreeWeb", "zeta"]],
    ],
  );
  const byProject = groupSessions(statuses, "project", parked);
  assert.deepEqual(
    byProject.map((group) => [group.id, group.label, group.description, group.sessions.length, group.closed.map((p) => p.label)]),
    [
      ["project:beta", "beta", "1 done", 1, []],
      ["project:my-app", "my-app", "1 working", 1, []],
      ["project:peacefreeweb", "PeacefreeWeb", "", 0, ["PeacefreeWeb"]],
      ["project:zeta", "zeta", "", 0, ["zeta"]],
    ],
  );
  // A closed project's folder is the one saved with its status.
  assert.equal(groupFolder(byProject[2]), "C:/p/PeacefreeWeb");
  assert.equal(groupFolder(byProject[3]), undefined);
  // Nothing parked: no closed group, as before.
  assert.equal(groupSessions([], "state", []).length, 0);
});

void test("grouped by state, a parked project's done chats get a group of their own; its other chats stay", () => {
  const parked = [
    { label: "PeacefreeWeb", status: "On hold", folder: undefined, color: undefined },
    { label: "Gone", status: "On hold", folder: undefined, color: undefined },
  ];
  const statuses = [
    status("late", "done", { folder: "peacefreeweb", timestamp: ago(2 * minute) }),
    status("early", "done", { folder: "PeacefreeWeb", timestamp: ago(9 * minute) }),
    status("asks", "waiting", { folder: "PeacefreeWeb" }),
    status("busy", "working", { folder: "PeacefreeWeb" }),
    status("new", "open", { folder: "PeacefreeWeb" }),
    status("other", "done", { folder: "other" }),
  ];
  const byState = groupSessions(statuses, "state", parked);
  assert.deepEqual(
    byState.map((group) => [group.id, group.label, group.sessions.map((s) => s.session_id), group.closed.map((p) => p.label)]),
    [
      ["state:waiting", "Waiting (1)", ["asks"], []],
      ["state:done", "Done (1)", ["other"], []],
      ["state:working", "Working (1)", ["busy"], []],
      ["state:open", "Open (1)", ["new"], []],
      ["state:parked", "Parked (2)", ["early", "late"], []],
      ["state:closed", "Closed (1)", [], ["Gone"]],
    ],
  );
  // Grouped by project nothing moves: the header names the status, the done still says done.
  const project = groupSessions(statuses, "project", parked).find((group) => group.id === "project:peacefreeweb");
  assert.equal(project?.description, "1 waiting · 2 done · 1 working · 1 open");
  // The test behind it, ignoring case like the grouping; nothing parked without a status.
  const isParked = parkedTest(parked);
  assert.equal(isParked(status("x", "done", { folder: "PEACEFREEWEB" })), true);
  assert.equal(isParked(status("x", "done", { folder: "other" })), false);
  assert.equal(parkedTest([])(status("x", "done", { folder: "PeacefreeWeb" })), false);
});
