# 20 — Check all tracked files for private info (small)

User's words: "Before a public release: check all tracked files for the 'Never in tracked files'
list".

## Problem / Goal
Before the repo goes public, nothing in it may hold the four items in CLAUDE.md "Never in tracked
files": the real name, the pseudonym to keep separate, personal paths (user folder, drive paths)
and the GitHub login. Example: a real user-folder path left in a research note or a test fixture.

This replaces the older "Before a public release" item, which left out the pseudonym and asked for
a fresh repo if old commits held *any* item. The global rule says the login in old commits is fine.

## Read first
- CLAUDE.md, "Never in tracked files" (the list), and the global CLAUDE.md "Git" rules (old
  commits that hold the login are fine; no history rewrite for it).
- docs/local.md (gitignored): the actual values to search for.
- `git ls-files`: what counts as tracked (docs/local.md itself is not).

## Approach
Report first; fix only what the user agrees to.
1. Current files: `git grep -i -n` for each value from docs/local.md, plus generic patterns: a
   drive letter followed by a backslash, `Users/` or `Users\`, `@gmail`, `AppData`.
2. History: `git log -p -S <value> --all` for each value, to see which commits hold it.
3. Commit metadata: `git log --format='%an %ae' --all | sort -u` (author names and emails are
   part of a public repo too).
4. Report as file:line and commit hashes. Don't repeat the found values in tracked files or commit
   messages; name them by kind ("real name", "user-folder path").

## Ask the user
- If old commits hold the real name, the pseudonym or a personal path: publish a fresh repo with
  one clean commit instead of rewriting history? Suggested: yes for those three; the login alone
  in old commits is not a reason (global rule).
- Fix hits in current files in this to-do? Suggested: yes, small edits, one commit.
- Is the commit author name/email fine to publish? Suggested: ask, since it is the repo's own
  identity (never change git config for it).

## Test
- Claude re-runs step 1 after the fixes and shows zero hits in current files.
- The user reads the history report (step 2-3) and decides on the fresh repo.
