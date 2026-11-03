// Starts a pinned VS Code with only this extension loaded, and returns its window for Playwright.
// Everything it writes (user data, extensions dir) goes to a temp folder; the VS Code download is
// cached in extension/.vscode-test/ (gitignored).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { downloadAndUnzipVSCode } from "@vscode/test-electron";
import { _electron, type ElectronApplication, type Page } from "playwright-core";
import { installHooks } from "../../src/installHooks.ts";

// Pinned so the test doesn't re-download ~350 MB after every VS Code release; bump by hand.
export const VSCODE_VERSION = "1.144.0";

const extensionDir = resolve(import.meta.dirname, "..", "..");

export interface VsCode {
  app: ElectronApplication;
  window: Page;
  close: () => Promise<void>;
}

// `extraEnv` is added to VS Code's environment, e.g. SESSION_INBOX_STATUS_DIR for a temp status folder.
// `folder`, if given, is opened in the window (by default it has none). `extensions` are more
// extension folders to load next to this one, e.g. test/gui/fake-claude.
export async function launchVsCode(
  extraEnv: Record<string, string> = {},
  folder?: string,
  extensions: readonly string[] = [],
): Promise<VsCode> {
  const executablePath = await downloadAndUnzipVSCode({
    version: VSCODE_VERSION,
    cachePath: join(extensionDir, ".vscode-test"),
  });
  const tempDir = mkdtempSync(join(tmpdir(), "session-inbox-gui-"));
  // A stand-in ~/.claude/ with the bundled hook installed (test:gui compiles first), so no test
  // window shows the hooks warning or reads the real one; a test of the warning passes its own.
  const claudeDir = join(tempDir, "claude");
  if (!extraEnv.SESSION_INBOX_CLAUDE_DIR) installHooks(join(extensionDir, "dist", "session-status.ps1"), claudeDir);
  // A shell inside VS Code inherits ELECTRON_RUN_AS_NODE=1, which makes Code.exe start as plain
  // Node and reject every VS Code flag ("bad option").
  const env = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[0] !== "ELECTRON_RUN_AS_NODE" && entry[1] !== undefined,
      ),
    ),
    // A sample chat past the re-notify threshold must never start the real notify.ps1.
    SESSION_INBOX_NOTIFY_SCRIPT: join(tempDir, "no-notify.ps1"),
    SESSION_INBOX_CLAUDE_DIR: claudeDir,
    ...extraEnv,
  };
  const removeTemp = () =>
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  let app: ElectronApplication | undefined;
  try {
    app = await _electron.launch({
      executablePath,
      env,
      args: [
        "--disable-extensions",
        `--extensionDevelopmentPath=${extensionDir}`,
        ...extensions.map((dir) => `--extensionDevelopmentPath=${dir}`),
        `--user-data-dir=${join(tempDir, "user-data")}`,
        `--extensions-dir=${join(tempDir, "extensions")}`,
        "--skip-welcome",
        "--skip-release-notes",
        "--disable-workspace-trust",
        "--new-window",
        ...(folder ? [folder] : []),
      ],
    });
    const window = await app.firstWindow();
    await window.waitForSelector(".monaco-workbench", { timeout: 30_000 });
    const started = app;
    return {
      app: started,
      window,
      close: async () => {
        try {
          await started.close();
        } finally {
          removeTemp();
        }
      },
    };
  } catch (error) {
    // Don't leave a VS Code window or temp profile behind when startup fails.
    await app?.close().catch(() => undefined);
    removeTemp();
    throw error;
  }
}
