// GUI test for the tray indicator (tray.ts, tray/session-tray.ps1): the setting sessionInbox.trayIcon
// starts and stops it, and it closes with VS Code. The tray runs under this test's own mutex
// (SESSION_INBOX_TRAY_MUTEX), so the real tray is never touched; "running" means that mutex is held.
// Its icon and menu are checked by the user (the tray area is outside VS Code's window).
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import { launchVsCode, type VsCode } from "./launch.ts";
import { writeSampleSession, writeSampleStatus } from "./samples.ts";
import { statusItem } from "./selectors.ts";

const skip = process.platform !== "win32" && "Windows only";
const mutex = `Local\\SessionInboxTrayGui-${process.pid}`;
let vscode: VsCode | undefined;
const temps: string[] = [];

async function trayRunning(): Promise<boolean> {
  const { stdout } = await promisify(execFile)("powershell.exe", [
    "-NoProfile",
    "-Command",
    `$m = $null; [System.Threading.Mutex]::TryOpenExisting('${mutex}', [ref]$m)`,
  ]);
  return stdout.trim() === "True";
}

async function waitForTray(running: boolean, ms: number): Promise<void> {
  const end = Date.now() + ms;
  while ((await trayRunning()) !== running) {
    if (Date.now() > end) assert.fail(running ? "the tray didn't start" : "the tray didn't close");
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

before(async () => {
  if (skip) return;
  const statusDir = mkdtempSync(join(tmpdir(), "session-inbox-status-"));
  const sessionsDir = mkdtempSync(join(tmpdir(), "session-inbox-sessions-"));
  temps.push(statusDir, sessionsDir);
  writeSampleStatus(statusDir, "tray-waiting", "waiting");
  writeSampleSession(sessionsDir, "tray-waiting");
  vscode = await launchVsCode(
    { SESSION_INBOX_STATUS_DIR: statusDir, SESSION_INBOX_SESSIONS_DIR: sessionsDir, SESSION_INBOX_TRAY_MUTEX: mutex },
    undefined,
    [],
    { "sessionInbox.trayIcon": true },
  );
  await vscode.window.locator(statusItem).waitFor({ state: "visible", timeout: 20_000 });
});

after(async () => {
  await vscode?.close();
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

void test("the setting starts and stops the tray, and it closes with VS Code", { skip }, async () => {
  assert.ok(vscode);
  await waitForTray(true, 15_000);
  writeFileSync(vscode.settingsFile, JSON.stringify({ "sessionInbox.trayIcon": false }));
  await waitForTray(false, 10_000);
  writeFileSync(vscode.settingsFile, JSON.stringify({ "sessionInbox.trayIcon": true }));
  await waitForTray(true, 10_000);
  const running = vscode;
  vscode = undefined;
  await running.close();
  await waitForTray(false, 10_000);
});
