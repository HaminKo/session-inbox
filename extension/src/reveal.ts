// The hand-off that shows a chat's own Claude tab (docs/research/claude-tabs.md). A click (a
// notify.ps1 popup or a sidebar row) writes <status folder>/.reveal; every window's Session Inbox
// watches that folder, and the window that has the chat's folder open shows the chat's tab. A file,
// not a vscode:// URI: VS Code sends a URI to the focused window, which may be the wrong one. No
// `vscode` import, so the unit tests run in plain Node.
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Not *.json, so readStatuses skips it.
export const revealFile = ".reveal";
// Long enough for a window the click opens to start up and read it.
export const revealMaxAgeMs = 15_000;
// The popup's clock is this machine's too; a little slack for rounding.
const futureSlackMs = 2_000;

export interface RevealRequest {
  session_id: string;
  project_dir: string;
  // Milliseconds since 1970 (Date.now()), when the click happened.
  at: number;
}

export function parseRevealRequest(text: string): RevealRequest | undefined {
  let data: unknown;
  try {
    // A BOM (Windows PowerShell 5.1 writes one with -Encoding UTF8) breaks JSON.parse.
    data = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return undefined;
  }
  if (typeof data !== "object" || data === null) return undefined;
  const { session_id, project_dir, at } = data as Record<string, unknown>;
  if (typeof session_id !== "string" || !session_id) return undefined;
  if (typeof project_dir !== "string" || !project_dir) return undefined;
  if (typeof at !== "number" || !Number.isFinite(at)) return undefined;
  return { session_id, project_dir, at };
}

// Windows paths: either slash, any case (the hook writes `c:/...`, VS Code `C:\...`), no trailing slash.
function normalize(path: string): string {
  return path.replace(/[\\/]+/g, "/").replace(/\/$/, "").toLowerCase();
}

// Whether one of the window's workspace folders is `dir`.
export function holdsFolder(workspaceFolders: readonly string[], dir: string): boolean {
  const wanted = normalize(dir);
  return workspaceFolders.some((folder) => normalize(folder) === wanted);
}

// This window shows the tab only if it has the chat's folder open: Claude Code opens a chat it
// doesn't have as a new tab, so the wrong window would get a second copy of the chat.
export function shouldReveal(request: RevealRequest, workspaceFolders: readonly string[], now: number): boolean {
  const age = now - request.at;
  return age >= -futureSlackMs && age <= revealMaxAgeMs && holdsFolder(workspaceFolders, request.project_dir);
}

// The current request, or undefined if there is none or it can't be read (mid-write: the rename
// below makes that rare, and the next change re-reads it).
export async function readRevealRequest(dir: string): Promise<RevealRequest | undefined> {
  try {
    return parseRevealRequest(await readFile(join(dir, revealFile), "utf8"));
  } catch {
    return undefined;
  }
}

// Written to a temp name and renamed, so a reader never sees half a file.
export async function writeRevealRequest(dir: string, request: RevealRequest): Promise<void> {
  const temp = join(dir, `${revealFile}.${process.pid}.tmp`);
  try {
    await writeFile(temp, JSON.stringify(request), "utf8");
    await rename(temp, join(dir, revealFile));
  } catch (error) {
    await rm(temp, { force: true }).catch(() => undefined);
    throw error;
  }
}
