#!/bin/sh
# FrostDex GitHub Sync — pull then push using GITHUB_TOKEN
set -e

REMOTE_URL="https://${GITHUB_TOKEN}@github.com/yakusag/frostdex1.git"

echo "=== Pulling from GitHub ==="
git pull "$REMOTE_URL" main --no-rebase 2>&1

echo "=== Pushing to GitHub ==="
git push "$REMOTE_URL" HEAD:main 2>&1

echo "=== Sync done! ==="
