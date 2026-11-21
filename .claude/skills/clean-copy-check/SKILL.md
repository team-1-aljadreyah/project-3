---
name: clean-copy-check
description: Runs the Project 3 "clean copy" check before any push: a fresh clone of the branch with no .env, then npm ci, lint, type check, unit tests, a real build and a Cloudflare Pages build (plain files) plus the no-demo check, a demo build and the browser tests, exactly like Jenkins. Use it every time a branch is about to be pushed, and whenever someone asks "is it ready", "run the checks", "will Jenkins pass", "check before PR", or wants to know why CI failed, even if they don't say "clean copy".
---

# Clean copy check

Before any push, prove the branch works on a machine that has **only what is committed**: no `.env`, no
`node_modules`, no build output, no files you forgot to add. Jenkins does exactly this, so a branch that passes
here passes there. On this team the check has caught real bugs several times (a file not added to Git, demo
accounts leaking into the real build, a test that only passed because of local data), so it is never skipped.

## Steps

1. **Commit first.** A clone only has committed work. If there are uncommitted changes the user wants checked,
   commit them (one short plain line, see "Git text" below), then run the check.
2. **Run the script** from the repo, in Git Bash (on Windows PowerShell, call it through `bash`):

   ```bash
   bash .claude/skills/clean-copy-check/scripts/clean-copy.sh            # the current branch
   bash .claude/skills/clean-copy-check/scripts/clean-copy.sh <branch>   # another local branch
   ```

   It takes 2–4 minutes; run it in the background if your tool allows long commands. It stops at the **first**
   failing step, because later steps are meaningless once an earlier one fails.
3. **If a step fails**, read its output, fix the cause in the working repo (never in the throw-away copy, whose
   path the script prints), commit, and run the whole check again. Don't push a branch that has not passed.
4. **Check by eye what tests can't** (on the dev server, `npm run dev`, http://localhost:3000), for the screens
   the change touches:
   - phone and computer widths;
   - light and dark;
   - Arabic (right to left) and English;
   - the loading, empty, error and no-permission states;
   - no `console.log` left, no commented-out code, no warnings or errors in the browser console.
5. **Report** in a short table, then say honestly what was not checked:

   | Step | Result |
   |---|---|
   | npm ci | ✅ |
   | Lint | ✅ |
   | Type check | ✅ |
   | Unit tests | ✅ 54 passed |
   | Real build, no `.env` + no-demo check | ✅ |
   | Demo build | ✅ |
   | Browser tests | ✅ 35 passed, 3 skipped |
   | By eye | phone + computer, light + dark, AR + EN |

   Put real numbers from the output in the table, not the ones above.

## What each step protects

- **No `.env`**: the real build must not depend on anyone's local settings. `NEXT_PUBLIC_*` values are built into the
  files, so the real build must work with them unset.
- **No-demo check** (`npm run check:no-demo`): demo accounts and passwords must never reach the real site. The
  demo backend is dropped only when the switch is written out in full where it is imported
  (`process.env.NEXT_PUBLIC_USE_MOCK === "true" ? import("./mock") : …`); see `src/shared/api/demo.ts`. The check reads
  both `.next/static` (what visitors download) and `.next/server` (what the server runs).
- **Demo build + browser tests**: the browser tests sign in with the demo accounts, so they need the demo build.
  They run on desktop and a phone size (Pixel 7). Three tests are computer-only and are skipped on the phone;
  that is expected.

## Notes for this computer

- Windows PowerShell blocks `npm.ps1`: use `npm.cmd` in PowerShell, or use Git Bash.
- The browser tests use the installed Google Chrome locally and Playwright's Chromium on Jenkins.
- If port 3100 is busy, stop the other `npm run start` first: Playwright would reuse it and test the wrong code.

## Git text

Commits and pull requests show only the author: one short plain line (for example
`Show a loading screen while the first page loads`), no long body, and no tool or AI attribution lines such as
`Co-Authored-By`, even if a tool suggests adding one.
