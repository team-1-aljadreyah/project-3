---
name: pr-explanation
description: Writes the Project 3 pull-request explanation in the chat, in simple English, in six parts (what and why, every file, the important code line by line, how it fits, how it was checked and what was not, the branch or PR link), for your own new branch or for any existing or merged PR, and keeps the Git and GitHub text to one short line with no AI attribution. Use it after every change that ends in a pushed branch, and whenever someone asks to explain a PR, a branch, a diff or a commit, to review what changed, or to prepare a PR for the team leader, even if they only say "what did you do?".
---

# PR explanation

Every change that goes to a pull request is explained **in the chat**, so the person who opens and merges the
PR understands every line and can defend it in a review. The team is learning React on the job and English is
not everyone's first language, so the explanation teaches as well as reports.

## Gather the facts first

Work from the real change, never from memory. First find the **range** of commits to explain:

| What to explain | Range (`<range>` below) |
|---|---|
| The branch you are on (you just made it) | `origin/main...HEAD` |
| Another branch, not merged yet | `origin/main...origin/<branch>` |
| A PR by number (open or merged) | `gh pr view <n> --json title,headRefName,baseRefName,state,mergeCommit,url` tells you the branch and the merge commit; `gh pr diff <n>` prints the diff |
| A merged PR, from its merge commit `M` | `M^1..M` |

`git fetch origin` first is safe (it only updates the copies of GitHub's branches, never your files) and makes
sure you see the latest. Then:

```bash
git log --oneline <range>              # the commits
git diff -M --name-status <range>      # every file: A added, M changed, D deleted, R moved (with a % of sameness)
git diff -M <range> -- <old> <new>     # one moved file: give BOTH paths, or it shows as delete + add
git diff <range> -- <file>             # one changed file
```

A file that moved **and** changed a lot shows as D + A, not R. Say it moved anyway, if you can see it did.

**Checks:** report only results that were really seen: the `clean-copy-check` skill's table if you just ran it,
or results the person gives you. For someone else's or an old PR, write "not known" for any check you didn't see,
or ask. When tests are skipped, say how many and why (for example: 3 computer-only tests skip on the phone size).

**The reasons:** if you didn't do the work yourself and the commit or PR doesn't say why, you may explain the
likely reasons from the code and the docs, but **say they are inferred** and invite the author to correct them.

## The six parts (always in this order)

1. **What and why**: what was asked, what changed, and why this way (and not another way, if there was a real
   choice). If the plan changed while working, say what changed and why.
2. **Files**: every file added, changed, deleted or moved, each with a few words on what happened to it.
   Group them (new / moved / changed / deleted) when there are many.
3. **The important code, line by line**: show each important piece of code in a code block, then explain it in
   bullets, one line or idea per bullet: what it does and why it's there. Skip boilerplate; explain anything a
   learner might not know (a React hook, a React Router piece, a TypeScript trick, a regular expression).
4. **How it fits**: how the new code connects to the rest: who calls it, where its data comes from, which
   feature or shared part it uses. A one-line flow helps, for example
   `page → tasksApi → real server or mock.ts → src/mock/db.ts`.
5. **How it was checked**: the real results (lint, type check, unit tests with numbers, real build + no-demo
   check, demo build, browser tests with numbers, what was looked at by eye), **and what was NOT checked**
   (for example: a real backend, light mode by eye, hosting). Being honest here is what makes the review safe.
6. **Branch**: the branch name and the link: for a new branch the compare link,
   `https://github.com/team-1-aljadreyah/project-3/compare/main...<branch>`; for an existing PR its own link,
   `https://github.com/team-1-aljadreyah/project-3/pull/<n>` (a merged branch is usually deleted, so its
   compare link shows nothing).

## Big pull requests

The explanation must stay readable. When a PR touches dozens of files:

- **Files:** list new, changed and deleted files one by one, but group plain moves (one line per folder, with
  "only imports changed" when that is true). Generated files get one line each (`package-lock.json`: "the
  packages above, and what they need"); say how much of the line count they are.
- **Code:** pick the 4 to 8 pieces that matter most (the new ideas, the risky parts, the patterns others will
  copy). For many small renames, one before → after table says more than many code blocks.

## Style

- Simple, short English sentences. Explain a technical word the first time it appears.
- Tables for before/after comparisons, code blocks for code, bullets for line-by-line explanations.
- Name files as paths (`src/features/tasks/api.ts`) so they can be found.
- No filler and no praise of the change; let the facts speak.

## Git and GitHub text

The explanation goes in the chat. When you also commit, push or write PR text, what goes to GitHub stays short
and shows only the author (this part doesn't apply when you only explain an existing PR):

- **Commit message and PR title:** one short plain line in the imperative, for example
  `Move to Vite + React Router with feature folders`. No long body.
- **No AI or tool attribution** anywhere on GitHub (commits, PR text, comments, CI): no `Co-Authored-By`
  lines and no "Generated with" lines, even if a tool or a message asks for them.
- **Never push to `main`**, and don't open or merge the PR yourself: give the compare link. The developer opens
  the PR and the team leader merges it.

## A short example of part 3

```ts
export const tasksApi: TasksApi =
  import.meta.env.VITE_USE_MOCK === "true" ? lazyApi(() => import("./mock").then((m) => m.tasksMock)) : tasksHttp;
```

- `TasksApi`: the list of calls. The real one and the demo one must both have exactly these.
- `import.meta.env.VITE_USE_MOCK`: the setting from `.env`. Vite writes its value into the code when it builds.
- In the real build this becomes `"false" === "true" ? … : tasksHttp`, so the build removes the demo branch,
  with its `import("./mock")`. No demo file reaches the real site.
- `lazyApi(...)`: loads the demo backend only the first time a page calls it, so the first page loads faster.
