// The sidebar: every running session in one tree, grouped by state or by project (sessionList.ts),
// and a badge on the Activity Bar icon with the waiting + done count. A title-bar button switches
// the grouping; the choice is kept in `globalState`, so other windows pick it up when they reload.
// A project with a hand-set status shows it after its name, in its colour, and stays listed as
// "Closed" when no chat of it runs (to-do #28).
import { readFile } from "node:fs/promises";
import * as vscode from "vscode";
import { parseFocus, staleDays, type Focus } from "./focus.ts";
import {
  groupFolder,
  groupSessions,
  rowLabel,
  sessionDescription,
  sessionLabel,
  sessionTooltip,
  type GroupBy,
  type SessionGroup,
} from "./sessionList.ts";
import {
  defaultIcon,
  focusPath,
  iconChoices,
  projectIcon,
  projectStatus,
  projectStatusColor,
  stateIcons,
  statusProjects,
  withIcon,
  type StatusProject,
} from "./projectLook.ts";
import { projectLooks, projectsSetting, updateProjects } from "./projectSetting.ts";
import { countStates, summarize, type SessionState, type SessionStatus } from "./statusFolder.ts";

// Each node keeps the grouping it was built under, so a node VS Code still holds from before a
// switch is drawn the way it was built.
export type Node =
  | { kind: "group"; group: SessionGroup; by: GroupBy }
  | { kind: "session"; status: SessionStatus; by: GroupBy }
  // A project with a status and no chat running: "Closed" under its header, or a row in "Closed".
  | { kind: "closed"; project: StatusProject; by: GroupBy }
  // A project's "Now:" line, the first row under its header (grouped by project only).
  | { kind: "focus"; groupId: string; file: string; focus: Focus };

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
// A focus block older than this gets a note in its hover.
const staleAfterDays = 14;
const closedIcon = new vscode.ThemeIcon("circle-slash", colors.open);
// The made-up URI a row naming a project gets when its status has a colour, so the decoration
// provider below colours its label (the only way to colour a tree row's text).
const decorationScheme = "session-inbox-project";

const groupByKey = "sessionInbox.groupBy";

export class Sidebar implements vscode.TreeDataProvider<Node>, vscode.FileDecorationProvider, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private readonly decorationsChanged = new vscode.EventEmitter<undefined>();
  readonly onDidChangeFileDecorations = this.decorationsChanged.event;
  private readonly decorations: vscode.Disposable;
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
  // The focus files of the projects shown: absolute path → text (undefined when unreadable) and
  // its parsed block. Re-read on every update, which also comes with every hook event and every
  // 30 s (docs/decisions.md).
  private focusFiles = new Map<string, { text: string | undefined; focus: Focus | undefined }>();
  private focusReads = 0;
  // The problem last logged per focus file, so the log gets one line per problem, not per update.
  private readonly reported = new Map<string, string>();
  private log: vscode.LogOutputChannel | undefined;

  private readonly state: vscode.Memento;

  // `state` is `ExtensionContext.globalState`; anything but "project" there counts as "state".
  constructor(viewId: string, state: vscode.Memento) {
    this.state = state;
    this.groupBy = state.get(groupByKey) === "project" ? "project" : "state";
    this.view = vscode.window.createTreeView(viewId, { treeDataProvider: this });
    this.decorations = vscode.window.registerFileDecorationProvider(this);
    this.configListener = vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration(projectsSetting)) return;
      this.looks = projectLooks();
      this.decorationsChanged.fire(undefined);
      this.regroup();
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
    this.groups = groupSessions(this.statuses, this.groupBy, statusProjects(this.looks));
    this.changed.fire(undefined);
    if (this.groupBy === "project") void this.readFocus();
  }

  // A project's focus file (from the setting, or the default) in its folder (groupFolder: a
  // session's, or the one saved with a closed project's status); undefined when turned off or
  // there's no folder.
  private focusPath(group: SessionGroup): { path: string; file: string; set: boolean } | undefined {
    return focusPath(this.looks, group.label, groupFolder(group));
  }

  // Reads every shown project's focus file and redraws when any text changed. A read that an
  // newer one overtook is dropped, so a slow disk can't put old text back.
  private async readFocus(): Promise<void> {
    const read = ++this.focusReads;
    const focusPaths = this.groups.map((group) => this.focusPath(group)).filter((focus) => focus !== undefined);
    const paths = new Set(focusPaths.map((focus) => focus.path));
    // Only a path typed by hand logs; a default file without the block is a project that has none yet.
    const setPaths = new Set(focusPaths.filter((focus) => focus.set).map((focus) => focus.path));
    const texts = new Map(
      await Promise.all(
        [...paths].map(async (path) => [path, await readFile(path, "utf8").catch(() => undefined)] as const),
      ),
    );
    if (this.disposed || read !== this.focusReads) return;
    const changed =
      texts.size !== this.focusFiles.size ||
      [...texts].some(([path, text]) => !this.focusFiles.has(path) || this.focusFiles.get(path)?.text !== text);
    if (changed) {
      this.focusFiles = new Map(
        [...texts].map(([path, text]) => [path, { text, focus: text === undefined ? undefined : parseFocus(text) }]),
      );
    }
    // Checked on every read, not only on a text change: a path can become set by hand while its
    // text stays the same. A path no longer set forgets its problem, so setting it again logs.
    for (const path of this.reported.keys()) if (!setPaths.has(path)) this.reported.delete(path);
    for (const [path, { text, focus }] of this.focusFiles) {
      if (setPaths.has(path)) this.reportFocus(path, text, focus);
    }
    if (changed) this.changed.fire(undefined);
  }

  // One line in the output channel when a focus file can't be used, again only after it was fixed.
  private reportFocus(path: string, text: string | undefined, focus: Focus | undefined): void {
    const problem =
      text === undefined
        ? "can't be read"
        : !focus
          ? 'has no "## Where we are" section'
          : !focus.now
            ? 'has no "Now:" line in its "## Where we are" section'
            : undefined;
    if (!problem) {
      this.reported.delete(path);
      return;
    }
    if (this.reported.get(path) === problem) return;
    this.reported.set(path, problem);
    this.log ??= vscode.window.createOutputChannel("Session Inbox", { log: true });
    this.log.warn(`Focus file ${path} ${problem}, so no focus row is shown.`);
  }

  // The focus row for a project, when its file is read and has a "Now:" line.
  private focusNode(group: SessionGroup): Node | undefined {
    const target = this.focusPath(group);
    const focus = target && this.focusFiles.get(target.path)?.focus;
    return target && focus?.now ? { kind: "focus", groupId: group.id, file: target.file, focus } : undefined;
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
    if (node.kind === "group") {
      const rows: Node[] = [
        ...node.group.sessions.map((status) => ({ kind: "session" as const, status, by: node.by })),
        ...node.group.closed.map((project) => ({ kind: "closed" as const, project, by: node.by })),
      ];
      const focus = node.by === "project" ? this.focusNode(node.group) : undefined;
      return focus ? [focus, ...rows] : rows;
    }
    return [];
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if (node.kind === "focus") return focusItem(node.focus, node.file, node.groupId, this.now);
    if (node.kind === "closed") return this.closedItem(node.project, node.by);
    if (node.kind === "group") {
      const { group } = node;
      const status = node.by === "project" ? projectStatus(this.looks, group.label) : undefined;
      const label = status ? `${group.label} · ${status}` : group.label;
      const item = new vscode.TreeItem(
        label,
        collapsedGroups.includes(group.id) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded,
      );
      item.id = group.id;
      item.description = group.description;
      if (node.by === "project") {
        const top = urgency.find((state) => group.sessions.some((s) => s.state === state));
        this.decorate(item, group.label);
        item.iconPath = new vscode.ThemeIcon(this.iconName(item, projectIcon(this.looks, group.label)), top && colors[top]);
        item.tooltip = [groupFolder(group), status].filter(Boolean).join("\n") || group.label;
        // Shows "Set Icon…", "Reset Icon" and the status commands on right-click (package.json,
        // view/item/context); ".status" adds "Set Status Color…" and "Clear Project Status".
        item.contextValue = status ? "project.status" : "project";
      }
      return item;
    }
    const { status } = node;
    const label = node.by === "state" ? this.withStatus(sessionLabel(status)) : rowLabel(status, node.by);
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    // No id: VS Code rejects duplicate ids, and two files can hold the same session_id.
    item.iconPath = icons[status.state];
    item.description = sessionDescription(status, this.now);
    item.tooltip = sessionTooltip(status, this.now);
    item.command = { command: "sessionInbox.openSession", title: "Open window", arguments: [status] };
    // Grouped by state no header names the project, so the row gets the status commands and colour.
    if (node.by === "state") {
      this.decorate(item, sessionLabel(status));
      item.contextValue = projectStatus(this.looks, sessionLabel(status)) ? "session.status" : "session";
    }
    return item;
  }

  // A closed project's row: "Closed" under its header, or its name in the "Closed" group. A click
  // opens its saved folder (extension.ts, openProject).
  private closedItem(project: StatusProject, by: GroupBy): vscode.TreeItem {
    const item = new vscode.TreeItem(by === "project" ? "Closed" : this.withStatus(project.label), vscode.TreeItemCollapsibleState.None);
    if (by === "state") this.decorate(item, project.label);
    item.iconPath = closedIcon;
    const folder = project.folder ?? "No folder saved: set the status again from the project's window.";
    item.tooltip = `${folder}\n${project.status}`;
    item.command = { command: "sessionInbox.openProject", title: "Open folder", arguments: [{ kind: "closed", project, by }] };
    item.contextValue = "closed.status";
    return item;
  }

  // `PeacefreeWeb · On hold`, or the name alone when the project has no status.
  private withStatus(label: string): string {
    const status = projectStatus(this.looks, label);
    return status ? `${label} · ${status}` : label;
  }

  // Gives a row naming a project the URI its status colour hangs on, when it has one.
  private decorate(item: vscode.TreeItem, label: string): void {
    if (this.statusColor(label)) item.resourceUri = vscode.Uri.from({ scheme: decorationScheme, path: `/${label}` });
  }

  // With a URI, VS Code draws the file icon theme's icon in place of the `folder` and `file`
  // codicons (and without the state colour); `symbol-folder` and `symbol-file` look the same and
  // are kept.
  private iconName(item: vscode.TreeItem, icon: string): string {
    if (!item.resourceUri) return icon;
    return icon === "folder" ? "symbol-folder" : icon === "file" ? "symbol-file" : icon;
  }

  // The colour of a project's status; none without a status (a `statusColor` left alone in
  // settings.json), as then nothing on the row could clear it.
  private statusColor(label: string): string | undefined {
    return projectStatus(this.looks, label) ? projectStatusColor(this.looks, label) : undefined;
  }

  // The colour of a row's label: its project's status colour (decorate).
  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== decorationScheme) return undefined;
    const color = this.statusColor(uri.path.slice(1));
    return color === undefined ? undefined : new vscode.FileDecoration(undefined, undefined, new vscode.ThemeColor(color));
  }

  dispose(): void {
    this.disposed = true;
    this.configListener.dispose();
    this.decorations.dispose();
    this.log?.dispose();
    this.view.dispose();
    this.changed.dispose();
    this.decorationsChanged.dispose();
  }
}

// Not clickable; the hover has the whole block, and a note when "Updated:" is old.
function focusItem(focus: Focus, file: string, groupId: string, now: number): vscode.TreeItem {
  const item = new vscode.TreeItem(focus.now ?? "", vscode.TreeItemCollapsibleState.None);
  item.id = `focus:${groupId}`;
  item.iconPath = new vscode.ThemeIcon("target");
  const tooltip = new vscode.MarkdownString("", true);
  tooltip.appendMarkdown("**Where we are** · ").appendText(file).appendMarkdown(`

${focus.block}`);
  const days = staleDays(focus.updated, new Date(now), staleAfterDays);
  if (days !== undefined) tooltip.appendMarkdown(`

$(warning) Not updated for ${days} days`);
  item.tooltip = tooltip;
  return item;
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
  await updateProjects((looks) => withIcon(looks, label, icon), "the icon");
}
