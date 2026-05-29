# FrostDex

A decentralized exchange (DEX) front-end built with Vite + React + Orderly Network SDK v2, featuring perpetual trading, portfolio management, leaderboards, and a FROST token ecosystem.

## Run & Operate

- `pnpm --filter @workspace/frostdex run dev` — run the FrostDex frontend (port 20570, preview path `/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: Vite 7 + React 18 + react-router-dom v7
- UI: Tailwind CSS v4 (`@tailwindcss/vite`), Radix UI, shadcn/ui components
- DEX SDK: `@orderly.network/*` v2.12.4 (hooks, ui, trading, portfolio, markets, wallet-connector, etc.)
- Wallet: wagmi v2, viem, web3-onboard, Solana wallet adapters, WalletConnect
- State: TanStack Query
- API: Express 5 (api-server artifact)
- DB: PostgreSQL + Drizzle ORM
- Build: Vite (frontend), esbuild (API server)

## Where things live

- `artifacts/frostdex/` — Main DEX frontend (React + Vite)
  - `src/` — All source files
  - `src/App.tsx` — Root app with router and Orderly providers
  - `src/main.tsx` — Entry point
  - `src/styles/index.css` — Tailwind v4 imports + custom styles
  - `src/components/` — All UI components
  - `src/pages/` — Route pages
- `artifacts/api-server/` — Express API server (currently minimal)
- `artifacts/mockup-sandbox/` — Canvas component preview server

## Architecture decisions

- Pure frontend DEX — no backend needed for trading; Orderly Network SDK handles all DEX protocol interactions directly from the browser
- Tailwind v4 syntax used: `@import "tailwindcss"` instead of `@tailwind base/components/utilities`
- `vite-plugin-node-polyfills` used to polyfill Node.js built-ins (buffer, crypto, stream, etc.) required by blockchain SDKs
- `vite-plugin-cjs-interop` used to handle CommonJS modules in the dependency tree
- BASE_PATH defaults to `"/"` (no env throw) since FrostDex is mounted at preview root

## Product

FrostDex is a full-featured DEX UI on the Orderly Network with:
- Perpetual futures trading with order book, charts, and positions
- Portfolio management and cross-chain deposits/withdrawals
- Token markets and leaderboards
- FROST native token with Buy/Chart quick access
- FrostAI assistant and Mood sentiment widgets
- Live price ticker with FROST, BTC, ETH, SOL, ARB, BNB, AVAX, DOGE

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- 429 errors in console from Orderly Network APIs are expected rate limiting — not bugs
- `util.debuglog` / `util.inspect` browser externalization warnings are harmless (from blockchain SDKs)
- Vite performs progressive dep optimization on first runs — multiple reloads are normal before the app fully stabilizes
- `woofi-swap-widget-kit` pinned to `^0.0.38` (not 0.0.42) for compatibility
- Run `pnpm --filter @workspace/frostdex install --no-frozen-lockfile` after adding new orderly packages

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Orderly Network SDK docs: https://orderly.network/docs
