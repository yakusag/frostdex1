# Admin panel setup

The admin panel is available at `/admin` and is intentionally not linked in
public navigation. Configure these server-only variables in Vercel:

| Variable | Purpose |
|---|---|
| `ADMIN_WALLET_ADDRESS` | EVM address registered as the Orderly broker admin |
| `ADMIN_SESSION_SECRET` | Random secret with at least 32 bytes |
| `TURSO_DATABASE_URL` | Turso database URL beginning with `libsql://` |
| `TURSO_AUTH_TOKEN` | Turso database authentication token |

The same Turso URL and token must be configured on the Railway worker. Do not
prefix these variables with `VITE_`.

## Existing Redis data

Before retiring Upstash, stop the Railway worker and run
`yarn migrate:redis-to-turso` in an environment containing both the old
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` and new Turso
credentials. The migration copies FrostDex string and set keys, including
encrypted Orderly keys, bot configurations, rotation states, calibration and
admin settings. If Upstash is over quota and refuses reads, restore read access
before attempting migration. Keep Upstash until the site and worker are
verified against Turso.

In Vercel, add variables under **Project Settings → Environment Variables**.
Use Production for the live site and redeploy after saving variables. The panel
requires HTTPS because its session cookie is Secure.

Connect the registered EVM wallet on the site to open `/admin`, then approve
the clearly labelled sign-in message. This is a message signature only: no
transaction, private key, or seed phrase is requested. Page settings are stored
in Turso and apply to navigation and direct FrostDex routes. If page settings
cannot be loaded, public routes remain available using default enabled flags.

Generate the admin session secret locally, for example with
`openssl rand -base64 48`. Do not send secrets or wallet credentials in chat.
