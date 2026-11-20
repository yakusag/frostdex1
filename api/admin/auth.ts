import type { ServerResponse } from "node:http";
import {
  assertAdminAuthConfigured,
  createAdminChallenge,
  getConfiguredAdminAddress,
  getAdminSessionAddress,
  isValidAdminAddress,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  verifyAdminLogin,
} from "../../server/admin-auth.js";
import {
  assertJsonRequest,
  getClientIp,
  isAllowedOrigin,
  readJsonBody,
  sendJson,
  type AdminApiRequest,
} from "../../server/admin-http.js";
import {
  AdminSetupError,
  AdminStoreError,
  consumeAdminRateLimit,
} from "../../server/admin-store.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function checkRateLimit(req: AdminApiRequest): Promise<boolean> {
  const ip = getClientIp(req);
  if (!ip) return false;
  const key = Buffer.from(ip).toString("base64url").slice(0, 100);
  return consumeAdminRateLimit(key, 12);
}

function handleError(res: ServerResponse, error: unknown) {
  console.error("Admin authentication request failed:", error);
  if (error instanceof AdminSetupError || error instanceof AdminStoreError) {
    return sendJson(res, 503, { error: error.message });
  }
  return sendJson(res, 500, {
    error: "Admin authentication is temporarily unavailable.",
  });
}

export default async function handler(
  req: AdminApiRequest,
  res: ServerResponse,
) {
  try {
    assertAdminAuthConfigured();
  } catch (error) {
    return handleError(res, error);
  }

  if (req.method === "GET") {
    const walletAddress = new URL(
      req.url ?? "/",
      "http://localhost",
    ).searchParams.get("walletAddress");
    if (walletAddress !== null) {
      return sendJson(res, 200, {
        authorized: isValidAdminAddress(walletAddress),
      });
    }
    return sendJson(res, 200, {
      authenticated: Boolean(getAdminSessionAddress(req)),
    });
  }

  if (req.method === "DELETE") {
    if (!isAllowedOrigin(req)) {
      return sendJson(res, 403, { error: "Request origin is not allowed." });
    }
    clearAdminSessionCookie(res);
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
    withinRateLimit = await checkRateLimit(req);
  } catch (error) {
    return handleError(res, error);
  }
  if (!withinRateLimit) {
    res.setHeader("Retry-After", "60");
    return sendJson(res, 429, { error: "Too many admin login attempts." });
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "Invalid request body." });
  }
  if (!isRecord(body) || typeof body.action !== "string") {
    return sendJson(res, 400, {
      error: "Invalid admin authentication request.",
    });
  }

  try {
    if (body.action === "challenge") {
      if (typeof body.address !== "string") {
        return sendJson(res, 400, { error: "A wallet address is required." });
      }
      if (!isValidAdminAddress(body.address)) {
        return sendJson(res, 403, { error: "This wallet is not authorized." });
      }
      const originHeader = req.headers.origin;
      if (typeof originHeader !== "string") {
        return sendJson(res, 403, { error: "Request origin is not allowed." });
      }
      const challenge = await createAdminChallenge(
        body.address,
        new URL(originHeader).origin,
      );
      return sendJson(res, 200, challenge);
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
      const verified = await verifyAdminLogin(
        body.address,
        body.nonce,
        body.signature,
      );
      if (!verified) {
        return sendJson(res, 401, {
          error: "Wallet signature was not accepted.",
        });
      }
      setAdminSessionCookie(res, getConfiguredAdminAddress());
      return sendJson(res, 200, { authenticated: true });
    }

    return sendJson(res, 400, {
      error: "Unsupported admin authentication action.",
    });
  } catch (error) {
    return handleError(res, error);
  }
}
