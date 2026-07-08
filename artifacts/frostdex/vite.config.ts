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

// ── Virtual module IDs ────────────────────────────────────────────────────────
const V = {
  USS_SHIM:      "\0polyfill:uss-shim",
  USS_SHIM_SEL:  "\0polyfill:uss-shim-with-selector",
  USS_WITH_SEL:  "\0polyfill:uss-with-selector",
  USS_INDEX:     "\0polyfill:uss-index",
  DAYJS_MIN:     "\0polyfill:dayjs-min",
};

// ── Central plugin: virtual ESM polyfills for pnpm-store CJS packages ─────────
const fixCjsImports = {
  name: "fix-cjs-imports",

  resolveId(id: string) {
    // vite-plugin-node-polyfills shims
    if (id.startsWith("vite-plugin-node-polyfills/shims/buffer"))  return bufferShim;
    if (id.startsWith("vite-plugin-node-polyfills/shims/process")) return processShim;
    if (id.startsWith("vite-plugin-node-polyfills/shims/global"))  return globalShim;

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
      "vite-plugin-node-polyfills/shims/process": processShim,
      "vite-plugin-node-polyfills/shims/buffer":  bufferShim,
      "vite-plugin-node-polyfills/shims/global":  globalShim,
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
    rollupOptions: {
      treeshake: false,
      onwarn: () => {},
      plugins: [fixCjsImports],
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
      "vite-plugin-node-polyfills/shims/buffer",
      "vite-plugin-node-polyfills/shims/process",
      "vite-plugin-node-polyfills/shims/global",
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
