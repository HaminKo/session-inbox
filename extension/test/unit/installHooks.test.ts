// Unit tests for Install Hooks: the settings.json merge, the hook copy, the backups and the check.
// Everything happens in a temp stand-in for ~/.claude/. Plain Node, no VS Code: `npm test`.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import {
  checkHooks,
  claudeDir,
  describeProblem,
  hookEntry,
  hookEvents,
  hookVersion,
  installHooks,
} from "../../src/installHooks.ts";

// The repo's hook, the file the build bundles.
const source = resolve(import.meta.dirname, "..", "..", "..", "hooks", "session-status.ps1");
// Local time: backup names use it.
const now = new Date(2026, 10, 2, 14, 5, 0);

let dir: string;
let settingsPath: string;
let hookPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "session-inbox-unit-"));
  settingsPath = join(dir, "settings.json");
  hookPath = join(dir, "hooks", "session-status.ps1");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

function readSettings(): { hooks: Record<string, { hooks: { command: string }[] }[]> } & Record<string, unknown> {
  return JSON.parse(readFileSync(settingsPath, "utf8")) as ReturnType<typeof readSettings>;
}

const notifyHook = {
  type: "command",
  command: 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$USERPROFILE/.claude/hooks/notify.ps1"',
  timeout: 30,
  async: true,
};

void test("claudeDir uses the test override, else ~/.claude", () => {
  assert.equal(claudeDir({ SESSION_INBOX_CLAUDE_DIR: dir }), dir);
  assert.match(claudeDir({}), /[\\/]\.claude$/);
});

void test("a missing settings.json and hook folder are created", () => {
  const result = installHooks(source, dir, now);
  assert.equal(result.copied, true);
  assert.deepEqual(result.addedEvents, [...hookEvents]);
  assert.equal(result.settingsBackup, undefined);
  assert.ok(readFileSync(source).equals(readFileSync(hookPath)));
  const settings = readSettings();
  for (const event of hookEvents) assert.deepEqual(settings.hooks[event], [{ hooks: [hookEntry] }]);
  assert.deepEqual(checkHooks(source, dir), { file: "ok", missingEvents: [] });
});

void test("an empty settings.json counts as {}", () => {
  writeFileSync(settingsPath, "\n");
  assert.deepEqual(installHooks(source, dir, now).addedEvents, [...hookEvents]);
  assert.deepEqual(Object.keys(readSettings()), ["hooks"]);
});

void test("other settings and hooks stay as they are; the original is backed up once", () => {
  const original = {
    env: { PYTHONIOENCODING: "utf-8" },
    hooks: {
      Stop: [{ hooks: [notifyHook] }],
      PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "other.ps1" }] }],
    },
    model: "opus",
  };
  const text = JSON.stringify(original, null, 2);
  writeFileSync(settingsPath, text);
  const result = installHooks(source, dir, now);
  assert.equal(result.settingsBackup, `${settingsPath}.before-session-inbox`);
  assert.equal(readFileSync(result.settingsBackup, "utf8"), text);
  const settings = readSettings();
  assert.deepEqual(settings.env, original.env);
  assert.equal(settings.model, "opus");
  assert.deepEqual(settings.hooks.PreToolUse, original.hooks.PreToolUse);
  // A new group next to notify.ps1's, which isn't touched.
  assert.deepEqual(settings.hooks.Stop, [{ hooks: [notifyHook] }, { hooks: [hookEntry] }]);

  // A second change (here: an event removed by hand) keeps the first backup.
  delete settings.hooks.SessionEnd;
  writeFileSync(settingsPath, JSON.stringify(settings));
  const again = installHooks(source, dir, now);
  assert.deepEqual(again.addedEvents, ["SessionEnd"]);
  assert.equal(again.settingsBackup, undefined);
  assert.equal(readFileSync(`${settingsPath}.before-session-inbox`, "utf8"), text);
});

void test("already installed: nothing is written", () => {
  installHooks(source, dir, now);
  const before = readFileSync(settingsPath, "utf8");
  // A hand-written entry with another path and options counts too.
  const settings = readSettings();
  settings.hooks.Stop = [{ hooks: [{ command: "pwsh -File D:/elsewhere/session-status.ps1" }] }];
  writeFileSync(settingsPath, JSON.stringify(settings));
  const changed = readFileSync(settingsPath, "utf8");
  assert.notEqual(changed, before);
  const result = installHooks(source, dir, now);
  assert.deepEqual(result, { copied: false, addedEvents: [] });
  assert.equal(readFileSync(settingsPath, "utf8"), changed);
  assert.equal(existsSync(`${settingsPath}.before-session-inbox`), false);
});

void test("invalid settings.json is refused and nothing is written", () => {
  for (const text of ["{ \"hooks\": { ", "[1, 2]", '{ "hooks": [] }', '{ "hooks": { "Stop": {} } }']) {
    writeFileSync(settingsPath, text);
    assert.throws(() => installHooks(source, dir, now), /left as it is/);
    assert.equal(readFileSync(settingsPath, "utf8"), text);
    assert.equal(existsSync(join(dir, "hooks")), false);
  }
});

void test("a hook that differs is backed up, then replaced", () => {
  mkdirSync(join(dir, "hooks"));
  writeFileSync(hookPath, "# an older hook\n");
  assert.equal(checkHooks(source, dir).file, "differs");
  const result = installHooks(source, dir, now);
  assert.equal(result.copied, true);
  assert.equal(result.hookBackup, join(dir, "hooks", "backups", "session-status.ps1.before-install-2026-11-02T140500"));
  assert.equal(readFileSync(result.hookBackup, "utf8"), "# an older hook\n");
  assert.ok(readFileSync(source).equals(readFileSync(hookPath)));
  assert.deepEqual(readdirSync(join(dir, "hooks", "backups")).length, 1);

  // Another replace in the same second keeps the first backup.
  writeFileSync(hookPath, "# another hook\n");
  assert.equal(installHooks(source, dir, now).hookBackup, `${result.hookBackup}-2`);
  assert.equal(readFileSync(result.hookBackup, "utf8"), "# an older hook\n");
});

void test("a hook that differs only in line endings counts as installed", () => {
  mkdirSync(join(dir, "hooks"));
  const text = readFileSync(source, "utf8").replace(/\r?\n/g, "\r\n");
  writeFileSync(hookPath, text);
  assert.equal(checkHooks(source, dir).file, "ok");
  assert.equal(installHooks(source, dir, now).copied, false);
  assert.equal(readFileSync(hookPath, "utf8"), text);
});

void test("a settings.json with a byte-order mark is read", () => {
  writeFileSync(settingsPath, '\uFEFF{ "model": "opus" }');
  assert.deepEqual(installHooks(source, dir, now).addedEvents, [...hookEvents]);
  assert.equal(readSettings().model, "opus");
});

void test("checkHooks and describeProblem report what's missing", () => {
  assert.deepEqual(checkHooks(source, dir), { file: "missing", missingEvents: [...hookEvents] });
  writeFileSync(settingsPath, "not json");
  assert.deepEqual(checkHooks(source, dir), { file: "missing", missingEvents: [] });
  assert.equal(describeProblem({ file: "ok", missingEvents: [] }), undefined);
  assert.equal(
    describeProblem({ file: "differs", missingEvents: ["Stop", "SessionEnd"] }),
    "Session Inbox: the status hook in ~/.claude/hooks/ differs from this extension's version; " +
      "~/.claude/settings.json doesn't run it for Stop, SessionEnd.",
  );
  assert.match(describeProblem({ file: "missing", missingEvents: [] }) ?? "", /isn't in ~\/\.claude\/hooks\//);
});

void test("hookVersion changes with the hook's contents", () => {
  const other = join(dir, "other.ps1");
  writeFileSync(other, "# other\n");
  assert.equal(hookVersion(source), hookVersion(source));
  assert.notEqual(hookVersion(source), hookVersion(other));
});
