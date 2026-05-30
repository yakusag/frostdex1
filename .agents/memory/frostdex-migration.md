---
name: FrostDex migration structure
description: How frostdex was migrated from .migration-backup/ into live artifacts/ — symlink approach and artifact deduplication
---

## Migration approach
- Source: `.migration-backup/artifacts/frostdex` and `.migration-backup/artifacts/frostdex-mobile`
- Destination: `artifacts/frostdex` and `artifacts/frostdex-mobile`
- Node modules: 1848 symlinks created via custom script (pnpm install gets killed at ~2100/2602 packages in 2.5min timeout)

## Artifact ID conflict
Both `.migration-backup/` and `artifacts/` copies had the same `id = "artifacts/frostdex"` in their `artifact.toml`. This caused the migration-backup version to shadow the live one in the preview routing.

**Fix:** Remove `.replit-artifact/artifact.toml` from all `.migration-backup/` subdirectories so only the live artifacts are registered.

## Why pnpm install gets killed
The full pnpm install for frostdex hits ~2600 packages which takes >2.5 min in the Replit sandbox, hitting the timeout. Symlink approach is used instead.

**How to apply:** If pnpm install is killed, use the manual symlink approach or add only specific missing packages.
