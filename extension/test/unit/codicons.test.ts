// Unit tests for reading codicon characters from VS Code's icon font (to-do #17). Plain Node:
// `npm test`. The font comes from the VS Code the GUI test downloads; without it the font test is
// skipped.
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { codiconChars, readCodicons } from "../../src/codicons.ts";
import { defaultIcon, iconChoices } from "../../src/projectLook.ts";
import { noFontSkip, pinnedFont } from "./pinnedFont.ts";

const font = pinnedFont();
const skip = !font && noFontSkip;

void test("the font names every icon the sidebar and the tray use", { skip }, async () => {
  const chars = await readCodicons(font ?? "");
  assert.ok(chars);
  // U+EA6C is `warning` in VS Code's own codicon.css.
  assert.equal(chars.get("warning")?.codePointAt(0), 0xea6c);
  for (const name of ["check", defaultIcon, ...iconChoices]) {
    const char = chars.get(name);
    assert.ok(char !== undefined, `no ${name}`);
    const code = char.codePointAt(0) ?? 0;
    assert.ok(code >= 0xe000 && code <= 0xf8ff, `${name} is in the Private Use Area`);
  }
});

void test("a missing or broken font gives nothing", async () => {
  assert.equal(await readCodicons(join(import.meta.dirname, "missing.ttf")), undefined);
  // A font header with no tables.
  assert.equal(codiconChars(Buffer.alloc(12)).size, 0);
  const notFont = await readCodicons(import.meta.filename);
  assert.ok(notFont === undefined || notFont.size === 0, "not a font");
});
