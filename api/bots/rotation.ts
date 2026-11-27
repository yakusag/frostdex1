import type { IncomingMessage, ServerResponse } from "node:http";
import { assertJsonRequest, isAllowedOrigin, readJsonBody, sendJson } from "../../server/admin-http.js";
import { getBotSessionOwner } from "../../server/bot-auth.js";
import { listBotConfigs, saveBotConfig } from "../../server/bot-store.js";
import { redisCommand, RedisSetupError, RedisStoreError } from "../../server/redis.js";

/**
 * GET /api/bots/rotation?network=testnet&id=ROT-XXXX
 * Returns the live state the 24/7 worker publishes for the signed-in owner,
 * plus how old its heartbeat is so the page can show "worker offline".
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const owner = getBotSessionOwner(req);
  if (!owner) return sendJson(res, 401, { error: "Start a guest simulation or sign in with a wallet." });
  const url = new URL(req.url ?? "/", "http://localhost");
  const network = url.searchParams.get("network");
  const id = url.searchParams.get("id") ?? "";
  if (req.method === "POST") {
    if (!isAllowedOrigin(req)) return sendJson(res, 403, { error: "Request origin is not allowed." });
    if (!assertJsonRequest(req)) return sendJson(res, 415, { error: "Expected an application/json request." });
    let body: unknown;
    try { body = await readJsonBody(req); } catch { return sendJson(res, 400, { error: "Invalid request body." }); }
    if (!body || typeof body !== "object") return sendJson(res, 400, { error: "Invalid action." });
    const action = (body as any).action;
    const positionId = (body as any).positionId;
    if ((network !== "testnet" && network !== "mainnet") || !/^[A-Z0-9_-]{1,32}$/.test(id)) return sendJson(res, 400, { error: "Invalid request." });
    if (!["pause", "resume", "stop", "close"].includes(action)) return sendJson(res, 400, { error: "Unsupported action." });
    try {
      const bot = (await listBotConfigs(owner, network)).find((item) => item.id === id && item.strategy === "rotation");
      if (!bot) return sendJson(res, 404, { error: "Bot not found for this account." });
      if (action === "close") {
        if (typeof positionId !== "string" || positionId.length > 100) return sendJson(res, 400, { error: "A valid position ID is required." });
        const raw = await redisCommand("GET", `frostdex:rotation:state:${network}:${owner.toLowerCase()}:${id}`);
        const state = typeof raw === "string" ? JSON.parse(raw) : null;
        if (!state?.positions?.some((p: any) => p.id === positionId)) return sendJson(res, 404, { error: "Open position not found." });
        await redisCommand("SET", `frostdex:rotation:command:${network}:${owner.toLowerCase()}:${id}`, JSON.stringify({ action: "close", positionId }), "EX", "60");
        return sendJson(res, 202, { queued: true, action, positionId });
      }
      const status = action === "pause" ? "paused" : action === "resume" ? "running" : "stopped";
      await saveBotConfig({ ...bot, status, updatedAt: Date.now() });
      return sendJson(res, 200, { ok: true, status });
    } catch (error) {
      console.error("rotation control failed:", error);
      if (error instanceof RedisSetupError || error instanceof RedisStoreError) return sendJson(res, 503, { error: error.message });
      return sendJson(res, 500, { error: "Unable to update rotation controls." });
    }
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
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
