# Frostdex Capital Rotation — 24/7 worker

Vercel serverless functions cannot run a bot continuously, so the trading loop
lives in this small Node process. The website (Vercel) only stores the bot
config and displays the state the worker publishes to Redis.

```
Browser /ai-bot ──► Vercel /api/bots/* ──► Upstash Redis ◄── worker (Railway/Fly/VPS)
                                                              │ public data + signed orders
                                                              ▼
                                                         Orderly REST API
```

## Run

```bash
yarn install
yarn worker          # = tsx worker/rotation-worker.ts
```

## Environment (same values as the Vercel project)

| Var | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | shared store |
| `BOT_KEY_ENCRYPTION_KEY` | decrypts the stored Orderly trading keys (base64, 32 bytes) |
| `BOT_MAINNET_ENABLED=true` | needed for mainnet, on **both** Vercel and the worker |
| `BOT_NETWORKS` | optional, default `testnet` (+ `mainnet` when enabled) |
| `PORT` | optional health endpoint for the host |

Also set `BOT_SESSION_SECRET` and `BOT_KEY_ENCRYPTION_KEY` on Vercel (already required by `/api/bots/*`).

## Deploy on Railway (≈ 3 min)

1. New project → Deploy from GitHub repo → this repo.
2. Settings → Start command: `yarn worker`. Build command: `yarn install`.
3. Add the variables above. Keep **one** instance: a Redis lock prevents two
   workers trading the same network, a second one just idles.

## Safety model

* Orderly keys are `read,trading` only — they cannot withdraw funds.
* Software stops are checked every 10 s. There is **no exchange-side stop order**:
  if the worker is down while a position is open, that position is unmanaged.
  Keep leverage low and capital small until you have verified it on testnet.
* The live broker refuses to open on a symbol where you already hold a position,
  and drops tracked positions you closed by hand.
* Daily loss limit flattens everything and halts until the next UTC day.
* Pressing **Stop** in the page flattens the bot's positions.
