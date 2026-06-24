import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { cjsInterop } from "vite-plugin-cjs-interop";
import { createRequire } from "module";

const port = Number(process.env.PORT || "8080");
const basePath = process.env.BASE_PATH || "/";
const isProd = process.env.NODE_ENV === "production";

const _require = createRequire(import.meta.url);
const vpnpMain = _require.resolve("vite-plugin-node-polyfills");
const vpnpDir = path.resolve(path.dirname(vpnpMain), "..");
const bufferShim  = path.join(vpnpDir, "shims/buffer/dist/index.cjs");
const processShim = path.join(vpnpDir, "shims/process/dist/index.cjs");
const globalShim  = path.join(vpnpDir, "shims/global/dist/index.cjs");

// Find the HIGHEST-VERSION complete viem ESM installation in the pnpm store.
// pnpm install may partially extract packages; we scan for _esm/clients/createClient.js
// and pick the entry with the highest semver so wagmi/porto don't get an old viem.
function findCompleteViemDir(): string | null {
  const pnpmDir = path.resolve(import.meta.dirname, "../../node_modules/.pnpm");
  try {
    const entries = fs.readdirSync(pnpmDir).filter(e => e.startsWith("viem@"));
    // Sort descending by the semver string immediately after "viem@"
    entries.sort((a, b) => {
      const va = a.slice("viem@".length).split("_")[0];
      const vb = b.slice("viem@".length).split("_")[0];
      // Compare numeric segments
      const pa = va.split(".").map(Number);
      const pb = vb.split(".").map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
      }
      return a < b ? 1 : -1; // tie-break: prefer zod@3.22.4 over zod@3.25.76
    });
    for (const entry of entries) {
      const viemDir = path.join(pnpmDir, entry, "node_modules/viem");
      if (fs.existsSync(path.join(viemDir, "_esm/clients/createClient.js"))) return viemDir;
    }
  } catch {}
  return null;
}
const completeViemDir = findCompleteViemDir();
// Alias viem/* to the complete directory so sub-path imports (viem/chains) resolve correctly.
// Pointing to a file would cause viem/chains → <file>/chains (ENOTDIR).
const viemAlias      = completeViemDir ?? path.dirname(_require.resolve("viem/package.json"));
const viemChainsPath = path.join(viemAlias, "_esm/chains/index.js");

// Pre-compute viem sub-path map at config load time (avoids repeated fs.existsSync per-module).
const viemSubpathCache = new Map<string, string>();
function resolveViemSubpath(id: string): string | null {
  if (viemSubpathCache.has(id)) return viemSubpathCache.get(id)!;
  if (id === "viem") {
    const p = path.join(viemAlias, "_esm/index.js");
    viemSubpathCache.set(id, p);
    return p;
  }
  if (id.startsWith("viem/")) {
    const sub = id.slice("viem/".length);
    const c1 = path.join(viemAlias, "_esm", sub, "index.js");
    if (fs.existsSync(c1)) { viemSubpathCache.set(id, c1); return c1; }
    const c2 = path.join(viemAlias, "_esm", sub + ".js");
    if (fs.existsSync(c2)) { viemSubpathCache.set(id, c2); return c2; }
    viemSubpathCache.set(id, "");
    return null;
  }
  return null;
}
// Pre-warm common viem paths immediately so they never hit disk during build
["viem", "viem/chains", "viem/actions", "viem/utils", "viem/clients", "viem/errors"].forEach(resolveViemSubpath);

// Pre-resolution plugin: intercept ALL viem imports before Vite's resolver sees them.
// resolve.alias { "viem": file } causes viem/chains → file/chains (ENOTDIR); a plugin avoids this.
const viemRedirect = {
  name: "viem-redirect",
  enforce: "pre" as const,
  resolveId(id: string) {
    if (id === "viem" || id.startsWith("viem/")) return resolveViemSubpath(id);
    return null;
  },
};

const fixVpnpShims = {
  name: "fix-vpnp-shims",
  resolveId(id: string) {
    if (id === "vite-plugin-node-polyfills/shims/buffer"  || id.startsWith("vite-plugin-node-polyfills/shims/buffer/"))  return bufferShim;
    if (id === "vite-plugin-node-polyfills/shims/process" || id.startsWith("vite-plugin-node-polyfills/shims/process/")) return processShim;
    if (id === "vite-plugin-node-polyfills/shims/global"  || id.startsWith("vite-plugin-node-polyfills/shims/global/"))  return globalShim;
    return null;
  },
};

const fixTrailingSlashShims = {
  name: "fix-trailing-slash-shims",
  setup(build: any) {
    build.onResolve({ filter: /^process\/$/ }, () => ({ path: processShim }));
    build.onResolve({ filter: /^buffer\/$/ },  () => ({ path: bufferShim  }));
    build.onResolve({ filter: /^global\/$/  }, () => ({ path: globalShim  }));
  },
};

// esbuild plugin: intercept es5-ext/* imports before package exports resolution.
// The es5-ext stub uses "./*" → "./wildcard.js" in exports, but esbuild appends
// the #/prototype-path fragment to the file path, producing an unreadable path.
const es5ExtStubEsbuild = {
  name: "es5-ext-stub-esbuild",
  setup(build: any) {
    build.onResolve({ filter: /^es5-ext\// }, (args: { path: string }) => ({
      path: args.path,
      namespace: "es5-ext-stub",
    }));
    build.onLoad({ filter: /.*/, namespace: "es5-ext-stub" }, (args: { path: string }) => {
      const id = args.path;
      // Array prototype helpers
      if (/array\/#\/e-?index-?of/i.test(id))
        return { contents: "module.exports = function(v){return Array.prototype.indexOf.call(this,v);};" };
      if (/array\/#\/contains/i.test(id))
        return { contents: "module.exports = function(v){return Array.prototype.indexOf.call(this,v)!==-1;};" };
      // String prototype helpers
      if (/string\/#\/contains/i.test(id))
        return { contents: "module.exports = function(v){return String.prototype.indexOf.call(this,v)!==-1;};" };
      if (/string\/#\/starts-with/i.test(id))
        return { contents: "module.exports = function(v){return String.prototype.startsWith.call(this,v);};" };
      // Object / function helpers
      if (/function\/is-arguments/i.test(id))
        return { contents: "module.exports = function(v){return Object.prototype.toString.call(v)==='[object Arguments]';};" };
      if (/object\/is-object/i.test(id))
        return { contents: "module.exports = function(v){return v!=null&&typeof v==='object';};" };
      if (/object\/valid-callable/i.test(id))
        return { contents: "module.exports = function(v){if(typeof v!=='function')throw new TypeError(v+' is not a function');return v;};" };
      // Default: return a no-op function stub
      return { contents: "module.exports = function(){};" };
    });
  },
};

// esbuild plugin for optimizeDeps pre-bundling phase.
// Vite plugins (resolveId) do NOT run during esbuild dep scanning — we must use esbuild's onResolve.
// This redirects every `viem` and `viem/*` import (from any importer) to the COMPLETE viem installation.
const viemRedirectEsbuild = {
  name: "viem-redirect-esbuild",
  setup(build: any) {
    build.onResolve({ filter: /^viem$/ }, () => ({
      path: path.join(viemAlias, "_esm/index.js"),
    }));
    build.onResolve({ filter: /^viem\/chains$/ }, () => ({
      path: path.join(viemAlias, "_esm/chains/index.js"),
    }));
    build.onResolve({ filter: /^viem\// }, (args: { path: string }) => {
      const sub = args.path.slice("viem/".length);
      const c1 = path.join(viemAlias, "_esm", sub, "index.js");
      if (fs.existsSync(c1)) return { path: c1 };
      const c2 = path.join(viemAlias, "_esm", sub + ".js");
      if (fs.existsSync(c2)) return { path: c2 };
      return null;
    });
  },
};

export default defineConfig({
  base: basePath,
  plugins: [
    viemRedirect,
    fixVpnpShims,
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    nodePolyfills({
      include: ["buffer", "crypto", "stream", "process"],
      globals: { Buffer: true, process: true, global: true },
    }),
    cjsInterop({
      dependencies: ["bs58", "@coral-xyz/anchor", "lodash"],
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "vite-plugin-node-polyfills/shims/process": processShim,
      "vite-plugin-node-polyfills/shims/buffer":  bufferShim,
      "vite-plugin-node-polyfills/shims/global":  globalShim,
      // viem is redirected by the viemRedirect plugin (enforce:"pre") above — no alias needed here
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    minify: "esbuild",
    rollupOptions: {
      treeshake: false,
      onwarn: () => {},
      plugins: [fixVpnpShims],
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: false },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom"],
    exclude: [
      "@keystonehq/bc-ur-registry",
      "babel-runtime",
      "@particle-network/solana-wallet",
      "@particle-network/auth",
      "@particle-network/analytics",
      "@particle-network/crypto",
      "@trezor/device-utils",
      "@solana/wallet-standard-wallet-adapter-base",
      "@abstract-foundation/agw-react",
      "@fractalwagmi/solana-wallet-adapter",
      "@orderly.network/affiliate",
    ],
    esbuildOptions: {
      define: { global: "globalThis" },
      plugins: [es5ExtStubEsbuild, viemRedirectEsbuild, fixTrailingSlashShims],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
