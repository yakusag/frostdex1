import type { IncomingMessage, ServerResponse } from "node:http";
import {
  assertJsonRequest,
  isAllowedOrigin,
  readJsonBody,
  sendJson,
} from "../../server/admin-http.js";
import { getBotSessionOwner } from "../../server/bot-auth.js";
import {
  getOrderlyKey,
  listBotConfigs,
  saveBotConfig,
  type BotNetwork,
  type BotWorkerConfig,
} from "../../server/bot-store.js";
import { RedisSetupError, RedisStoreError } from "../../server/redis.js";

type BotApiRequest = IncomingMessage & { body?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBotNetwork(value: unknown): value is BotNetwork {
  return value === "testnet" || value === "mainnet";
}

function isNetworkEnabled(network: BotNetwork): boolean {
  return network === "testnet" || process.env.BOT_MAINNET_ENABLED === "true";
}

function isBotConfig(
  value: unknown,
): value is Omit<BotWorkerConfig, "ownerAddress" | "updatedAt"> {
  if (!isRecord(value) || !isBotNetwork(value.network)) return false;
  return (
    typeof value.id === "string" &&
    /^[A-Z0-9_-]{1,32}$/.test(value.id) &&
    typeof value.strategy === "string" &&
    ["grid", "dca", "signal", "trend", "sniper", "rotation"].includes(
      value.strategy,
    ) &&
    typeof value.symbol === "string" &&
    /^PERP_[A-Z0-9]+_(USDC|USDT)(?:_[A-Za-z0-9]+)?$/.test(value.symbol) &&
    typeof value.investment === "number" &&
    Number.isFinite(value.investment) &&
    value.investment > 0 &&
    typeof value.liveMode === "boolean" &&
    (value.status === "running" ||
      value.status === "stopped" ||
      value.status === "paused") &&
    isRecord(value.params) &&
    Object.values(value.params).every(
      (param) =>
        (typeof param === "string" && param.length <= 64) ||
        (typeof param === "number" && Number.isFinite(param)),
    )
  );
}

function handleError(res: ServerResponse, error: unknown) {
  console.error("Background bot config request failed:", error);
  if (error instanceof RedisSetupError || error instanceof RedisStoreError) {
    return sendJson(res, 503, { error: error.message });
  }
  return sendJson(res, 500, {
    error: "Background bot settings are temporarily unavailable.",
  });
}

export default async function handler(req: BotApiRequest, res: ServerResponse) {
  const ownerAddress = getBotSessionOwner(req);
  if (!ownerAddress) {
    return sendJson(res, 401, { error: "Start a guest simulation or sign in with a wallet." });
  }
  const guest = ownerAddress.startsWith("guest_");

  if (req.method === "GET") {
    const network = new URL(
      req.url ?? "/",
      "http://localhost",
    ).searchParams.get("network");
    if (!isBotNetwork(network) || !isNetworkEnabled(network)) {
      return sendJson(res, 403, { error: "This bot network is not enabled." });
    }
    try {
      return sendJson(res, 200, {
        bots: await listBotConfigs(ownerAddress, network),
        network,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  if (!isAllowedOrigin(req)) {
    return sendJson(res, 403, { error: "Request origin is not allowed." });
  }
  if (!assertJsonRequest(req)) {
    return sendJson(res, 415, {
      error: "Expected an application/json request.",
    });
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "Invalid request body." });
  }
  if (!isBotConfig(body) || !isNetworkEnabled(body.network)) {
    return sendJson(res, 400, { error: "Invalid or disabled bot settings." });
  }
  if (guest && body.strategy !== "rotation") {
    return sendJson(res, 403, { error: "Guest sessions are limited to testnet rotation simulations up to 1,000 virtual USDC." });
  }
  if (guest && body.liveMode) {
    return sendJson(res, 403, { error: "Guest sessions cannot place live trades. Switch to wallet sign-in for Live mode." });
  }
  if (guest && body.network !== "testnet") {
    return sendJson(res, 403, { error: "Guest sessions are limited to testnet. Select Testnet to continue." });
  }
  if (guest && body.investment > 1000) {
    return sendJson(res, 403, { error: "Guest simulations are limited to 1,000 virtual USDC total capital." });
  }

  try {
    if (body.liveMode && body.status === "running") {
      const key = await getOrderlyKey(ownerAddress, body.network);
      if (!key || key.scope !== "read,trading") {
        return sendJson(res, 409, {
          error:
            "Configure a read,trading Orderly key before running live bots.",
        });
      }
    }
    const bot: BotWorkerConfig = {
      ...body,
      ownerAddress,
      updatedAt: Date.now(),
    };
    await saveBotConfig(bot);
    return sendJson(res, 200, { bot });
  } catch (error) {
    return handleError(res, error);
  }
}
