// The sidebar: every running session in one tree, grouped by state or by project (sessionList.ts),
// and a badge on the Activity Bar icon with the waiting + done count. A title-bar button switches
// the grouping; the choice is kept in `globalState`, so other windows pick it up when they reload.
import * as vscode from "vscode";
import {
  groupSessions,
  rowLabel,
  sessionDescription,
  sessionTooltip,
  type GroupBy,
  type SessionGroup,
} from "./sessionList.ts";
import { countStates, summarize, type SessionState, type SessionStatus } from "./statusFolder.ts";

// Each node keeps the grouping it was built under, so a node VS Code still holds from before a
// switch is drawn the way it was built.
type Node =
  | { kind: "group"; group: SessionGroup; by: GroupBy }
  | { kind: "session"; status: SessionStatus; by: GroupBy };

// Theme colours, so they suit light and dark themes.
const colors: Record<SessionState, vscode.ThemeColor> = {
  waiting: new vscode.ThemeColor("list.warningForeground"),
  done: new vscode.ThemeColor("charts.green"),
  working: new vscode.ThemeColor("charts.blue"),
};
const icons: Record<SessionState, vscode.ThemeIcon> = {
  waiting: new vscode.ThemeIcon("warning", colors.waiting),
  done: new vscode.ThemeIcon("check", colors.done),
  working: new vscode.ThemeIcon("loading~spin", colors.working),
};
// Most urgent first: a project header's folder takes the colour of the first state it holds.
const urgency: readonly SessionState[] = ["waiting", "done", "working"];

const groupByKey = "sessionInbox.groupBy";

export class Sidebar implements vscode.TreeDataProvider<Node>, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private readonly view: vscode.TreeView<Node>;
  private statuses: readonly SessionStatus[] = [];
  private groups: SessionGroup[] = [];
  private groupBy: GroupBy;
  // The time the ages are measured against, set per update so all rows agree.
  private now = Date.now();
  private disposed = false;

  private readonly state: vscode.Memento;

  // `state` is `ExtensionContext.globalState`; anything but "project" there counts as "state".
  constructor(viewId: string, state: vscode.Memento) {
    this.state = state;
    this.groupBy = state.get(groupByKey) === "project" ? "project" : "state";
    this.view = vscode.window.createTreeView(viewId, { treeDataProvider: this });
    void this.showGroupBy();
  }

  // Regroups the rows at once and saves the choice; the button swaps through the context key.
  async setGroupBy(groupBy: GroupBy): Promise<void> {
    if (this.disposed) return;
    this.groupBy = groupBy;
    this.regroup();
    await Promise.all([this.state.update(groupByKey, groupBy), this.showGroupBy()]);
  }

  private async showGroupBy(): Promise<void> {
    await vscode.commands.executeCommand("setContext", groupByKey, this.groupBy);
  }

  private regroup(): void {
    this.groups = groupSessions(this.statuses, this.groupBy);
    this.changed.fire(undefined);
  }

  // Called with every read, including the 30 s tick that moves the age text on.
  update(statuses: readonly SessionStatus[]): void {
    // A read that finishes during shutdown must not touch a disposed view.
    if (this.disposed) return;
    this.statuses = statuses;
    this.now = Date.now();
    const { needsYou, headline } = summarize(countStates(statuses));
    this.view.badge = needsYou > 0 ? { value: needsYou, tooltip: headline } : undefined;
    this.regroup();
  }

  getChildren(node?: Node): Node[] {
    if (!node) return this.groups.map((group) => ({ kind: "group", group, by: this.groupBy }));
    if (node.kind === "group") return node.group.sessions.map((status) => ({ kind: "session", status, by: node.by }));
    return [];
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === "group") {
      const item = new vscode.TreeItem(node.group.label, vscode.TreeItemCollapsibleState.Expanded);
      item.id = node.group.id;
      item.description = node.group.description;
      if (node.by === "project") {
        const top = urgency.find((state) => node.group.sessions.some((s) => s.state === state));
        item.iconPath = new vscode.ThemeIcon("folder", top && colors[top]);
      }
      return item;
    }
    const { status } = node;
    const item = new vscode.TreeItem(rowLabel(status, node.by), vscode.TreeItemCollapsibleState.None);
    // No id: VS Code rejects duplicate ids, and two files can hold the same session_id.
    item.iconPath = icons[status.state];
    item.description = sessionDescription(status, this.now);
    item.tooltip = sessionTooltip(status, this.now);
    item.command = { command: "sessionInbox.openSession", title: "Open window", arguments: [status] };
    return item;
  }

  dispose(): void {
    this.disposed = true;
    this.view.dispose();
    this.changed.dispose();
  }
}
