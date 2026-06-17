#!/bin/bash
set -e
pnpm install --frozen-lockfile --filter "!@workspace/frostdex-mobile"
