---
name: Vite trailing-slash shim fix
description: How to fix esbuild optimizer failing on `process/` and `buffer/` trailing-slash imports from packages like readable-stream
---

## The Problem
`vite-plugin-node-polyfills` registers aliases for `buffer/` and `process/` (with trailing slash). During esbuild's dep optimizer crawl, packages like `readable-stream@4.x` import `require('process/')` which gets rewritten to a relative shims path. esbuild then fails: `Cannot read file "vite-plugin-node-polyfills/shims/process": is a directory`.

## The Fix
Add an esbuild plugin in `optimizeDeps.esbuildOptions.plugins` that intercepts `process/` and `buffer/` with absolute paths:

```ts
const _require = createRequire(import.meta.url);
const vpnpMain = _require.resolve("vite-plugin-node-polyfills");
const vpnpDir = path.resolve(path.dirname(vpnpMain), "..");
const bufferShim = path.join(vpnpDir, "shims/buffer/dist/index.cjs");
const processShim = path.join(vpnpDir, "shims/process/dist/index.cjs");

const fixTrailingSlashShims = {
  name: "fix-trailing-slash-shims",
  setup(build: any) {
    build.onResolve({ filter: /^process\/$/ }, () => ({ path: processShim }));
    build.onResolve({ filter: /^buffer\/$/ }, () => ({ path: bufferShim }));
  },
};
// add to optimizeDeps.esbuildOptions.plugins
```

**Why:** `_require.resolve("vite-plugin-node-polyfills/package.json")` fails because that package doesn't export `package.json` in its exports field. Must resolve the main entry instead and go up one directory.

**Also add** `readable-stream` to `optimizeDeps.exclude` as a belt-and-suspenders fix.

**How to apply:** Whenever using `vite-plugin-node-polyfills` + packages that use trailing-slash node built-in imports (readable-stream, isomorphic-fetch, etc.).
