---
name: pnpm OOM with react-native in frostdex-mobile
description: Any pnpm install that includes frostdex-mobile OOMs the container
---

# pnpm OOM with frostdex-mobile

## The Rule
Never run `pnpm install` when frostdex-mobile is in the pnpm workspace scope. It will OOM the container.

**Why:** The pnpm virtual store is missing 626+ react-native packages. Attempting to install them causes OOM.

**How to apply:**
- All 40+ direct deps for frostdex-mobile are manually installed via tarball extraction to `artifacts/frostdex-mobile/node_modules/`
- frostdex-mobile IS included in pnpm-workspace.yaml so `pnpm --filter @workspace/frostdex-mobile run dev` works
- Only `pnpm run` is safe; `pnpm install` is not
- If a new package is needed, download and extract the tarball manually to node_modules/
