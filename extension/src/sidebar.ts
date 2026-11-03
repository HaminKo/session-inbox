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
import { defaultIcon, iconChoices, projectIcon, stateIcons, withIcon } from "./projectLook.ts";
import { countStates, summarize, type SessionState, type SessionStatus } from "./statusFolder.ts";

// Each node keeps the grouping it was built under, so a node VS Code still holds from before a
// switch is drawn the way it was built.
export type Node =
  | { kind: "group"; group: SessionGroup; by: GroupBy }
  | { kind: "session"; status: SessionStatus; by: GroupBy };

// Theme colours, so they suit light and dark themes.
const colors: Record<SessionState, vscode.ThemeColor> = {
  waiting: new vscode.ThemeColor("list.warningForeground"),
  done: new vscode.ThemeColor("charts.green"),
  working: new vscode.ThemeColor("charts.blue"),
  open: new vscode.ThemeColor("descriptionForeground"),
};
const icons: Record<SessionState, vscode.ThemeIcon> = {
  waiting: new vscode.ThemeIcon(stateIcons.waiting, colors.waiting),
  done: new vscode.ThemeIcon(stateIcons.done, colors.done),
  working: new vscode.ThemeIcon("loading~spin", colors.working),
  open: new vscode.ThemeIcon("circle-outline", colors.open),
};
// Most urgent first: a project header's folder takes the colour of the first state it holds.
const urgency: readonly SessionState[] = ["waiting", "done", "working", "open"];
// Starts collapsed: the least urgent group, and after a VS Code restart it can hold every chat.
// VS Code keeps it open once expanded, as the group's id doesn't change.
const collapsedGroups: readonly string[] = ["state:open"];

const groupByKey = "sessionInbox.groupBy";
const projectsKey = "projects";

function projectLooks(): unknown {
  return vscode.workspace.getConfiguration("sessionInbox").get(projectsKey);
}

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
  // The `sessionInbox.projects` setting, re-read when it changes (in any window: settings are shared).
  private looks = projectLooks();
  private readonly configListener: vscode.Disposable;

  private readonly state: vscode.Memento;

  // `state` is `ExtensionContext.globalState`; anything but "project" there counts as "state".
  constructor(viewId: string, state: vscode.Memento) {
    this.state = state;
    this.groupBy = state.get(groupByKey) === "project" ? "project" : "state";
    this.view = vscode.window.createTreeView(viewId, { treeDataProvider: this });
    this.configListener = vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration(`sessionInbox.${projectsKey}`)) return;
      this.looks = projectLooks();
      this.changed.fire(undefined);
    });
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
      const item = new vscode.TreeItem(
        node.group.label,
        collapsedGroups.includes(node.group.id)
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.Expanded,
      );
      item.id = node.group.id;
      item.description = node.group.description;
      if (node.by === "project") {
        const top = urgency.find((state) => node.group.sessions.some((s) => s.state === state));
        item.iconPath = new vscode.ThemeIcon(projectIcon(this.looks, node.group.label), top && colors[top]);
        // Shows "Set Icon…" and "Reset Icon" on right-click (package.json, view/item/context).
        item.contextValue = "project";
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
    this.configListener.dispose();
    this.view.dispose();
    this.changed.dispose();
  }
}

// Right-click "Set Icon…" on a project header: a pick of icons, written to the user setting.
// `node` is undefined when the command is run some other way (it's hidden from the palette).
export async function pickProjectIcon(node?: Node): Promise<void> {
  if (node?.kind !== "group") return;
  const { label } = node.group;
  const current = projectIcon(projectLooks(), label);
  // The current icon on top, so Enter or Escape right away changes nothing.
  const choices = [current, ...iconChoices.filter((icon) => icon !== current)];
  const picked = await vscode.window.showQuickPick(
    choices.map((icon) => ({ label: `$(${icon}) ${icon}`, icon, description: icon === current ? "current" : "" })),
    { title: `Icon for ${label}`, placeHolder: "Any other codicon name can be set in settings.json" },
  );
  // The folder is the default, so picking it is a reset (no entry left behind).
  if (picked) await setProjectIcon(label, picked.icon === defaultIcon ? undefined : picked.icon);
}

// Right-click "Reset Icon": back to the folder. Also used by pickProjectIcon.
export async function setProjectIcon(label: string, icon: string | undefined): Promise<void> {
  const config = vscode.workspace.getConfiguration("sessionInbox");
  try {
    await config.update(projectsKey, withIcon(config.get(projectsKey), label, icon), vscode.ConfigurationTarget.Global);
  } catch (error) {
    // E.g. settings.json has a syntax error or unsaved changes.
    void vscode.window.showErrorMessage(`Couldn't save the icon to your user settings: ${String(error)}`);
  }
}
