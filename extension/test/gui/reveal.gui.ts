// GUI test for showing a chat's own Claude tab (docs/research/claude-tabs.md): a stand-in Claude
// Code (test/gui/fake-claude) records which session ids it was asked to show. The test window has
// a temp folder open; another temp folder plays a project open in some other window.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { launchVsCode, type VsCode } from "./launch.ts";
import { writeSampleSession, writeSampleStatus } from "./samples.ts";
import { statusItem, treeRow } from "./selectors.ts";

let vscode: VsCode;
const temps: string[] = [];
let hereDir: string;
let otherDir: string;
let statusDir: string;
let log: string;

function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

before(async () => {
  hereDir = temp("session-inbox-here-");
  otherDir = temp("session-inbox-other-");
  statusDir = temp("session-inbox-status-");
  writeSampleStatus(statusDir, "here", "done", { projectDir: hereDir });
  const sessionsDir = temp("session-inbox-sessions-");
  writeSampleSession(sessionsDir, "here");
  log = join(temp("session-inbox-fake-claude-"), "calls.txt");
  vscode = await launchVsCode(
    { SESSION_INBOX_STATUS_DIR: statusDir, SESSION_INBOX_SESSIONS_DIR: sessionsDir, FAKE_CLAUDE_LOG: log },
    hereDir,
    [resolve(import.meta.dirname, "fake-claude")],
  );
  await vscode.window.locator(statusItem).waitFor({ state: "visible", timeout: 20_000 });
});

after(async () => {
  await vscode?.close();
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function calls(): string[] {
  return existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
}

async function waitForCalls(expected: string[]): Promise<void> {
  const end = Date.now() + 10_000;
  while (JSON.stringify(calls()) !== JSON.stringify(expected)) {
    if (Date.now() > end) assert.fail(`expected calls ${JSON.stringify(expected)}, got ${JSON.stringify(calls())}`);
    await vscode.window.waitForTimeout(200);
  }
}

// What notify.ps1 writes on a popup click.
function writeRequest(sessionId: string, projectDir: string): void {
  writeFileSync(join(statusDir, ".reveal"), JSON.stringify({ session_id: sessionId, project_dir: projectDir, at: Date.now() }));
}

void test("a click on a session of this window asks Claude Code for its tab", async () => {
  await vscode.window.locator(statusItem).click();
  const row = vscode.window.locator(treeRow).filter({ hasText: "demo-here" });
  await row.click();
  await waitForCalls(["here"]);
});

void test("a request for another window's folder is ignored, one for this window's is shown", async () => {
  writeRequest("elsewhere", otherDir);
  await vscode.window.waitForTimeout(1_500);
  assert.deepEqual(calls(), ["here"]);
  // Another case than VS Code's own path for the folder (the hook writes `c:/...`).
  writeRequest("popup", hereDir.toUpperCase());
  await waitForCalls(["here", "popup"]);
});
