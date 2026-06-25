#!/bin/sh
# FrostDex GitHub Sync — commit any pending changes, pull then push
set -e

REMOTE_URL="https://${GITHUB_TOKEN}@github.com/yakusag/frostdex1.git"

git config user.email "sync@frostdex.pw" 2>/dev/null || true
git config user.name "FrostDex Sync" 2>/dev/null || true

# Clear any stale lock files left by previous processes
rm -f .git/index.lock .git/MERGE_HEAD .git/CHERRY_PICK_HEAD 2>/dev/null || true

echo "=== Staging and committing pending changes ==="
git add -A
if ! git diff --cached --quiet; then
  git commit -m "chore: sync pending changes"
fi

echo "=== Pulling from GitHub (ours wins on conflict) ==="
git pull "$REMOTE_URL" main --no-rebase -X ours 2>&1 || {
  echo "Pull had conflicts — using ours strategy to resolve"
  git checkout --ours -- . 2>/dev/null || true
  git add -A
  git commit -m "chore: resolve conflicts (keep local)" 2>/dev/null || true
}

echo "=== Pushing to GitHub ==="
git push "$REMOTE_URL" HEAD:main 2>&1

echo "=== Sync done! ==="
