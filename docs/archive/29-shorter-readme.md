# To do 29: Shorter README, feature details moved to docs/guide.md (medium)

User, 2026-11-13: "Our readme - is it too long? Shouldn't we trim this down to the bare essentials
and move this inforamtion to another document?" Then "yes" to Claude's suggestions (below).

## Problem / Goal
README.md is 283 lines (measured 2026-11-13). Features takes 120 of them (lines 13–132, 42%) and
reads like a user manual, with edge cases such as "45 minutes after the reply", "VS Code can't use
a hex code here", `explorer.decorations.colors` and what the tray does after Exit. A visitor has to
scroll past all of it to reach Install and run, which starts at line 150. The rest is what a README
is for (Install and run, the Settings table) and stays.

Goal: a visitor reads what Session Inbox does and how to install it quickly. No detail is removed:
it moves to docs/guide.md. The README's wording gets shorter too, following the README rule in
`~/.claude/CLAUDE.md` (added 2026-11-13): short, plain sentences with no edge cases, formats or
numbers that change often. docs/guide.md can be complete, but it is still written for people.
Estimated (not measured): a README of ~150 lines, with Install reached around line 40.

Example: the README's Reminders feature becomes one line ("A session still waiting after 10
minutes gets its popup once more; needs your own popup hook") that links to the guide's Reminders
section. That section keeps the details: only the window with the folder open sends it, the window
must not be in front, it can be ~30 s late, and the Turn Off Reminders message.

## Decided already (user, 2026-11-13, on Claude's suggestions)
- The details go to `docs/guide.md`. Rejected: a root `GUIDE.md` (one more file at the top level).
- Development stays in the README: it's 21 lines at the bottom and isn't in a user's way.
  Rejected: CONTRIBUTING.md, which suggests outside contributions are wanted and adds a file for
  little gain.
- Built after to-do 28. Step B probably changes the README's Project status text, and two chats
  editing one file mix their changes.
- No cut to "bare essentials" everywhere: Install and run and the Settings table stay whole.

## Read first
- README.md, the whole file. Sections as measured on 2026-11-13 (to-do 28 may have moved them):
  pitch and pictures 1–11, Features 13–132, How it works and Requirements 134–148, Install and run
  150–207 (37 lines in `<details>`), Settings 209–218, Optional: desktop popups 220–235,
  Development 237–257, Changelog, Credits and License 259–283.
- docs/decisions.md 2026-11-04 and docs/archive/26-readme-readability.md give the current order and
  the reasons for it. This to-do revises that decision.
- `extension/README.md` lines 8–10, 21 and 24. It says "All features, settings and install steps:
  main README" and links `#install-and-run` and `#optional-desktop-popups`. The released 0.1.0
  `.vsix` holds those links, so both headings must stay in README.md.
- In-page links in README.md: the Settings table links `#reminders`, `#tray-icon-optional`,
  `#sidebar`, `#where-a-project-stands` and `#project-status`. Features links
  `#optional-desktop-popups` and `#project-status`.
- CLAUDE.md: "Docs to update when behaviour changes", "Project docs", and the README decisions
  ("README.md keeps the headings…").
- `extension/src/extension.ts:202-208`: the missing-popup-hook message says "see the project's
  README". This is still true if the README keeps a short popups section.

## Approach
Docs only, no code.
1. **README.md:**
   - Features becomes one or two lines per feature: status bar, sidebar, where a project stands,
     project status, clicking a session, reminders, tray icon. Each links to its section in the
     guide. Leave out numbers and edge cases so this list rarely needs changing. ~15–20 lines.
   - Optional: desktop popups keeps its heading (the released anchor), cut to 2–3 lines: what
     your own popup hook adds (reminders, a click shows the chat) and a link to the guide for what
     it receives.
   - The other sections stay, with shorter wording: pitch, pictures, How it works, Requirements,
     Install and run (with its `<details>` block), the Settings table, Development, Changelog,
     Credits, License. Edge cases among them can move to the guide too, such as what Install Hooks
     backs up and when it warns. The Settings table's links now point to `docs/guide.md#…`.
2. **docs/guide.md** ("Session Inbox user guide"):
   - The current Features subsections, moved word for word with the same `###` headings, so the
     anchors keep their names.
   - The popup-hook format: the JSON a reminder sends on stdin, and the `.reveal` file.
   - Links to hooks.md become relative from docs/ (`research/hooks.md`).
3. **extension/README.md:** "All features…" points to the guide too, by absolute GitHub URL like
   its other links. This file ships in the next `.vsix`.
4. **CLAUDE.md:**
   - "Docs to update" lists docs/guide.md for the details, and README.md for the short Features
     list, Install and run, the Settings table and Credits.
   - "Project docs" lists docs/guide.md.
5. **docs/decisions.md:** a new entry that revises 2026-11-04: what moved where, and why. Rejected
   alternatives to name there:
   - CONTRIBUTING.md and a root GUIDE.md (see above).
   - A `<details>` block per feature: it hides text, anchors into collapsed blocks are awkward,
     and the file stays as long.
   - Only moving Install and run above Features: the cheapest change, but Features stays 120
     lines.

## Ask the user
1. The short Features list: one bullet per feature under `## Features`, or `###` subheadings with
   one line each? Suggested: one bullet per feature with the name in bold, linking to the guide.
   It's the shortest, and the subheadings live in the guide.
2. A CHANGELOG line? Suggested: no. README.md and docs/guide.md aren't in the `.vsix`, and the
   extension page only gets a link (as in #25 and #26).
3. Should the guide explain How it works in more depth (status files, hook events)? Suggested: no.
   The README keeps its short How it works, and the hook details are already in Install and run
   and docs/research/hooks.md.

## Test
- **Claude:**
  - Every fact in the old Features and Optional: desktop popups sections appears in
    docs/guide.md: a phrase-by-phrase check, as in #26.
  - All links resolve: README to the guide's anchors, the guide to `research/hooks.md`, and
    `#install-and-run` and `#optional-desktop-popups` are still README headings.
  - The pictures still show, and the links in extension/README.md work.
  - README line counts before and after (measured). Each feature in the README's list is at most
    two short lines.
  - Any fact cut from a README section that stays is in the guide.
  - Lint, tsc, unit and GUI tests as CLAUDE.md says. No code changes, so they should pass
    unchanged.
- **User:** read README.md and docs/guide.md in the Markdown preview (`Ctrl+Shift+V`), then on
  GitHub after pushing (the anchor links into the guide).
