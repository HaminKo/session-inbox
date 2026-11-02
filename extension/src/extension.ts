import { existsSync } from "node:fs";
import * as vscode from "vscode";
import { SessionSource } from "./sessionSource.ts";
import { sessionFolder } from "./sessionList.ts";
import { Sidebar } from "./sidebar.ts";
import { countStates, sessionsDir, statusDir, summarize, type SessionStatus } from "./statusFolder.ts";

export function activate(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.name = "Session Inbox";
  item.command = "workbench.view.extension.sessionInbox";
  context.subscriptions.push(item);

  const sidebar = new Sidebar("sessionInbox.sessions", context.globalState);
  context.subscriptions.push(
    vscode.commands.registerCommand("sessionInbox.groupByProject", () => sidebar.setGroupBy("project")),
    vscode.commands.registerCommand("sessionInbox.groupByState", () => sidebar.setGroupBy("state")),
    vscode.commands.registerCommand("sessionInbox.openSession", openSession),
  );

  const source = new SessionSource(statusDir(), sessionsDir());
  context.subscriptions.push(
    source.onChange((statuses) => {
      const { needsYou, text, tooltip } = summarize(countStates(statuses));
      item.text = text;
      item.tooltip = tooltip;
      item.backgroundColor = needsYou > 0 ? new vscode.ThemeColor("statusBarItem.warningBackground") : undefined;
      item.show();
    }),
    source.onChange((statuses) => sidebar.update(statuses)),
    source,
    sidebar,
  );
}

// A row click. VS Code focuses the window that already has the folder open, or opens a new one
// (docs/decisions.md 2026-11-01); the click lets VS Code take the foreground, so no Windows tricks.
// `status` is undefined when the command is run some other way (it's hidden from the palette).
async function openSession(status?: SessionStatus): Promise<void> {
  if (!status) return;
  const folder = sessionFolder(status);
  if (!folder) {
    void vscode.window.showInformationMessage("Folder not known yet; it updates on the session's next step.");
    return;
  }
  // A deleted folder (a removed worktree) would open an empty window with an error in it.
  if (!existsSync(folder)) {
    void vscode.window.showWarningMessage(`Folder not found: ${folder}`);
    return;
  }
  try {
    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(folder), { forceNewWindow: true });
  } catch (error) {
    void vscode.window.showErrorMessage(`Couldn't open ${folder}: ${String(error)}`);
  }
}
