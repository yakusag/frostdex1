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
// This avoids "EISDIR" failures where Rollup/esbuild try to read a directory
// instead of the shim's actual CJS entry file.
const _require = createRequire(import.meta.url);
const vpnpMain = _require.resolve("vite-plugin-node-polyfills");
const vpnpDir = path.resolve(path.dirname(vpnpMain), "..");
const bufferShim  = path.join(vpnpDir, "shims/buffer/dist/index.cjs");
const processShim = path.join(vpnpDir, "shims/process/dist/index.cjs");
const globalShim  = path.join(vpnpDir, "shims/global/dist/index.cjs");

// Rollup plugin — runs during both `vite build` and internally for optimizeDeps.
// Intercepts bare shim specifiers before Rollup tries to resolve them as
// directories (which would give EISDIR).
const fixVpnpShims = {
  name: "fix-vpnp-shims",
  resolveId(id: string) {
    if (id === "vite-plugin-node-polyfills/shims/buffer"  || id.startsWith("vite-plugin-node-polyfills/shims/buffer/"))  return bufferShim;
    if (id === "vite-plugin-node-polyfills/shims/process" || id.startsWith("vite-plugin-node-polyfills/shims/process/")) return processShim;
    if (id === "vite-plugin-node-polyfills/shims/global"  || id.startsWith("vite-plugin-node-polyfills/shims/global/"))  return globalShim;
    return null;
  },
};

// esbuild plugin for the dep-optimizer phase (same logic, esbuild API)
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
      // Keep these for the dev-server transform path as well
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
    rollupOptions: {
      plugins: [fixVpnpShims],
    },
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
