import * as vscode from "vscode";
import {
  countStates,
  onlyLive,
  readLiveSessionIds,
  readStatuses,
  sessionsDir,
  statusDir,
  summarize,
  watchFolder,
} from "./statusFolder.ts";

export function activate(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.name = "Session Inbox";
  context.subscriptions.push(item);

  const dir = statusDir();
  const sessions = sessionsDir();
  // Reads can overlap when events arrive quickly; only the newest one may update the item.
  let latest = 0;
  const refresh = async () => {
    const run = ++latest;
    const [statuses, live] = await Promise.all([readStatuses(dir), readLiveSessionIds(sessions)]);
    if (run !== latest) return;
    const { needsYou, text, tooltip } = summarize(countStates(onlyLive(statuses, live)));
    item.text = text;
    item.tooltip = tooltip;
    item.backgroundColor = needsYou > 0 ? new vscode.ThemeColor("statusBarItem.warningBackground") : undefined;
    item.show();
  };

  void refresh();
  const watcher = watchFolder(dir, () => void refresh());
  // A chat process that exits removes its <pid>.json, so watching that folder drops the count at
  // once. One killed without cleanup changes no file: the timer catches that.
  const sessionsWatcher = watchFolder(sessions, () => void refresh());
  const timer = setInterval(() => void refresh(), 30_000);
  context.subscriptions.push(
    { dispose: watcher.dispose },
    { dispose: sessionsWatcher.dispose },
    { dispose: () => clearInterval(timer) },
  );
}
