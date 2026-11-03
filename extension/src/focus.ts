// A project's current focus: the "Where we are" section of a markdown file the project names in
// `sessionInbox.projects` (`"focus": "docs/todo.md"`). That project's own finish-step skill writes
// it; the extension only reads it. Plain text in, plain data out, so it can be unit-tested.
//
//   ## Where we are
//   - Now: To do 31, step F3b4b (Run translated)
//   - Next: To do 37, 11, 59
//   - Updated: 2026-11-03

export interface Focus {
  // The text after `Now:`; the sidebar shows a row only when it is there.
  now?: string;
  // The section's lines without the heading, for the hover.
  block: string;
  // The text after `Updated:`, e.g. `2026-11-03`.
  updated?: string;
}

const heading = /^##\s+where we are\s*$/i;
// A level-1 or level-2 heading ends the section; `###` and deeper belong to it.
const nextHeading = /^#{1,2}(?!#)/;

// The value after `Now:` or `Updated:`, with or without a leading `- ` or `* `.
function field(lines: readonly string[], name: string): string | undefined {
  const pattern = new RegExp(`^\\s*(?:[-*]\\s+)?${name}:\\s*(.*?)\\s*$`, "i");
  for (const line of lines) {
    const value = pattern.exec(line)?.[1];
    if (value) return value;
  }
  return undefined;
}

// The first "## Where we are" section, up to the next `#` or `##` heading or the end of the file;
// undefined when there is none.
export function parseFocus(text: string): Focus | undefined {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return undefined;
  const end = lines.findIndex((line, index) => index > start && nextHeading.test(line));
  const section = lines.slice(start + 1, end < 0 ? undefined : end);
  return {
    now: field(section, "Now"),
    block: section.join("\n").trim(),
    updated: field(section, "Updated"),
  };
}

// How many days `updated` (YYYY-MM-DD) is older than `today`'s local date, when that is more than
// `limit`; undefined when it isn't, or when `updated` is missing or not a real date.
export function staleDays(updated: string | undefined, today: Date, limit: number): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(updated ?? "");
  if (!match) return undefined;
  const [, year, month, day] = match.map(Number);
  const then = Date.UTC(year, month - 1, day);
  // Date.UTC rolls 2026-02-31 over into March; such a date counts as no date.
  if (new Date(then).getUTCMonth() !== month - 1 || new Date(then).getUTCDate() !== day) return undefined;
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((now - then) / 86_400_000);
  return days > limit ? days : undefined;
}
