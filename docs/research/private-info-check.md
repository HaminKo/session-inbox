# Private-info check (to-do #20)

Search of the repo for the CLAUDE.md "Never in tracked files" list: real name, pseudonym, personal
paths, GitHub login. The values themselves are in docs/local.md (gitignored), with the copy-ready
search commands; this file names them only by kind.

## 2026-11-03 — first run (all numbers measured)
Scope: 69 tracked files (all text, so `git grep -I` skipped none), all 43 commits (`--all`),
commit subjects and bodies, author and committer fields.

**Current files: 0 hits** for the real name (all four spellings), the pseudonym, the user-folder
name, the login and the commit email. Generic patterns:
- Drive-letter paths: only the standard Node install path (CLAUDE.md), registry keys (`HKCU:\...`)
  and made-up test fixture paths (`C:\p\demo`, `c:\work\...`, `C:\Projects\demo`).
- `Users/`: one hit, already shortened to `c:/Users/.../session-inbox` (docs/research/hooks.md).
- `AppData`: only the generic `%APPDATA%`.

**History (diffs):** the real name (as the login, lowercase) was the LICENSE copyright holder in
the first commit (`657a1c0`); `320be22` replaced it with a neutral holder. No personal path, no
email address and no pseudonym in any diff.

**Commit messages:** 0 hits.

**Commit metadata:** every commit has the commit identity from docs/local.md as author and
committer: a name that is the real name / login, and a personal email address.

**Not on the list, noted:** names of the user's other projects (PeacefreeWeb, sc-map-library,
falconpaladin) appear in README.md, docs/research/hooks.md, to-dos 17-19 and one unit-test
fixture. Those projects are published under the pseudonym, so together with a repo under the
real-name account they link the two. The user is fine with that (see docs/decisions.md
2026-11-03).

**Remote:** the GitHub repo was already public at the time of the check, with 38 of the 43
commits pushed, so their content was already published.

## How to re-run
The commands are in docs/local.md, "Private values". Also re-check the generic patterns:
`git grep -n -I -E '[A-Za-z]:\\'`, `git grep -n -I -i -E 'Users[/\\]|AppData|@gmail'`, and
`git log --all --format='%an %ae %cn %ce' | sort -u`.
