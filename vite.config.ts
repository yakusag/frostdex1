import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { cjsInterop } from "vite-plugin-cjs-interop";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import fs from "fs";
import path from "path";

function loadConfigTitle(): string {
  try {
    const configPath = path.join(__dirname, "public/config.js");
    if (!fs.existsSync(configPath)) {
      return "Orderly Network";
    }

    const configText = fs.readFileSync(configPath, "utf-8");
    const jsonText = configText
      .replace(/window\.__RUNTIME_CONFIG__\s*=\s*/, "")
      .replace(/;\s*$/, "")
      .trim();

    const config = JSON.parse(jsonText);
    return config.VITE_ORDERLY_BROKER_NAME || "Orderly Network";
  } catch (error) {
    console.warn("Failed to load title from config.js:", error);
    return "Orderly Network";
  }
}

function htmlTitlePlugin(): Plugin {
  const title = loadConfigTitle();
  console.log(`Using title from config.js: ${title}`);

  return {
    name: "html-title-transform",
    transformIndexHtml(html) {
      return html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    },
  };
}

export default defineConfig(() => {
  const basePath = process.env.PUBLIC_PATH || "/";
  const isProd = process.env.NODE_ENV === "production";

  return {
    server: {
      open: false,
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: true,
      hmr: true,
      watch: {
        usePolling: false,
      },
    },
    define: {
      __GROQ_KEY__: JSON.stringify(process.env.GROQ_API_KEY || ""),
    },
    base: basePath,
    plugins: [
      react({
        babel: {
          plugins: isProd ? [["transform-remove-console", { exclude: ["error", "warn"] }]] : [],
        },
      }),
      tsconfigPaths(),
      htmlTitlePlugin(),
      cjsInterop({
        dependencies: ["bs58", "@coral-xyz/anchor", "lodash"],
      }),
      nodePolyfills({
        include: ["buffer", "crypto", "stream"],
        protocolImports: false,
      }),
    ],
    build: {
      outDir: "build/client",
      target: "esnext",
      chunkSizeWarningLimit: 2000,
      cssCodeSplit: true,
      reportCompressedSize: false,
      sourcemap: false,
      minify: "esbuild",
      assetsInlineLimit: 4096,
      rollupOptions: {
        maxParallelFileOps: 4,
        treeshake: {
          moduleSideEffects: "no-external",
          propertyReadSideEffects: false,
          unknownGlobalSideEffects: false,
        },
        output: {
          compact: true,
          generatedCode: { constBindings: true },
          manualChunks: {
            "vendor-react":     ["react", "react-dom", "react-router-dom"],
            "vendor-orderly-a": ["@orderly.network/react-app", "@orderly.network/ui"],
            "vendor-orderly-b": ["@orderly.network/ui-scaffold", "@orderly.network/trading"],
            "vendor-orderly-c": ["@orderly.network/markets", "@orderly.network/portfolio"],
            "vendor-orderly-d": ["@orderly.network/affiliate", "@orderly.network/vaults"],
            "vendor-orderly-e": ["@orderly.network/wallet-connector"],
            "vendor-web3":      ["wagmi"],
            "vendor-solana":    ["@solana/wallet-adapter-base", "@solana/wallet-adapter-wallets"],
          },
        },
      },
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom"],
      force: false,
      esbuildOptions: {
        target: "esnext",
      },
    },
    esbuild: {
      drop: isProd ? ["console", "debugger"] : [],
      legalComments: "none",
      treeShaking: true,
      minifyIdentifiers: isProd,
      minifySyntax: isProd,
    },
    css: {
      devSourcemap: false,
    },
  };
});
