import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../../server/admin-http.js";
import { getBotSessionOwner } from "../../server/bot-auth.js";
import { redisCommand, RedisSetupError, RedisStoreError } from "../../server/redis.js";

/**
 * GET /api/bots/rotation?network=testnet&id=ROT-XXXX
 * Returns the live state the 24/7 worker publishes for the signed-in owner,
 * plus how old its heartbeat is so the page can show "worker offline".
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const owner = getBotSessionOwner(req);
  if (!owner) return sendJson(res, 401, { error: "Start a guest simulation or sign in with a wallet." });
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const network = url.searchParams.get("network");
  const id = url.searchParams.get("id") ?? "";
  if ((network !== "testnet" && network !== "mainnet") || !/^[A-Z0-9_-]{1,32}$/.test(id)) {
    return sendJson(res, 400, { error: "Invalid request." });
  }
  try {
    const raw = await redisCommand("GET", `frostdex:rotation:state:${network}:${owner.toLowerCase()}:${id}`);
    const lock = await redisCommand("GET", `frostdex:rotation:lock:${network}`);
    const state = typeof raw === "string" ? JSON.parse(raw) : null;
    return sendJson(res, 200, {
      state,
      workerOnline: Boolean(lock) && state ? Date.now() - state.heartbeat < 60_000 : Boolean(lock),
      serverTime: Date.now(),
    });
  } catch (error) {
    console.error("rotation state failed:", error);
    if (error instanceof RedisSetupError || error instanceof RedisStoreError) {
      return sendJson(res, 503, { error: error.message });
    }
    return sendJson(res, 500, { error: "Rotation state is temporarily unavailable." });
  }
}
