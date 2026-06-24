---
name: Vite optimizeDeps crash fix for FrostDex
description: esbuild EPIPE/OOM crash during dep optimization due to heavy web3 packages — fix is comprehensive exclude list
---

# Vite optimizeDeps crash — FrostDex

## The Rule
Any heavy web3/orderly/wagmi package must be in `optimizeDeps.exclude` in `artifacts/frostdex/vite.config.ts`. Never let esbuild pre-bundle them.

**Why:** esbuild's dep optimizer crashes (EPIPE = OOM) when it tries to pre-bundle the entire Orderly SDK + wagmi + viem dependency tree. This corrupts the `.vite/deps` cache and causes "Failed to resolve import" errors for packages like `readable-stream` and `ethers` on next page load.

**How to apply:** If a new heavy package is added to frostdex, add it to `optimizeDeps.exclude`. Clear `.vite/deps` cache before restarting: `rm -rf artifacts/frostdex/node_modules/.vite`.

## Fixed packages excluded (as of June 2026)
- All `@orderly.network/*` packages
- `wagmi`, `viem`, `ethers`, `memoizee`
- `@reown/appkit`, `@tanstack/react-query`
- `@solana/*`, `@solana-mobile/*`
- `@privy-io/*`, `@binance/w3w-blocknative-connector`
- `@web3-onboard/*`, `woofi-swap-widget-kit`
- `readable-stream`, `babel-runtime`
- Various particle-network, trezor, keystonehq packages
