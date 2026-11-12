// GUI test for the clicks: the status bar item shows the sidebar, and a session row focuses the
// window that has its folder open, or opens one. The test window has a temp folder open; another
// temp folder plays a project with no window yet, a third a project with a status and no chat
// (listed as closed).
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
let parkedDir: string;

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
  parkedDir = temp("session-inbox-parked-");
  const parked = { "sessionInbox.projects": { [basename(parkedDir)]: { status: "On hold", folder: parkedDir } } };
  const env = { SESSION_INBOX_STATUS_DIR: statusDir, SESSION_INBOX_SESSIONS_DIR: sessionsDir };
  vscode = await launchVsCode(env, hereDir, [], parked);
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

void test("Set Status of This Project in the palette lists this window's folder, as closed (no chat of it runs)", async () => {
  await vscode.window.keyboard.press("F1");
  const input = vscode.window.locator(".quick-input-widget input");
  await input.fill(">Session Inbox: Set Status of This Project");
  await vscode.window.locator(".quick-input-list .monaco-list-row").filter({ hasText: "Set Status of This Project" }).first().waitFor();
  await input.press("Enter");
  // Picked by typing (the pick's rows can still move when a click lands), once the pick is up.
  await vscode.window.locator(".quick-input-title").filter({ hasText: `Status for ${basename(hereDir)}` }).waitFor();
  await input.fill("Come back later");
  await input.press("Enter");
  await row(`${basename(hereDir)} · Come back later`).waitFor({ timeout: 5_000 });
  const labels = (await vscode.window.locator(`${treeRow} .label-name`).allInnerTexts()).map((text) => text.trim());
  // A-Z: "session-inbox-here-…" before "session-inbox-parked-…".
  assert.deepEqual(labels.slice(-3), ["Closed (2)", `${basename(hereDir)} · Come back later`, `${basename(parkedDir)} · On hold`]);
});

void test("a closed project's row has its folder and status in the hover; a click opens its folder", async () => {
  const parked = row(`${basename(parkedDir)} · On hold`);
  await parked.hover();
  const hover = vscode.window.locator(".monaco-hover:visible").first();
  await hover.waitFor({ state: "visible", timeout: 5_000 });
  const text = await hover.innerText();
  for (const part of [parkedDir, "On hold"]) assert.ok(text.includes(part), `${part} in ${JSON.stringify(text)}`);
  await vscode.window.mouse.move(0, 0);
  await parked.click();
  await waitForTitles(
    (now) => now.length === 3 && now.some((title) => title.includes(basename(parkedDir))),
    "expected a third window for the closed project's folder",
  );
});
