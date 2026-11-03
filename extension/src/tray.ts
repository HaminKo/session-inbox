// The tray indicator (tray/session-tray.ps1, copied into dist/ by the build): a system-tray icon with
// the "needs you" count, for when no VS Code window is in front. Started while the setting
// sessionInbox.trayIcon is on. Every window starts it; the script's mutex keeps one copy.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultIcon, projectIcon, stateIcons } from "./projectLook.ts";

// Not `detached`: PowerShell then never runs the script (docs/research/hooks.md). The tray still
// outlives the window that started it: it ends with the VS Code process, which it watches itself.
function runTray(script: string, args: readonly string[]): ChildProcess {
  const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, ...args], {
    stdio: "ignore",
    windowsHide: true,
    // Not the extension host's ELECTRON_RUN_AS_NODE.
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  });
  child.on("error", (error) => console.error("Session Inbox: couldn't run the tray script", error));
  child.unref();
  return child;
}

// `vsCodePid`: the tray exits when this process ends. From the extension host that is its parent,
// VS Code's main process (measured 2026-11-03), shared by all of that VS Code's windows.
export function startTray(script: string, vsCodePid: number): ChildProcess {
  return runTray(script, ["-VsCodePid", String(vsCodePid)]);
}

// Closes the running tray, whichever window started it.
export function stopTray(script: string): ChildProcess {
  return runTray(script, ["-Stop"]);
}

// What the tray draws its menu icons with (to-do #17), in <status folder>/.tray-looks: not a .json,
// so neither the extension nor the tray reads it as a status file. The extension works out every
// name and character, so the script only looks them up: `projects` maps a project label (lowercase)
// to its icon name, like projectIcon(); `chars` maps each icon name used to its character in `font`.
export const trayLooksFile = ".tray-looks";

export interface TrayLooks {
  font: string;
  default: string;
  states: Record<string, string>;
  projects: Record<string, string>;
  chars: Record<string, string>;
}

// `looks` is the setting sessionInbox.projects; `chars` the font's codicons (codicons.ts), or
// undefined when the font can't be read: then `chars` is empty and the tray shows text only.
export function trayLooks(font: string, chars: ReadonlyMap<string, string> | undefined, looks: unknown): TrayLooks {
  const projects: Record<string, string> = {};
  if (typeof looks === "object" && looks !== null && !Array.isArray(looks)) {
    // projectIcon() already takes the first spelling of a label; a project on the folder needs no
    // entry, as the tray falls back to `default`.
    for (const key of new Set(Object.keys(looks).map((label) => label.toLowerCase()))) {
      const icon = projectIcon(looks, key);
      if (icon !== defaultIcon) projects[key] = icon;
    }
  }
  const used = new Set([defaultIcon, ...Object.values(stateIcons), ...Object.values(projects)]);
  const found: Record<string, string> = {};
  for (const name of used) {
    const char = chars?.get(name);
    if (char !== undefined) found[name] = char;
  }
  return { font, default: defaultIcon, states: { ...stateIcons }, projects, chars: found };
}

// Written to a temp name and renamed, so the tray never reads half a file. The status folder is made
// if no hook has made it yet. The rename is tried a few times: it fails while the tray is reading
// the file (every 2 s). Never throws: without the file the tray shows text only.
export async function writeTrayLooks(dir: string, looks: TrayLooks): Promise<void> {
  const temp = join(dir, `${trayLooksFile}.${process.pid}.tmp`);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(temp, JSON.stringify(looks), "utf8");
    for (let attempt = 1; ; attempt++) {
      try {
        await rename(temp, join(dir, trayLooksFile));
        return;
      } catch (error) {
        if (attempt >= 5) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  } catch {
    await rm(temp, { force: true }).catch(() => undefined);
  }
}
