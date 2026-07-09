import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { cjsInterop } from "vite-plugin-cjs-interop";
import { createRequire } from "module";

const port = Number(process.env.PORT || "8080");
const basePath = process.env.BASE_PATH || "/";

const _require = createRequire(import.meta.url);
const fs = _require("fs") as typeof import("fs");

// ── Shim paths ───────────────────────────────────────────────────────────────
const vpnpMain = _require.resolve("vite-plugin-node-polyfills");
const vpnpDir  = path.resolve(path.dirname(vpnpMain), "..");
const bufferShim  = path.join(vpnpDir, "shims/buffer/dist/index.cjs");
const processShim = path.join(vpnpDir, "shims/process/dist/index.cjs");
const globalShim  = path.join(vpnpDir, "shims/global/dist/index.cjs");

// eventemitter3: use the ESM build (proper default export)
const ee3Esm = _require.resolve("eventemitter3").replace(/index\.js$/, "index.mjs");

// Find a package in the pnpm virtual store
function findPnpmPkg(prefix: string): string | null {
  const base = path.join(import.meta.dirname, "../../node_modules/.pnpm");
  if (!fs.existsSync(base)) return null;
  const entry = fs.readdirSync(base).find(e => e.startsWith(prefix));
  if (!entry) return null;
  const pkgName = prefix.split("@")[0];
  return path.join(base, entry, "node_modules", pkgName);
}

const dayjsDir = findPnpmPkg("dayjs@1.11");

// Read dayjs source once at config-load time for the virtual module
const dayjsCjsSrc = dayjsDir
  ? (() => {
      const f = path.join(dayjsDir, "dayjs.min.js");
      return fs.existsSync(f) ? fs.readFileSync(f, "utf-8") : null;
    })()
  : null;

// (CJS shim sources no longer needed — shims are pure inline ESM now)

// ── Virtual module IDs ────────────────────────────────────────────────────────
const V = {
  USS_SHIM:      "\0polyfill:uss-shim",
  USS_SHIM_SEL:  "\0polyfill:uss-shim-with-selector",
  USS_WITH_SEL:  "\0polyfill:uss-with-selector",
  USS_INDEX:     "\0polyfill:uss-index",
  DAYJS_MIN:     "\0polyfill:dayjs-min",
  // CJS shims wrapped as proper ESM to avoid "Object.defineProperty on non-object"
  // in Rollup production builds (exports is undefined in ESM context).
  GLOBAL_SHIM:   "\0polyfill:global-shim",
  BUFFER_SHIM:   "\0polyfill:buffer-shim",
  PROCESS_SHIM:  "\0polyfill:process-shim",
};

// ── Central plugin: virtual ESM polyfills for pnpm-store CJS packages ─────────
const fixCjsImports = {
  name: "fix-cjs-imports",

  resolveId(id: string) {
    // vite-plugin-node-polyfills shims → return virtual ESM IDs instead of CJS
    // files. The CJS files use Object.defineProperties(exports, ...) which
    // crashes Rollup production builds because exports is undefined in ESM scope.
    if (id.startsWith("vite-plugin-node-polyfills/shims/buffer"))  return V.BUFFER_SHIM;
    if (id.startsWith("vite-plugin-node-polyfills/shims/process")) return V.PROCESS_SHIM;
    if (id.startsWith("vite-plugin-node-polyfills/shims/global"))  return V.GLOBAL_SHIM;

    // use-sync-external-store — redirect to virtual ESM (React 19 has it built-in)
    if (id === "use-sync-external-store/shim/with-selector.js" ||
        id === "use-sync-external-store/shim/with-selector")
      return V.USS_SHIM_SEL;
    if (id === "use-sync-external-store/shim/index.js" ||
        id === "use-sync-external-store/shim")
      return V.USS_SHIM;
    if (id === "use-sync-external-store/with-selector.js" ||
        id === "use-sync-external-store/with-selector")
      return V.USS_WITH_SEL;
    if (id === "use-sync-external-store" ||
        id === "use-sync-external-store/index.js")
      return V.USS_INDEX;

    // dayjs — serve the UMD source as a virtual ESM module
    if (id === "dayjs/dayjs.min.js" || id === "dayjs/dayjs.min")
      return dayjsCjsSrc ? V.DAYJS_MIN : null;

    return null;
  },

  load(id: string) {
    // use-sync-external-store: React 19 has useSyncExternalStore built-in
    if (id === V.USS_SHIM || id === V.USS_INDEX) {
      return `export { useSyncExternalStore } from 'react';\nexport { useSyncExternalStore as default } from 'react';\n`;
    }
    if (id === V.USS_SHIM_SEL || id === V.USS_WITH_SEL) {
      return `
import { useSyncExternalStore } from 'react';
function useSyncExternalStoreWithSelector(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
  let selected;
  const getSelected = () => {
    const next = selector(getSnapshot());
    if (selected !== undefined && isEqual && isEqual(selected, next)) return selected;
    return (selected = next);
  };
  const getServerSelected = getServerSnapshot ? () => selector(getServerSnapshot()) : undefined;
  return useSyncExternalStore(subscribe, getSelected, getServerSelected);
}
export { useSyncExternalStoreWithSelector };
export default { useSyncExternalStoreWithSelector };
`;
    }

    // dayjs: wrap UMD source so module.exports becomes the ESM default
    if (id === V.DAYJS_MIN && dayjsCjsSrc) {
      return `
const module = { exports: {} };
const exports = module.exports;
const define = undefined; // disable AMD path
${dayjsCjsSrc}
export default module.exports;
`;
    }

    // vite-plugin-node-polyfills shims — pure inline ESM, zero require() calls.
    // Embedding the raw CJS source doesn't work in Rollup production builds because
    // the CJS files call require() (no-op in ESM) and Object.defineProperties(exports,…)
    // where exports is undefined. These inline replacements are self-contained.

    if (id === V.GLOBAL_SHIM) {
      return `const g = globalThis;\nexport { g as global };\nexport default g;\n`;
    }

    if (id === V.BUFFER_SHIM) {
      // Full faithful re-export from the 'buffer' npm package (already resolved
      // to the browser polyfill by vite-plugin-node-polyfills). Exporting all
      // named members that the upstream CJS shim exposes so nothing is missing.
      return `
import * as _buf from 'buffer';
export const Buffer           = _buf.Buffer;
export const Blob             = _buf.Blob             ?? globalThis.Blob;
export const File             = _buf.File             ?? globalThis.File;
export const atob             = _buf.atob             ?? globalThis.atob;
export const btoa             = _buf.btoa             ?? globalThis.btoa;
export const SlowBuffer       = _buf.SlowBuffer;
export const INSPECT_MAX_BYTES= _buf.INSPECT_MAX_BYTES;
export const kMaxLength       = _buf.kMaxLength;
export const kStringMaxLength = _buf.kStringMaxLength;
export const constants        = _buf.constants;
export const transcode        = _buf.transcode;
export const isAscii          = _buf.isAscii;
export const isUtf8           = _buf.isUtf8;
export const resolveObjectURL = _buf.resolveObjectURL;
export default _buf.Buffer;
`;
    }

    if (id === V.PROCESS_SHIM) {
      // Browser-safe process polyfill — matches the upstream shim surface.
      // nextTick uses a micro-task queue so ordering matches Node semantics.
      return `
const _noop = () => _process;
const _ntQueue = [];
let _ntScheduled = false;
function _drainNt() { _ntScheduled = false; const q = _ntQueue.splice(0); for (const [fn, a] of q) fn(...a); }
const _process = {
  title: 'browser',
  browser: true,
  env: {},
  argv: [],
  version: '',
  versions: {},
  platform: 'browser',
  on: _noop,
  addListener: _noop,
  once: _noop,
  off: _noop,
  removeListener: _noop,
  removeAllListeners: _noop,
  emit: () => false,
  prependListener: _noop,
  prependOnceListener: _noop,
  listeners: () => [],
  binding: (n) => { throw new Error('process.binding is not supported'); },
  cwd: () => '/',
  chdir: () => { throw new Error('process.chdir is not supported'); },
  umask: () => 0,
  hrtime: (t) => t ? [0, 0] : [0, 0],
  exit: () => {},
  nextTick(fn, ...args) {
    _ntQueue.push([fn, args]);
    if (!_ntScheduled) { _ntScheduled = true; Promise.resolve().then(_drainNt); }
  },
};
export { _process as process };
export default _process;
`;
    }

    return null;
  },
};

// ── esbuild plugin for optimizeDeps shim resolution ───────────────────────────
const fixEsbuildShims = {
  name: "fix-esbuild-shims",
  setup(build: any) {
    build.onResolve({ filter: /^process\/$/ }, () => ({ path: processShim }));
    build.onResolve({ filter: /^buffer\/$/ },  () => ({ path: bufferShim  }));
    build.onResolve({ filter: /^global\/$/  }, () => ({ path: globalShim  }));
    build.onResolve({ filter: /vite-plugin-node-polyfills\/shims\/buffer/  }, () => ({ path: bufferShim  }));
    build.onResolve({ filter: /vite-plugin-node-polyfills\/shims\/process/ }, () => ({ path: processShim }));
    build.onResolve({ filter: /vite-plugin-node-polyfills\/shims\/global/  }, () => ({ path: globalShim  }));
  },
};

export default defineConfig({
  base: basePath,
  define: {
    // Replace bare `global` references in production Rollup build.
    // Without this, CJS libraries that call Object.defineProperty(global, ...)
    // receive undefined and throw "Object.defineProperty called on non-object".
    global: "globalThis",
  },
  plugins: [
    fixCjsImports,
    react(),
    tailwindcss(),
    ...(process.env.NODE_ENV !== "production" ? [runtimeErrorOverlay()] : []),
    nodePolyfills({
      include: ["buffer", "crypto", "stream", "process"],
      globals: { Buffer: false, process: false, global: false },
      protocolImports: true,
    }),
    cjsInterop({
      dependencies: ["bs58", "@coral-xyz/anchor", "lodash"],
    }),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({ root: path.resolve(import.meta.dirname, "..") }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
        ]
      : []),
  ],
  resolve: {
    alias: {
      // shims handled by fixCjsImports plugin (virtual ESM) — no CJS alias needed
      "eventemitter3": ee3Esm,
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: "esnext",
    minify: false,
    cssMinify: false,
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 10000,
    maxParallelFileOps: 2,
    // Force Rollup's built-in @rollup/plugin-commonjs to transform ALL
    // node_modules files (not just .cjs) so that CJS-only packages don't
    // emit bare `Object.defineProperty(exports, ...)` calls at runtime.
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      treeshake: false,
      onwarn: () => {},
      // fixCjsImports is already in top-level `plugins`; do NOT add it here
      // again — duplicate plugin registration causes resolveId to fire twice
      // and can prevent virtual module IDs from being matched correctly.
      output: {
        format: "es",
        hoistTransitiveImports: false,
        manualChunks(id) {
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) return "chunk-react";
          if (id.includes("@orderly.network"))   return "chunk-orderly";
          if (id.includes("/wagmi/") || id.includes("/viem/") || id.includes("/@reown/") || id.includes("/ethers/"))
            return "chunk-web3";
          if (id.includes("/@solana/") || id.includes("/@solana-mobile/") || id.includes("/@coral-xyz/"))
            return "chunk-solana";
          if (
            id.includes("/@particle-network/") || id.includes("/@privy-io/") ||
            id.includes("/@binance/") || id.includes("/@web3-onboard/") ||
            id.includes("/@abstract-foundation/") || id.includes("/@fractalwagmi/") ||
            id.includes("/@keystonehq/") || id.includes("/@trezor/") ||
            id.includes("/woofi-swap-widget-kit/")
          ) return "chunk-wallets";
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: false },
    proxy: { "/api": { target: "http://localhost:8080", changeOrigin: true } },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "eventemitter3",
      // shims are now virtual ESM modules — no need to pre-bundle the CJS files
    ],
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
      "readable-stream",
      "ethers",
      "memoizee",
      "@orderly.network/affiliate",
      "@orderly.network/default-solana-adapter",
      "@orderly.network/hooks",
      "@orderly.network/i18n",
      "@orderly.network/markets",
      "@orderly.network/portfolio",
      "@orderly.network/react-app",
      "@orderly.network/trading",
      "@orderly.network/trading-leaderboard",
      "@orderly.network/trading-points",
      "@orderly.network/types",
      "@orderly.network/ui",
      "@orderly.network/ui-scaffold",
      "@orderly.network/vaults",
      "@orderly.network/wallet-connector",
      "@orderly.network/wallet-connector-privy",
      "wagmi",
      "viem",
      "@reown/appkit",
      "@tanstack/react-query",
      "@solana/wallet-adapter-base",
      "@solana/wallet-adapter-wallets",
      "@solana-mobile/wallet-adapter-mobile",
      "@privy-io/cross-app-connect",
      "@binance/w3w-blocknative-connector",
      "@web3-onboard/injected-wallets",
      "@web3-onboard/walletconnect",
      "woofi-swap-widget-kit",
    ],
    force: true,
    esbuildOptions: {
      define: { global: "globalThis" },
      plugins: [fixEsbuildShims],
    },
  },
  preview: { port, host: "0.0.0.0", allowedHosts: true },
});
