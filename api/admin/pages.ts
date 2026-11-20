import type { ServerResponse } from "node:http";
import {
  assertAdminAuthConfigured,
  getAdminSessionAddress,
} from "../../server/admin-auth.js";
import {
  assertJsonRequest,
  isAllowedOrigin,
  readJsonBody,
  sendJson,
  type AdminApiRequest,
} from "../../server/admin-http.js";
import {
  AdminSetupError,
  AdminStoreError,
  getSitePageFlags,
  setSitePageEnabled,
} from "../../server/admin-store.js";
import { isSitePageId } from "../../shared/site-pages.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function handleError(res: ServerResponse, error: unknown) {
  console.error("Admin page settings request failed:", error);
  if (error instanceof AdminSetupError || error instanceof AdminStoreError) {
    return sendJson(res, 503, { error: error.message });
  }
  return sendJson(res, 500, {
    error: "Admin page settings are temporarily unavailable.",
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

  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  if (req.method === "PUT" && !isAllowedOrigin(req)) {
    return sendJson(res, 403, { error: "Request origin is not allowed." });
  }
  if (req.method === "PUT" && !assertJsonRequest(req)) {
    return sendJson(res, 415, {
      error: "Expected an application/json request.",
    });
  }
  if (!getAdminSessionAddress(req)) {
    return sendJson(res, 401, { error: "Admin sign-in is required." });
  }

  if (req.method === "GET") {
    try {
      return sendJson(res, 200, { pages: await getSitePageFlags() });
    } catch (error) {
      return handleError(res, error);
    }
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "Invalid request body." });
  }
  if (
    !isRecord(body) ||
    typeof body.pageId !== "string" ||
    !isSitePageId(body.pageId) ||
    typeof body.enabled !== "boolean"
  ) {
    return sendJson(res, 400, { error: "Invalid page setting." });
  }

  try {
    const pages = await setSitePageEnabled(body.pageId, body.enabled);
    return sendJson(res, 200, { pages });
  } catch (error) {
    return handleError(res, error);
  }
}
