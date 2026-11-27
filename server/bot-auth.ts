import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { getAddress, isAddress, isHex, verifyMessage, type Hex } from "viem";
import {
  consumeBotLoginChallenge,
  saveBotLoginChallenge,
} from "./bot-store.js";

const SESSION_COOKIE = "__Host-frostdex-bot";
const SESSION_TTL_SECONDS = 4 * 60 * 60;
const NONCE_PATTERN = /^[a-f0-9]{64}$/;

export class BotAuthSetupError extends Error {}

function getSessionSecret(): string {
  const secret = process.env.BOT_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new BotAuthSetupError(
      "Background bot session auth is not configured.",
    );
  }
  return secret;
}

export async function createBotLoginChallenge(
  address: string,
  origin: string,
): Promise<{ nonce: string; message: string }> {
  if (!isAddress(address)) {
    throw new Error("A valid wallet address is required.");
  }
  const nonce = randomBytes(32).toString("hex");
  const normalizedAddress = getAddress(address);
  const message = [
    "FrostDex background bot sign-in",
    `Origin: ${origin}`,
    `Address: ${normalizedAddress}`,
    `Nonce: ${nonce}`,
    "This signature only signs in to manage background bots. It does not authorize a transaction.",
  ].join("\n");
  await saveBotLoginChallenge(nonce, {
    address: normalizedAddress,
    message,
  });
  return { nonce, message };
}

export async function verifyBotLogin(
  address: string,
  nonce: string,
  signature: string,
): Promise<boolean> {
  if (!isAddress(address) || !NONCE_PATTERN.test(nonce) || !isHex(signature)) {
    return false;
  }
  if (signature.length !== 132 && signature.length !== 130) return false;

  const normalizedAddress = getAddress(address);
  const challenge = await consumeBotLoginChallenge(nonce);
  if (!challenge || challenge.address !== normalizedAddress) return false;

  return verifyMessage({
    address: normalizedAddress,
    message: challenge.message,
    signature: signature as Hex,
  });
}

function createSessionToken(address: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      address,
      expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function getCookieValue(
  req: IncomingMessage,
  cookieName: string,
): string | null {
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader !== "string") return null;

  for (const cookie of cookieHeader.split(";")) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name === cookieName) return valueParts.join("=");
  }
  return null;
}

export function setBotSessionCookie(
  res: ServerResponse,
  address: string,
): void {
  const token = createSessionToken(getAddress(address));
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`,
  );
}

export function clearBotSessionCookie(res: ServerResponse): void {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  );
}

export function getBotSessionOwner(req: IncomingMessage): string | null {
  const token = getCookieValue(req, SESSION_COOKIE);
  if (!token) return null;

  const [payload, encodedSignature, ...extra] = token.split(".");
  if (!payload || !encodedSignature || extra.length > 0) return null;

  let expectedSignature: Buffer;
  try {
    expectedSignature = createHmac("sha256", getSessionSecret())
      .update(payload)
      .digest();
  } catch {
    return null;
  }

  const suppliedSignature = Buffer.from(encodedSignature, "base64url");
  if (
    expectedSignature.length !== suppliedSignature.length ||
    !timingSafeEqual(expectedSignature, suppliedSignature)
  ) {
    return null;
  }

  let session: unknown;
  try {
    session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    !session ||
    typeof session !== "object" ||
    !("address" in session) ||
    !("expiresAt" in session) ||
    typeof session.address !== "string" ||
    typeof session.expiresAt !== "number" ||
    session.expiresAt <= Math.floor(Date.now() / 1000) ||
    !(isAddress(session.address) || /^guest_[a-f0-9]{32}$/.test(session.address))
  ) {
    return null;
  }
  return isAddress(session.address) ? getAddress(session.address) : session.address;
}

export function getBotSessionAddress(req: IncomingMessage): string | null {
  const owner = getBotSessionOwner(req);
  return owner && isAddress(owner) ? getAddress(owner) : null;
}

export function setBotGuestSessionCookie(res: ServerResponse): string {
  const owner = `guest_${randomBytes(16).toString("hex")}`;
  const token = createSessionToken(owner);
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`);
  return owner;
}
