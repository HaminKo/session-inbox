// The user setting `sessionInbox.projects` (projectLook.ts reads its entries): read it, and write
// it back with one change. A user setting, so every window sees a change at once
// (`onDidChangeConfiguration`) and it outlives the windows (docs/decisions.md 2026-11-02).
import * as vscode from "vscode";

const section = "sessionInbox";
const key = "projects";
// For `ConfigurationChangeEvent.affectsConfiguration`.
export const projectsSetting = `${section}.${key}`;

export function projectLooks(): unknown {
  return vscode.workspace.getConfiguration(section).get(key);
}

// Writes `change(current setting)`; `what` names it in the error, e.g. "the icon".
export async function updateProjects(change: (looks: unknown) => Record<string, unknown>, what: string): Promise<void> {
  const config = vscode.workspace.getConfiguration(section);
  try {
    await config.update(key, change(config.get(key)), vscode.ConfigurationTarget.Global);
  } catch (error) {
    // E.g. settings.json has a syntax error or unsaved changes.
    void vscode.window.showErrorMessage(`Couldn't save ${what} to your user settings: ${String(error)}`);
  }
}
