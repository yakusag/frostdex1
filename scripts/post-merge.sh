#!/bin/bash
set -e
# Exclude frostdex-mobile: pnpm install with react-native scope OOMs the container.
# Its deps are managed manually via tarball extraction in node_modules/.
pnpm install --frozen-lockfile --filter '!@workspace/frostdex-mobile'
pnpm --filter db push
