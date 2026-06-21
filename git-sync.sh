#!/bin/sh
# FrostDex GitHub Sync — pull then push
# Uses ~/.github-cred-helper.sh for auth (token never embedded in URL)
set -e

echo "=== Pulling from GitHub ==="
git pull origin main --no-rebase 2>&1

echo "=== Pushing to GitHub ==="
git push origin HEAD:main 2>&1

echo "=== Sync done! ==="
