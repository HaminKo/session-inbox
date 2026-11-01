import * as vscode from "vscode";
import { countStates, readStatuses, statusDir, summarize, watchFolder } from "./statusFolder.ts";

export function activate(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.name = "Session Inbox";
  context.subscriptions.push(item);

  const dir = statusDir();
  // Reads can overlap when events arrive quickly; only the newest one may update the item.
  let latest = 0;
  const refresh = async () => {
    const run = ++latest;
    const statuses = await readStatuses(dir);
    if (run !== latest) return;
    const { needsYou, text, tooltip } = summarize(countStates(statuses));
    item.text = text;
    item.tooltip = tooltip;
    item.backgroundColor = needsYou > 0 ? new vscode.ThemeColor("statusBarItem.warningBackground") : undefined;
    item.show();
  };

  void refresh();
  const watcher = watchFolder(dir, () => void refresh());
  context.subscriptions.push({ dispose: watcher.dispose });
}
