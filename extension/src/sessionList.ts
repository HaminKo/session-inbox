// What the sidebar shows, worked out from the statuses: groups, their order, and the text of each
// row. No `vscode` import, so the unit tests run in plain Node.
import { countStates, type SessionState, type SessionStatus } from "./statusFolder.ts";

// One header row and the sessions under it; the same shape in both groupings. `id` is
// `state:<state>` or `project:<label>`, so the two groupings never share a tree item id.
export interface SessionGroup {
  id: string;
  label: string;
  description: string;
  sessions: SessionStatus[];
}

// The two ways the sidebar groups sessions; the title-bar button switches between them.
export type GroupBy = "state" | "project";

const groupOrder: readonly SessionState[] = ["waiting", "done", "working"];
const groupNames: Record<SessionState, string> = { waiting: "Waiting", done: "Done", working: "Working" };
const stateNames: Record<SessionState, string> = {
  waiting: "Waiting (permission or question)",
  done: "Done (your turn)",
  working: "Working",
};

export function groupSessions(statuses: readonly SessionStatus[], by: GroupBy = "state"): SessionGroup[] {
  return by === "project" ? groupByProject(statuses) : groupByState(statuses);
}

// Waiting, then done, then working; empty groups left out. Inside a group the oldest timestamp
// comes first (the session that has waited longest), ones without a readable timestamp last.
function groupByState(statuses: readonly SessionStatus[]): SessionGroup[] {
  return groupOrder
    .map((state) => {
      const sessions = statuses.filter((status) => status.state === state).sort(byTime);
      return { id: `state:${state}`, label: `${groupNames[state]} (${sessions.length})`, description: "", sessions };
    })
    .filter((group) => group.sessions.length > 0);
}

// One group per row label ignoring case (Windows folders; a worktree is its own project), shown
// with the lowest of its spellings. A-Z with numbers by value (`todo9` before `todo12`), ties by
// the key itself, so neither the order nor the header text depends on the order files are read.
// The header says `1 waiting · 1 done`; inside, waiting, done, working, each oldest first.
function groupByProject(statuses: readonly SessionStatus[]): SessionGroup[] {
  const projects = new Map<string, { label: string; sessions: SessionStatus[] }>();
  for (const status of statuses) {
    const label = sessionLabel(status);
    const key = label.toLowerCase();
    const project = projects.get(key) ?? { label, sessions: [] };
    if (label < project.label) project.label = label;
    project.sessions.push(status);
    projects.set(key, project);
  }
  return [...projects]
    .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }) || (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, { label, sessions }]) => {
      const counts = countStates(sessions);
      return {
        id: `project:${key}`,
        label,
        description: groupOrder
          .filter((state) => counts[state] > 0)
          .map((state) => `${counts[state]} ${state}`)
          .join(" · "),
        sessions: sessions.sort((a, b) => groupOrder.indexOf(a.state) - groupOrder.indexOf(b.state) || byTime(a, b)),
      };
    });
}

function byTime(a: SessionStatus, b: SessionStatus): number {
  return (since(a) ?? Infinity) - (since(b) ?? Infinity);
}

// A row's label: grouped by project the header already names the project, so the row names its
// state (`Waiting`, `Done`, `Working`); grouped by state, the project.
export function rowLabel(status: SessionStatus, by: GroupBy): string {
  return by === "project" ? groupNames[status.state] : sessionLabel(status);
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
