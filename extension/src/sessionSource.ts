// The live sessions, shared by the status bar and the sidebar: reads the status folder, drops chats
// that are gone, shows a reply still waiting on its background task as `working`, adds running
// chats that have no status file yet as `open`, and re-reads on every change and every `intervalMs`
// (which also ends the background wait's time limit). No `vscode` import, so the unit tests run in
// plain Node.
import {
  backgroundAsWorking,
  onlyLive,
  openSessions,
  readLiveSessions,
  readStatuses,
  watchFolder,
  type SessionStatus,
} from "./statusFolder.ts";

export type SessionListener = (statuses: readonly SessionStatus[]) => void;

export class SessionSource {
  private readonly listeners = new Set<SessionListener>();
  private readonly disposers: (() => void)[] = [];
  // Reads can overlap when events arrive quickly; only the newest one may notify.
  private latest = 0;
  private disposed = false;
  // The last read, replayed to a new subscriber.
  private current: readonly SessionStatus[] | undefined;
  private readonly statusDir: string;
  private readonly sessionsDir: string;

  constructor(statusDir: string, sessionsDir: string, { intervalMs = 30_000 } = {}) {
    this.statusDir = statusDir;
    this.sessionsDir = sessionsDir;
    void this.refresh();
    const watcher = watchFolder(statusDir, () => void this.refresh());
    // A chat process that exits removes its <pid>.json, so watching that folder drops it at once.
    // One killed without cleanup changes no file: the timer catches that.
    const sessionsWatcher = watchFolder(sessionsDir, () => void this.refresh());
    const timer = setInterval(() => void this.refresh(), intervalMs);
    this.disposers.push(watcher.dispose, sessionsWatcher.dispose, () => clearInterval(timer));
  }

  // Calls `listener` after every read with the statuses of running chats, and at once if a read
  // has already finished, so a late subscriber doesn't wait for the next change.
  onChange(listener: SessionListener): { dispose: () => void } {
    // A wrapper per subscription, so subscribing one function twice gives two independent ones.
    const entry: SessionListener = (statuses) => listener(statuses);
    if (this.current) entry(this.current);
    this.listeners.add(entry);
    return { dispose: () => this.listeners.delete(entry) };
  }

  async refresh(): Promise<void> {
    const run = ++this.latest;
    const [statuses, live] = await Promise.all([readStatuses(this.statusDir), readLiveSessions(this.sessionsDir)]);
    if (run !== this.latest || this.disposed) return;
    const current = [
      ...backgroundAsWorking(onlyLive(statuses, live), live, Date.now()),
      ...openSessions(statuses, live),
    ];
    this.current = current;
    // A copy, so a listener added during the loop isn't called twice. One that throws must not
    // keep the others from updating.
    for (const listener of [...this.listeners]) {
      try {
        listener(current);
      } catch (error) {
        console.error("Session Inbox: a session listener failed", error);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
    for (const dispose of this.disposers) dispose();
  }
}
