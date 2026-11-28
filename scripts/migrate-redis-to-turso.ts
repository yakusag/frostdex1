/**
 * One-time, repeatable migration of FrostDex Redis keys into Turso.
 * Run while the bot worker is stopped: yarn migrate:redis-to-turso
 * Requires legacy UPSTASH_* and new TURSO_* variables in this environment.
 */
import { redisCommand } from "../server/redis.js";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, "");
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!redisUrl || !redisToken) throw new Error("Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for migration.");
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");

async function redis(...command: string[]): Promise<unknown> {
  const response = await fetch(redisUrl!, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const body = await response.json() as { result?: unknown; error?: string };
  if (!response.ok || body.error) throw new Error(body.error || `Upstash request failed: ${response.status}`);
  return body.result;
}

async function main() {
  let cursor = "0";
  let copied = 0;
  let skipped = 0;
  do {
    const page = await redis("SCAN", cursor, "MATCH", "frostdex:*", "COUNT", "250") as [string, string[]];
    if (!Array.isArray(page) || page.length !== 2 || !Array.isArray(page[1])) throw new Error("Unexpected Upstash SCAN response.");
    cursor = String(page[0]);
    for (const key of page[1]) {
      const type = String(await redis("TYPE", key));
      if (type === "string") {
        const value = await redis("GET", key);
        if (typeof value !== "string") { skipped++; continue; }
        const ttl = Number(await redis("TTL", key));
        if (ttl === -2 || ttl === 0) { skipped++; continue; }
        if (ttl > 0) await redisCommand("SET", key, value, "EX", String(ttl));
        else await redisCommand("SET", key, value);
        copied++;
      } else if (type === "set") {
        const members = await redis("SMEMBERS", key);
        if (!Array.isArray(members)) throw new Error(`Invalid Redis set: ${key}`);
        for (let i = 0; i < members.length; i += 100) {
          const chunk = members.slice(i, i + 100).filter((v): v is string => typeof v === "string");
          if (chunk.length) await redisCommand("SADD", key, ...chunk);
        }
        copied++;
      } else {
        skipped++;
        console.warn("Skipped unsupported Redis key type", type, key);
      }
    }
    console.log(`Migration progress: ${copied} keys copied; ${skipped} skipped.`);
  } while (cursor !== "0");
  console.log(`Migration finished. ${copied} keys copied; ${skipped} skipped.`);
}

main().catch((error) => {
  console.error("Redis to Turso migration failed:", error);
  process.exitCode = 1;
});
