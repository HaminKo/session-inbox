// GUI test for the sidebar: the Activity Bar badge, the groups and the row text. Same setup as
// statusbar.gui.ts: temp status and sessions folders, never the real ones.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
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

void test("a running chat with no status file is listed under Open, collapsed and not counted", async () => {
  writeSampleSession(sessionsDir, "o", { vscode: true });
  const before = [
    "Waiting (1)",
    "demo-a | worktree · 12 min · Needs permission to use Bash",
    "Done (2)",
    "demo-d | 1 h 20 min · Finished",
    "demo-b | <1 min · Finished",
    "Working (1)",
    "demo-c",
  ];
  await waitFor(rows, [...before, "Open (1)"], "rows");
  assert.equal(await badge(), "3");
  await vscode.window.locator(treeRow, { hasText: "Open (1)" }).click();
  await waitFor(rows, [...before, "Open (1)", "demo-o"], "rows");
  const icon = vscode.window.locator(`${treeRow} .custom-view-tree-node-item-icon`).last();
  assert.match((await icon.getAttribute("class")) ?? "", /codicon-circle-outline\b/);
  // Gone again, so the grouping test below sees the same rows as before.
  unlinkSync(join(sessionsDir, "o.json"));
  await waitFor(rows, before, "rows");
});

void test("a reply that ended with a background task running is listed under Working and not counted", async () => {
  writeSampleSession(sessionsDir, "g");
  writeSampleStatus(statusDir, "g", "done", { background: 1 });
  const done = [
    "Waiting (1)",
    "demo-a | worktree · 12 min · Needs permission to use Bash",
    "Done (2)",
    "demo-d | 1 h 20 min · Finished",
    "demo-b | <1 min · Finished",
  ];
  await waitFor(rows, [...done, "Working (2)", "demo-c", "demo-g | background task · Finished"], "rows");
  assert.equal(await badge(), "3");
  // The task ended and Claude's next reply had none running: an ordinary done, counted.
  writeSampleStatus(statusDir, "g", "done");
  await waitFor(rows, [...done.slice(0, 2), "Done (3)", ...done.slice(3), "demo-g | <1 min · Finished", "Working (1)", "demo-c"], "rows");
  await waitFor(badge, "4", "badge");
  // Gone again, so the grouping test below sees the same rows as before.
  unlinkSync(join(statusDir, "g.json"));
  unlinkSync(join(sessionsDir, "g.json"));
  await waitFor(rows, [...done, "Working (1)", "demo-c"], "rows");
});

const projectHeader = `${treeRow}:has(.monaco-tl-twistie.collapsible)`;

// Each project header's icon as "name rgb(...)", top to bottom.
async function headerIcons(): Promise<string[]> {
  const result: string[] = [];
  for (const row of await vscode.window.locator(projectHeader).all()) {
    const icon = row.locator(".custom-view-tree-node-item-icon");
    const name = /codicon-([a-z0-9-]+)/.exec((await icon.getAttribute("class")) ?? "")?.[1] ?? "?";
    // VS Code writes the resolved colour (`color: rgb(...)`); the theme key's name isn't in the page.
    const color = /color: (rgb\([^)]*\))/.exec((await icon.getAttribute("style")) ?? "")?.[1] ?? "none";
    result.push(`${name} ${color}`);
  }
  return result;
}

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
  // demo-a has a waiting session, demo-b and demo-d are done, demo-c is working.
  const icons = await headerIcons();
  const [waiting, done, working, done2] = icons;
  assert.match(waiting, /^folder rgb/);
  assert.equal(done, done2);
  assert.equal(new Set([waiting, done, working]).size, 3, `three different colours: ${icons.join(", ")}`);
  await groupButton("Group by state").click();
  await waitFor(rows, byState, "rows by state again");
  await groupButton("Group by project").waitFor({ state: "visible", timeout: 2_000 });
});

void test("right-click on a project header sets its icon, which keeps the state colour", async () => {
  await groupButton("Group by project").click();
  await waitFor(async () => (await headerIcons()).length, 4, "project headers");
  // demo-b and demo-d are both done: same folder, same colour.
  const [, before, , other] = await headerIcons();
  assert.equal(before, other);
  const header = vscode.window.locator(projectHeader).filter({ hasText: "demo-b" });
  // VS Code's own (HTML) context menu, as on Windows by default.
  const menuItem = (title: string) => vscode.window.locator(`.context-view .action-label[aria-label="${title}"]`);
  await header.click({ button: "right" });
  await menuItem("Set Icon…").click();
  const input = vscode.window.locator(".quick-input-widget input");
  await input.fill("rocket");
  await input.press("Enter");
  // Written to the user setting; its change event redraws the header in the same state colour.
  await waitFor(async () => (await headerIcons())[1], before.replace(/^folder/, "rocket"), "demo-b's icon");
  assert.equal((await headerIcons())[3], other);
  await header.click({ button: "right" });
  await menuItem("Reset Icon").click();
  await waitFor(async () => (await headerIcons())[1], before, "demo-b's icon after reset");
  await groupButton("Group by state").click();
});

void test("grouped by project, a project's docs/todo.md gives a Now row that follows the file", async () => {
  const projectDir = mkdtempSync(join(tmpdir(), "session-inbox-project-"));
  // The setting is read live; put back what earlier tests left in it afterwards.
  const settings = JSON.parse(readFileSync(vscode.settingsFile, "utf8")) as Record<string, unknown>;
  const focusFile = join(projectDir, "docs", "todo.md");
  const writeFocus = (now: string) =>
    writeFileSync(focusFile, `# To do

## Where we are
- Now: ${now}
- Next: 7
- Updated: 2026-01-01

## To do
`);
  try {
    mkdirSync(join(focusFile, ".."));
    writeFocus("Step B (the parser)");
    // No setting: docs/todo.md is every project's focus file by default.
    writeSampleSession(sessionsDir, "f");
    writeSampleStatus(statusDir, "f", "done", { projectDir });
    await groupButton("Group by project").click();
    const lastRows = async () => (await rows()).slice(-3);
    await waitFor(lastRows, ["demo-f | 1 done", "Step B (the parser)", "Done | <1 min · Finished"], "demo-f's rows");
    // The row has the target icon; its hover is checked by hand (docs/todo/18-project-focus.md).
    const focusRow = vscode.window.locator(treeRow).filter({ hasText: "Step B (the parser)" });
    assert.equal(await focusRow.locator(".codicon-target").count(), 1);
    // Re-read with the next update; a hook event (here: the status file rewritten) brings one.
    writeFocus("Step C (the row)");
    writeSampleStatus(statusDir, "f", "done", { projectDir });
    await waitFor(lastRows, ["demo-f | 1 done", "Step C (the row)", "Done | <1 min · Finished"], "demo-f's new focus");
    // `"focus": false` turns the row off (the setting is re-read live).
    const focusOff = { "sessionInbox.projects": { "DEMO-F": { focus: false } } };
    writeFileSync(vscode.settingsFile, JSON.stringify({ ...settings, ...focusOff }));
    await waitFor(async () => (await rows()).slice(-2), ["demo-f | 1 done", "Done | <1 min · Finished"], "demo-f without focus");
    await groupButton("Group by state").click();
    await waitFor(async () => (await rows())[0], "Waiting (1)", "first row by state");
    assert.ok(!(await rows()).some((row) => row.startsWith("Step C")), "no focus row by state");
  } finally {
    writeFileSync(vscode.settingsFile, JSON.stringify(settings));
    rmSync(join(statusDir, "f.json"), { force: true });
    rmSync(join(sessionsDir, "f.json"), { force: true });
    rmSync(projectDir, { recursive: true, force: true });
  }
});

void test("with no sessions left it shows the welcome text and no badge", async () => {
  for (const id of ["a", "b", "c", "d", "e"]) unlinkSync(join(statusDir, `${id}.json`));
  await waitFor(rows, [], "rows");
  await waitFor(badge, "", "badge");
  const welcome = vscode.window.locator(`${sideBar} .welcome-view-content`);
  assert.equal((await welcome.innerText()).trim(), "No Claude Code sessions running.");
});
