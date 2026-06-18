#!/bin/bash
# sync-github.sh — Push the current HEAD to GitHub after every checkpoint,
# then update the repo description and topics via the GitHub API.
# Requires: GITHUB_TOKEN secret set in Replit environment.
set -euo pipefail

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "[sync-github] GITHUB_TOKEN is not set — skipping GitHub push." >&2
  exit 0
fi

# Determine the remote URL and inject the token for authenticated push.
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$REMOTE_URL" ]; then
  echo "[sync-github] No 'origin' remote found — skipping GitHub push." >&2
  exit 0
fi

# Only handle https:// remotes (SSH remotes don't need a token injection).
if echo "$REMOTE_URL" | grep -q "^https://"; then
  # Strip any existing credentials from the URL, then inject the token.
  AUTHED_URL=$(echo "$REMOTE_URL" | sed "s|https://\([^@]*@\)\?|https://x-access-token:${GITHUB_TOKEN}@|")
else
  # SSH remote — push as-is; token not needed.
  AUTHED_URL="$REMOTE_URL"
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

echo "[sync-github] Pushing branch '${BRANCH}' to GitHub (origin)…"
git push "$AUTHED_URL" "HEAD:refs/heads/${BRANCH}" --force 2>&1 | \
  sed "s/${GITHUB_TOKEN}/***REDACTED***/g"

echo "[sync-github] Done."

# ---------------------------------------------------------------------------
# Update repo description and topics via the GitHub API.
# Values are sourced from github-meta.json at the repo root.
# ---------------------------------------------------------------------------

REPO_OWNER_SLUG=$(echo "$REMOTE_URL" | sed -E 's|.*github\.com[:/]([^/]+/[^/.]+)(\.git)?$|\1|')

if [ -z "$REPO_OWNER_SLUG" ]; then
  echo "[sync-github] Could not parse owner/repo from remote URL — skipping metadata update." >&2
  exit 0
fi

META_FILE="$(git rev-parse --show-toplevel)/github-meta.json"

if [ ! -f "$META_FILE" ]; then
  echo "[sync-github] github-meta.json not found — skipping metadata update." >&2
  exit 0
fi

# Use Node.js to safely construct JSON payloads from github-meta.json.
DESC_PAYLOAD=$(node -e "
  const m = require('$META_FILE');
  process.stdout.write(JSON.stringify({ description: m.description || '' }));
")

TOPICS_PAYLOAD=$(node -e "
  const m = require('$META_FILE');
  process.stdout.write(JSON.stringify({ names: m.topics || [] }));
")

echo "[sync-github] Updating repo description for ${REPO_OWNER_SLUG}…"
if curl -sf -X PATCH \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/${REPO_OWNER_SLUG}" \
  -d "$DESC_PAYLOAD" \
  > /dev/null; then
  echo "[sync-github] Description updated."
else
  echo "[sync-github] Description update failed (non-fatal)." >&2
fi

echo "[sync-github] Updating repo topics for ${REPO_OWNER_SLUG}…"
if curl -sf -X PUT \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/${REPO_OWNER_SLUG}/topics" \
  -d "$TOPICS_PAYLOAD" \
  > /dev/null; then
  echo "[sync-github] Topics updated."
else
  echo "[sync-github] Topics update failed (non-fatal)." >&2
fi
