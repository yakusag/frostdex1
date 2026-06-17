#!/bin/bash
set -e
# CI=true is required for non-TTY environments (post-merge runs with stdin closed).
# pnpm will refuse to remove existing node_modules without TTY confirmation
# unless CI=true is set.
CI=true pnpm install --frozen-lockfile
pnpm --filter db push
