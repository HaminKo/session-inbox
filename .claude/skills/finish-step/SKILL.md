---
name: finish-step
description: End of a build step or session in this project. Use when the user says the step is tested, the test passed, it works, or similar, or says "commit". Updates the docs, gives the commit message, and commits only this session's files when the user says "commit". Not when only part of a test checklist passed.
---

# Finish a step

Phase 1 runs when the user says the whole step is tested. Phase 2 runs only when the user says "commit" (for a check-in commit in the middle of a step, skip phase 1, but still follow "Commit message").

## Commit message (every commit)
Give only the message, as plain text in a code block (no git or PowerShell commands):
- A subject line under ~60 characters, then a blank line and at most 5 short "- " lines saying what
  changed.
- No measurements, user choices, review findings, test lists or doc lists: they already live in the
  to-do's Progress list or the docs.

## Phase 1: docs and commit message
Only when the user has tested the whole step; if part of the test failed, fix that first.
- Run the checks in CLAUDE.md "Build specifics"; all must pass. (Extension: `npm run lint`,
  `npm run compile`, `npx tsc --noEmit`, and `npm test`/GUI test if present, from `extension/`.
  Hooks: re-run the payload verification in docs/research/hooks.md.)
- Check the changed files for anything on the "Never in tracked files" list in CLAUDE.md (real
  name, personal paths, the GitHub login).
- Finished to-do: remove its line from docs/todo.md and move its file unchanged with
  `git mv docs/todo/NN-name.md docs/archive/NN-name.md` (sessions read the archive only when a
  to-do names it). Numbers are never reused or renumbered.
- One step of a bigger to-do: update its Progress list (what was built, choices, test results,
  what the next step does).
- "Where we are" at the top of docs/todo.md, at every commit, its three lines kept in exactly this
  form (the Session Inbox extension reads them): `- Now: To do N, step X (short title)` (the step
  or to-do built next; with no to-do open, what comes next in words, e.g.
  `Before a public release (no to-dos open)`), `- Next: To do A, B, C` (the Bugs me list in
  order), `- Updated: YYYY-MM-DD` (today). When a to-do is finished, its line leaves "### Now": ask
  the user which to-do goes there (suggest the first under Bugs me) and move that line up.
- Update the docs the change affects (CLAUDE.md "Build specifics": Docs to update —
  docs/guide.md, README.md, docs/research/hooks.md).
- If CHANGELOG.md exists and users can see the change, add one plain-language line under Unreleased
  (not for refactors or tests).
- Check that this step's findings, dead ends and decisions are written down: docs/research/ and
  docs/decisions.md.
- If the step added anything made by someone else (a library, tool, asset, or copied or adapted
  code), add it to README.md "Credits" with its author, license and link.
- The commit message, as in "Commit message" above.
- Say what comes next: the next step or to-do (the new "Now:"), and the command to start it in a
  new chat, in its own code block: `/build-todo N`, or `/build-todo N, step B` for the next step of
  a bigger to-do. On the line before it, the model to pick (the build-todo skill's model check:
  Opus for open design, format research or a bug with an unknown cause; Sonnet when the design is
  written down; Haiku for docs only), e.g. "Sonnet: the design is in the Progress list".

## Phase 2: commit (only when the user says "commit")
Other Claude sessions may be editing this folder at the same time.
1. Run git status. Show the files this session changed; list any other changed files as "left
   untouched (another session)".
2. Stage only this session's files, by explicit path. Never git add -A, git add . or git stash.
   After a `git mv` into docs/archive/, name only the new path: the move is already staged, and
   naming the old path makes git add fail and stage nothing. Check `git diff --cached --stat`
   before committing.
3. Commit with the message given earlier in this session. No Co-Authored-By or other attribution
   lines.
4. Never push; the user pushes.
