// GUI test for a reminder with no notify.ps1 (SESSION_INBOX_NOTIFY_SCRIPT points at a file that
// isn't there yet): the window says so, the reminders aren't spent and go out once a script turns
// up, and the warning's button turns reminders off in the user settings. SESSION_INBOX_IGNORE_FOCUS
// as in renotify.gui.ts.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { launchVsCode, type VsCode } from "./launch.ts";
import { writeSampleSession, writeSampleStatus } from "./samples.ts";
import { statusItem } from "./selectors.ts";

let vscode: VsCode;
const temps: string[] = [];
let statusDir: string;
let script: string;
let callsDir: string;

function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

const minute = 60_000;

before(async () => {
  const hereDir = temp("session-inbox-here-");
  statusDir = temp("session-inbox-status-");
  const sessionsDir = temp("session-inbox-sessions-");
  // Two chats past the threshold: two failed reminders.
  writeSampleStatus(statusDir, "here-a", "waiting", { projectDir: hereDir, waitedMs: 20 * minute });
  writeSampleStatus(statusDir, "here-b", "waiting", { projectDir: hereDir, waitedMs: 30 * minute });
  for (const id of ["here-a", "here-b"]) writeSampleSession(sessionsDir, id);
  const fakeDir = temp("session-inbox-fake-notify-");
  script = join(fakeDir, "notify.ps1");
  callsDir = join(fakeDir, "calls");
  mkdirSync(callsDir);
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

const toast = ".notifications-toasts .notification-toast";

async function waitFor(check: () => boolean, ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await vscode.window.waitForTimeout(200);
}

// One file per call: the two reminders run at the same time, and one shared log was locked (EBUSY).
function sessionIds(): string[] {
  return readdirSync(callsDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const text = readFileSync(join(callsDir, name), "utf8").replace(/^\uFEFF/, "");
      return (JSON.parse(text) as { session_id: string }).session_id;
    })
    .sort();
}

function renotifyMinutes(): unknown {
  try {
    const settings = JSON.parse(readFileSync(vscode.settingsFile, "utf8")) as Record<string, unknown>;
    return settings["sessionInbox.renotifyMinutes"];
  } catch {
    return undefined; // Caught mid-write: asked again.
  }
}

void test("a missing notify.ps1 is said, reminders wait for it, and the button turns them off", async () => {
  const warning = vscode.window.locator(toast).filter({ hasText: "reminder not sent" });
  await warning.waitFor({ state: "visible", timeout: 15_000 });
  // VS Code folds identical messages into one toast, so this count doesn't prove "said once"; the
  // toldMissing flag in extension.ts does that.
  assert.equal(await warning.count(), 1);
  assert.match((await warning.textContent()) ?? "", /notify\.ps1 not found/);

  // The script turns up; a status change makes the next read come now instead of in 30 s.
  writeFileSync(
    script,
    "[Console]::InputEncoding = [System.Text.Encoding]::UTF8\n" +
      `$file = Join-Path '${callsDir}' ([guid]::NewGuid())\n` +
      'Set-Content -LiteralPath "$file.tmp" -Encoding UTF8 -Value ([Console]::In.ReadToEnd())\n' +
      'Rename-Item -LiteralPath "$file.tmp" -NewName "$(Split-Path -Leaf $file).json"\n',
  );
  writeSampleStatus(statusDir, "elsewhere", "working");
  await waitFor(() => sessionIds().length >= 2, 15_000);
  assert.deepEqual(sessionIds(), ["here-a", "here-b"]);

  await warning.getByRole("button", { name: "Turn Off Reminders" }).click();
  await waitFor(() => renotifyMinutes() === 0, 10_000);
  assert.equal(renotifyMinutes(), 0);
});
