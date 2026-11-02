import * as vscode from "vscode";
import { SessionSource } from "./sessionSource.ts";
import { Sidebar } from "./sidebar.ts";
import { countStates, sessionsDir, statusDir, summarize } from "./statusFolder.ts";

export function activate(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.name = "Session Inbox";
  context.subscriptions.push(item);

  const sidebar = new Sidebar("sessionInbox.sessions");

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
