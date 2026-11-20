# Admin panel setup

The admin panel is available at `/admin` and is intentionally not linked in
public navigation. Before deploying this feature, configure the following
server-only environment variables in the Vercel project:

| Variable                   | Value                                                   |
| -------------------------- | ------------------------------------------------------- |
| `ADMIN_WALLET_ADDRESS`     | The EVM address registered as the Orderly broker admin. |
| `ADMIN_SESSION_SECRET`     | A randomly generated secret with at least 32 bytes.     |
| `UPSTASH_REDIS_REST_URL`   | The REST URL for a managed Upstash Redis database.      |
| `UPSTASH_REDIS_REST_TOKEN` | The Upstash REST token for that database.               |

Create an Upstash Redis database and copy its REST URL and token from the
database details. Generate the session secret locally, for example with
`openssl rand -base64 48`. Do not send the secret or wallet credentials in
chat, and do not prefix any of these variables with `VITE_`.

In Vercel, add the variables under **Project Settings → Environment Variables**.
Use the Production environment for the live site; configure Preview only if
preview deployments should also have admin access. Redeploy after saving the
variables. The panel requires HTTPS because its session cookie is Secure.

Open `/admin`, connect the registered EVM wallet, and approve the clearly
labelled sign-in message. This is a message signature only: no transaction,
private key, or seed phrase is requested. Page settings are stored in Redis and
apply to navigation and direct FrostDex routes. If page settings cannot be
loaded, FrostDex routes remain unavailable until the settings service recovers;
`/admin` remains available for troubleshooting.

These controls cover FrostDex routes. Links that open external Orderly pages
are managed by those external services, not by this panel.
