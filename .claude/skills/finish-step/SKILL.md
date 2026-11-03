---
name: finish-step
description: End of a build step or session in this project. Use when the user says the step is tested, the test passed, it works, or similar, or says "commit". Updates the docs, gives the commit message, and commits only this session's files when the user says "commit". Not when only part of a test checklist passed.
---

# Finish a step

Phase 1 runs when the user says the whole step is tested. Phase 2 runs only when the user says "commit" (for a check-in commit in the middle of a step, skip phase 1).

## Phase 1: docs and commit message
Only when the user has tested the whole step; if part of the test failed, fix that first.
- Run the checks in CLAUDE.md "Build specifics"; all must pass. (Extension: `npm run lint`,
  `npm run compile`, `npx tsc --noEmit`, and `npm test`/GUI test if present, from `extension/`.
  Hooks: re-run the payload verification in docs/research/hooks.md.)
- Check the changed files for anything on the "Never in tracked files" list in CLAUDE.md (real
  name, personal paths, the GitHub login).
- Finished to-do: remove its entry from docs/todo.md (numbers are never reused).
- One step of a bigger to-do: update its Progress list (what was built, choices, test results,
  what the next step does).
- "Where we are" at the top of docs/todo.md, at every commit, its three lines kept in exactly this
  form (the Session Inbox extension reads them): `- Now: To do N, step X (short title)` (the step
  or to-do built next; when a to-do is finished, the next one in the list, asking the user if the
  order isn't clear), `- Next: To do A, B, C` (the following to-dos in build order),
  `- Updated: YYYY-MM-DD` (today).
- Update the docs the change affects (CLAUDE.md "Build specifics": Docs to update — README.md,
  docs/research/hooks.md).
- If CHANGELOG.md exists and users can see the change, add one plain-language line under Unreleased
  (not for refactors or tests).
- Check that this step's findings, dead ends and decisions are written down: docs/research/ and
  docs/decisions.md.
- If the step added anything made by someone else (a library, tool, asset, or copied or adapted
  code), add it to README.md "Credits" with its author, license and link.
- Give the commit message as plain text in a code block.
- Say what comes next: the next step or to-do (the new "Now:"), and the command to start it in a
  new chat, in its own code block: `/build-todo N`, or `/build-todo N, step B` for the next step of
  a bigger to-do.

## Phase 2: commit (only when the user says "commit")
Other Claude sessions may be editing this folder at the same time.
1. Run git status. Show the files this session changed; list any other changed files as "left
   untouched (another session)".
2. Stage only this session's files, by explicit path. Never git add -A, git add . or git stash.
3. Commit with the message from phase 1. No Co-Authored-By or other attribution lines.
4. Never push; the user pushes.
