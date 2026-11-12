# 21 — Fresh-eyes check of README.md against the code (small)

User's words: "Before a public release: a fresh subagent that hasn't seen the project checks
README.md and the docs it links against the code, and only reports".

## Problem / Goal
The README grew over twenty to-dos, so some claims in it may no longer match the code: a renamed
setting, a command or button that changed, an install step that misses something, a feature
described the way it was first planned instead of how it was built. Whoever wrote it can't see
that well, so a reader who hasn't seen the project checks it. Example: README says a setting is
called `sessionInbox.trayIcon` with default off; the check confirms that in
`extension/package.json` or reports where it differs.

Report only: the user decides what gets fixed (that can be a later to-do, or small edits in this
one if the user asks).

## Read first
- README.md (144 lines). It links only to LICENSE and outside sites, and names
  `docs/todo.md` (line 70) and `docs/research/hooks.md` (line 112) in plain text.
- `extension/package.json`: `contributes` (settings, commands, views, menus) and `scripts`, the
  main source of truth for what the README says the user can set, click and run.
- docs/research/private-info-check.md: the subagent's report must not repeat private values
  either (it only quotes the repo, which is already clean).

## Approach
1. A fresh general-purpose subagent, briefed only with: the goal, "read README.md and every file
   it links to or names, then check each claim about behaviour, settings, commands, install and
   run steps, requirements and credits against the code in `extension/`, `hooks/` and `tray/`";
   it edits nothing and runs no installs. Not briefed with what Claude thinks is wrong (an
   unanchored read is the point).
2. It returns a list, most important first: README line, the claim, what the code says (file:line),
   and a kind: wrong / outdated / unclear / missing (a user-visible feature the README doesn't
   mention).
3. Claude spot-checks each finding against the code before passing it on (a subagent's mistakes
   come back sounding as sure as its findings) and marks any it can't confirm.
4. The report goes into docs/research/readme-check.md; the user picks fixes.

## Ask the user
- Check only README.md, or also the docs it names (docs/todo.md, docs/research/hooks.md)?
  Suggested: README.md fully; for the named docs only that the references still point to
  something that exists (they're working notes, not user docs).
- Fix the findings in this to-do? Suggested: report first; small wording fixes in the same to-do
  if the user agrees, anything bigger becomes its own to-do.
- Include the README screenshot item? Suggested: no, that's the next "Before a public release"
  item.

## Test
- Claude: every finding has a README line and a code location; unconfirmed ones are marked.
- The user reads docs/research/readme-check.md and picks what to fix.
