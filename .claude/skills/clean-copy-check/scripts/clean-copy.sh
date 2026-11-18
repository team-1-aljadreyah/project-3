#!/usr/bin/env bash
# The clean copy check: the same steps as Jenkins, on a fresh clone of a branch, with no .env.
# It proves the branch builds and passes on a machine that has only what is committed.
#
# Usage (from anywhere inside the repo, in Git Bash):
#   bash .claude/skills/clean-copy-check/scripts/clean-copy.sh            # the current branch
#   bash .claude/skills/clean-copy-check/scripts/clean-copy.sh my-branch  # another local branch
#
# It stops at the first failing step and says which one. The copy is deleted when everything passes,
# and kept (its path is printed) when something fails, so you can look inside.
set -euo pipefail

REPO="$(git rev-parse --show-toplevel)"
BRANCH="${1:-$(git -C "$REPO" rev-parse --abbrev-ref HEAD)}"
PORT=3100 # the port the browser tests serve the built site on (playwright.config.ts)

step() { printf '\n=== %s\n' "$1"; }
fail() { printf '\nCLEAN COPY FAILED at: %s\n' "$1" >&2; exit 1; }

# Only committed work is in a clone. Say so, so nobody thinks uncommitted edits were checked.
if [ -n "$(git -C "$REPO" status --porcelain)" ]; then
  echo "NOTE: the repo has uncommitted changes. They are NOT in the clean copy (commit them first to check them)."
fi

# A server already on the test port would be reused by Playwright and test the wrong code.
if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
  fail "port $PORT is busy (stop the other 'vite preview' or 'npm run preview' first)"
fi

COPY="$(mktemp -d)/clean-copy"
step "clone $BRANCH into $COPY"
git clone -q --branch "$BRANCH" "$REPO" "$COPY" || fail "clone"
cd "$COPY"
echo "commit $(git rev-parse --short HEAD): $(git log -1 --format=%s)"
[ ! -e .env ] || fail ".env is committed (it must never be)"

step "npm ci";                 npm ci --no-audit --no-fund       || fail "npm ci"
step "lint";                   npm run lint                       || fail "lint"
step "type check";             npm run typecheck                  || fail "type check"
step "unit tests";             npm test                           || fail "unit tests"
step "real build (no .env)";   env -u VITE_USE_MOCK npm run build || fail "real build"
step "no-demo check";          npm run check:no-demo              || fail "no-demo check (demo data is in the real build)"
step "demo build";             VITE_USE_MOCK=true npm run build   || fail "demo build"
step "browser tests";          npm run test:e2e                   || fail "browser tests"

cd "$REPO"
rm -rf "$(dirname "$COPY")"
printf '\nCLEAN COPY: ALL PASSED (%s)\n' "$BRANCH"
