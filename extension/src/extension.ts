import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  // Placeholder until the status bar reads real counts from the status folder (to-do #4).
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.text = "$(inbox) Session Inbox";
  item.tooltip = "Session Inbox (placeholder)";
  item.show();
  context.subscriptions.push(item);
}
