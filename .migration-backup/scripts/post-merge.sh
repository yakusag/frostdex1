#!/bin/bash
set -e
# CI=true is required for non-TTY environments (post-merge runs with stdin closed).
# pnpm will refuse to remove existing node_modules without TTY confirmation
# unless CI=true is set.
CI=true pnpm install --frozen-lockfile
pnpm --filter db push

# Push the latest checkpoint to GitHub so the repo stays in sync automatically.
bash "$(dirname "$0")/sync-github.sh" || true
