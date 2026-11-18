---
name: pr-explanation
description: Writes the Project 3 pull-request explanation in the chat, in simple English, in six parts (what and why, every file, the important code line by line, how it fits, how it was checked and what was not, the branch and compare link), and keeps the Git and GitHub text to one short line with no AI attribution. Use it after every change that ends in a pushed branch, and whenever someone asks to explain a PR, a branch, a diff or a commit, to review what changed, or to prepare a PR for the team leader, even if they only say "what did you do?".
---

# PR explanation

Every change that goes to a pull request is explained **in the chat**, so the person who opens and merges the
PR understands every line and can defend it in a review. The team is learning React on the job and English is
not everyone's first language, so the explanation teaches as well as reports.

## Gather the facts first

Work from the real change, never from memory:

```bash
git fetch origin
git log --oneline origin/main..HEAD          # the commits in this branch
git diff --stat origin/main...HEAD           # every file added, changed, deleted or moved
git diff origin/main...HEAD -- <file>        # read each important file's change
```

Use `-M` (`git diff -M --stat`) so moved files show as moves, not as a delete plus an add. Also collect the
results of the checks that were really run (the `clean-copy-check` skill's table). If something wasn't run,
say so; never write a result you didn't see.

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
6. **Branch**: the branch name and the compare link,
   `https://github.com/team-1-aljadreyah/project-3/compare/main...<branch>`.

## Style

- Simple, short English sentences. Explain a technical word the first time it appears.
- Tables for before/after comparisons, code blocks for code, bullets for line-by-line explanations.
- Name files as paths (`src/features/tasks/api.ts`) so they can be found.
- No filler and no praise of the change; let the facts speak.

## Git and GitHub text

The explanation goes in the chat. What goes to GitHub stays short and shows only the author:

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
