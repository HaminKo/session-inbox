// Install Hooks: copies the status hook (bundled into dist/ at build time from the repo's
// hooks/session-status.ps1) into ~/.claude/hooks/ and adds it to the 5 events in
// ~/.claude/settings.json, leaving every other hook and setting as it is. Also the check behind the
// startup warning. No `vscode` import, so the unit tests run in plain Node.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const hookEvents = ["PermissionRequest", "Stop", "UserPromptSubmit", "PostToolUse", "SessionEnd"] as const;

const hookName = "session-status.ps1";

// The entry the README gives. No `async`: the hook has to run in order (docs/decisions.md).
export const hookEntry = {
  type: "command",
  command: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$USERPROFILE/.claude/hooks/${hookName}"`,
  timeout: 10,
};

// SESSION_INBOX_CLAUDE_DIR is for the tests only: a temp stand-in for ~/.claude/.
export function claudeDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.SESSION_INBOX_CLAUDE_DIR || join(homedir(), ".claude");
}

export interface HookCheck {
  file: "ok" | "missing" | "differs";
  // Events with no hook running session-status.ps1; empty when settings.json can't be read.
  missingEvents: string[];
}

type Settings = Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Missing or empty file → {}. Throws, with the reason, for anything this can't safely rewrite.
function readSettings(path: string): Settings {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  if (text.trim() === "") return {};
  let settings: unknown;
  try {
    settings = JSON.parse(text);
  } catch (error) {
    throw new Error(`${path} isn't valid JSON (${error instanceof Error ? error.message : String(error)}); it was left as it is.`, {
      cause: error,
    });
  }
  if (!isObject(settings)) throw new Error(`${path} doesn't hold a JSON object; it was left as it is.`);
  if (settings.hooks !== undefined) {
    if (!isObject(settings.hooks)) throw new Error(`"hooks" in ${path} isn't an object; it was left as it is.`);
    for (const event of hookEvents) {
      const groups = settings.hooks[event];
      if (groups !== undefined && !Array.isArray(groups)) {
        throw new Error(`"hooks.${event}" in ${path} isn't a list; it was left as it is.`);
      }
    }
  }
  return settings;
}

// Any hook command naming session-status.ps1 counts, whatever its path or options.
function hasStatusHook(groups: unknown): boolean {
  return (
    Array.isArray(groups) &&
    groups.some(
      (group) =>
        isObject(group) &&
        Array.isArray(group.hooks) &&
        group.hooks.some((hook) => isObject(hook) && typeof hook.command === "string" && hook.command.includes(hookName)),
    )
  );
}

function missingEvents(settings: Settings): string[] {
  const hooks = isObject(settings.hooks) ? settings.hooks : {};
  return hookEvents.filter((event) => !hasStatusHook(hooks[event]));
}

// Line endings don't count: a checkout with core.autocrlf gives the same script with CRLF.
function hookText(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function hookFileState(source: string, target: string): HookCheck["file"] {
  if (!existsSync(target)) return "missing";
  return hookText(source) === hookText(target) ? "ok" : "differs";
}

// `source` is the bundled hook. An unreadable settings.json reports no missing events: Claude
// Code shows its own error for that, and installing would refuse anyway.
export function checkHooks(source: string, dir = claudeDir()): HookCheck {
  const file = hookFileState(source, join(dir, "hooks", hookName));
  let missing: string[] = [];
  try {
    missing = missingEvents(readSettings(join(dir, "settings.json")));
  } catch {
    // Left empty, see above.
  }
  return { file, missingEvents: missing };
}

// The warning's text, or undefined when everything is installed.
export function describeProblem(check: HookCheck): string | undefined {
  const problems: string[] = [];
  if (check.file === "missing") problems.push("the status hook isn't in ~/.claude/hooks/");
  if (check.file === "differs") problems.push("the status hook in ~/.claude/hooks/ differs from this extension's version");
  if (check.missingEvents.length > 0) {
    problems.push(`~/.claude/settings.json doesn't run it for ${check.missingEvents.join(", ")}`);
  }
  if (problems.length === 0) return undefined;
  return `Session Inbox: ${problems.join("; ")}.`;
}

// Identifies the bundled hook's version, so "Don't ask again" holds only until it changes.
export function hookVersion(source: string): string {
  return createHash("sha256").update(hookText(source)).digest("hex");
}

export interface InstallResult {
  copied: boolean;
  addedEvents: string[];
  // Where the replaced hook / the original settings.json were saved, if this run saved them.
  hookBackup?: string;
  settingsBackup?: string;
}

// Local time, e.g. 2026-11-02T140500; a second backup in the same second gets "-2", and so on.
function backupPath(folder: string, name: string, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const base = join(folder, `${name}.before-install-${stamp}`);
  let path = base;
  for (let n = 2; existsSync(path); n++) path = `${base}-${n}`;
  return path;
}

// Reads and writes settings.json first, so an unreadable or locked one stops the install before
// the hook file is touched.
// A hook file that differs is backed up before it is replaced; settings.json is backed up once,
// before its first change, and that backup is never overwritten.
export function installHooks(source: string, dir = claudeDir(), now = new Date()): InstallResult {
  const settingsPath = join(dir, "settings.json");
  const settings = readSettings(settingsPath);
  const result: InstallResult = { copied: false, addedEvents: missingEvents(settings) };

  if (result.addedEvents.length > 0) {
    if (existsSync(settingsPath)) {
      const backup = `${settingsPath}.before-session-inbox`;
      if (!existsSync(backup)) {
        copyFileSync(settingsPath, backup);
        result.settingsBackup = backup;
      }
    }
    const hooks = isObject(settings.hooks) ? settings.hooks : {};
    for (const event of result.addedEvents) {
      const groups = Array.isArray(hooks[event]) ? (hooks[event] as unknown[]) : [];
      hooks[event] = [...groups, { hooks: [{ ...hookEntry }] }];
    }
    settings.hooks = hooks;
    // Written next to it and renamed over it, so Claude Code never reads a half-written file. A
    // symlinked settings.json (dotfiles) is written through the link, not replaced by a plain file.
    mkdirSync(dir, { recursive: true });
    const real = existsSync(settingsPath) ? realpathSync(settingsPath) : settingsPath;
    const temp = `${real}.session-inbox-tmp`;
    try {
      writeFileSync(temp, `${JSON.stringify(settings, null, 2)}\n`);
      renameSync(temp, real);
    } finally {
      rmSync(temp, { force: true });
    }
  }

  const hooksDir = join(dir, "hooks");
  const target = join(hooksDir, hookName);
  const file = hookFileState(source, target);
  if (file !== "ok") {
    mkdirSync(hooksDir, { recursive: true });
    if (file === "differs") {
      const backups = join(hooksDir, "backups");
      mkdirSync(backups, { recursive: true });
      result.hookBackup = backupPath(backups, hookName, now);
      copyFileSync(target, result.hookBackup);
    }
    copyFileSync(source, target);
    result.copied = true;
  }
  return result;
}
