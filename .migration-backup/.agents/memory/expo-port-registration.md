---
name: Expo Workflow Port Registration
description: How to fix DIDNT_OPEN_A_PORT for expo artifacts in this project
---

# Expo Workflow Port Registration

## The Rule
For expo (mobile) artifacts, `localPort` in artifact.toml is NOT automatically added to `.replit` [[ports]]. Without the port entry in `.replit`, Replit's workflow health check reports DIDNT_OPEN_A_PORT even when Metro is running and bound to that port.

**Why:** The frostdex-mobile artifact was migrated from another repl. Port registration in .replit didn't transfer. verifyAndReplaceArtifactToml does NOT update .replit [[ports]].

**How to apply:** Use `verifyAndReplaceDotReplit({ tempFilePath, dotReplitPath })` to add the port:
```toml
[[ports]]
localPort = 23456
externalPort = 4000
```

Also: if there is a duplicate artifact (e.g. in .migration-backup/) with the same `id`, disable it by renaming its `.replit-artifact/` directory to `.replit-artifact-disabled/` — duplicate IDs block port detection.

## Secondary Fix
Metro bundling error: `semver/functions/satisfies` not found.
- Cause: semver v6.x installed (no `functions/` subdir); react-native-reanimated requires semver v7+
- Fix: Download semver 7.7.2 tarball and overwrite `node_modules/semver/`; add `--reset-cache` to dev script
