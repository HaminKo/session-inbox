// A project's own icon and focus file in the sidebar (grouped by project), from the user setting
// `sessionInbox.projects`: `{ "sc-map-library": { "icon": "map" } }`. The icon keeps its state
// colour, so the glance still shows waiting / done / working (docs/decisions.md 2026-11-02).
// Plain data, no VS Code, so it can be unit-tested; sidebar.ts turns the name into a ThemeIcon.

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

// The project's focus file (focus.ts), relative to its folder; undefined when not set.
export function projectFocus(looks: unknown, label: string): string | undefined {
  const focus = projectEntry(looks, label)?.focus;
  return typeof focus === "string" && focus.trim() ? focus.trim() : undefined;
}

// The setting with `label`'s icon set, or removed when `icon` is undefined. Other fields of the
// entry are kept; an entry left empty is dropped. Kept under its stored spelling, else the header's
// label; other spellings of the same project (typed by hand) are dropped, so a reset sticks.
export function withIcon(looks: unknown, label: string, icon: string | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = isEntry(looks) ? { ...looks } : {};
  const key = findKey(result, label);
  const entry: Record<string, unknown> = key !== undefined && isEntry(result[key]) ? { ...result[key] } : {};
  for (let other = key; other !== undefined; other = findKey(result, label)) delete result[other];
  if (icon === undefined) delete entry.icon;
  else entry.icon = icon;
  if (Object.keys(entry).length > 0) result[key ?? label] = entry;
  return result;
}
