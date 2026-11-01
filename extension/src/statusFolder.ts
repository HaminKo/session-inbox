// Reads and watches the status folder that hooks/session-status.ps1 writes
// (~/.claude/session-status/<session_id>.json, one file per session; format in
// docs/research/hooks.md). No `vscode` import, so the unit tests run in plain Node.
import { statSync, watch, type FSWatcher } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type SessionState = "waiting" | "done" | "working";

export interface SessionStatus {
  session_id: string;
  cwd?: string;
  folder?: string;
  worktree?: boolean;
  worktree_name?: string;
  state: SessionState;
  message?: string;
  tool_name?: string | null;
  timestamp?: string;
}

export type Counts = Record<SessionState, number>;

const states: readonly string[] = ["waiting", "done", "working"];

// SESSION_INBOX_STATUS_DIR is for the tests only: it points the extension at a temp folder.
export function statusDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.SESSION_INBOX_STATUS_DIR || join(homedir(), ".claude", "session-status");
}

// Every readable status file in `dir`. A missing folder means no sessions yet. Files that can't be
// read or parsed (deleted mid-read, not a status file) are skipped; the next change re-reads them.
export async function readStatuses(dir: string): Promise<SessionStatus[]> {
  return ((await readJsonFiles(dir)) ?? []).filter(isStatus);
}

// SESSION_INBOX_SESSIONS_DIR is for the tests only, like SESSION_INBOX_STATUS_DIR.
export function sessionsDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.SESSION_INBOX_SESSIONS_DIR || join(homedir(), ".claude", "sessions");
}

// Claude Code keeps ~/.claude/sessions/<pid>.json ({ pid, sessionId, ... }) for each running chat
// process; undocumented, see docs/research/hooks.md. Returns the ids of sessions whose process is
// still running, or undefined when that can't be told, so that nothing gets hidden: folder missing
// or empty (a changed format might leave it so), or any file unreadable (mid-write) or not in the
// expected format. A reused PID keeps a gone chat counted, never hides a live one.
export async function readLiveSessionIds(dir: string): Promise<Set<string> | undefined> {
  const files = await readJsonFiles(dir);
  if (!files || files.length === 0 || !files.every(isSession)) return undefined;
  return new Set(files.filter((session) => isRunning(session.pid)).map((session) => session.sessionId));
}

function isSession(data: unknown): data is { pid: number; sessionId: string } {
  if (typeof data !== "object" || data === null) return false;
  const { pid, sessionId } = data as Record<string, unknown>;
  return Number.isInteger(pid) && (pid as number) > 0 && typeof sessionId === "string";
}

// The parsed contents of every *.json in `dir` (undefined for a file that can't be read or parsed),
// or undefined if the folder can't be read.
async function readJsonFiles(dir: string): Promise<unknown[] | undefined> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return undefined;
  }
  const read = names
    .filter((name) => name.endsWith(".json"))
    .map(async (name): Promise<unknown> => {
      try {
        return JSON.parse(await readFile(join(dir, name), "utf8"));
      } catch {
        return undefined;
      }
    });
  return Promise.all(read);
}

// Signal 0 only checks that the process exists. EPERM: it exists but belongs to someone else.
function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

// Drops status files whose chat is gone (closed without SessionEnd). `live` undefined: keep all.
export function onlyLive(statuses: readonly SessionStatus[], live: Set<string> | undefined): SessionStatus[] {
  return live ? statuses.filter((status) => live.has(status.session_id)) : [...statuses];
}

function isStatus(data: unknown): data is SessionStatus {
  if (typeof data !== "object" || data === null) return false;
  const { session_id, state } = data as Record<string, unknown>;
  return typeof session_id === "string" && typeof state === "string" && states.includes(state);
}

export function countStates(statuses: readonly SessionStatus[]): Counts {
  const counts: Counts = { waiting: 0, done: 0, working: 0 };
  for (const status of statuses) counts[status.state]++;
  return counts;
}

// The inbox counts waiting + done (docs/decisions.md): both are sessions where it's your turn.
export function summarize(counts: Counts): { needsYou: number; text: string; tooltip: string } {
  const needsYou = counts.waiting + counts.done;
  const text = needsYou > 0 ? `$(warning) ${needsYou} waiting` : "$(check) all clear";
  const headline =
    needsYou === 1 ? "1 session needs you" : needsYou > 1 ? `${needsYou} sessions need you` : "No session needs you";
  const tooltip = [
    `Session Inbox: ${headline}`,
    `Waiting (permission or question): ${counts.waiting}`,
    `Done (your turn): ${counts.done}`,
    `Working: ${counts.working}`,
  ].join("\n");
  return { needsYou, text, tooltip };
}

// Calls `onChange` shortly after the folder's contents change. While the folder doesn't exist (no
// hook has run yet, or it was deleted), checks every `retryMs` until it appears, then calls
// `onChange` once.
export function watchFolder(
  dir: string,
  onChange: () => void,
  { debounceMs = 100, retryMs = 5_000 } = {},
): { dispose: () => void } {
  let watcher: FSWatcher | undefined;
  let watchedIno: number | undefined;
  let pending: NodeJS.Timeout | undefined;
  let retry: NodeJS.Timeout | undefined;
  let disposed = false;

  // Windows sends several events for one write. Wait `debounceMs` after the first event, without
  // restarting the wait on later ones (a steady stream of events must not hold it off forever).
  // Nothing is lost: the read happens after the wait, and an event after it starts a new wait.
  const changed = () => {
    if (!disposed && !pending) pending = setTimeout(check, debounceMs);
  };
  function check(): void {
    pending = undefined;
    if (disposed) return;
    // A deleted folder (even if re-created since) leaves the watcher on a dead handle: start over.
    if (watcher && inode(dir) !== watchedIno) reconnect();
    onChange();
  }
  function reconnect(): void {
    watcher?.close();
    watcher = undefined;
    clearTimeout(retry);
    start();
  }
  function start(): void {
    if (disposed) return;
    const ino = inode(dir);
    if (ino !== undefined) {
      try {
        const current = watch(dir, changed);
        // Only the current watcher may reconnect: a late error from a replaced one is ignored.
        current.on("error", () => {
          if (current !== watcher) return;
          reconnect();
          changed();
        });
        watcher = current;
        watchedIno = ino;
        return;
      } catch {
        // Gone again between the check and the watch: retry below.
      }
    }
    retry = setTimeout(() => {
      start();
      if (watcher) changed();
    }, retryMs);
  }
  start();

  return {
    dispose: () => {
      disposed = true;
      clearTimeout(pending);
      clearTimeout(retry);
      watcher?.close();
    },
  };
}

function inode(dir: string): number | undefined {
  return statSync(dir, { throwIfNoEntry: false })?.ino;
}
