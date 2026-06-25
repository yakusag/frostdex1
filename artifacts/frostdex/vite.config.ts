import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { cjsInterop } from "vite-plugin-cjs-interop";
import { createRequire } from "module";

// PORT defaults to 8080 so `vite build` works in CI/Vercel without PORT set.
const port = Number(process.env.PORT || "8080");

const basePath = process.env.BASE_PATH || "/";

// Resolve absolute shim paths once at config-load time.
const _require = createRequire(import.meta.url);
const vpnpMain = _require.resolve("vite-plugin-node-polyfills");
const vpnpDir = path.resolve(path.dirname(vpnpMain), "..");
const bufferShim  = path.join(vpnpDir, "shims/buffer/dist/index.cjs");
const processShim = path.join(vpnpDir, "shims/process/dist/index.cjs");
const globalShim  = path.join(vpnpDir, "shims/global/dist/index.cjs");

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

export default defineConfig({
  base: basePath,
  plugins: [
    fixVpnpShims,
    react(),
    tailwindcss(),
    ...(process.env.NODE_ENV !== "production" ? [runtimeErrorOverlay()] : []),
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
    rollupOptions: {
      treeshake: false,
      onwarn: () => {},
      maxParallelFileOps: 2,
      plugins: [fixVpnpShims],
      output: {
        manualChunks(id) {
          if (id.includes("@orderly.network")) return "chunk-orderly";
          if (
            id.includes("/wagmi/") ||
            id.includes("/viem/") ||
            id.includes("/@reown/") ||
            id.includes("/ethers/")
          )
            return "chunk-web3";
          if (
            id.includes("/@solana/") ||
            id.includes("/@solana-mobile/") ||
            id.includes("/@coral-xyz/")
          )
            return "chunk-solana";
          if (
            id.includes("/@particle-network/") ||
            id.includes("/@privy-io/") ||
            id.includes("/@binance/") ||
            id.includes("/@web3-onboard/") ||
            id.includes("/@abstract-foundation/") ||
            id.includes("/@fractalwagmi/") ||
            id.includes("/@keystonehq/") ||
            id.includes("/@trezor/") ||
            id.includes("/woofi-swap-widget-kit/")
          )
            return "chunk-wallets";
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
    esbuildOptions: {
      define: { global: "globalThis" },
      plugins: [fixTrailingSlashShims],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
