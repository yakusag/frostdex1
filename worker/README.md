# Frostdex Capital Rotation — 24/7 worker

The trading loop runs as a persistent Node process on Railway/Fly/VPS. Vercel
serves the API and dashboard; both connect to the same Turso database.

```
Browser /ai-bot → Vercel API ─┐
                              ├→ Turso (shared durable storage) ← Railway worker
                              └→ Orderly REST API (signed orders)
```

## Run
```bash
yarn install
yarn worker
```

## Environment (configure on BOTH Vercel and Railway)

| Variable | Purpose |
|---|---|
| `TURSO_DATABASE_URL` | Turso URL beginning with `libsql://` |
| `TURSO_AUTH_TOKEN` | Database authentication token |
| `BOT_KEY_ENCRYPTION_KEY` | Existing base64 32-byte key used to decrypt stored Orderly keys |
| `BOT_SESSION_SECRET` | Existing bot session signing secret |
| `BOT_MAINNET_ENABLED=true` | Required for mainnet, on both services |
| `BOT_NETWORKS` | Optional; defaults to testnet (+ mainnet when enabled) |
| `PORT` | Optional health endpoint |

Do not change `BOT_KEY_ENCRYPTION_KEY` during migration: stored Orderly
secrets remain encrypted and require the same key.

## Migrate existing Upstash data

Before switching production traffic, run the one-time migration with BOTH the
old Upstash credentials and the new Turso credentials in the same environment:

```bash
yarn migrate:redis-to-turso
```

Stop the Railway worker while migrating. The script copies all
`frostdex:*` string and set keys, including bot configs, encrypted keys,
owners, rotation states, calibration, queued commands and admin settings.
It is repeatable. If Upstash is over quota or cannot be read, migration cannot
complete until read access is restored. Do not delete the old database or its
credentials until production verification is complete.

## Deploy on Railway

1. Keep the existing Railway service and repository.
2. Set the start command to `yarn worker`.
3. Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`; preserve the existing
   `BOT_KEY_ENCRYPTION_KEY`, `BOT_SESSION_SECRET`, and network settings.
4. Keep one worker instance; the database lock is shared by all instances.

## Safety

* Keep live trading disabled until migration and testnet verification succeed.
* If the worker is down, open exchange positions are not managed by this process.
* Orderly keys remain encrypted at rest; do not rotate their encryption key
  unless all stored keys are deliberately re-encrypted first.
