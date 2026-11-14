// Unit tests for the status-folder reader. Plain Node, no VS Code: `npm test`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import {
  backgroundAsWorking,
  backgroundLimitMs,
  countStates,
  onlyLive,
  openSessions,
  readLiveSessions,
  readStatuses,
  sessionsDir,
  statusDir,
  summarize,
  watchFolder,
  type SessionStatus,
} from "../../src/statusFolder.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "session-inbox-unit-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeStatus(dir: string, id: string, state: string): void {
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({ session_id: id, folder: "demo", state }));
}

// Resolves on the next onChange call, or rejects after `ms`.
function nextChange(dir: string, ms: number, options = { retryMs: 50 }) {
  let watcher: { dispose: () => void } | undefined;
  const changed = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no change reported within ${ms} ms`)), ms);
    watcher = watchFolder(dir, () => {
      clearTimeout(timer);
      resolve();
    }, options);
  });
  return { changed, dispose: () => watcher?.dispose() };
}

void test("statusDir uses the override, else ~/.claude/session-status", () => {
  assert.equal(statusDir({ SESSION_INBOX_STATUS_DIR: root }), root);
  assert.match(statusDir({}), /[\\/]\.claude[\\/]session-status$/);
});

void test("a missing folder reads as no sessions", async () => {
  assert.deepEqual(await readStatuses(join(root, "missing")), []);
});

void test("reads status files and skips everything else", async () => {
  writeStatus(root, "a", "waiting");
  writeStatus(root, "b", "done");
  writeStatus(root, "c", "working");
  writeStatus(root, "bad-state", "sleeping");
  writeFileSync(join(root, "half.json"), '{"session_id":"half","sta');
  writeFileSync(join(root, "d.json.123.tmp"), JSON.stringify({ session_id: "d", state: "done" }));
  writeFileSync(join(root, "notes.txt"), "not a status file");
  const ids = (await readStatuses(root)).map((status) => status.session_id).sort();
  assert.deepEqual(ids, ["a", "b", "c"]);
});

// A PID that just exited: a child process that ran and finished.
function deadPid(): number {
  const pid = spawnSync(process.execPath, ["-e", ""]).pid;
  assert.ok(pid);
  return pid;
}

function writeSession(dir: string, pid: number, sessionId: string): void {
  writeFileSync(join(dir, `${pid}.json`), JSON.stringify({ pid, sessionId, kind: "interactive" }));
}

void test("sessionsDir uses the override, else ~/.claude/sessions", () => {
  assert.equal(sessionsDir({ SESSION_INBOX_SESSIONS_DIR: root }), root);
  assert.match(sessionsDir({}), /[\\/]\.claude[\\/]sessions$/);
});

void test("live sessions are those whose process is running", async () => {
  writeSession(root, process.pid, "alive");
  writeSession(root, deadPid(), "gone");
  writeFileSync(join(root, "notes.txt"), "not a session file");
  assert.deepEqual(
    (await readLiveSessions(root))?.map((session) => session.sessionId),
    ["alive"],
  );
});

void test("a sessions folder that can't be trusted hides nothing", async () => {
  assert.equal(await readLiveSessions(join(root, "missing")), undefined, "missing folder");
  assert.equal(await readLiveSessions(root), undefined, "empty folder");
  writeSession(root, process.pid, "alive");
  writeFileSync(join(root, "1.json"), '{"pid":1,"sess');
  assert.equal(await readLiveSessions(root), undefined, "a file mid-write");
  writeFileSync(join(root, "1.json"), JSON.stringify({ processId: 1, id: "renamed-fields" }));
  assert.equal(await readLiveSessions(root), undefined, "a file in another format");
  writeFileSync(join(root, "1.json"), JSON.stringify({ pid: 0, sessionId: "bad-pid" }));
  assert.equal(await readLiveSessions(root), undefined, "a PID that isn't a process id");
  const statuses = [{ session_id: "a", state: "done" as const }];
  assert.deepEqual(onlyLive(statuses, undefined), statuses);
});

void test("onlyLive drops status files whose chat is gone", () => {
  const statuses = [
    { session_id: "alive", state: "done" as const },
    { session_id: "gone", state: "done" as const },
  ];
  assert.deepEqual(
    onlyLive(statuses, [{ pid: 1, sessionId: "alive" }]).map((status) => status.session_id),
    ["alive"],
  );
});

void test("a reply that ended with a background task counts as working until restart or 45 min", () => {
  const now = Date.parse("2026-11-05T22:30:00-05:00");
  const reply = "2026-11-05T22:15:03.0403531-05:00"; // the hook's format: seven decimals, local offset
  const replyMs = Date.parse(reply);
  const done = (id: string, more: Partial<SessionStatus> = {}): SessionStatus => ({
    session_id: id,
    state: "done",
    background: 1,
    timestamp: reply,
    ...more,
  });
  const statuses = [
    done("running"),
    done("restarted"),
    done("two-processes"),
    done("unknown-start"),
    done("old", { timestamp: new Date(now - backgroundLimitMs).toISOString() }),
    done("almost-old", { timestamp: new Date(now - backgroundLimitMs + 1000).toISOString() }),
    done("none", { background: 0 }),
    done("no-field", { background: undefined }),
    done("text", { background: "2" as unknown as number }),
    done("no-time", { timestamp: undefined }),
    done("bad-time", { timestamp: "soon" }),
    done("waiting", { state: "waiting" }),
  ];
  // Each chat's running processes by start time; one started before the reply unless listed here.
  const before = replyMs - 60 * 60_000; // before every status's own reply, "almost-old" too
  const after = replyMs + 60_000;
  const starts: Record<string, unknown[]> = {
    restarted: [after],
    "two-processes": [after, before], // the reply's own process still runs
    "unknown-start": ["soon"],
  };
  const live = statuses.flatMap((status) =>
    (starts[status.session_id] ?? [before]).map((startedAt) => ({ pid: 1, sessionId: status.session_id, startedAt })),
  );
  const states = (result: SessionStatus[]) => Object.fromEntries(result.map((status) => [status.session_id, status.state]));
  assert.deepEqual(states(backgroundAsWorking(statuses, live, now)), {
    running: "working",
    restarted: "done",
    "two-processes": "working",
    "unknown-start": "working",
    old: "done",
    "almost-old": "working",
    none: "done",
    "no-field": "done",
    text: "done",
    "no-time": "done",
    "bad-time": "done",
    waiting: "waiting",
  });
  assert.equal(states(backgroundAsWorking(statuses, undefined, now)).restarted, "working", "no sessions folder: time only");
  const [kept] = backgroundAsWorking([done("running", { message: "Tests run in the background." })], live, now);
  assert.deepEqual(kept, { ...done("running", { message: "Tests run in the background." }), state: "working" });
});

void test("a running VS Code chat with no status file is open", () => {
  const statuses = [{ session_id: "has-file", state: "done" as const }];
  const chat = { kind: "interactive", entrypoint: "claude-vscode" };
  const live = [
    { pid: 1, sessionId: "has-file", ...chat, cwd: "C:\\p\\demo" },
    { pid: 2, sessionId: "restored", ...chat, cwd: "C:\\p\\PeacefreeWeb", startedAt: 0 },
    { pid: 3, sessionId: "cli", kind: "interactive", entrypoint: "cli", cwd: "C:\\p\\demo" },
    { pid: 4, sessionId: "background", kind: "sdk", entrypoint: "claude-vscode", cwd: "C:\\p\\demo" },
    { pid: 5, sessionId: "odd", ...chat, cwd: 5, startedAt: "soon" },
  ];
  assert.deepEqual(openSessions(statuses, live), [
    {
      session_id: "restored",
      state: "open",
      cwd: "C:\\p\\PeacefreeWeb",
      project_dir: "C:\\p\\PeacefreeWeb",
      timestamp: "1970-01-01T00:00:00.000Z",
    },
    { session_id: "odd", state: "open", cwd: undefined, project_dir: undefined, timestamp: undefined },
  ]);
  assert.deepEqual(openSessions(statuses, undefined), [], "a sessions folder that can't be trusted adds nothing");
});

void test("a status file can't claim the open state", async () => {
  writeStatus(root, "a", "open");
  assert.deepEqual(await readStatuses(root), []);
});

void test("counts by state", () => {
  const counts = countStates([
    { session_id: "a", state: "waiting" },
    { session_id: "b", state: "done" },
    { session_id: "c", state: "done" },
    { session_id: "d", state: "working" },
  ]);
  assert.deepEqual(counts, { waiting: 1, done: 2, working: 1, open: 0, parked: 0 });
});

void test("a parked project's done counts as parked; its waiting and working don't change", () => {
  const statuses: SessionStatus[] = [
    { session_id: "a", state: "waiting", folder: "held" },
    { session_id: "b", state: "done", folder: "held" },
    { session_id: "c", state: "done", folder: "free" },
    { session_id: "d", state: "working", folder: "held" },
    { session_id: "e", state: "open", folder: "held" },
  ];
  const counts = countStates(statuses, (status) => status.folder === "held");
  assert.deepEqual(counts, { waiting: 1, done: 1, working: 1, open: 1, parked: 1 });
  const summary = summarize(counts);
  assert.equal(summary.needsYou, 2, "waiting + done, not the parked done");
  assert.match(summary.tooltip, /\nDone \(your turn\): 1\nParked \(done, not counted\): 1\nWorking: 1\n/);
});

void test("summary counts waiting + done", () => {
  const busy = summarize({ waiting: 1, done: 2, working: 3, open: 0, parked: 0 });
  assert.equal(busy.needsYou, 3);
  assert.equal(busy.text, "$(warning) 3 waiting");
  assert.equal(
    busy.tooltip,
    "Session Inbox: 3 sessions need you\nWaiting (permission or question): 1\nDone (your turn): 2\nWorking: 3",
  );
  assert.match(summarize({ waiting: 0, done: 1, working: 0, open: 0, parked: 0 }).tooltip, /^Session Inbox: 1 session needs you\n/);
  const clear = summarize({ waiting: 0, done: 0, working: 2, open: 0, parked: 0 });
  assert.equal(clear.needsYou, 0);
  assert.equal(clear.text, "$(check) all clear");
  assert.match(clear.tooltip, /^Session Inbox: No session needs you\n/);
  const open = summarize({ waiting: 0, done: 0, working: 0, open: 8, parked: 0 });
  assert.equal(open.needsYou, 0, "open chats aren't counted");
  assert.equal(open.text, "$(check) all clear");
  assert.match(open.tooltip, /\nOpen \(no status yet\): 8$/);
  assert.doesNotMatch(clear.tooltip, /Open/, "no open line while there are none");
});

void test("watchFolder reports a new file", async () => {
  const watch = nextChange(root, 2_000);
  try {
    writeStatus(root, "a", "waiting");
    await watch.changed;
  } finally {
    watch.dispose();
  }
});

void test("watchFolder reports a deleted file", async () => {
  writeStatus(root, "a", "done");
  const watch = nextChange(root, 2_000);
  try {
    unlinkSync(join(root, "a.json"));
    await watch.changed;
  } finally {
    watch.dispose();
  }
});

void test("watchFolder waits for a missing folder to appear", async () => {
  const dir = join(root, "session-status");
  const watch = nextChange(dir, 2_000);
  try {
    mkdirSync(dir);
    await watch.changed;
  } finally {
    watch.dispose();
  }
});

void test("watchFolder notices the folder being deleted and coming back", async () => {
  const dir = join(root, "session-status");
  mkdirSync(dir);
  let calls = 0;
  const watcher = watchFolder(dir, () => calls++, { retryMs: 50 });
  try {
    rmSync(dir, { recursive: true });
    await waitFor(() => calls >= 1, "deletion not reported");
    mkdirSync(dir);
    const before = calls;
    await waitFor(() => calls > before, "re-created folder not reported");
    writeStatus(dir, "a", "waiting");
    const afterCreate = calls;
    await waitFor(() => calls > afterCreate, "file in the re-created folder not reported");
  } finally {
    watcher.dispose();
  }
});

void test("watchFolder reports during a steady stream of writes", async () => {
  let calls = 0;
  const watcher = watchFolder(root, () => calls++, { debounceMs: 100 });
  try {
    // A write every 30 ms for 600 ms: a wait that restarts on every event would never fire.
    for (let i = 0; i < 20; i++) {
      writeStatus(root, "a", i % 2 ? "working" : "done");
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    assert.ok(calls >= 2, `only ${calls} change(s) reported during the stream`);
  } finally {
    watcher.dispose();
  }
});

async function waitFor(check: () => boolean, message: string, ms = 2_000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
