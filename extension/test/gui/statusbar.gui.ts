// GUI test: drives a real VS Code window with the extension loaded and checks what it shows.
// Run with `npm run test:gui` (builds dist/ first).
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { launchVsCode, type VsCode } from "./launch.ts";
import { statusItem } from "./selectors.ts";

let vscode: VsCode;

before(async () => {
  vscode = await launchVsCode();
  // Activation is onStartupFinished, a few seconds after the window appears.
  await vscode.window.locator(statusItem).waitFor({ state: "visible", timeout: 20_000 });
});

after(async () => {
  await vscode?.close();
});

void test("status bar shows the Session Inbox item", async () => {
  const item = vscode.window.locator(statusItem);
  const label = (await item.innerText()).trim();
  assert.equal(label, "Session Inbox", `status bar item text was "${label}"`);
  const icon = item.locator(".codicon-inbox");
  assert.equal(await icon.count(), 1, "status bar item has no $(inbox) icon");
});

void test("hovering the item shows its tooltip", async () => {
  await vscode.window.locator(statusItem).hover();
  const hover = vscode.window.locator(".monaco-hover:visible").first();
  await hover.waitFor({ state: "visible", timeout: 5_000 });
  const text = (await hover.innerText()).trim();
  assert.equal(text, "Session Inbox (placeholder)", `tooltip was "${text}"`);
});
