// GUI test: drives a real VS Code window with the extension loaded and checks what it shows.
// Run with `npm run test:gui` (builds dist/ first). The extension reads a temp status folder with
// sample files (SESSION_INBOX_STATUS_DIR) and a temp sessions folder (SESSION_INBOX_SESSIONS_DIR),
// never the real ~/.claude/session-status/ or ~/.claude/sessions/.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { launchVsCode, type VsCode } from "./launch.ts";
import { writeSampleSession, writeSampleStatus } from "./samples.ts";
import { statusItem } from "./selectors.ts";

let vscode: VsCode;
let statusDir: string;
let sessionsDir: string;

before(async () => {
  statusDir = mkdtempSync(join(tmpdir(), "session-inbox-status-"));
  writeSampleStatus(statusDir, "a", "waiting");
  writeSampleStatus(statusDir, "b", "done");
  writeSampleStatus(statusDir, "c", "working");
  sessionsDir = mkdtempSync(join(tmpdir(), "session-inbox-sessions-"));
  for (const id of ["a", "b", "c", "d"]) writeSampleSession(sessionsDir, id);
  vscode = await launchVsCode({ SESSION_INBOX_STATUS_DIR: statusDir, SESSION_INBOX_SESSIONS_DIR: sessionsDir });
  // Activation is onStartupFinished, a few seconds after the window appears.
  await vscode.window.locator(statusItem).waitFor({ state: "visible", timeout: 20_000 });
});

after(async () => {
  await vscode?.close();
  rmSync(statusDir, { recursive: true, force: true });
  rmSync(sessionsDir, { recursive: true, force: true });
});

async function label(): Promise<string> {
  return (await vscode.window.locator(statusItem).innerText()).trim();
}

// The item updates after a file event plus a short debounce; poll until it shows `expected`.
async function waitForLabel(expected: string): Promise<void> {
  const end = Date.now() + 5_000;
  while ((await label()) !== expected) {
    if (Date.now() > end) assert.fail(`status bar item text was "${await label()}", expected "${expected}"`);
    await vscode.window.waitForTimeout(100);
  }
}

void test("status bar counts waiting + done sessions, highlighted", async () => {
  assert.equal(await label(), "2 waiting");
  const item = vscode.window.locator(statusItem);
  assert.equal(await item.locator(".codicon-warning").count(), 1, "no $(warning) icon");
  assert.match((await item.getAttribute("class")) ?? "", /\bwarning-kind\b/, "no warning background");
});

void test("hovering the item shows the breakdown", async () => {
  await vscode.window.locator(statusItem).hover();
  const hover = vscode.window.locator(".monaco-hover:visible").first();
  await hover.waitFor({ state: "visible", timeout: 5_000 });
  const text = (await hover.innerText()).trim();
  assert.equal(
    text,
    "Session Inbox: 2 sessions need you\nWaiting (permission or question): 1\nDone (your turn): 1\nWorking: 1",
  );
  await vscode.window.mouse.move(0, 0);
});

void test("a new status file updates the count", async () => {
  writeSampleStatus(statusDir, "d", "waiting");
  await waitForLabel("3 waiting");
});

void test("a chat that is gone is not counted, and drops out when its process ends", async () => {
  // "e" has no running chat; "f" does. Once "f" is counted, a refresh has seen "e" too.
  writeSampleStatus(statusDir, "e", "waiting");
  writeSampleSession(sessionsDir, "f");
  writeSampleStatus(statusDir, "f", "waiting");
  await waitForLabel("4 waiting");
  writeSampleSession(sessionsDir, "e");
  await waitForLabel("5 waiting");
  // Claude Code removes <pid>.json when the chat process exits, even if SessionEnd never fired.
  unlinkSync(join(sessionsDir, "e.json"));
  await waitForLabel("4 waiting");
});

void test("with only working sessions left it shows all clear", async () => {
  for (const id of ["a", "b", "d", "e", "f"]) unlinkSync(join(statusDir, `${id}.json`));
  await waitForLabel("all clear");
  const item = vscode.window.locator(statusItem);
  assert.equal(await item.locator(".codicon-check").count(), 1, "no $(check) icon");
  assert.doesNotMatch((await item.getAttribute("class")) ?? "", /\bwarning-kind\b/, "still highlighted");
});
