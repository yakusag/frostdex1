---
name: pnpm OOM with react-native in frostdex-mobile
description: History of OOM issue and how it was resolved; current install command for mobile app; manual store repair pattern
---

# pnpm install for frostdex-mobile

## Current Status: RESOLVED
The pnpm virtual store is now fully populated (2,625+ entries). Normal `pnpm install` works.

## Working install command
```
CI=true pnpm install --filter @workspace/frostdex-mobile --no-optional --ignore-scripts --no-frozen-lockfile
```
- `CI=true` — suppresses the TTY prompt to remove existing node_modules
- `--no-optional` — skips optional packages, reduces scope
- `--ignore-scripts` — skips postinstall scripts during install
- `--no-frozen-lockfile` — allows lockfile updates when package.json diverges

Second and subsequent runs complete in ~3 seconds (lockfile already up to date).

## History
Previously, `pnpm install` OOMed because the virtual store was missing 626+ react-native packages
and the container didn't have enough free memory. The fix was simply to run the install with
adequate memory available (5+ GB free) and the correct flags. No tarball workarounds needed.

**Why it failed before:** Container was likely memory-constrained at the time. With 5+ GB available
and `--no-optional --ignore-scripts`, the install completes in ~47s on first run.

**How to apply:**
- Use the command above when adding/upgrading packages for frostdex-mobile
- The manual tarball workaround is no longer needed
- `pnpm run` still works as before

## Manual Store Repair (when OOM leaves empty pnpm store entries)

When pnpm install OOMs mid-run, it leaves `.pnpm/` store dirs as empty directories.
Symptom: vite fails with "Cannot find package 'X'" even though the symlink exists.

Fix pattern:
1. `npm install --no-save <pkg>@<version>` in /tmp to get all deps resolved
2. For each empty store dir: `cp -r /tmp/node_modules/<pkg>/. <store-dir>/node_modules/<pkg>/`
3. Create missing symlinks in `artifacts/<name>/node_modules/<pkg>` → absolute path to store entry

Packages that needed repair for frostdex:web workflow:
- vite-plugin-node-polyfills@0.28.0 (+ its deps: @rollup/plugin-inject, @rollup/pluginutils)
- vite-plugin-cjs-interop@4.0.3

## Lockfile Specifier Fix
When task agents update package.json versions without updating pnpm-lock.yaml specifiers,
pnpm reports "specifier mismatch". Fix: update the `specifier:` lines in `pnpm-lock.yaml` to match.
