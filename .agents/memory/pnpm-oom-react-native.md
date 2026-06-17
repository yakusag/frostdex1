---
name: pnpm OOM with react-native in frostdex-mobile
description: Any pnpm install that includes frostdex-mobile OOMs the container; manual store repair pattern
---

# pnpm OOM with frostdex-mobile

## The Rule
Never run `pnpm install` when frostdex-mobile is in the pnpm workspace scope. It will OOM the container.

**Why:** The pnpm virtual store is missing 626+ react-native packages. Attempting to install them causes OOM.

**How to apply:**
- All 40+ direct deps for frostdex-mobile are manually installed via tarball extraction to `artifacts/frostdex-mobile/node_modules/`
- frostdex-mobile IS included in pnpm-workspace.yaml so `pnpm --filter @workspace/frostdex-mobile run dev` works
- Only `pnpm run` is safe; `pnpm install` is not
- `scripts/post-merge.sh` uses `--filter '!@workspace/frostdex-mobile'`
- If a new package is needed, download and extract the tarball manually to node_modules/

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
