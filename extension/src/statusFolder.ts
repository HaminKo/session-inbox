// Reads and watches the status folder that hooks/session-status.ps1 writes
// (~/.claude/session-status/<session_id>.json, one file per session; format in
// docs/research/hooks.md). No `vscode` import, so the unit tests run in plain Node.
import { statSync, watch, type FSWatcher } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// `open`: a running chat with no status file yet (made by `openSessions`, never read from a file).
export type SessionState = "waiting" | "done" | "working" | "open";

export interface SessionStatus {
  session_id: string;
  cwd?: string;
  project_dir?: string;
  folder?: string;
  worktree?: boolean;
  worktree_name?: string;
  state: SessionState;
  message?: string;
  tool_name?: string | null;
  // Background tasks still running when the reply ended (written on `Stop`, 0 otherwise).
  background?: number;
  timestamp?: string;
}

export type Counts = Record<SessionState, number>;

// The states a status file may hold; `open` never comes from a file.
const fileStates: readonly string[] = ["waiting", "done", "working"];

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

// One ~/.claude/sessions/<pid>.json. Only `pid` and `sessionId` are checked; the rest may hold anything.
export interface LiveSession {
  pid: number;
  sessionId: string;
  cwd?: unknown;
  startedAt?: unknown;
  kind?: unknown;
  entrypoint?: unknown;
}

// Claude Code keeps ~/.claude/sessions/<pid>.json for each running chat process; undocumented, see
// docs/research/hooks.md. Returns the sessions whose process is still running, or undefined when
// that can't be told, so that nothing gets hidden: folder missing or empty (a changed format might
// leave it so), or any file unreadable (mid-write) or not in the expected format. A reused PID
// keeps a gone chat counted, never hides a live one.
export async function readLiveSessions(dir: string): Promise<LiveSession[] | undefined> {
  const files = await readJsonFiles(dir);
  if (!files || files.length === 0 || !files.every(isSession)) return undefined;
  return files.filter((session) => isRunning(session.pid));
}

function isSession(data: unknown): data is LiveSession {
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
export function onlyLive(statuses: readonly SessionStatus[], live: readonly LiveSession[] | undefined): SessionStatus[] {
  if (!live) return [...statuses];
  const ids = new Set(live.map((session) => session.sessionId));
  return statuses.filter((status) => ids.has(status.session_id));
}

// A reply that ended with a background task still running isn't your turn yet: Claude reports on the
// task by itself when it ends, and that reply's own `Stop` rewrites the file. Until then such a `done`
// counts as `working`. It is `done` again once the chat's process restarted after the reply (the task
// died with the old one, and no hook fires for that), or `backgroundLimitMs` after the reply (the
// longest wait measured was 38.4 min, docs/research/hooks.md). With no timestamp it stays `done`.
export const backgroundLimitMs = 45 * 60_000;

export function backgroundAsWorking(
  statuses: readonly SessionStatus[],
  live: readonly LiveSession[] | undefined,
  now: number,
): SessionStatus[] {
  return statuses.map((status) => (onBackgroundTask(status, live, now) ? { ...status, state: "working" } : status));
}

function onBackgroundTask(status: SessionStatus, live: readonly LiveSession[] | undefined, now: number): boolean {
  if (status.state !== "done" || !hasBackground(status)) return false;
  const reply = typeof status.timestamp === "string" ? Date.parse(status.timestamp) : NaN;
  if (Number.isNaN(reply) || now - reply >= backgroundLimitMs) return false;
  // Restarted: every running process of this chat started after the reply. A start time that isn't
  // a number can't be told, so it counts as before. No sessions folder: only the time limit.
  const starts = (live ?? [])
    .filter((session) => session.sessionId === status.session_id)
    .map((session) => (typeof session.startedAt === "number" ? session.startedAt : -Infinity));
  return starts.length === 0 || Math.min(...starts) <= reply;
}

export function hasBackground(status: SessionStatus): boolean {
  return typeof status.background === "number" && status.background > 0;
}

// Running VS Code chats with no status file yet (after a VS Code restart, or a new tab before its
// first prompt), as `open` statuses: project from the start folder (`cwd` there doesn't follow the
// shell), time from when the process started. No `folder`: the row label falls back to the last part
// of `cwd`. Only VS Code chats with a tab (`interactive`); CLI chats are left out (docs/todo.md, Later).
export function openSessions(statuses: readonly SessionStatus[], live: readonly LiveSession[] | undefined): SessionStatus[] {
  if (!live) return [];
  const known = new Set(statuses.map((status) => status.session_id));
  return live
    .filter(
      (session) =>
        session.entrypoint === "claude-vscode" && session.kind === "interactive" && !known.has(session.sessionId),
    )
    .map((session) => {
      const cwd = typeof session.cwd === "string" && session.cwd ? session.cwd : undefined;
      const started = typeof session.startedAt === "number" ? new Date(session.startedAt) : undefined;
      return {
        session_id: session.sessionId,
        state: "open",
        cwd,
        project_dir: cwd,
        timestamp: started && !Number.isNaN(started.getTime()) ? started.toISOString() : undefined,
      };
    });
}

function isStatus(data: unknown): data is SessionStatus {
  if (typeof data !== "object" || data === null) return false;
  const { session_id, state } = data as Record<string, unknown>;
  return typeof session_id === "string" && typeof state === "string" && fileStates.includes(state);
}

export function countStates(statuses: readonly SessionStatus[]): Counts {
  const counts: Counts = { waiting: 0, done: 0, working: 0, open: 0 };
  for (const status of statuses) counts[status.state]++;
  return counts;
}

// The inbox counts waiting + done (docs/decisions.md): both are sessions where it's your turn.
export function summarize(counts: Counts): { needsYou: number; headline: string; text: string; tooltip: string } {
  const needsYou = counts.waiting + counts.done;
  const text = needsYou > 0 ? `$(warning) ${needsYou} waiting` : "$(check) all clear";
  const headline =
    needsYou === 1 ? "1 session needs you" : needsYou > 1 ? `${needsYou} sessions need you` : "No session needs you";
  const tooltip = [
    `Session Inbox: ${headline}`,
    `Waiting (permission or question): ${counts.waiting}`,
    `Done (your turn): ${counts.done}`,
    `Working: ${counts.working}`,
    counts.open > 0 ? `Open (no status yet): ${counts.open}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { needsYou, headline, text, tooltip };
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
