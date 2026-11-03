// The tray script (tray/session-tray.ps1) keeps a PowerShell copy of the status-folder rules. These
// tests run it with -Once on the same temp folders as the TypeScript and compare, so a change to one
// copy that isn't made in the other fails here. Windows only (Windows PowerShell 5.1).
import assert from "node:assert/strict";
import { execFile, spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { suite, test } from "node:test";
import { promisify } from "node:util";
import { sessionFolder, sessionLabel } from "../../src/sessionList.ts";
import { countStates, onlyLive, readLiveSessions, readStatuses } from "../../src/statusFolder.ts";

const script = join(import.meta.dirname, "..", "..", "..", "tray", "session-tray.ps1");
const skip = process.platform !== "win32" && "Windows PowerShell only";

interface TrayResult {
  waiting: number;
  done: number;
  working: number;
  needsYou: number;
  needs: { session_id: string; state: string; label: string; project_dir: string }[];
}

function powershell(args: string[], env: NodeJS.ProcessEnv) {
  return promisify(execFile)("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, ...args], {
    env: { ...process.env, ...env },
    // A tray that doesn't exit (the mutex check failed) would hang the test run.
    timeout: 15_000,
  });
}

async function runOnce(statusDir: string, sessionsDir: string): Promise<TrayResult> {
  const { stdout } = await powershell(["-Once"], {
    SESSION_INBOX_STATUS_DIR: statusDir,
    SESSION_INBOX_SESSIONS_DIR: sessionsDir,
  });
  return JSON.parse(stdout) as TrayResult;
}

// What the extension shows for the same folders: counts, and the ids that need you.
async function extensionView(statusDir: string, sessionsDir: string) {
  const statuses = onlyLive(await readStatuses(statusDir), await readLiveSessions(sessionsDir));
  const { waiting, done, working } = countStates(statuses);
  const needs = statuses.filter((status) => status.state === "waiting" || status.state === "done");
  return { waiting, done, working, needsYou: waiting + done, ids: needs.map((status) => status.session_id).sort() };
}

async function assertSameAsExtension(statusDir: string, sessionsDir: string) {
  const tray = await runOnce(statusDir, sessionsDir);
  const expected = await extensionView(statusDir, sessionsDir);
  const { waiting, done, working, needsYou } = tray;
  assert.deepEqual(
    { waiting, done, working, needsYou, ids: tray.needs.map((session) => session.session_id).sort() },
    expected,
  );
  return tray;
}

function folders() {
  const root = mkdtempSync(join(tmpdir(), "session-inbox-unit-"));
  const statusDir = join(root, "session-status");
  const sessionsDir = join(root, "sessions");
  mkdirSync(statusDir);
  mkdirSync(sessionsDir);
  return { root, statusDir, sessionsDir };
}

function writeStatus(dir: string, id: string, state: string, more: object = {}): void {
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({ session_id: id, folder: `project-${id}`, state, ...more }));
}

// Named by session, not pid: here several sessions share this test's pid.
function writeSession(dir: string, pid: number, sessionId: string): void {
  writeFileSync(join(dir, `${sessionId}.json`), JSON.stringify({ pid, sessionId, kind: "interactive" }));
}

// A PID that just exited: a child process that ran and finished.
function deadPid(): number {
  const pid = spawnSync(process.execPath, ["-e", ""]).pid;
  assert.ok(pid);
  return pid;
}

// Each test starts powershell.exe (~0.6 s), so they run side by side.
void suite("tray script", { skip, concurrency: true }, () => {
  void test("counts and lists the same sessions as the extension", async () => {
    const { root, statusDir, sessionsDir } = folders();
    try {
      writeStatus(statusDir, "w", "waiting", { project_dir: "c:/work/project-w" });
      writeStatus(statusDir, "d", "done");
      writeStatus(statusDir, "c", "done", { cwd: "c:\\work\\project-c" });
      writeStatus(statusDir, "sub", "done", { cwd: "c:\\work\\project-sub\\extension" });
      writeStatus(statusDir, "k", "working");
      writeStatus(statusDir, "gone", "waiting");
      writeStatus(statusDir, "bad-state", "sleeping");
      writeStatus(statusDir, "upper", "Waiting");
      writeFileSync(join(statusDir, "half.json"), '{"session_id":"half","sta');
      writeFileSync(join(statusDir, "bom.json"), "\uFEFF" + JSON.stringify({ session_id: "bom", state: "done" }));
      writeFileSync(join(statusDir, "list.json"), JSON.stringify([{ session_id: "list", state: "done" }]));
      writeFileSync(join(statusDir, "number-id.json"), JSON.stringify({ session_id: 5, state: "done" }));
      writeFileSync(join(statusDir, ".reveal"), JSON.stringify({ session_id: "w", project_dir: "x", at: 1 }));
      writeFileSync(join(statusDir, "x.json.1.tmp"), JSON.stringify({ session_id: "x", state: "done" }));
      for (const id of ["w", "d", "c", "sub", "k", "bad-state", "upper", "bom", "list"]) writeSession(sessionsDir, process.pid, id);
      writeSession(sessionsDir, deadPid(), "gone");

      const tray = await assertSameAsExtension(statusDir, sessionsDir);
      assert.equal(tray.needsYou, 4, "one waiting and three done; the leftover is hidden");
      assert.equal(tray.needs[0]?.session_id, "w", "waiting first");
      // Label and the folder a click opens, as the sidebar has them.
      const statuses = await readStatuses(statusDir);
      for (const need of tray.needs) {
        const status = statuses.find((candidate) => candidate.session_id === need.session_id);
        assert.ok(status);
        assert.equal(need.label, sessionLabel(status), `label of ${need.session_id}`);
        assert.equal(need.project_dir, sessionFolder(status) ?? "", `folder of ${need.session_id}`);
      }
      assert.deepEqual(
        tray.needs.map((need) => need.project_dir),
        ["c:/work/project-w", "c:\\work\\project-c", "", ""],
        "project_dir; else cwd while it is the folder itself",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  void test("a sessions folder that can't be trusted hides nothing", async () => {
    const { root, statusDir, sessionsDir } = folders();
    try {
      writeStatus(statusDir, "a", "done");
      writeStatus(statusDir, "b", "waiting");
      assert.equal((await assertSameAsExtension(statusDir, join(root, "missing"))).needsYou, 2, "missing folder");
      assert.equal((await assertSameAsExtension(statusDir, sessionsDir)).needsYou, 2, "empty folder");
      writeSession(sessionsDir, process.pid, "a");
      writeFileSync(join(sessionsDir, "1.json"), JSON.stringify({ processId: 1, id: "renamed-fields" }));
      assert.equal((await assertSameAsExtension(statusDir, sessionsDir)).needsYou, 2, "a file in another format");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  void test("a missing status folder or a single session", async () => {
    const { root, statusDir, sessionsDir } = folders();
    try {
      assert.equal((await assertSameAsExtension(join(root, "missing"), sessionsDir)).needsYou, 0, "missing folder");
      writeStatus(statusDir, "only", "waiting", { folder: undefined, cwd: "c:\\work\\from-cwd\\" });
      const tray = await assertSameAsExtension(statusDir, sessionsDir);
      assert.deepEqual(tray.needs.map((session) => session.label), ["from-cwd"], "a one-item list stays a list; label from cwd");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // A PowerShell helper holds the mutex, as a running tray would; a second tray must exit at once
  // without showing an icon.
  void test("a second copy exits", async () => {
    const mutex = `Local\\SessionInboxTrayTest-${process.pid}`;
    const holder = spawn("powershell.exe", [
      "-NoProfile",
      "-Command",
      `$m = New-Object System.Threading.Mutex($true, '${mutex}'); 'held'; Start-Sleep 20`,
    ]);
    try {
      await new Promise<void>((resolve, reject) => {
        holder.stdout.once("data", () => resolve());
        holder.once("exit", () => reject(new Error("the mutex holder exited early")));
      });
      const { root, statusDir, sessionsDir } = folders();
      try {
        const started = Date.now();
        await powershell([], {
          SESSION_INBOX_STATUS_DIR: statusDir,
          SESSION_INBOX_SESSIONS_DIR: sessionsDir,
          SESSION_INBOX_TRAY_MUTEX: mutex,
        });
        assert.ok(Date.now() - started < 10_000, "exited without starting the tray");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    } finally {
      holder.kill();
    }
  });
});
