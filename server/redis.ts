/**
 * Turso-backed compatibility storage for FrostDex's existing key/value API.
 * Uses Turso's authenticated Hrana HTTP pipeline; no Redis service is required.
 */
export class RedisSetupError extends Error {}
export class RedisStoreError extends Error {}
type HranaValue = { type: string; value?: string | number | null };
type HranaResult = { rows?: HranaValue[][]; affected_row_count?: number };
let schemaReady: Promise<void> | undefined;

function databaseConfig() {
  const rawUrl = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!rawUrl || !authToken) throw new RedisSetupError("Turso storage is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
  const url = rawUrl.replace(/^(?:libsql|turso):\/\//, "https://").replace(/\/+$/, "");
  return { endpoint: url.endsWith("/v2/pipeline") ? url : `${url}/v2/pipeline`, authToken };
}
function toHrana(value: string | number | null): HranaValue {
  if (value === null) return { type: "null" };
  if (typeof value === "number") return Number.isInteger(value) ? { type: "integer", value: String(value) } : { type: "float", value };
  return { type: "text", value };
}
function fromHrana(value: HranaValue | undefined): string | number | null {
  if (!value || value.type === "null") return null;
  if (value.type === "integer" || value.type === "float") return Number(value.value);
  if (value.type === "text" || value.type === "blob") return String(value.value ?? "");
  return value.value == null ? null : String(value.value);
}
async function execute(sql: string, args: Array<string | number | null> = []): Promise<HranaResult> {
  const { endpoint, authToken } = databaseConfig();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ baton: null, requests: [
      { type: "execute", stmt: { sql, args: args.map(toHrana), want_rows: true } },
      { type: "close" },
    ] }),
  });
  if (!response.ok) throw new RedisStoreError(`Turso request failed (HTTP ${response.status}).`);
  const payload = await response.json() as { results?: Array<{ type: string; response?: { result?: HranaResult }; error?: { message?: string } }> };
  const first = payload.results?.[0];
  if (!first || first.type !== "ok" || !first.response?.result) throw new RedisStoreError(first?.error?.message || "Turso returned an invalid SQL response.");
  return first.response.result;
}
async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await execute("CREATE TABLE IF NOT EXISTS frostdex_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER)");
      await execute("CREATE TABLE IF NOT EXISTS frostdex_set_members (set_key TEXT NOT NULL, member TEXT NOT NULL, PRIMARY KEY (set_key, member))");
      await execute("CREATE INDEX IF NOT EXISTS frostdex_kv_expiry_idx ON frostdex_kv(expires_at)");
    })().catch((error) => { schemaReady = undefined; throw error; });
  }
  await schemaReady;
}
function rowValue(result: HranaResult): string | number | null { return fromHrana(result.rows?.[0]?.[0]); }

export async function redisCommand(...command: string[]): Promise<unknown> {
  if (!command.length) throw new RedisStoreError("Empty storage command.");
  try {
    await ensureSchema();
    const op = command[0].toUpperCase();
    const now = Math.floor(Date.now() / 1000);
    if (op === "GET" && command.length === 2) {
      return rowValue(await execute("SELECT value FROM frostdex_kv WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)", [command[1], now]));
    }
    if (op === "GETDEL" && command.length === 2) {
      return rowValue(await execute("DELETE FROM frostdex_kv WHERE key = ? AND (expires_at IS NULL OR expires_at > ?) RETURNING value", [command[1], now]));
    }
    if (op === "SET" && command.length >= 3) {
      const [key, value] = command.slice(1, 3);
      let ttl: number | null = null;
      let nx = false;
      for (let i = 3; i < command.length; i++) {
        const option = command[i].toUpperCase();
        if (option === "EX" && command[i + 1]) ttl = Math.max(1, Number(command[++i]));
        else if (option === "NX") nx = true;
        else throw new RedisStoreError("Unsupported SET option.");
      }
      if (ttl !== null && !Number.isFinite(ttl)) throw new RedisStoreError("Invalid storage expiry.");
      const expiry = ttl === null ? null : now + ttl;
      const result = nx
        ? await execute(`INSERT INTO frostdex_kv(key,value,expires_at) VALUES (?,?,?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, expires_at=excluded.expires_at
            WHERE frostdex_kv.expires_at IS NOT NULL AND frostdex_kv.expires_at <= ?
            RETURNING key`, [key, value, expiry, now])
        : await execute("INSERT INTO frostdex_kv(key,value,expires_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, expires_at=excluded.expires_at", [key, value, expiry]);
      return nx && (result.affected_row_count ?? 0) === 0 ? null : "OK";
    }
    if (op === "DEL" && command.length >= 2) {
      let deleted = 0;
      for (const key of command.slice(1)) {
        deleted += (await execute("DELETE FROM frostdex_kv WHERE key = ?", [key])).affected_row_count ?? 0;
        await execute("DELETE FROM frostdex_set_members WHERE set_key = ?", [key]);
      }
      return deleted;
    }
    if (op === "SADD" && command.length >= 3) {
      let added = 0;
      for (const member of command.slice(2)) added += (await execute("INSERT OR IGNORE INTO frostdex_set_members(set_key,member) VALUES (?,?)", [command[1], member])).affected_row_count ?? 0;
      return added;
    }
    if (op === "SMEMBERS" && command.length === 2) {
      const result = await execute("SELECT member FROM frostdex_set_members WHERE set_key = ? ORDER BY member", [command[1]]);
      return (result.rows ?? []).map((row) => fromHrana(row[0])).filter((v): v is string => typeof v === "string");
    }
    if (op === "SREM" && command.length >= 3) {
      let removed = 0;
      for (const member of command.slice(2)) removed += (await execute("DELETE FROM frostdex_set_members WHERE set_key = ? AND member = ?", [command[1], member])).affected_row_count ?? 0;
      return removed;
    }
    if (op === "INCR" && command.length === 2) {
      const result = await execute(`INSERT INTO frostdex_kv(key,value,expires_at) VALUES (?,'1',NULL)
        ON CONFLICT(key) DO UPDATE SET
        value=CASE WHEN expires_at IS NOT NULL AND expires_at<=? THEN '1' ELSE CAST(CAST(value AS INTEGER)+1 AS TEXT) END,
        expires_at=CASE WHEN expires_at IS NOT NULL AND expires_at<=? THEN NULL ELSE expires_at END
        RETURNING value`, [command[1], now, now]);
      return Number(rowValue(result));
    }
    if (op === "EXPIRE" && command.length === 3) {
      const seconds = Number(command[2]);
      if (!Number.isFinite(seconds)) throw new RedisStoreError("Invalid storage expiry.");
      const result = await execute("UPDATE frostdex_kv SET expires_at=? WHERE key=? AND (expires_at IS NULL OR expires_at > ?)", [now + seconds, command[1], now]);
      return (result.affected_row_count ?? 0) > 0 ? 1 : 0;
    }
    throw new RedisStoreError(`Unsupported storage command: ${op}`);
  } catch (error) {
    if (error instanceof RedisSetupError || error instanceof RedisStoreError) throw error;
    throw new RedisStoreError("Turso storage request failed.", { cause: error });
  }
}
