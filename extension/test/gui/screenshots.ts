// Screenshots of the extension's UI in a real VS Code window, for Claude to read.
// `npm run screenshots` takes all; `npm run screenshots -- statusbar` takes one by name.
// Files go to the OS temp folder (never the repo); their paths are printed. The extension reads
// sample status files (1 waiting, 1 done, 1 working), never the real ~/.claude/session-status/.
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "playwright-core";
import { launchVsCode } from "./launch.ts";
import { writeSampleSession, writeSampleStatus } from "./samples.ts";
import { activityItem, problemsItem, sideBar, statusBar, statusItem, treeRow } from "./selectors.ts";

const shots: Record<string, (window: Page, path: string) => Promise<void>> = {
  // The right half of the status bar is empty here; crop to the left part with our item.
  // VS Code's problems counter, right of our item, is drawn a moment later: wait for it so every
  // re-take has it.
  statusbar: async (window, path) => {
    await window.locator(problemsItem).waitFor({ state: "visible", timeout: 10_000 });
    const bar = await window.locator(statusBar).boundingBox();
    const item = await window.locator(statusItem).boundingBox();
    if (!bar || !item) throw new Error("status bar or item not found");
    const width = Math.min(bar.width, item.x + item.width + 150 - bar.x);
    await window.screenshot({ path, clip: { x: bar.x, y: bar.y, width, height: bar.height } });
  },
  // The Activity Bar icon with its badge and the open Session Inbox view, top part only.
  // VS Code's default sidebar width cuts off the waiting row's message, so its right edge is
  // dragged wider first (each launch has a fresh profile, so the width doesn't stick).
  sidebar: async (window, path) => {
    await window.locator(activityItem).click();
    await window.locator(treeRow).nth(5).waitFor({ state: "visible", timeout: 5_000 });
    const narrow = await window.locator(sideBar).boundingBox();
    if (!narrow) throw new Error("sidebar not found");
    const edge = { x: narrow.x + narrow.width, y: narrow.y + narrow.height / 2 };
    await window.mouse.move(edge.x, edge.y);
    await window.mouse.down();
    await window.mouse.move(edge.x + 150, edge.y, { steps: 5 });
    await window.mouse.up();
    const bar = await window.locator(activityItem).boundingBox();
    const side = await window.locator(sideBar).boundingBox();
    if (!bar || !side) throw new Error("activity bar item or sidebar not found");
    if (side.width < narrow.width + 100) throw new Error(`sidebar did not widen (${narrow.width} → ${side.width} px)`);
    const height = Math.max(bar.y + bar.height, side.y + 200) - side.y;
    // "disabled" stops the working row's spinner at its first frame, so re-takes match.
    await window.screenshot({ path, animations: "disabled", clip: { x: 0, y: side.y, width: side.x + side.width, height } });
  },
  window: async (window, path) => {
    await window.screenshot({ path });
  },
};

const wanted = process.argv.slice(2);
const unknown = wanted.filter((name) => !Object.hasOwn(shots, name));
if (unknown.length > 0) {
  console.error(`Unknown screenshot: ${unknown.join(", ")}. Known: ${Object.keys(shots).join(", ")}`);
  process.exit(1);
}

const outDir = join(tmpdir(), "session-inbox-shots");
mkdirSync(outDir, { recursive: true });
const statusDir = mkdtempSync(join(tmpdir(), "session-inbox-status-"));
writeSampleStatus(statusDir, "a", "waiting", { waitedMs: 12 * 60_000, worktree: true });
writeSampleStatus(statusDir, "b", "done");
writeSampleStatus(statusDir, "c", "working");
const sessionsDir = mkdtempSync(join(tmpdir(), "session-inbox-sessions-"));
for (const id of ["a", "b", "c"]) writeSampleSession(sessionsDir, id);
try {
  const vscode = await launchVsCode({ SESSION_INBOX_STATUS_DIR: statusDir, SESSION_INBOX_SESSIONS_DIR: sessionsDir });
  try {
    await vscode.window.locator(statusItem).waitFor({ state: "visible", timeout: 20_000 });
    for (const name of wanted.length > 0 ? wanted : Object.keys(shots)) {
      const path = join(outDir, `${name}.png`);
      await shots[name](vscode.window, path);
      console.log(path);
    }
  } finally {
    await vscode.close();
  }
} finally {
  rmSync(statusDir, { recursive: true, force: true });
  rmSync(sessionsDir, { recursive: true, force: true });
}
