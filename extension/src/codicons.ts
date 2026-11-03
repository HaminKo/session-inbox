// The characters behind codicon names (`warning`, `library`, ...) in VS Code's own icon font,
// `<appRoot>/out/media/codicon.ttf`, so the tray can draw the sidebar's icons (to-do #17). The font's
// `post` table names every glyph and its `cmap` table gives each glyph's character; the characters
// are read from the installed font, not copied, as codicons promise stable names only.
// Plain Node, no VS Code, so it can be unit-tested.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Where VS Code keeps the font, from `vscode.env.appRoot` (its resources/app folder).
export function codiconFont(appRoot: string): string {
  return join(appRoot, "out", "media", "codicon.ttf");
}

// The font's tables by tag: offset and length.
function tables(font: Buffer): Map<string, { offset: number; length: number }> {
  const result = new Map<string, { offset: number; length: number }>();
  const count = font.readUInt16BE(4);
  for (let i = 0; i < count; i++) {
    const entry = 12 + 16 * i;
    result.set(font.toString("latin1", entry, entry + 4), { offset: font.readUInt32BE(entry + 8), length: font.readUInt32BE(entry + 12) });
  }
  return result;
}

// Glyph index -> name, from a format 2 `post` table. Indexes below 258 are the standard Mac names
// (`.notdef`, `space`, letters), which no codicon uses, so they are left out.
function glyphNames(font: Buffer, post: { offset: number; length: number }): Map<number, string> {
  const names = new Map<number, string>();
  if (font.readUInt32BE(post.offset) !== 0x20000) return names;
  const glyphs = font.readUInt16BE(post.offset + 32);
  const indexes: number[] = [];
  for (let i = 0; i < glyphs; i++) indexes.push(font.readUInt16BE(post.offset + 34 + 2 * i));
  const strings: string[] = [];
  const end = post.offset + post.length;
  for (let at = post.offset + 34 + 2 * glyphs; at < end; at += 1 + font[at]) {
    strings.push(font.toString("latin1", at + 1, at + 1 + font[at]));
  }
  indexes.forEach((index, glyph) => {
    const name = strings[index - 258];
    if (index >= 258 && name !== undefined) names.set(glyph, name);
  });
  return names;
}

// Glyph index -> its lowest character, from the Windows Unicode `cmap` subtable (format 4 or 12).
function glyphChars(font: Buffer, cmap: { offset: number; length: number }): Map<number, number> {
  const chars = new Map<number, number>();
  const add = (char: number, glyph: number) => {
    if (glyph !== 0 && !chars.has(glyph)) chars.set(glyph, char);
  };
  const subtables = font.readUInt16BE(cmap.offset + 2);
  for (let i = 0; i < subtables; i++) {
    const entry = cmap.offset + 4 + 8 * i;
    if (font.readUInt16BE(entry) !== 3) continue;
    const table = cmap.offset + font.readUInt32BE(entry + 4);
    const format = font.readUInt16BE(table);
    if (format === 4) {
      const segments = font.readUInt16BE(table + 6) / 2;
      const ends = table + 14;
      const starts = ends + 2 * segments + 2;
      const deltas = starts + 2 * segments;
      const rangeOffsets = deltas + 2 * segments;
      for (let s = 0; s < segments; s++) {
        const start = font.readUInt16BE(starts + 2 * s);
        const last = font.readUInt16BE(ends + 2 * s);
        const delta = font.readUInt16BE(deltas + 2 * s);
        const rangeOffset = font.readUInt16BE(rangeOffsets + 2 * s);
        for (let char = start; char <= last && char !== 0xffff; char++) {
          if (rangeOffset === 0) add(char, (char + delta) & 0xffff);
          else {
            const glyph = font.readUInt16BE(rangeOffsets + 2 * s + rangeOffset + 2 * (char - start));
            if (glyph !== 0) add(char, (glyph + delta) & 0xffff);
          }
        }
      }
    } else if (format === 12) {
      const groups = font.readUInt32BE(table + 12);
      for (let g = 0; g < groups; g++) {
        const group = table + 16 + 12 * g;
        const start = font.readUInt32BE(group);
        const firstGlyph = font.readUInt32BE(group + 8);
        for (let char = start; char <= font.readUInt32BE(group + 4); char++) add(char, firstGlyph + char - start);
      }
    }
  }
  return chars;
}

// Some codicon names are aliases with no glyph name of their own in the font: VS Code's codicon
// list gives both the same character. Only the ones the icon pick offers (projectLook.ts
// iconChoices) are listed; codicons.test.ts checks every choice resolves. Other aliases typed by
// hand show no project icon in the tray.
const aliases: Readonly<Record<string, string>> = { zap: "symbol-event" };

// Codicon name -> the character to draw with the font. Empty for a font without these tables.
export function codiconChars(font: Buffer): Map<string, string> {
  const result = new Map<string, string>();
  const found = tables(font);
  const post = found.get("post");
  const cmap = found.get("cmap");
  if (!post || !cmap) return result;
  const chars = glyphChars(font, cmap);
  for (const [glyph, name] of glyphNames(font, post)) {
    const char = chars.get(glyph);
    if (char !== undefined && !result.has(name)) result.set(name, String.fromCodePoint(char));
  }
  for (const [alias, name] of Object.entries(aliases)) {
    const char = result.get(name);
    if (char !== undefined && !result.has(alias)) result.set(alias, char);
  }
  return result;
}

// The font's names and characters, or undefined when it is missing or can't be read.
export async function readCodicons(path: string): Promise<Map<string, string> | undefined> {
  try {
    return codiconChars(await readFile(path));
  } catch {
    return undefined;
  }
}
