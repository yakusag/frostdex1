#!/bin/bash
set -e

echo "post-merge: Installing dependencies..."
yarn install --frozen-lockfile --non-interactive 2>&1

echo "post-merge: Done."
