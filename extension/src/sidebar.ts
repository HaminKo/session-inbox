// The sidebar: every running session in one tree, grouped by state (sessionList.ts), and a badge on
// the Activity Bar icon with the waiting + done count.
import * as vscode from "vscode";
import { groupSessions, sessionDescription, sessionLabel, sessionTooltip, type SessionGroup } from "./sessionList.ts";
import { countStates, summarize, type SessionState, type SessionStatus } from "./statusFolder.ts";

type Node = { kind: "group"; group: SessionGroup } | { kind: "session"; status: SessionStatus };

const icons: Record<SessionState, vscode.ThemeIcon> = {
  waiting: new vscode.ThemeIcon("warning", new vscode.ThemeColor("list.warningForeground")),
  done: new vscode.ThemeIcon("check"),
  working: new vscode.ThemeIcon("loading~spin"),
};

export class Sidebar implements vscode.TreeDataProvider<Node>, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private readonly view: vscode.TreeView<Node>;
  private groups: SessionGroup[] = [];
  // The time the ages are measured against, set per update so all rows agree.
  private now = Date.now();
  private disposed = false;

  constructor(viewId: string) {
    this.view = vscode.window.createTreeView(viewId, { treeDataProvider: this });
  }

  // Called with every read, including the 30 s tick that moves the age text on.
  update(statuses: readonly SessionStatus[]): void {
    // A read that finishes during shutdown must not touch a disposed view.
    if (this.disposed) return;
    this.groups = groupSessions(statuses);
    this.now = Date.now();
    const { needsYou, headline } = summarize(countStates(statuses));
    this.view.badge = needsYou > 0 ? { value: needsYou, tooltip: headline } : undefined;
    this.changed.fire(undefined);
  }

  getChildren(node?: Node): Node[] {
    if (!node) return this.groups.map((group) => ({ kind: "group", group }));
    if (node.kind === "group") return node.group.sessions.map((status) => ({ kind: "session", status }));
    return [];
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === "group") {
      const item = new vscode.TreeItem(node.group.label, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `group:${node.group.state}`;
      return item;
    }
    const { status } = node;
    const item = new vscode.TreeItem(sessionLabel(status), vscode.TreeItemCollapsibleState.None);
    // No id: VS Code rejects duplicate ids, and two files can hold the same session_id.
    item.iconPath = icons[status.state];
    item.description = sessionDescription(status, this.now);
    item.tooltip = sessionTooltip(status, this.now);
    return item;
  }

  dispose(): void {
    this.disposed = true;
    this.view.dispose();
    this.changed.dispose();
  }
}
