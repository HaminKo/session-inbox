// Unit tests for a project's own icon (the `sessionInbox.projects` setting). Plain Node: `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { iconChoices, projectIcon, withIcon } from "../../src/projectLook.ts";

void test("a project's icon comes from the setting, matched ignoring case", () => {
  const looks = { "SC-Map-Library": { icon: "map" }, website: { icon: "globe" } };
  assert.equal(projectIcon(looks, "sc-map-library"), "map");
  assert.equal(projectIcon(looks, "Website"), "globe");
});

void test("a missing or malformed setting gives the folder", () => {
  for (const looks of [undefined, null, "map", [], {}, { other: { icon: "map" } }]) {
    assert.equal(projectIcon(looks, "demo"), "folder", JSON.stringify(looks));
  }
  for (const entry of [null, "map", { icon: 5 }, { icon: "" }, { icon: "Map" }, { icon: "$(map)" }, { icon: "map-" }]) {
    assert.equal(projectIcon({ demo: entry }, "demo"), "folder", JSON.stringify(entry));
  }
  // Well-formed but unknown: passed on (VS Code can't say which names exist).
  assert.equal(projectIcon({ demo: { icon: "no-such-icon" } }, "demo"), "no-such-icon");
});

void test("setting an icon keeps other projects and other fields, and the stored spelling", () => {
  const looks = { Demo: { icon: "map", note: "kept" }, other: { icon: "globe" } };
  assert.deepEqual(withIcon(looks, "demo", "rocket"), { Demo: { icon: "rocket", note: "kept" }, other: { icon: "globe" } });
  assert.deepEqual(withIcon(undefined, "new-one", "game"), { "new-one": { icon: "game" } });
  // The input isn't changed: VS Code hands out its own copy, but don't rely on it.
  assert.deepEqual(looks.Demo, { icon: "map", note: "kept" });
});

void test("resetting removes the icon, and the entry when nothing else is left", () => {
  assert.deepEqual(withIcon({ demo: { icon: "map" }, other: { icon: "globe" } }, "DEMO", undefined), {
    other: { icon: "globe" },
  });
  assert.deepEqual(withIcon({ demo: { icon: "map", note: "kept" } }, "demo", undefined), { demo: { note: "kept" } });
  assert.deepEqual(withIcon({}, "demo", undefined), {});
});

void test("every curated icon is a well-formed name and listed once", () => {
  assert.equal(new Set(iconChoices).size, iconChoices.length);
  for (const icon of iconChoices) assert.equal(projectIcon({ demo: { icon } }, "demo"), icon);
  assert.equal(iconChoices[0], "folder");
});

void test("other spellings of the same project are dropped, so a reset sticks", () => {
  const looks = { demo: { icon: "map" }, Demo: { icon: "rocket" } };
  assert.deepEqual(withIcon(looks, "DEMO", undefined), {});
  assert.equal(projectIcon(withIcon(looks, "DEMO", undefined), "demo"), "folder");
  assert.deepEqual(withIcon(looks, "demo", "game"), { demo: { icon: "game" } });
});
