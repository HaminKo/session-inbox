// Sample status files in the format hooks/session-status.ps1 writes, and the matching
// ~/.claude/sessions/<pid>.json files Claude Code keeps per running chat, for the GUI test and the
// screenshots.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// `waitedMs` back-dates the timestamp (how long the state has lasted); `worktree` marks a linked worktree;
// `projectDir` sets the folder a row click opens.
export function writeSampleStatus(
  dir: string,
  id: string,
  state: "waiting" | "done" | "working",
  { waitedMs = 0, worktree = false, project = id, projectDir = "" } = {},
): void {
  const status = {
    session_id: id,
    cwd: `C:/projects/demo-${project}`,
    ...(projectDir ? { project_dir: projectDir } : {}),
    folder: `demo-${project}`,
    worktree,
    worktree_name: `demo-${project}`,
    state,
    message: state === "waiting" ? "Needs permission to use Bash" : state === "done" ? "Finished" : "",
    tool_name: state === "waiting" ? "Bash" : null,
    timestamp: new Date(Date.now() - waitedMs).toISOString(),
  };
  writeFileSync(join(dir, `${id}.json`), JSON.stringify(status));
}

// Marks session `id` as running. Several sessions can share `pid` (the test's own, which is alive);
// the file is named after the id so each can be removed on its own. `vscode` makes it a VS Code
// chat (entrypoint, start folder, start time), which the sidebar lists as "Open" while it has no
// status file.
export function writeSampleSession(dir: string, id: string, { pid = process.pid, vscode = false } = {}): void {
  const session = {
    pid,
    sessionId: id,
    kind: "interactive",
    ...(vscode ? { entrypoint: "claude-vscode", cwd: `C:\\projects\\demo-${id}`, startedAt: Date.now() } : {}),
  };
  writeFileSync(join(dir, `${id}.json`), JSON.stringify(session));
}
