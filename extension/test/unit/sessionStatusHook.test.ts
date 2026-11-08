// Runs the status-writer hook (hooks/session-status.ps1) on fake payloads, with USERPROFILE pointed
// at a temp folder, and checks the status file it writes. Windows only (Windows PowerShell 5.1).
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, suite, test } from "node:test";
import { promisify } from "node:util";

const script = join(import.meta.dirname, "..", "..", "..", "hooks", "session-status.ps1");
const skip = process.platform !== "win32" && "Windows PowerShell only";

let home: string;

before(() => {
  home = mkdtempSync(join(tmpdir(), "session-inbox-unit-"));
});

after(() => {
  rmSync(home, { recursive: true, force: true });
});

// Pipes `payload` into the hook and returns the status file it wrote for `id`.
async function runHook(id: string, payload: object): Promise<Record<string, unknown>> {
  const run = promisify(execFile)("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script], {
    env: { ...process.env, USERPROFILE: home, CLAUDE_PROJECT_DIR: "C:/projects/demo" },
    timeout: 15_000,
  });
  run.child.stdin?.end(JSON.stringify({ session_id: id, cwd: "C:\\projects\\demo", ...payload }));
  await run;
  return JSON.parse(readFileSync(join(home, ".claude", "session-status", `${id}.json`), "utf8")) as Record<string, unknown>;
}

// One transcript line as Claude Code writes it (JSON Lines, keys in this order).
function toolResult(id: string, content: string, asList = false): string {
  const body = asList ? [{ type: "text", text: content }] : content;
  return JSON.stringify({ type: "user", message: { role: "user", content: [{ tool_use_id: id, type: "tool_result", content: body }] } });
}

function endNotice(taskId: string, toolUseId: string): string {
  const notice = `<task-notification>\n<task-id>${taskId}</task-id>\n<tool-use-id>${toolUseId}</tool-use-id>\n<output-file>C:\\t\\${taskId}.output</output-file>\n<status>completed</status>\n</task-notification>`;
  return JSON.stringify({ type: "user", message: { role: "user", content: notice } });
}

function taskStop(taskId: string): string {
  const call = { type: "tool_use", id: `toolu_stop_${taskId}`, name: "TaskStop", input: { task_id: taskId } };
  return JSON.stringify({ type: "assistant", message: { role: "assistant", content: [call] } });
}

// The start of an agent's launch text as measured (2026-11-05); its id comes after a sentence.
const agentLaunch = (id: string) =>
  `Async agent launched successfully. (This tool result is internal metadata — never quote or paste any part of it, including the agentId below, into a user-facing reply.)\nagentId: ${id} (internal ID - do not mention to user. Use SendMessage with to: '${id}', summary: "<5-10 word recap>" to continue this agent.)`;

// Each test starts powershell.exe (~0.5 s), so they run side by side.
void suite("status-writer hook", { skip, concurrency: true }, () => {
  void test("Stop counts the background tasks that started and haven't ended", async () => {
    const transcript = join(home, "transcript.jsonl");
    const lines = [
      toolResult("toolu_bash", "Command running in background with ID: b1. Output is being written to: C:\\t\\b1.output"),
      toolResult("toolu_agent", agentLaunch("a1f2"), true), // agents run in the background with no flag
      toolResult("toolu_monitor", "Monitor started (task b3, expires in 10m unless the source ends)"),
      toolResult("toolu_vrtx_ps", "Command running in background with ID: b4. Output is being written to: x"),
      toolResult("toolu_server", "Command running in background with ID: b6. Output is being written to: x"),
      toolResult("toolu_fg", "Exit code 0"),
      // Launch and stop texts quoted inside another tool's output (a grep of a transcript): escaped.
      toolResult("toolu_grep", toolResult("toolu_quoted", "Command running in background with ID: b5.")),
      toolResult("toolu_grep2", taskStop("b3")),
      endNotice("b1", "toolu_bash"),
      endNotice("b4", "toolu_vrtx_ps"),
      taskStop("b6"), // stopped: no notification follows
    ];
    writeFileSync(transcript, lines.join("\n") + "\n");
    const status = await runHook("stop", { hook_event_name: "Stop", last_assistant_message: "Tests run in the background.", transcript_path: transcript });
    assert.equal(status.state, "done");
    assert.equal(status.message, "Tests run in the background.");
    assert.equal(status.background, 2, "the agent and the monitor");
  });

  void test("Stop with no readable transcript, and every other event, writes background 0", async () => {
    const missing = await runHook("missing", { hook_event_name: "Stop", last_assistant_message: "Done.", transcript_path: join(home, "nope.jsonl") });
    assert.equal(missing.background, 0);
    const none = await runHook("none", { hook_event_name: "Stop", last_assistant_message: "Done." });
    assert.equal(none.background, 0);
    const working = await runHook("working", { hook_event_name: "PostToolUse", tool_name: "Bash" });
    assert.deepEqual([working.state, working.background], ["working", 0]);
  });
});
