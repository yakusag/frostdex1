import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../server/admin-http";
import { getSitePageFlags } from "../server/admin-store";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const pages = await getSitePageFlags();
    return sendJson(res, 200, { pages });
  } catch (error) {
    console.error("Failed to load public site page settings:", error);
    return sendJson(res, 503, {
      error: "Site page settings are temporarily unavailable.",
    });
  }
}
