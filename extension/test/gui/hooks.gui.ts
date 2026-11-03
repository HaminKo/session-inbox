// GUI test for Install Hooks: with an empty stand-in ~/.claude/ (SESSION_INBOX_CLAUDE_DIR) the window
// warns at startup, and the warning's button installs the hook and its settings.json entries there.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { hookEvents } from "../../src/installHooks.ts";
import { launchVsCode, type VsCode } from "./launch.ts";
import { statusItem } from "./selectors.ts";

let vscode: VsCode;
const temps: string[] = [];
let claudeDir: string;

function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

before(async () => {
  claudeDir = temp("session-inbox-claude-");
  vscode = await launchVsCode({
    SESSION_INBOX_STATUS_DIR: temp("session-inbox-status-"),
    SESSION_INBOX_SESSIONS_DIR: temp("session-inbox-sessions-"),
    SESSION_INBOX_CLAUDE_DIR: claudeDir,
  });
  await vscode.window.locator(statusItem).waitFor({ state: "visible", timeout: 20_000 });
});

after(async () => {
  await vscode?.close();
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

const toast = ".notifications-toasts .notification-toast";

void test("missing hooks show one warning, and its button installs them", async () => {
  const warning = vscode.window.locator(toast).filter({ hasText: "the status hook isn't in ~/.claude/hooks/" });
  await warning.waitFor({ state: "visible", timeout: 10_000 });
  assert.equal(await warning.count(), 1);
  await warning.getByRole("button", { name: "Install Hooks" }).click();
  await vscode.window
    .locator(toast)
    .filter({ hasText: "copied the status hook" })
    .waitFor({ state: "visible", timeout: 10_000 });
  assert.ok(existsSync(join(claudeDir, "hooks", "session-status.ps1")));
  const settings = JSON.parse(readFileSync(join(claudeDir, "settings.json"), "utf8")) as { hooks: Record<string, unknown> };
  assert.deepEqual(Object.keys(settings.hooks), [...hookEvents]);
});
