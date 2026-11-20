import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  assertJsonRequest,
  getClientIp,
  isAllowedOrigin,
  readJsonBody,
  sendJson,
} from "../../server/admin-http.js";
import {
  clearBotSessionCookie,
  createBotLoginChallenge,
  getBotSessionAddress,
  setBotSessionCookie,
  verifyBotLogin,
  BotAuthSetupError,
} from "../../server/bot-auth.js";
import { consumeBotRateLimit } from "../../server/bot-store.js";
import { RedisSetupError, RedisStoreError } from "../../server/redis.js";

type BotApiRequest = IncomingMessage & { body?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function handleError(res: ServerResponse, error: unknown) {
  console.error("Background bot authentication failed:", error);
  if (
    error instanceof BotAuthSetupError ||
    error instanceof RedisSetupError ||
    error instanceof RedisStoreError
  ) {
    return sendJson(res, 503, { error: error.message });
  }
  return sendJson(res, 500, {
    error: "Background bot authentication is temporarily unavailable.",
  });
}

export default async function handler(req: BotApiRequest, res: ServerResponse) {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      authenticated: Boolean(getBotSessionAddress(req)),
      address: getBotSessionAddress(req),
    });
  }

  if (req.method === "DELETE") {
    if (!isAllowedOrigin(req)) {
      return sendJson(res, 403, { error: "Request origin is not allowed." });
    }
    clearBotSessionCookie(res);
    return sendJson(res, 200, { authenticated: false });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, DELETE");
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

  let withinRateLimit: boolean;
  try {
    const ip = getClientIp(req);
    if (!ip) return sendJson(res, 403, { error: "Client IP is unavailable." });
    const bucket = createHash("sha256").update(ip).digest("hex");
    withinRateLimit = await consumeBotRateLimit(bucket, 12);
  } catch (error) {
    return handleError(res, error);
  }
  if (!withinRateLimit) {
    res.setHeader("Retry-After", "60");
    return sendJson(res, 429, { error: "Too many sign-in requests." });
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "Invalid request body." });
  }
  if (!isRecord(body) || typeof body.action !== "string") {
    return sendJson(res, 400, { error: "Invalid sign-in request." });
  }

  try {
    if (body.action === "challenge") {
      if (typeof body.address !== "string") {
        return sendJson(res, 400, { error: "A wallet address is required." });
      }
      const origin = req.headers.origin;
      if (typeof origin !== "string") {
        return sendJson(res, 403, { error: "Request origin is not allowed." });
      }
      return sendJson(
        res,
        200,
        await createBotLoginChallenge(body.address, new URL(origin).origin),
      );
    }

    if (body.action === "login") {
      if (
        typeof body.address !== "string" ||
        typeof body.nonce !== "string" ||
        typeof body.signature !== "string"
      ) {
        return sendJson(res, 400, {
          error: "Invalid wallet signature request.",
        });
      }
      if (!(await verifyBotLogin(body.address, body.nonce, body.signature))) {
        return sendJson(res, 401, {
          error: "Wallet signature was not accepted.",
        });
      }
      setBotSessionCookie(res, body.address);
      return sendJson(res, 200, {
        authenticated: true,
        address: body.address,
      });
    }

    return sendJson(res, 400, { error: "Unsupported sign-in action." });
  } catch (error) {
    return handleError(res, error);
  }
}
