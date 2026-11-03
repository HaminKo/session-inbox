// Unit tests for a project's focus block (focus.ts) and its setting. Plain Node: `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFocus, staleDays } from "../../src/focus.ts";
import { projectFocus } from "../../src/projectLook.ts";

const todo = [
  "Next number: 38",
  "",
  "## Where we are",
  "- Now: To do 31, step F3b4b (Run translated)",
  "- Next: To do 37, 11, 59",
  "- Updated: 2026-11-03",
  "",
  "## To do",
  "- Now: not this one",
].join("\n");

void test("the Where we are block gives Now, the block and Updated", () => {
  assert.deepEqual(parseFocus(todo), {
    now: "To do 31, step F3b4b (Run translated)",
    block: "- Now: To do 31, step F3b4b (Run translated)\n- Next: To do 37, 11, 59\n- Updated: 2026-11-03",
    updated: "2026-11-03",
  });
});

void test("CRLF line endings, no leading dash, and a section at the end of the file", () => {
  const text = "# Todo\r\n## where we are\r\nNow:  Step B  \r\n### Notes\r\nUpdated: 2026-10-01\r\n";
  assert.deepEqual(parseFocus(text), { now: "Step B", block: "Now:  Step B  \n### Notes\nUpdated: 2026-10-01", updated: "2026-10-01" });
});

void test("no section gives nothing; a section without Now: gives no now", () => {
  assert.equal(parseFocus("# Todo\n## To do\n- Now: x\n"), undefined);
  assert.equal(parseFocus(""), undefined);
  const focus = parseFocus("## Where we are\n- Next: 5\n- Now:\n## To do\n- Now: x");
  assert.equal(focus?.now, undefined);
  assert.equal(focus?.block, "- Next: 5\n- Now:");
  // A level-1 heading ends it too.
  assert.equal(parseFocus("## Where we are\n- Next: 5\n# Archive\n- Now: old")?.now, undefined);
});

void test("stale only after more than 14 days, counted in local dates", () => {
  const today = new Date(2026, 10, 17, 23, 30); // 17 November, late evening
  assert.equal(staleDays("2026-11-03", today, 14), undefined);
  assert.equal(staleDays("2026-11-02", today, 14), 15);
  assert.equal(staleDays("2026-11-17", today, 14), undefined);
  for (const updated of [undefined, "", "yesterday", "2026-11-2", "2026-13-01", "2026-02-31"]) assert.equal(staleDays(updated, today, 14), undefined);
});

void test("the focus file comes from the setting, matched ignoring case", () => {
  const looks = { "SC-Map-Library": { icon: "map", focus: " docs/todo.md " }, other: { icon: "globe" } };
  assert.equal(projectFocus(looks, "sc-map-library"), "docs/todo.md");
  assert.equal(projectFocus(looks, "other"), undefined);
  for (const focus of [5, "", "  ", null]) assert.equal(projectFocus({ demo: { focus } }, "demo"), undefined);
  assert.equal(projectFocus(undefined, "demo"), undefined);
});
