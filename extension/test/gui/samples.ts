// Sample status files in the format hooks/session-status.ps1 writes, for the GUI test and the
// screenshots.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export function writeSampleStatus(dir: string, id: string, state: "waiting" | "done" | "working"): void {
  const status = {
    session_id: id,
    cwd: `C:/projects/demo-${id}`,
    folder: `demo-${id}`,
    worktree: false,
    worktree_name: `demo-${id}`,
    state,
    message: state === "waiting" ? "Needs permission to use Bash" : state === "done" ? "Finished" : "",
    tool_name: state === "waiting" ? "Bash" : null,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(join(dir, `${id}.json`), JSON.stringify(status));
}
