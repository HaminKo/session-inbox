// GUI test for the sidebar: the Activity Bar badge, the groups and the row text. Same setup as
// statusbar.gui.ts: temp status and sessions folders, never the real ones.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { launchVsCode, type VsCode } from "./launch.ts";
import { writeSampleSession, writeSampleStatus } from "./samples.ts";
import { activityItem, sideBar, statusItem, treeRow } from "./selectors.ts";

let vscode: VsCode;
let statusDir: string;
let sessionsDir: string;

before(async () => {
  statusDir = mkdtempSync(join(tmpdir(), "session-inbox-status-"));
  writeSampleStatus(statusDir, "a", "waiting", { waitedMs: 12 * 60_000, worktree: true });
  writeSampleStatus(statusDir, "b", "done");
  writeSampleStatus(statusDir, "c", "working");
  sessionsDir = mkdtempSync(join(tmpdir(), "session-inbox-sessions-"));
  for (const id of ["a", "b", "c", "d", "e"]) writeSampleSession(sessionsDir, id);
  vscode = await launchVsCode({ SESSION_INBOX_STATUS_DIR: statusDir, SESSION_INBOX_SESSIONS_DIR: sessionsDir });
  await vscode.window.locator(statusItem).waitFor({ state: "visible", timeout: 20_000 });
});

after(async () => {
  await vscode?.close();
  rmSync(statusDir, { recursive: true, force: true });
  rmSync(sessionsDir, { recursive: true, force: true });
});

// Each tree row as "label | description" ("label" alone for a group header or an empty description).
async function rows(): Promise<string[]> {
  const result: string[] = [];
  for (const row of await vscode.window.locator(treeRow).all()) {
    const name = (await row.locator(".label-name").innerText({ timeout: 500 })).trim();
    const description = row.locator(".label-description");
    const text = (await description.count()) > 0 ? (await description.innerText({ timeout: 500 })).trim() : "";
    result.push(text ? `${name} | ${text}` : name);
  }
  return result;
}

// Updates arrive after a file event plus a short debounce; poll until `read` gives `expected`.
async function waitFor<T>(read: () => Promise<T>, expected: T, what: string): Promise<void> {
  const end = Date.now() + 5_000;
  for (;;) {
    // A read can fail when the tree re-renders under it; that counts as "not yet".
    let actual = "(read failed)";
    try {
      const value = await read();
      actual = JSON.stringify(value);
      assert.deepEqual(value, expected);
      return;
    } catch {
      if (Date.now() > end) assert.fail(`${what} was ${actual}, expected ${JSON.stringify(expected)}`);
    }
    await vscode.window.waitForTimeout(100);
  }
}

async function badge(): Promise<string> {
  const content = vscode.window.locator(`${activityItem} .badge-content`);
  return (await content.isVisible()) ? (await content.innerText({ timeout: 500 })).trim() : "";
}

void test("the Activity Bar icon has a badge with the waiting + done count", async () => {
  await waitFor(badge, "2", "badge");
  const label = await vscode.window.locator(activityItem).getAttribute("aria-label");
  assert.equal(label, "Session Inbox - 2 sessions need you");
});

void test("the view lists waiting, done, working, with folder, worktree, age and message", async () => {
  // The badge covers the icon's link, so click the whole entry.
  await vscode.window.locator(activityItem).click();
  await waitFor(
    rows,
    [
      "Waiting (1)",
      "demo-a | worktree · 12 min · Needs permission to use Bash",
      "Done (1)",
      "demo-b | <1 min · Finished",
      "Working (1)",
      "demo-c",
    ],
    "rows",
  );
  const icons: (string | undefined)[] = [];
  for (const icon of await vscode.window.locator(`${treeRow} .custom-view-tree-node-item-icon`).all()) {
    icons.push(/codicon-(warning|check|loading)\b/.exec((await icon.getAttribute("class")) ?? "")?.[1]);
  }
  assert.deepEqual(icons, ["warning", "check", "loading"]);
});

void test("a new status file shows up in its group, oldest first, and in the badge", async () => {
  writeSampleStatus(statusDir, "d", "done", { waitedMs: 80 * 60_000 });
  await waitFor(
    rows,
    [
      "Waiting (1)",
      "demo-a | worktree · 12 min · Needs permission to use Bash",
      "Done (2)",
      "demo-d | 1 h 20 min · Finished",
      "demo-b | <1 min · Finished",
      "Working (1)",
      "demo-c",
    ],
    "rows",
  );
  await waitFor(badge, "3", "badge");
});

// The title-bar button; it shows the grouping you'd switch to (by state is the default).
function groupButton(title: string) {
  // VS Code renders it twice (container title and section header), one hidden.
  return vscode.window.locator(`${sideBar} .action-label[aria-label="${title}"]`).filter({ visible: true });
}

void test("the title-bar button switches between grouping by project and by state", async () => {
  // A second session in demo-a's folder, so one project holds two states.
  writeSampleStatus(statusDir, "e", "working", { project: "a" });
  const byState = [
    "Waiting (1)",
    "demo-a | worktree · 12 min · Needs permission to use Bash",
    "Done (2)",
    "demo-d | 1 h 20 min · Finished",
    "demo-b | <1 min · Finished",
    "Working (2)",
    "demo-c",
    "demo-a",
  ];
  await waitFor(rows, byState, "rows by state");
  await groupButton("Group by project").click();
  await waitFor(
    rows,
    [
      "demo-a | 1 waiting · 1 working",
      "Waiting | worktree · 12 min · Needs permission to use Bash",
      "Working",
      "demo-b | 1 done",
      "Done | <1 min · Finished",
      "demo-c | 1 working",
      "Working",
      "demo-d | 1 done",
      "Done | 1 h 20 min · Finished",
    ],
    "rows by project",
  );
  // Headers have a folder icon, the one with a waiting session in the warning colour.
  const headerIcons: string[] = [];
  for (const row of await vscode.window.locator(`${treeRow}:has(.monaco-tl-twistie.collapsible)`).all()) {
    const icon = row.locator(".custom-view-tree-node-item-icon");
    const name = /codicon-(folder)\b/.exec((await icon.getAttribute("class")) ?? "")?.[1] ?? "?";
    // VS Code writes the resolved colour (`color: rgb(...)`); the theme key's name isn't in the page.
    const color = /color: (rgb\([^)]*\))/.exec((await icon.getAttribute("style")) ?? "")?.[1] ?? "none";
    headerIcons.push(`${name} ${color}`);
  }
  // demo-a has a waiting session, demo-b and demo-d are done, demo-c is working.
  const [waiting, done, working, done2] = headerIcons;
  assert.match(waiting, /^folder rgb/);
  assert.equal(done, done2);
  assert.equal(new Set([waiting, done, working]).size, 3, `three different colours: ${headerIcons.join(", ")}`);
  await groupButton("Group by state").click();
  await waitFor(rows, byState, "rows by state again");
  await groupButton("Group by project").waitFor({ state: "visible", timeout: 2_000 });
});

void test("with no sessions left it shows the welcome text and no badge", async () => {
  for (const id of ["a", "b", "c", "d", "e"]) unlinkSync(join(statusDir, `${id}.json`));
  await waitFor(rows, [], "rows");
  await waitFor(badge, "", "badge");
  const welcome = vscode.window.locator(`${sideBar} .welcome-view-content`);
  assert.equal((await welcome.innerText()).trim(), "No Claude Code sessions running.");
});
