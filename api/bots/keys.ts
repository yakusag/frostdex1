import type { IncomingMessage, ServerResponse } from "node:http";
import {
  assertJsonRequest,
  isAllowedOrigin,
  readJsonBody,
  sendJson,
} from "../../server/admin-http.js";
import { getBotSessionAddress } from "../../server/bot-auth.js";
import { encryptOrderlySecret } from "../../server/bot-key-vault.js";
import {
  getOrderlyKey,
  saveOrderlyKey,
  type BotNetwork,
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

function handleError(res: ServerResponse, error: unknown) {
  console.error("Background bot key request failed:", error);
  if (error instanceof RedisSetupError || error instanceof RedisStoreError) {
    return sendJson(res, 503, { error: error.message });
  }
  return sendJson(res, 500, {
    error: "Background bot key storage is temporarily unavailable.",
  });
}

export default async function handler(req: BotApiRequest, res: ServerResponse) {
  const ownerAddress = getBotSessionAddress(req);
  if (!ownerAddress) {
    return sendJson(res, 401, { error: "Wallet sign-in is required." });
  }

  if (req.method === "GET") {
    const network = new URL(
      req.url ?? "/",
      "http://localhost",
    ).searchParams.get("network");
    if (!isBotNetwork(network) || !isNetworkEnabled(network)) {
      return sendJson(res, 403, { error: "This bot network is not enabled." });
    }

    try {
      const key = await getOrderlyKey(ownerAddress, network);
      return sendJson(res, 200, {
        configured: key !== null,
        network,
        scope: key?.scope,
        accountId: key?.accountId,
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
  if (
    !isRecord(body) ||
    !isBotNetwork(body.network) ||
    !isNetworkEnabled(body.network) ||
    typeof body.orderlyKey !== "string" ||
    !/^ed25519:[1-9A-HJ-NP-Za-km-z]{20,}$/.test(body.orderlyKey) ||
    typeof body.accountId !== "string" ||
    body.accountId.length < 1 ||
    body.accountId.length > 128 ||
    body.scope !== "read,trading" ||
    typeof body.secretKey !== "string" ||
    body.secretKey.length < 20 ||
    body.secretKey.length > 256
  ) {
    return sendJson(res, 400, {
      error: "Provide a valid network, account, and read,trading Orderly key.",
    });
  }

  try {
    await saveOrderlyKey(ownerAddress, {
      orderlyKey: body.orderlyKey,
      accountId: body.accountId,
      scope: "read,trading",
      network: body.network,
      encryptedSecret: encryptOrderlySecret(
        body.secretKey,
        ownerAddress,
        body.orderlyKey,
      ),
    });
    return sendJson(res, 200, {
      configured: true,
      network: body.network,
      scope: "read,trading",
    });
  } catch (error) {
    return handleError(res, error);
  }
}
