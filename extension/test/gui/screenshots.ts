// Screenshots of the extension's UI in a real VS Code window, for Claude to read.
// `npm run screenshots` takes all; `npm run screenshots -- statusbar` takes one by name.
// Files go to the OS temp folder (never the repo); their paths are printed.
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "playwright-core";
import { launchVsCode } from "./launch.ts";
import { statusBar, statusItem } from "./selectors.ts";

const shots: Record<string, (window: Page, path: string) => Promise<void>> = {
  // The right half of the status bar is empty here; crop to the left part with our item.
  statusbar: async (window, path) => {
    const bar = await window.locator(statusBar).boundingBox();
    const item = await window.locator(statusItem).boundingBox();
    if (!bar || !item) throw new Error("status bar or item not found");
    const width = Math.min(bar.width, item.x + item.width + 150 - bar.x);
    await window.screenshot({ path, clip: { x: bar.x, y: bar.y, width, height: bar.height } });
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
const vscode = await launchVsCode();
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
