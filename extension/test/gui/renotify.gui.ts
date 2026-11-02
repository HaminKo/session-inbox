// GUI test for re-notify (renotify.ts): a stand-in notify.ps1 (SESSION_INBOX_NOTIFY_SCRIPT) appends
// every payload it gets to a log. The test window has a temp folder open; another temp folder plays a
// project open in some other window, whose window sends its own reminders. A focused window holds
// its reminders back, and Playwright keeps the test window focused (blur(), minimize() and a faked DOM
// blur all left VS Code's window state focused, 2026-11-01), so SESSION_INBOX_IGNORE_FOCUS turns that
// off here; the hold itself is a user-test item.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { launchVsCode, type VsCode } from "./launch.ts";
import { writeSampleSession, writeSampleStatus } from "./samples.ts";
import { statusItem } from "./selectors.ts";

let vscode: VsCode;
const temps: string[] = [];
let hereDir: string;
let log: string;

function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

const minute = 60_000;

before(async () => {
  hereDir = temp("session-inbox-here-");
  const otherDir = temp("session-inbox-other-");
  const statusDir = temp("session-inbox-status-");
  const sessionsDir = temp("session-inbox-sessions-");
  // Past the default 10 minutes in this window, under it in this window, past it in another window.
  writeSampleStatus(statusDir, "here-old", "waiting", { projectDir: hereDir, waitedMs: 20 * minute });
  writeSampleStatus(statusDir, "here-new", "waiting", { projectDir: hereDir, waitedMs: minute });
  writeSampleStatus(statusDir, "other-old", "waiting", { projectDir: otherDir, waitedMs: 20 * minute });
  for (const id of ["here-old", "here-new", "other-old"]) writeSampleSession(sessionsDir, id);
  const fakeDir = temp("session-inbox-fake-notify-");
  log = join(fakeDir, "calls.txt");
  const script = join(fakeDir, "notify.ps1");
  writeFileSync(
    script,
    "[Console]::InputEncoding = [System.Text.Encoding]::UTF8\n" +
      "$data = [Console]::In.ReadToEnd() | ConvertFrom-Json\n" +
      "$data | Add-Member project_dir $env:CLAUDE_PROJECT_DIR\n" +
      `Add-Content -LiteralPath '${log}' -Encoding UTF8 -Value ($data | ConvertTo-Json -Compress)\n`,
  );
  vscode = await launchVsCode(
    { SESSION_INBOX_STATUS_DIR: statusDir, SESSION_INBOX_SESSIONS_DIR: sessionsDir, SESSION_INBOX_NOTIFY_SCRIPT: script, SESSION_INBOX_IGNORE_FOCUS: "1" },
    hereDir,
  );
  await vscode.window.locator(statusItem).waitFor({ state: "visible", timeout: 20_000 });
});

after(async () => {
  await vscode?.close();
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function calls(): Record<string, string>[] {
  if (!existsSync(log)) return [];
  const lines = readFileSync(log, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  return lines.map((line) => JSON.parse(line) as Record<string, string>);
}

void test("only this window's chat past the threshold gets a reminder, once", async () => {
  const end = Date.now() + 15_000;
  while (calls().length === 0 && Date.now() < end) await vscode.window.waitForTimeout(200);
  // Room for a wrong second call to show up (the folder watcher re-reads on its own changes too).
  await vscode.window.waitForTimeout(2_000);
  const got = calls();
  assert.equal(got.length, 1, JSON.stringify(got));
  assert.equal(got[0]?.session_id, "here-old");
  assert.equal(got[0]?.hook_event_name, "SessionInboxReminder");
  assert.equal(got[0]?.project_dir, hereDir);
  assert.match(got[0]?.message ?? "", /^Still waiting \(20 min\): Needs permission to use Bash$/);
});
