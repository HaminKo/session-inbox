// VS Code's icon font from the VS Code the GUI test downloads (test/gui/launch.ts), for the unit
// tests that need a real codicon.ttf; undefined until that download exists.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { codiconFont } from "../../src/codicons.ts";

// <extension>/.vscode-test/vscode-win32-x64-archive-<version>/<commit>/resources/app
export function pinnedFont(): string | undefined {
  const root = join(import.meta.dirname, "..", "..", ".vscode-test");
  if (!existsSync(root)) return undefined;
  for (const download of readdirSync(root)) {
    if (!download.startsWith("vscode-")) continue;
    for (const commit of readdirSync(join(root, download))) {
      const font = codiconFont(join(root, download, commit, "resources", "app"));
      if (existsSync(font)) return font;
    }
  }
  return undefined;
}

export const noFontSkip = "the GUI test's VS Code isn't downloaded (run npm run test:gui once)";
