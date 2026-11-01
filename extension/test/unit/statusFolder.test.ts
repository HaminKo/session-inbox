// Unit tests for the status-folder reader. Plain Node, no VS Code: `npm test`.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { countStates, readStatuses, statusDir, summarize, watchFolder } from "../../src/statusFolder.ts";

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

void test("counts by state", () => {
  const counts = countStates([
    { session_id: "a", state: "waiting" },
    { session_id: "b", state: "done" },
    { session_id: "c", state: "done" },
    { session_id: "d", state: "working" },
  ]);
  assert.deepEqual(counts, { waiting: 1, done: 2, working: 1 });
});

void test("summary counts waiting + done", () => {
  const busy = summarize({ waiting: 1, done: 2, working: 3 });
  assert.equal(busy.needsYou, 3);
  assert.equal(busy.text, "$(warning) 3 waiting");
  assert.equal(
    busy.tooltip,
    "Session Inbox: 3 sessions need you\nWaiting (permission or question): 1\nDone (your turn): 2\nWorking: 3",
  );
  assert.match(summarize({ waiting: 0, done: 1, working: 0 }).tooltip, /^Session Inbox: 1 session needs you\n/);
  const clear = summarize({ waiting: 0, done: 0, working: 2 });
  assert.equal(clear.needsYou, 0);
  assert.equal(clear.text, "$(check) all clear");
  assert.match(clear.tooltip, /^Session Inbox: No session needs you\n/);
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
