import { existsSync } from "node:fs";
import * as vscode from "vscode";
import { holdsFolder, readRevealRequest, shouldReveal, writeRevealRequest } from "./reveal.ts";
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
    source.onChange(revealRequests(statusDir())),
    source,
    sidebar,
  );
}

function workspaceFolders(): string[] {
  return (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
}

// Shows a chat's tab when a click elsewhere (a popup, another window's sidebar) asks this window to.
// Runs on every read of the status folder, which holds the request file: so on its change, and at
// startup for a window the click has just opened.
function revealRequests(dir: string): () => void {
  // Every status file change and the periodic re-read run this too; each request is shown once.
  let handled = "";
  const check = async () => {
    const request = await readRevealRequest(dir);
    if (!request || !shouldReveal(request, workspaceFolders(), Date.now())) return;
    const key = `${request.session_id}@${request.at}`;
    if (key === handled) return;
    handled = key;
    await revealTab(request.session_id);
  };
  return () => void check();
}

// Claude Code's own command (internal, docs/research/claude-tabs.md): brings the chat's tab to the
// front, or opens the chat in a new tab. False if it's gone or fails; the window is shown anyway.
async function revealTab(sessionId: string): Promise<boolean> {
  try {
    await vscode.commands.executeCommand("claude-vscode.primaryEditor.open", sessionId);
    return true;
  } catch (error) {
    console.error("Session Inbox: couldn't show the chat's Claude tab", error);
    return false;
  }
}

// A row click. A chat in this window: its tab comes up. Otherwise VS Code focuses the window that
// already has the folder open, or opens a new one (docs/decisions.md 2026-11-01; the click lets VS
// Code take the foreground, so no Windows tricks), and that window shows the tab (revealRequests).
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
  if (holdsFolder(workspaceFolders(), folder)) {
    // The window is already up, so a failure would look like a click that does nothing.
    if (!(await revealTab(status.session_id))) {
      void vscode.window.showWarningMessage("Couldn't show this chat's Claude tab (is Claude Code installed and up to date?).");
    }
    return;
  }
  // Before opening the folder, so a window that starts up for it finds the request.
  await writeRevealRequest(statusDir(), { session_id: status.session_id, project_dir: folder, at: Date.now() }).catch(
    (error: unknown) => console.error("Session Inbox: couldn't write the reveal request", error),
  );
  try {
    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(folder), { forceNewWindow: true });
  } catch (error) {
    void vscode.window.showErrorMessage(`Couldn't open ${folder}: ${String(error)}`);
  }
}
