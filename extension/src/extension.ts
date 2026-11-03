import { existsSync } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import { checkHooks, describeProblem, hookVersion, installHooks } from "./installHooks.ts";
import { dueReminders, notifyScript, reminderPayload, sendReminder } from "./renotify.ts";
import { holdsFolder, readRevealRequest, shouldReveal, writeRevealRequest } from "./reveal.ts";
import { SessionSource } from "./sessionSource.ts";
import { sessionFolder } from "./sessionList.ts";
import { pickProjectIcon, setProjectIcon, Sidebar, type Node } from "./sidebar.ts";
import { countStates, sessionsDir, statusDir, summarize, type SessionStatus } from "./statusFolder.ts";
import { startTray, stopTray } from "./tray.ts";

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
    vscode.commands.registerCommand("sessionInbox.setProjectIcon", pickProjectIcon),
    vscode.commands.registerCommand("sessionInbox.resetProjectIcon", (node?: Node) =>
      node?.kind === "group" ? setProjectIcon(node.group.label, undefined) : undefined,
    ),
    vscode.commands.registerCommand("sessionInbox.installHooks", () => runInstall(bundledHook(context))),
  );
  warnAboutHooks(context);
  trayIcon(context);

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
    source.onChange(reminders()),
    source,
    sidebar,
  );
}

// Copied into dist/ by the build (package.json "bundle") from the repo's hooks/session-status.ps1.
function bundledHook(context: vscode.ExtensionContext): string {
  return join(context.extensionPath, "dist", "session-status.ps1");
}

// Starts the tray indicator at startup and when the setting is turned on; closes it when it's turned
// off. Windows only: the tray is a WinForms script.
function trayIcon(context: vscode.ExtensionContext): void {
  if (process.platform !== "win32") return;
  const script = join(context.extensionPath, "dist", "session-tray.ps1");
  const enabled = () => vscode.workspace.getConfiguration("sessionInbox").get<boolean>("trayIcon", false);
  if (enabled()) startTray(script, process.ppid);
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("sessionInbox.trayIcon")) return;
      if (enabled()) startTray(script, process.ppid);
      else stopTray(script);
    }),
  );
}

const hooksDismissedKey = "hooksDismissedVersion";

// One warning per window at startup when the hook is missing, differs, or isn't in settings.json.
// "Don't ask again" holds for this bundled hook only: a new version asks again.
function warnAboutHooks(context: vscode.ExtensionContext): void {
  const source = bundledHook(context);
  let problem: string | undefined;
  let version = "";
  try {
    problem = describeProblem(checkHooks(source));
    if (problem) version = hookVersion(source);
  } catch (error) {
    console.error("Session Inbox: couldn't check the hooks", error);
    return;
  }
  if (!problem || context.globalState.get(hooksDismissedKey) === version) return;
  void vscode.window.showWarningMessage(problem, "Install Hooks", "Don't ask again").then((choice) => {
    if (choice === "Install Hooks") void runInstall(source);
    if (choice === "Don't ask again") void context.globalState.update(hooksDismissedKey, version);
  });
}

async function runInstall(source: string): Promise<void> {
  try {
    const result = installHooks(source);
    if (!result.copied && result.addedEvents.length === 0) {
      void vscode.window.showInformationMessage("Session Inbox: the hooks are already installed.");
      return;
    }
    const done: string[] = [];
    if (result.copied) done.push("copied the status hook to ~/.claude/hooks/");
    if (result.addedEvents.length > 0) done.push(`added it to ${result.addedEvents.join(", ")} in settings.json`);
    const backups = [result.hookBackup, result.settingsBackup].filter((path) => path !== undefined);
    // Claude Code reads hooks in settings.json when a chat starts.
    const restart = result.addedEvents.length > 0 ? " New chats use it; restart chats already running." : "";
    await vscode.window.showInformationMessage(
      `Session Inbox: ${done.join(" and ")}.${restart}${backups.length > 0 ? ` Backup: ${backups.join(", ")}` : ""}`,
    );
  } catch (error) {
    void vscode.window.showErrorMessage(`Session Inbox: couldn't install the hooks: ${error instanceof Error ? error.message : String(error)}`);
  }
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

// A chat that has waited past sessionInbox.renotifyMinutes gets one more popup (renotify.ts). Runs on
// every read, so also on the 30 s re-read: a reminder comes at most that much late. Only the window
// that has the chat's folder open sends it, so several windows don't each send one. What was sent is
// kept in memory: after a reload, a chat already past the threshold is reminded once more.
function reminders(): (statuses: readonly SessionStatus[]) => void {
  const sent = new Set<string>();
  return (statuses) => {
    // notify.ps1 shows nothing while this window has focus; held back instead, the reminder comes
    // on the first read after you leave the window without acting.
    // SESSION_INBOX_IGNORE_FOCUS is for the GUI test only: its window can't lose focus.
    if (vscode.window.state.focused && !process.env.SESSION_INBOX_IGNORE_FOCUS) return;
    // Off: nothing else to do on this hot path (it runs on every tool call of every chat).
    const minutes = vscode.workspace.getConfiguration("sessionInbox").get<number>("renotifyMinutes", 10);
    if (!(minutes > 0)) return;
    const folders = workspaceFolders();
    const folderOf = new Map<SessionStatus, string>();
    for (const status of statuses) {
      const folder = sessionFolder(status);
      if (folder !== undefined && holdsFolder(folders, folder)) folderOf.set(status, folder);
    }
    const now = Date.now();
    const script = notifyScript();
    for (const status of dueReminders([...folderOf.keys()], now, minutes, sent)) {
      const folder = folderOf.get(status) ?? "";
      if (!sendReminder(script, reminderPayload(status, folder, now), folder)) {
        console.error(`Session Inbox: no reminder, ${script} not found`);
      }
    }
  };
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
