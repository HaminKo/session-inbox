// A project's own icon, focus file and status in the sidebar, from the user setting
// `sessionInbox.projects`: `{ "sc-map-library": { "icon": "map" } }`. The icon keeps its state
// colour, so the glance still shows waiting / done / working (docs/decisions.md 2026-11-02).
// Plain data, no VS Code, so it can be unit-tested; sidebar.ts turns the name into a ThemeIcon.
import { resolve } from "node:path";
import { compareProjects } from "./sessionList.ts";

export const defaultIcon = "folder";

// The sidebar's row icon per state that needs you; the tray menu draws the same ones.
export const stateIcons = { waiting: "warning", done: "check" } as const;

// The QuickPick's choices; any other codicon name can be typed into settings.json by hand.
// All checked against the pinned VS Code (test/gui/launch.ts).
export const iconChoices: readonly string[] = [
  "folder",
  "map",
  "globe",
  "home",
  "book",
  "library",
  "beaker",
  "rocket",
  "game",
  "heart",
  "star-full",
  "flame",
  "zap",
  "lightbulb",
  "tools",
  "code",
  "terminal",
  "database",
  "cloud",
  "device-mobile",
  "paintcan",
  "music",
  "mortar-board",
  "briefcase",
  "robot",
];

// Codicon names are lowercase words joined by "-". VS Code can't tell an extension which names
// exist, so a well-formed typo still draws an empty icon.
const iconName = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isEntry(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The entry for `label`, matched ignoring case like the project grouping (sessionList.ts).
function findKey(looks: unknown, label: string): string | undefined {
  if (!isEntry(looks)) return undefined;
  const key = label.toLowerCase();
  return Object.keys(looks).find((name) => name.toLowerCase() === key);
}

// The setting's entry for `label`, when it is an object.
function projectEntry(looks: unknown, label: string): Record<string, unknown> | undefined {
  const key = findKey(looks, label);
  const entry = key !== undefined && isEntry(looks) ? looks[key] : undefined;
  return isEntry(entry) ? entry : undefined;
}

// The icon name for a project header: the setting's, or the folder when it's missing or malformed.
export function projectIcon(looks: unknown, label: string): string {
  const icon = projectEntry(looks, label)?.icon;
  return typeof icon === "string" && iconName.test(icon) ? icon : defaultIcon;
}

// The focus file every project has unless its entry says otherwise (docs/decisions.md 2026-11-03).
export const defaultFocus = "docs/todo.md";

// The project's focus file (focus.ts), relative to its folder: the setting's string (`set`), none
// for `false`, else the default. `set` tells a path typed by hand, whose problems get logged.
export function projectFocus(looks: unknown, label: string): { file: string; set: boolean } | undefined {
  const focus = projectEntry(looks, label)?.focus;
  if (focus === false) return undefined;
  return typeof focus === "string" && focus.trim() ? { file: focus.trim(), set: true } : { file: defaultFocus, set: false };
}

// projectFocus as an absolute path in `folder`; undefined when turned off or there's no folder.
export function focusPath(
  looks: unknown,
  label: string,
  folder: string | undefined,
): { path: string; file: string; set: boolean } | undefined {
  const focus = projectFocus(looks, label);
  return focus && folder ? { ...focus, path: resolve(folder, focus.file) } : undefined;
}

// The setting with `label`'s entry changed: each field of `changes` set, or removed when undefined.
// Other fields of the entry are kept; an entry left empty is dropped. Kept under its stored
// spelling, else the header's label. Other spellings of the same project (typed by hand) are merged
// into it, the first spelling's field winning as everywhere here, so a reset sticks and no field
// typed under another spelling is lost.
function withEntry(looks: unknown, label: string, changes: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = isEntry(looks) ? { ...looks } : {};
  const key = findKey(result, label);
  let entry: Record<string, unknown> = {};
  for (let other = key; other !== undefined; other = findKey(result, label)) {
    const fields = result[other];
    if (isEntry(fields)) entry = { ...fields, ...entry };
    delete result[other];
  }
  for (const [field, value] of Object.entries(changes)) {
    if (value === undefined) delete entry[field];
    else entry[field] = value;
  }
  if (Object.keys(entry).length > 0) result[key ?? label] = entry;
  return result;
}

// The setting with `label`'s icon set, or removed when `icon` is undefined.
export function withIcon(looks: unknown, label: string, icon: string | undefined): Record<string, unknown> {
  return withEntry(looks, label, { icon });
}

// A hand-set status (to-do #28): any text, with these two offered. Every status means the same:
// the project is parked. Stored with the folder it was set from, so a closed project can still be
// listed and opened (its "Closed" row, sidebar.ts).
export const statusChoices: readonly string[] = ["On hold", "Come back later"];

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function projectStatus(looks: unknown, label: string): string | undefined {
  return text(projectEntry(looks, label)?.status);
}

export function projectFolder(looks: unknown, label: string): string | undefined {
  return text(projectEntry(looks, label)?.folder);
}

// The setting with `label`'s status set, and `folder` saved with it (an unknown folder keeps the
// one saved before). `status` undefined clears it with its folder and colour: they are kept only
// for the status.
export function withStatus(
  looks: unknown,
  label: string,
  status: string | undefined,
  folder: string | undefined,
): Record<string, unknown> {
  if (status === undefined) return withEntry(looks, label, { status: undefined, folder: undefined, statusColor: undefined });
  return withEntry(looks, label, folder === undefined ? { status } : { status, folder });
}

// The colours offered for a status, picked by the user per project and drawn on the label that
// names it (a file decoration, sidebar.ts). Theme colours, so they suit light and dark themes: VS
// Code colours only by a theme colour's id, never a hex code. Any other id can be typed into
// settings.json.
export const statusColorChoices: readonly { name: string; color: string }[] = [
  { name: "Red", color: "charts.red" },
  { name: "Orange", color: "charts.orange" },
  { name: "Yellow", color: "charts.yellow" },
  { name: "Green", color: "charts.green" },
  { name: "Blue", color: "charts.blue" },
  { name: "Purple", color: "charts.purple" },
  { name: "Magenta", color: "terminal.ansiMagenta" },
  { name: "Cyan", color: "terminal.ansiCyan" },
  { name: "Grey", color: "disabledForeground" },
];

// A theme colour id: words joined by "." (`charts.red`, `terminal.ansiMagenta`, `foreground`).
// A well-formed unknown id draws the default colour; a hex code is not an id.
const colorId = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)*$/;

export function projectStatusColor(looks: unknown, label: string): string | undefined {
  const color = text(projectEntry(looks, label)?.statusColor);
  return color && colorId.test(color) ? color : undefined;
}

// The setting with `label`'s status colour set, or removed when `color` is undefined.
export function withStatusColor(looks: unknown, label: string, color: string | undefined): Record<string, unknown> {
  return withEntry(looks, label, { statusColor: color });
}

export interface StatusProject {
  label: string;
  status: string;
  folder: string | undefined;
  color: string | undefined;
}

// Every project with a status, A-Z like the project grouping. Several spellings of one project
// (typed by hand) give one row, from the entry the other functions here read: the first.
export function statusProjects(looks: unknown): StatusProject[] {
  if (!isEntry(looks)) return [];
  const projects = new Map<string, StatusProject>();
  for (const label of Object.keys(looks)) {
    const key = label.toLowerCase();
    const status = projectStatus(looks, label);
    if (projects.has(key) || !status) continue;
    projects.set(key, { label, status, folder: projectFolder(looks, label), color: projectStatusColor(looks, label) });
  }
  return [...projects].sort(([a], [b]) => compareProjects(a, b)).map(([, project]) => project);
}
