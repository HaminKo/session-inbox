// The tray indicator (tray/session-tray.ps1, copied into dist/ by the build): a system-tray icon with
// the "needs you" count, for when no VS Code window is in front. Started while the setting
// sessionInbox.trayIcon is on. Every window starts it; the script's mutex keeps one copy.
import { spawn, type ChildProcess } from "node:child_process";

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
