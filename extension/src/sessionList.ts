// What the sidebar shows, worked out from the statuses: groups, their order, and the text of each
// row. No `vscode` import, so the unit tests run in plain Node.
import type { StatusProject } from "./projectLook.ts";
import { countStates, hasBackground, type SessionState, type SessionStatus } from "./statusFolder.ts";

// One header row and the sessions under it; the same shape in both groupings. `id` is
// `state:<state>`, `state:parked`, `state:closed` or `project:<label>`, so the two groupings never
// share a tree item id.
export interface SessionGroup {
  id: string;
  label: string;
  description: string;
  sessions: SessionStatus[];
  // Projects with a hand-set status and no chat running (to-do #28): each a "Closed" row that
  // opens its folder. Never counted.
  closed: StatusProject[];
}

// The two ways the sidebar groups sessions; the title-bar button switches between them.
export type GroupBy = "state" | "project";

const groupOrder: readonly SessionState[] = ["waiting", "done", "working", "open"];
const groupNames: Record<SessionState, string> = { waiting: "Waiting", done: "Done", working: "Working", open: "Open" };
const stateNames: Record<SessionState, string> = {
  waiting: "Waiting (permission or question)",
  done: "Done (your turn)",
  working: "Working",
  open: "Open (no status yet)",
};

// `parked`: the projects with a status (statusProjects, A-Z); those with no chat running are listed
// as closed.
export function groupSessions(
  statuses: readonly SessionStatus[],
  by: GroupBy = "state",
  parked: readonly StatusProject[] = [],
): SessionGroup[] {
  const open = new Set(statuses.map((status) => sessionLabel(status).toLowerCase()));
  const closed = parked.filter((project) => !open.has(project.label.toLowerCase()));
  return by === "project" ? groupByProject(statuses, closed) : groupByState(statuses, closed, parkedTest(parked));
}

// Whether a chat belongs to one of `parked` (statusProjects), matched ignoring case like the project
// grouping. Its `done` isn't your turn (to-do #28): countStates counts it apart, and grouped by state
// it has a group of its own.
export function parkedTest(parked: readonly StatusProject[]): (status: SessionStatus) => boolean {
  const labels = new Set(parked.map((project) => project.label.toLowerCase()));
  return (status) => labels.has(sessionLabel(status).toLowerCase());
}

// Waiting, done, working, open, a parked project's done, then the closed projects; empty groups left
// out, so the Waiting and Done headers add up to the badge. Inside a group the oldest timestamp comes
// first (the session that has waited longest), ones without a readable timestamp last.
function groupByState(
  statuses: readonly SessionStatus[],
  closed: readonly StatusProject[],
  isParked: (status: SessionStatus) => boolean,
): SessionGroup[] {
  const parkedDone = (status: SessionStatus) => status.state === "done" && isParked(status);
  const groups: SessionGroup[] = groupOrder
    .map((state) => {
      const sessions = statuses.filter((status) => status.state === state && !parkedDone(status)).sort(byTime);
      return { id: `state:${state}`, label: `${groupNames[state]} (${sessions.length})`, description: "", sessions, closed: [] };
    })
    .filter((group) => group.sessions.length > 0);
  const parked = statuses.filter(parkedDone).sort(byTime);
  if (parked.length > 0) {
    groups.push({ id: "state:parked", label: `Parked (${parked.length})`, description: "", sessions: parked, closed: [] });
  }
  if (closed.length > 0) {
    groups.push({ id: "state:closed", label: `Closed (${closed.length})`, description: "", sessions: [], closed: [...closed] });
  }
  return groups;
}

// One group per row label ignoring case (Windows folders; a worktree is its own project), shown
// with the lowest of its spellings. A-Z with numbers by value (`todo9` before `todo12`), ties by
// the key itself, so neither the order nor the header text depends on the order files are read.
// The header says `1 waiting · 1 done`; inside, waiting, done, working, open, each oldest first. A
// closed project has a header of its own in its A-Z place, with no sessions.
function groupByProject(statuses: readonly SessionStatus[], closed: readonly StatusProject[]): SessionGroup[] {
  const projects = new Map<string, { label: string; sessions: SessionStatus[]; closed: StatusProject[] }>();
  for (const status of statuses) {
    const label = sessionLabel(status);
    const key = label.toLowerCase();
    const project = projects.get(key) ?? { label, sessions: [], closed: [] };
    if (label < project.label) project.label = label;
    project.sessions.push(status);
    projects.set(key, project);
  }
  for (const project of closed) projects.set(project.label.toLowerCase(), { label: project.label, sessions: [], closed: [project] });
  return [...projects]
    .sort(([a], [b]) => compareProjects(a, b))
    .map(([key, { label, sessions, closed }]) => {
      const counts = countStates(sessions);
      return {
        id: `project:${key}`,
        label,
        description: groupOrder
          .filter((state) => counts[state] > 0)
          .map((state) => `${counts[state]} ${state}`)
          .join(" · "),
        sessions: sessions.sort((a, b) => groupOrder.indexOf(a.state) - groupOrder.indexOf(b.state) || byTime(a, b)),
        closed,
      };
    });
}

// Project names (lowercase keys) A-Z with numbers by value (`todo9` before `todo12`), ties by the
// key itself, so the order never depends on the order things were read.
export function compareProjects(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true }) || (a < b ? -1 : a > b ? 1 : 0);
}

// The folder of a group's first session that has one (sessionFolder), else the one saved with a
// closed project's status.
export function groupFolder(group: SessionGroup): string | undefined {
  return group.sessions.map(sessionFolder).find((dir) => dir !== undefined) ?? group.closed.find((project) => project.folder)?.folder;
}

function byTime(a: SessionStatus, b: SessionStatus): number {
  return (since(a) ?? Infinity) - (since(b) ?? Infinity);
}

// A row's label: grouped by project the header already names the project, so the row names its
// state (`Waiting`, `Done`, `Working`, `Open`); grouped by state, the project.
export function rowLabel(status: SessionStatus, by: GroupBy): string {
  return by === "project" ? groupNames[status.state] : sessionLabel(status);
}

// The project folder; for an older or odd file, the last part of `cwd`, then the session id.
export function sessionLabel(status: SessionStatus): string {
  return text(status.folder) || leaf(text(status.cwd)) || status.session_id;
}

// The last part of a path, either slash; undefined for an empty path.
function leaf(path: string): string | undefined {
  return path.split(/[\\/]/).filter(Boolean).pop();
}

// The folder a click opens: the chat's start folder. A file written before the hook had
// `project_dir` falls back to `cwd`, but only while it is that folder itself (`cwd` follows the
// shell into subfolders); otherwise undefined, until the session's next hook event rewrites the file.
export function sessionFolder(status: SessionStatus): string | undefined {
  const projectDir = text(status.project_dir);
  if (projectDir) return projectDir;
  const cwd = text(status.cwd);
  const last = leaf(cwd);
  return last && last.toLowerCase() === text(status.folder).toLowerCase() ? cwd : undefined;
}

// `worktree · 12 min · <message>`, leaving out what doesn't apply. `working` shows no time: its
// timestamp means last activity, not waiting since (docs/research/hooks.md). Nor does `open`: its
// timestamp is when the chat process started, after a VS Code restart just the restart. A reply
// waiting on its background task (`working` with `background`) says so, then the reply's line.
export function sessionDescription(status: SessionStatus, now: number): string {
  const start = since(status);
  const parts = [
    status.worktree === true ? "worktree" : "",
    onTask(status) ? "background task" : "",
    (status.state === "waiting" || status.state === "done") && start !== undefined ? formatAge(now - start) : "",
    oneLine(status.message),
  ];
  return parts.filter(Boolean).join(" · ");
}

// Full path, state with the clock time it began (last activity for `working`, the reply for one on a
// background task, process start for `open`), full message.
// The date is added when that wasn't today.
export function sessionTooltip(status: SessionStatus, now: number): string {
  const start = since(status);
  const time = start === undefined ? "" : clockTime(new Date(start), new Date(now));
  return [text(status.cwd) || sessionLabel(status), stateLine(status, time), text(status.message)]
    .filter(Boolean)
    .join("\n");
}

function stateLine(status: SessionStatus, time: string): string {
  if (!time) return stateNames[status.state];
  if (onTask(status)) return `Working on a background task since ${time}`;
  if (status.state === "working") return `Working, last activity ${time}`;
  if (status.state === "open") return `${stateNames.open}, chat started ${time}`;
  return `${stateNames[status.state]} since ${time}`;
}

// A reply that ended with a background task running, shown as working (statusFolder.ts,
// backgroundAsWorking). Once it falls back to `done` it looks like any other `done`.
function onTask(status: SessionStatus): boolean {
  return status.state === "working" && hasBackground(status);
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

// When the status's state began (its timestamp), or undefined if it has none that parses.
export function since(status: SessionStatus): number | undefined {
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
