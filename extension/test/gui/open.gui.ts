// GUI test for the clicks: the status bar item shows the sidebar, and a session row focuses the
// window that has its folder open, or opens one. The test window has a temp folder open; another
// temp folder plays a project with no window yet.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { after, before, test } from "node:test";
import { launchVsCode, type VsCode } from "./launch.ts";
import { writeSampleSession, writeSampleStatus } from "./samples.ts";
import { statusItem, treeRow } from "./selectors.ts";

let vscode: VsCode;
const temps: string[] = [];
let hereDir: string;
let otherDir: string;

function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

before(async () => {
  hereDir = temp("session-inbox-here-");
  otherDir = temp("session-inbox-other-");
  const statusDir = temp("session-inbox-status-");
  writeSampleStatus(statusDir, "here", "done", { projectDir: hereDir });
  writeSampleStatus(statusDir, "other", "waiting", { projectDir: otherDir });
  const sessionsDir = temp("session-inbox-sessions-");
  for (const id of ["here", "other"]) writeSampleSession(sessionsDir, id);
  vscode = await launchVsCode({ SESSION_INBOX_STATUS_DIR: statusDir, SESSION_INBOX_SESSIONS_DIR: sessionsDir }, hereDir);
  await vscode.window.locator(statusItem).waitFor({ state: "visible", timeout: 20_000 });
});

after(async () => {
  await vscode?.close();
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function row(label: string) {
  // `:text-is()` on `.label-name` never matches (measured 2026-11-01, VS Code 1.144); `hasText` does.
  return vscode.window.locator(treeRow).filter({ hasText: label });
}

// Window titles of every VS Code window, read from the main process.
async function titles(): Promise<string[]> {
  // Electron's types aren't installed (the test doesn't depend on electron); the part used here.
  type Electron = { BrowserWindow: { getAllWindows(): { getTitle(): string }[] } };
  return vscode.app.evaluate(({ BrowserWindow }: Electron) => BrowserWindow.getAllWindows().map((w) => w.getTitle()));
}

async function waitForTitles(check: (titles: string[]) => boolean, what: string): Promise<string[]> {
  const end = Date.now() + 15_000;
  for (;;) {
    const now = await titles();
    if (check(now)) return now;
    if (Date.now() > end) assert.fail(`${what}; windows: ${JSON.stringify(now)}`);
    await vscode.window.waitForTimeout(200);
  }
}

void test("a click on the status bar item shows the Sessions view", async () => {
  // The window opens with the Explorer showing, so a visible row means the click switched views.
  await vscode.window.locator(statusItem).click();
  await row("demo-other").waitFor({ state: "visible", timeout: 5_000 });
});

void test("a session whose folder has no window opens it in a new window", async () => {
  await row("demo-other").click();
  await waitForTitles(
    (now) => now.length === 2 && now.some((title) => title.includes(basename(otherDir))),
    "expected a second window for the other folder",
  );
});

void test("a session whose folder already has a window brings it up, no new window", async () => {
  // Both folders are open now: the click on either must not add a window.
  await row("demo-other").click();
  await row("demo-here").click();
  await vscode.window.waitForTimeout(3_000);
  const now = await titles();
  assert.equal(now.length, 2, `windows: ${JSON.stringify(now)}`);
});
