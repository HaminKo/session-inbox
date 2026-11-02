// Unit tests for the "show this chat's tab" hand-off file. Plain Node, no VS Code: `npm test`.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import {
  holdsFolder,
  parseRevealRequest,
  readRevealRequest,
  revealFile,
  revealMaxAgeMs,
  shouldReveal,
  writeRevealRequest,
} from "../../src/reveal.ts";
import { readStatuses } from "../../src/statusFolder.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "session-inbox-unit-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const request = { session_id: "abc", project_dir: "c:/Projects/demo", at: 1_000_000 };

void test("parseRevealRequest reads a request, with or without a BOM", () => {
  assert.deepEqual(parseRevealRequest(JSON.stringify(request)), request);
  assert.deepEqual(parseRevealRequest("\uFEFF" + JSON.stringify(request)), request);
});

void test("parseRevealRequest rejects bad JSON and missing or wrong fields", () => {
  for (const text of [
    "",
    "{",
    "null",
    "[]",
    JSON.stringify({ ...request, session_id: "" }),
    JSON.stringify({ ...request, project_dir: 7 }),
    JSON.stringify({ ...request, at: "now" }),
    JSON.stringify({ session_id: "abc", project_dir: "c:/x" }),
  ]) {
    assert.equal(parseRevealRequest(text), undefined, text);
  }
});

void test("holdsFolder ignores case, slash direction and a trailing slash", () => {
  assert.ok(holdsFolder(["C:\\Projects\\demo"], "c:/projects/demo/"));
  assert.ok(holdsFolder(["C:\\other", "C:\\Projects\\demo"], "c:/Projects/demo"));
  assert.ok(!holdsFolder(["C:\\Projects\\demo-2"], "c:/Projects/demo"));
  assert.ok(!holdsFolder(["C:\\Projects\\demo\\sub"], "c:/Projects/demo"));
  assert.ok(!holdsFolder([], "c:/Projects/demo"));
});

void test("shouldReveal: only a fresh request for a folder this window has open", () => {
  const here = ["C:\\Projects\\demo"];
  assert.ok(shouldReveal(request, here, request.at));
  assert.ok(shouldReveal(request, here, request.at + revealMaxAgeMs));
  assert.ok(!shouldReveal(request, here, request.at + revealMaxAgeMs + 1), "stale");
  assert.ok(shouldReveal(request, here, request.at - 1_000), "a clock a second behind");
  assert.ok(!shouldReveal(request, here, request.at - 60_000), "far in the future");
  assert.ok(!shouldReveal(request, ["C:\\Projects\\other"], request.at), "another window's folder");
});

void test("writeRevealRequest and readRevealRequest round-trip, leaving no temp file", async () => {
  await writeRevealRequest(root, request);
  assert.deepEqual(await readRevealRequest(root), request);
  await writeRevealRequest(root, { ...request, at: 2 });
  assert.equal((await readRevealRequest(root))?.at, 2);
  assert.deepEqual(readdirSync(root), [revealFile]);
});

void test("readRevealRequest: undefined for no file or a broken one", async () => {
  assert.equal(await readRevealRequest(root), undefined);
  assert.equal(await readRevealRequest(join(root, "missing")), undefined);
  writeFileSync(join(root, revealFile), "{ half");
  assert.equal(await readRevealRequest(root), undefined);
});

void test("the request file is not read as a status file", async () => {
  await writeRevealRequest(root, request);
  assert.deepEqual(await readStatuses(root), []);
});
