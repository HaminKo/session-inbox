// Unit tests for a project's own icon and status (the `sessionInbox.projects` setting). Plain Node: `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  iconChoices,
  projectFolder,
  projectIcon,
  projectStatus,
  projectStatusColor,
  statusColorChoices,
  statusProjects,
  withIcon,
  withStatus,
  withStatusColor,
} from "../../src/projectLook.ts";

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

void test("setting a status saves the folder, keeps other fields and the stored spelling", () => {
  const looks = { PeacefreeWeb: { icon: "globe" }, other: { icon: "map" } };
  const set = withStatus(looks, "peacefreeweb", "On hold", "C:/p/PeacefreeWeb");
  assert.deepEqual(set, {
    PeacefreeWeb: { icon: "globe", status: "On hold", folder: "C:/p/PeacefreeWeb" },
    other: { icon: "map" },
  });
  assert.equal(projectStatus(set, "PEACEFREEWEB"), "On hold");
  assert.equal(projectFolder(set, "peacefreeweb"), "C:/p/PeacefreeWeb");
  assert.deepEqual(looks.PeacefreeWeb, { icon: "globe" });
  // A new project gets an entry; an unknown folder keeps the one saved before.
  assert.deepEqual(withStatus(undefined, "slide-out", "Come back later", undefined), { "slide-out": { status: "Come back later" } });
  assert.deepEqual(withStatus(set, "PeacefreeWeb", "Come back later", undefined).PeacefreeWeb, {
    icon: "globe",
    status: "Come back later",
    folder: "C:/p/PeacefreeWeb",
  });
});

void test("clearing a status removes it, its folder and colour, and the entry when nothing else is left", () => {
  const looks = {
    demo: { icon: "map", status: "On hold", folder: "C:/p/demo", statusColor: "charts.red" },
    solo: { status: "x", folder: "C:/p/solo" },
  };
  assert.deepEqual(withStatus(looks, "DEMO", undefined, "C:/p/demo"), {
    demo: { icon: "map" },
    solo: { status: "x", folder: "C:/p/solo" },
  });
  assert.deepEqual(withStatus(looks, "solo", undefined, undefined), { demo: looks.demo });
  // Other spellings go too, so a project typed by hand twice is really cleared; their other
  // fields are kept, under the first spelling.
  assert.deepEqual(withStatus({ demo: { status: "a" }, Demo: { status: "b" } }, "demo", undefined, undefined), {});
  const twice = { demo: { status: "a" }, Demo: { status: "b", icon: "map", focus: "notes/x.md" } };
  assert.deepEqual(withStatus(twice, "DEMO", undefined, undefined), { demo: { icon: "map", focus: "notes/x.md" } });
});

void test("a missing, empty or malformed status or folder reads as none", () => {
  for (const entry of [undefined, null, "On hold", {}, { status: 5 }, { status: "" }, { status: "  " }]) {
    assert.equal(projectStatus({ demo: entry }, "demo"), undefined, JSON.stringify(entry));
  }
  assert.equal(projectStatus({ demo: { status: "  On hold " } }, "demo"), "On hold");
  assert.equal(projectFolder({ demo: { status: "x", folder: "" } }, "demo"), undefined);
  assert.equal(projectFolder({ demo: { status: "x", folder: 5 } }, "demo"), undefined);
});

void test("statusProjects lists every project with a status, A-Z, open or closed", () => {
  const looks = {
    "slide-out": { status: "On hold", folder: "C:/p/slide-out" },
    todo12: { status: "Later" },
    PeacefreeWeb: { status: "Come back later", folder: "C:/p/PeacefreeWeb", icon: "globe", statusColor: "charts.purple" },
    iconOnly: { icon: "map" },
    todo9: { status: "Later" },
    // Typed by hand: the first spelling is the one read, as everywhere else.
    "Slide-Out": { status: "ignored" },
  };
  assert.deepEqual(statusProjects(looks), [
    { label: "PeacefreeWeb", status: "Come back later", folder: "C:/p/PeacefreeWeb", color: "charts.purple" },
    { label: "slide-out", status: "On hold", folder: "C:/p/slide-out", color: undefined },
    { label: "todo9", status: "Later", folder: undefined, color: undefined },
    { label: "todo12", status: "Later", folder: undefined, color: undefined },
  ]);
  for (const bad of [undefined, null, [], "x", {}]) assert.deepEqual(statusProjects(bad), [], JSON.stringify(bad));
});


void test("a status colour is a theme colour id, set and removed per project; a new status keeps it", () => {
  const looks = withStatusColor({ Demo: { status: "On hold", folder: "C:/p/demo" } }, "demo", "charts.purple");
  assert.deepEqual(looks, { Demo: { status: "On hold", folder: "C:/p/demo", statusColor: "charts.purple" } });
  assert.equal(projectStatusColor(looks, "DEMO"), "charts.purple");
  assert.equal(projectStatusColor(withStatus(looks, "demo", "Come back later", undefined), "demo"), "charts.purple");
  assert.deepEqual(withStatusColor(looks, "demo", undefined), { Demo: { status: "On hold", folder: "C:/p/demo" } });
  // Typed by hand: any well-formed id passes; a hex code or anything else gives no colour.
  assert.equal(projectStatusColor({ demo: { statusColor: "terminal.ansiBrightRed" } }, "demo"), "terminal.ansiBrightRed");
  for (const statusColor of ["#ff0000", "red!", "charts..red", ".red", "", 5, null]) {
    assert.equal(projectStatusColor({ demo: { statusColor } }, "demo"), undefined, JSON.stringify(statusColor));
  }
});

void test("every offered colour is a well-formed id, listed once", () => {
  assert.equal(new Set(statusColorChoices.map((choice) => choice.color)).size, statusColorChoices.length);
  for (const { color } of statusColorChoices) assert.equal(projectStatusColor({ demo: { statusColor: color } }, "demo"), color);
});
