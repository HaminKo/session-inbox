// Setting a project's status by hand (to-do #28): right-click "Set Project Status…" / "Clear
// Project Status" in the sidebar, and the palette's "Set Status of This Project…" for the window's
// own folder, so a project with no chat open can get one. Stored in `sessionInbox.projects`.
import { basename } from "node:path";
import * as vscode from "vscode";
import {
  projectStatus,
  projectStatusColor,
  statusChoices,
  statusColorChoices,
  withStatus,
  withStatusColor,
} from "./projectLook.ts";
import { projectLooks, updateProjects } from "./projectSetting.ts";
import { groupFolder, sessionFolder, sessionLabel } from "./sessionList.ts";
import type { Node } from "./sidebar.ts";

// A project as the sidebar names it (the folder leaf), and its folder when known.
interface Project {
  label: string;
  folder: string | undefined;
}

// The project a right-clicked row stands for: a project header, a session row grouped by state, or
// a closed project's row. Undefined for other rows, or when the command is run some other way.
function projectOf(node: Node | undefined): Project | undefined {
  switch (node?.kind) {
    case "group":
      return node.by === "project" ? { label: node.group.label, folder: groupFolder(node.group) } : undefined;
    case "session":
      return { label: sessionLabel(node.status), folder: sessionFolder(node.status) };
    case "closed":
      return { label: node.project.label, folder: node.project.folder };
    default:
      return undefined;
  }
}

export async function pickProjectStatus(node?: Node): Promise<void> {
  const project = projectOf(node);
  if (project) await pickStatus(project);
}

export async function clearProjectStatus(node?: Node): Promise<void> {
  const project = projectOf(node);
  if (project) await saveStatus(project.label, undefined, undefined);
}

// Right-click "Set Status Color…" (only on a row whose project has a status): a pick of colour
// names for the label, saved for this project. Names only: the pick draws an icon's colour grey
// (measured in VS Code 1.144), so coloured dots would all look the same.
export async function pickProjectStatusColor(node?: Node): Promise<void> {
  const project = projectOf(node);
  if (!project) return;
  const current = projectStatusColor(projectLooks(), project.label);
  type ColorItem = vscode.QuickPickItem & { color?: string };
  const choices: ColorItem[] = statusColorChoices.map(({ name, color }) => ({ label: name, color }));
  // The current one on top, so Enter or Escape right away changes nothing; one typed into
  // settings.json by hand is shown by its id.
  const currentItem = choices.find((item) => item.color === current) ?? (current ? { label: current, color: current } : undefined);
  const items: ColorItem[] = [
    ...(currentItem ? [{ ...currentItem, description: "current" }] : []),
    ...choices.filter((item) => item.color !== current),
    ...(current ? [{ label: "No color" }] : []),
  ];
  const picked = await vscode.window.showQuickPick(items, {
    title: `Status color for ${project.label}`,
    placeHolder: "Any other theme color id can be set in settings.json",
  });
  if (picked) await updateProjects((looks) => withStatusColor(looks, project.label, picked.color), "the color");
}

// The palette command: the window's folder, or a pick when it has several.
export async function pickWindowProjectStatus(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    void vscode.window.showInformationMessage("Open the project's folder first; its status is saved for that folder.");
    return;
  }
  const folder = folders.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick({ placeHolder: "Which project?" });
  if (!folder) return;
  // The leaf, as the hooks name a project (its start folder), not the workspace's display name.
  const label = basename(folder.uri.fsPath);
  if (label) await pickStatus({ label, folder: folder.uri.fsPath });
  else void vscode.window.showInformationMessage("A drive's root folder has no project name to save a status under.");
}

type StatusItem = vscode.QuickPickItem & { action?: "type" | "clear" };

// A pick of the current status and the presets, "Type your own…" (an input box), and "Clear
// status" when one is set. Two steps for your own text: a pick that also took typed text would put
// it above a preset it partly matches (VS Code sorts by match; `sortByLabel` is not public API), so
// "on h" + Enter would save "on h".
async function pickStatus(project: Project): Promise<void> {
  const current = projectStatus(projectLooks(), project.label);
  const title = `Status for ${project.label}`;
  // The current one on top, so Enter or Escape right away changes nothing.
  const items: StatusItem[] = [
    ...(current ? [{ label: current, description: "current" }] : []),
    ...statusChoices.filter((choice) => choice.toLowerCase() !== current?.toLowerCase()).map((label) => ({ label })),
    { label: "$(edit) Type your own…", action: "type" },
    ...(current ? [{ label: "$(close) Clear status", action: "clear" as const }] : []),
  ];
  const picked = await vscode.window.showQuickPick(items, { title, placeHolder: "The project counts as parked" });
  if (!picked) return;
  let status: string | undefined = picked.label;
  if (picked.action === "clear") status = undefined;
  if (picked.action === "type") {
    const typed = await vscode.window.showInputBox({
      title,
      value: current,
      placeHolder: "e.g. Come back later: the login bug",
      prompt: "Any text; shown next to the project",
      validateInput: (value) => (value.trim() ? undefined : "Type a status, or pick Clear status instead."),
    });
    if (!typed?.trim()) return;
    status = typed.trim();
  }
  // The current one is saved again too: that also saves a folder it was missing.
  await saveStatus(project.label, status, project.folder);
}

async function saveStatus(label: string, status: string | undefined, folder: string | undefined): Promise<void> {
  await updateProjects((looks) => withStatus(looks, label, status, folder), "the status");
}
