// What the sidebar shows, worked out from the statuses: groups, their order, and the text of each
// row. No `vscode` import, so the unit tests run in plain Node.
import type { SessionState, SessionStatus } from "./statusFolder.ts";

export interface SessionGroup {
  state: SessionState;
  label: string;
  sessions: SessionStatus[];
}

const groupOrder: readonly SessionState[] = ["waiting", "done", "working"];
const groupNames: Record<SessionState, string> = { waiting: "Waiting", done: "Done", working: "Working" };
const stateNames: Record<SessionState, string> = {
  waiting: "Waiting (permission or question)",
  done: "Done (your turn)",
  working: "Working",
};

// Waiting, then done, then working; empty groups left out. Inside a group the oldest timestamp
// comes first (the session that has waited longest), ones without a readable timestamp last.
export function groupSessions(statuses: readonly SessionStatus[]): SessionGroup[] {
  return groupOrder
    .map((state) => {
      const sessions = statuses
        .filter((status) => status.state === state)
        .sort((a, b) => (since(a) ?? Infinity) - (since(b) ?? Infinity));
      return { state, label: `${groupNames[state]} (${sessions.length})`, sessions };
    })
    .filter((group) => group.sessions.length > 0);
}

// The project folder; for an older or odd file, the last part of `cwd`, then the session id.
export function sessionLabel(status: SessionStatus): string {
  return text(status.folder) || text(status.cwd).split(/[\\/]/).filter(Boolean).pop() || status.session_id;
}

// `worktree · 12 min · <message>`, leaving out what doesn't apply. `working` shows no time: its
// timestamp means last activity, not waiting since (docs/research/hooks.md).
export function sessionDescription(status: SessionStatus, now: number): string {
  const start = since(status);
  const parts = [
    status.worktree === true ? "worktree" : "",
    status.state !== "working" && start !== undefined ? formatAge(now - start) : "",
    oneLine(status.message),
  ];
  return parts.filter(Boolean).join(" · ");
}

// Full path, state with the clock time it began (last activity for `working`), full message.
// The date is added when that wasn't today.
export function sessionTooltip(status: SessionStatus, now: number): string {
  const start = since(status);
  const time = start === undefined ? "" : clockTime(new Date(start), new Date(now));
  const state = !time
    ? stateNames[status.state]
    : status.state === "working"
      ? `Working, last activity ${time}`
      : `${stateNames[status.state]} since ${time}`;
  return [text(status.cwd) || sessionLabel(status), state, text(status.message)].filter(Boolean).join("\n");
}

// `<1 min`, `12 min`, `1 h 20 min`, `2 d`. A negative age (clock drift) counts as `<1 min`.
export function formatAge(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d`;
}

function since(status: SessionStatus): number | undefined {
  const time = Date.parse(text(status.timestamp));
  return Number.isNaN(time) ? undefined : time;
}

// Local time as HH:MM, with YYYY-MM-DD in front when it isn't `today`; the same in every locale.
function clockTime(date: Date, today: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return date.toDateString() === today.toDateString()
    ? time
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`;
}

function oneLine(value: unknown): string {
  return text(value).replace(/\s+/g, " ").trim();
}

// Only `session_id` and `state` are checked when a file is read; other fields may hold anything.
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
