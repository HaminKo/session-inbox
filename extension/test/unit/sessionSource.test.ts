// Unit tests for the shared session source. Plain Node, no VS Code: `npm test`.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { SessionSource } from "../../src/sessionSource.ts";
import type { SessionStatus } from "../../src/statusFolder.ts";

let root: string;
let statusDir: string;
let sessionsDir: string;
let source: SessionSource | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "session-inbox-unit-"));
  statusDir = join(root, "status");
  sessionsDir = join(root, "sessions");
  mkdirSync(statusDir);
  mkdirSync(sessionsDir);
});

afterEach(() => {
  source?.dispose();
  rmSync(root, { recursive: true, force: true });
});

function writeStatus(id: string, state: string): void {
  writeFileSync(join(statusDir, `${id}.json`), JSON.stringify({ session_id: id, folder: "demo", state }));
}

function writeSession(id: string, entrypoint?: string): void {
  writeFileSync(join(sessionsDir, `${id}.json`), JSON.stringify({ pid: process.pid, sessionId: id, kind: "interactive", entrypoint }));
}

// Resolves with the first update whose ids (sorted) equal `ids`, or rejects after 3 s.
function waitFor(src: SessionSource, ids: string[]): Promise<readonly SessionStatus[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`never saw ${ids.join(",")}`)), 3_000);
    const sub = src.onChange((statuses) => {
      if (statuses.map((status) => status.session_id).sort().join(",") !== ids.join(",")) return;
      clearTimeout(timer);
      // onChange may call back before it returns; drop the listener on the next tick.
      setImmediate(() => sub.dispose());
      resolve(statuses);
    });
  });
}

void test("reports only sessions whose chat is running, and follows changes", async () => {
  writeStatus("a", "waiting");
  writeStatus("gone", "done");
  writeSession("a");
  writeSession("b");
  source = new SessionSource(statusDir, sessionsDir);
  await waitFor(source, ["a"]);
  writeStatus("b", "working");
  await waitFor(source, ["a", "b"]);
});

void test("a late subscriber gets the last read at once", async () => {
  writeStatus("a", "waiting");
  writeSession("a");
  source = new SessionSource(statusDir, sessionsDir);
  await waitFor(source, ["a"]);
  let got: readonly SessionStatus[] | undefined;
  source.onChange((statuses) => (got = statuses)).dispose();
  assert.deepEqual(
    got?.map((status) => status.session_id),
    ["a"],
  );
});

void test("no updates after dispose", async () => {
  writeSession("a");
  source = new SessionSource(statusDir, sessionsDir);
  await waitFor(source, []);
  let calls = 0;
  source.onChange(() => calls++);
  calls = 0;
  source.dispose();
  writeStatus("a", "waiting");
  await source.refresh();
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(calls, 0);
});

void test("a running VS Code chat is open until its status file appears", async () => {
  writeSession("restored", "claude-vscode");
  source = new SessionSource(statusDir, sessionsDir);
  const [open] = await waitFor(source, ["restored"]);
  assert.equal(open?.state, "open");
  writeStatus("restored", "working");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("never saw working")), 3_000);
    const sub = source?.onChange((statuses) => {
      if (statuses.length !== 1 || statuses[0]?.state !== "working") return;
      clearTimeout(timer);
      setImmediate(() => sub?.dispose());
      resolve();
    });
  });
});
