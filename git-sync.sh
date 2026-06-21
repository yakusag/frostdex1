#!/bin/sh
# FrostDex GitHub Sync — pull then push
set -e

REMOTE="https://x-token-auth:${GITHUB_TOKEN}@github.com/yakusag/frostdex1.git"

echo "=== Pulling from GitHub ==="
git pull "$REMOTE" main --no-rebase 2>&1

echo "=== Pushing to GitHub ==="
git push "$REMOTE" HEAD:main 2>&1

echo "=== Sync done! ==="
