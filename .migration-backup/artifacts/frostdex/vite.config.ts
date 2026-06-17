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
const isProd = process.env.NODE_ENV === "production";

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
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
        pure_funcs: ["console.log", "console.info", "console.debug", "console.warn"],
      },
      format: { comments: false },
    },
    rollupOptions: {
      plugins: [fixVpnpShims],
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/react-router-dom/") || id.includes("node_modules/react-router/") || id.includes("node_modules/react-helmet-async/")) {
            return "react-vendor";
          }
          if (id.includes("node_modules/recharts/") || id.includes("node_modules/d3-") || id.includes("node_modules/victory-")) {
            return "charts-vendor";
          }
          if (id.includes("node_modules/@orderly.network/")) {
            return "orderly-vendor";
          }
          if (id.includes("node_modules/@solana/") || id.includes("node_modules/@coral-xyz/") || id.includes("node_modules/bs58") || id.includes("node_modules/borsh")) {
            return "solana-vendor";
          }
          if (id.includes("node_modules/ethers") || id.includes("node_modules/@ethersproject/") || id.includes("node_modules/viem") || id.includes("node_modules/wagmi")) {
            return "eth-vendor";
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: false },
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
      "@orderly.network/affiliate",
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
