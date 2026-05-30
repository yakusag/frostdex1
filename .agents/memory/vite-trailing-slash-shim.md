---
name: Vite trailing-slash shim fix
description: How to fix EISDIR and shim resolution failures in vite-plugin-node-polyfills when using pnpm + Rollup build
---

## The Problems
1. **esbuild optimizer (dev)**: packages like `readable-stream@4.x` import `require('process/')` (trailing slash). VPNP rewrites this to a relative dir path → esbuild fails with "is a directory".
2. **vite client (dev)**: VPNP injects `import process from 'vite-plugin-node-polyfills/shims/process'` into `@vite/client`. Since `@vite/client` lives in the pnpm store, it can't find the shims package → 500 on `/@vite/client`.
3. **Rollup build**: packages like `@solana/web3.js` import `vite-plugin-node-polyfills/shims/buffer` at build time. VPNP rewrites `buffer` imports to this path, but Rollup resolves it as a directory → EISDIR error.

## The Fix

### In vite.config.ts:

```ts
const _require = createRequire(import.meta.url);
const vpnpMain = _require.resolve("vite-plugin-node-polyfills");
const vpnpDir = path.resolve(path.dirname(vpnpMain), "..");
const bufferShim  = path.join(vpnpDir, "shims/buffer/dist/index.cjs");
const processShim = path.join(vpnpDir, "shims/process/dist/index.cjs");
const globalShim  = path.join(vpnpDir, "shims/global/dist/index.cjs");

// Rollup plugin — works for both plugins[] and build.rollupOptions.plugins
const fixVpnpShims = {
  name: "fix-vpnp-shims",
  resolveId(id: string) {
    if (id.startsWith("vite-plugin-node-polyfills/shims/buffer"))  return bufferShim;
    if (id.startsWith("vite-plugin-node-polyfills/shims/process")) return processShim;
    if (id.startsWith("vite-plugin-node-polyfills/shims/global"))  return globalShim;
    return null;
  },
};

// esbuild plugin for optimizeDeps
const fixTrailingSlashShims = {
  name: "fix-trailing-slash-shims",
  setup(build: any) {
    build.onResolve({ filter: /^process\/$/ }, () => ({ path: processShim }));
    build.onResolve({ filter: /^buffer\/$/ },  () => ({ path: bufferShim  }));
  },
};
```

**Add `fixVpnpShims` to BOTH `plugins:[]` array AND `build.rollupOptions.plugins`.**

**Add `fixTrailingSlashShims` to `optimizeDeps.esbuildOptions.plugins`.**

**Add shim paths to `resolve.alias` as well (for dev server transform).**

**Why:** Vite's `resolve.alias` doesn't always intercept Rollup's `resolveId` for all module paths. The explicit Rollup plugin in `build.rollupOptions.plugins` is the reliable fix for production builds.

**PORT note:** Don't throw on missing PORT — use `Number(process.env.PORT || "8080")`. Vercel/CI run `vite build` without PORT set.

**Security note:** Never put API keys in `.replit [userenv.shared]` — that ends up in versioned `.replit` file. Use Replit Secrets (`requestEnvVar`) instead.

**How to apply:** Whenever using vite-plugin-node-polyfills@0.28+ with pnpm workspaces + Solana/Web3 deps.
