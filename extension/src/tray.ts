// The tray indicator (tray/session-tray.ps1, copied into dist/ by the build): a system-tray icon with
// the "needs you" count, for when no VS Code window is in front. Started while the setting
// sessionInbox.trayIcon is on. Every window starts it; the script's mutex keeps one copy.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultIcon, projectIcon, stateIcons, statusProjects } from "./projectLook.ts";

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

// When a second -Stop follows the first. A copy started before it has taken over or left by then:
// PowerShell needs ~0.4 s to get there (measured 2026-11-15), then waits at most 5 s for a stopping copy.
export const secondStopMs = 15_000;

function exited(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    child.once("exit", () => resolve());
    child.once("error", () => resolve()); // never started
  });
}

// Follows the setting sessionInbox.trayIcon in one window, so that quick toggles still end with the
// tray matching the last value (to-do #31, docs/research/tray.md). `changed` runs on each change:
// - On: the tray starts only once every -Stop this window sent has exited, so the new copy finds the
//   stop event set and waits for the stopping copy instead of leaving. Skipped if off by then.
// - Off: -Stop, and once more after `secondStopAfter` if still off. A -Stop that comes while a new
//   copy starts up or waits to take over is lost: that copy resets the stop event when it takes over.
// Every window does the same, so the copies they start settle on one.
export function trayFollower(
  enabled: () => boolean,
  run: { start: () => ChildProcess; stop: () => ChildProcess },
  secondStopAfter = secondStopMs,
) {
  let stopped = Promise.resolve(); // the last -Stop, until it has exited
  let again: NodeJS.Timeout | undefined;
  let disposed = false;
  const stop = () => {
    stopped = exited(run.stop());
  };
  // Also waits for a -Stop sent while waiting (the setting turned off and on again meanwhile).
  async function stopsExited(): Promise<void> {
    let last: Promise<void>;
    do {
      last = stopped;
      await last;
    } while (last !== stopped);
  }
  return {
    // Resolves once the tray has been started, or skipped.
    async changed(): Promise<void> {
      clearTimeout(again);
      if (!enabled()) {
        stop();
        again = setTimeout(() => {
          if (!enabled()) stop();
        }, secondStopAfter);
        return;
      }
      await stopsExited();
      if (enabled() && !disposed) run.start();
    },
    dispose(): void {
      disposed = true;
      clearTimeout(again);
    },
  };
}

// What the tray draws its menu icons with (to-do #17), in <status folder>/.tray-looks: not a .json,
// so neither the extension nor the tray reads it as a status file. The extension works out every
// name and character, so the script only looks them up: `projects` maps a project label (lowercase)
// to its icon name, like projectIcon(); `chars` maps each icon name used to its character in `font`.
// `parked`: the labels (lowercase) of the projects with a hand-set status, whose done chats the tray
// doesn't count (parkedTest, to-do #28); a file written before had none, so nothing is parked.
export const trayLooksFile = ".tray-looks";

export interface TrayLooks {
  font: string;
  default: string;
  states: Record<string, string>;
  projects: Record<string, string>;
  chars: Record<string, string>;
  parked: string[];
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
  const parked = statusProjects(looks).map((project) => project.label.toLowerCase());
  return { font, default: defaultIcon, states: { ...stateIcons }, projects, chars: found, parked };
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
