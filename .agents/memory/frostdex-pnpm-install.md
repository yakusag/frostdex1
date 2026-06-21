---
name: Frostdex pnpm install fix
description: pnpm install must complete before vite can start; solved by putting install in workflow run command
---

## Rule
The `artifacts/frostdex: web` workflow must run `pnpm install --frozen-lockfile` before starting vite,
because pnpm's isolated linker doesn't auto-install and the bash tool times out at 120s.

**Why:** pnpm isolated linker needs ~2500 packages linked. Downloads take >120s due to rate limiting.
The workflow process has no timeout, so install completes there (~38s on warm cache).

**How to apply:**
- artifact.toml dev run: `pnpm install --frozen-lockfile && pnpm --filter @workspace/frostdex run dev`
- Do NOT add install to package.json dev script (unnecessary overhead on hot restarts)
- After first install, subsequent restarts reuse cache and complete in ~4s
