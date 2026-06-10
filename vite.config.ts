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

  return {
    server: {
      open: false,
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: true,
    },
    define: {
      __GROQ_KEY__: JSON.stringify(process.env.GROQ_API_KEY || ""),
    },
    base: basePath,
    plugins: [
      react({
        babel: {
          plugins: [],
        },
      }),
      tsconfigPaths(),
      htmlTitlePlugin(),
      cjsInterop({
        dependencies: ["bs58", "@coral-xyz/anchor", "lodash"],
      }),
      nodePolyfills({
        include: ["buffer", "crypto", "stream"],
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
      rollupOptions: {
        maxParallelFileOps: 3,
        output: {
          manualChunks(id) {
            // React core — always first to load
            if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/react-router-dom/")) {
              return "vendor-react";
            }
            // Orderly UI layer
            if (id.includes("@orderly.network/react-app") || id.includes("@orderly.network/ui/")) {
              return "vendor-orderly-a";
            }
            if (id.includes("@orderly.network/ui-scaffold") || id.includes("@orderly.network/trading/")) {
              return "vendor-orderly-b";
            }
            if (id.includes("@orderly.network/markets") || id.includes("@orderly.network/portfolio")) {
              return "vendor-orderly-c";
            }
            if (id.includes("@orderly.network/affiliate") || id.includes("@orderly.network/vaults")) {
              return "vendor-orderly-d";
            }
            if (id.includes("@orderly.network/wallet-connector-privy")) {
              return "vendor-privy";
            }
            if (id.includes("@orderly.network/wallet-connector")) {
              return "vendor-orderly-e";
            }
            if (id.includes("@orderly.network/i18n") || id.includes("@orderly.network/trading-leaderboard") || id.includes("@orderly.network/trading-points")) {
              return "vendor-orderly-f";
            }
            // Web3 / wallets
            if (id.includes("node_modules/wagmi") || id.includes("node_modules/viem") || id.includes("node_modules/@wagmi")) {
              return "vendor-web3";
            }
            if (id.includes("@solana/wallet-adapter-base") || id.includes("@solana/wallet-adapter-wallets") || id.includes("@solana-mobile")) {
              return "vendor-solana";
            }
            if (id.includes("@web3-onboard") || id.includes("@reown") || id.includes("@walletconnect")) {
              return "vendor-walletconnect";
            }
            // Swap widget
            if (id.includes("woofi-swap-widget-kit")) {
              return "vendor-swap";
            }
            // Utilities
            if (id.includes("node_modules/date-fns") || id.includes("node_modules/lodash") || id.includes("node_modules/lucide-react")) {
              return "vendor-utils";
            }
          },
        },
      },
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom"],
      exclude: [
        "woofi-swap-widget-kit",
        "@solana/codecs-core",
        "@solana/codecs-data-structures",
        "@solana/codecs-numbers",
        "@solana/codecs-strings",
        "@solana/codecs",
        "@solana/errors",
        "@solana/options",
      ],
      force: false,
    },
    esbuild: {
      drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
      legalComments: "none",
      treeShaking: true,
    },
    css: {
      devSourcemap: false,
    },
  };
});
