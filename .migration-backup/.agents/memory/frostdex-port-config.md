---
name: FrostDex port configuration
description: Port assignments for frostdex artifacts — web app moved off 8080 to avoid conflict with api-server
---

## Port Assignments

| Artifact | Local Port | External |
|---|---|---|
| api-server | 8080 | 80 |
| frostdex web | 3000 | 3000 |
| frostdex-mobile (Expo web) | 23456 | 3003 |

## Why

Both api-server and frostdex web originally used port 8080. This caused `Error: Port 8080 is already in use` when starting the web workflow. Fixed by updating `artifacts/frostdex/.replit-artifact/artifact.toml` → `localPort = 3000` and `PORT = "3000"` in `[services.env]`.

## How to apply

If frostdex web workflow fails with port conflict, check artifact.toml `localPort` and `[services.env] PORT`. Use `verifyAndReplaceArtifactToml` to change (cannot use `configureWorkflow` — artifact-managed).

## Other notes

- `@orderly.network/affiliate` must be in `optimizeDeps.exclude` in vite.config.ts — otherwise esbuild crashes with "The service was stopped" during dep optimization.
- Clearing Vite cache (`rm -rf artifacts/frostdex/node_modules/.vite`) before restart helps when port changes invalidate the dep cache.
