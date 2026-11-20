import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { getAddress, isAddress, isHex, verifyMessage, type Hex } from "viem";
import {
  consumeAdminChallenge,
  saveAdminChallenge,
} from "./admin-store.js";

const SESSION_COOKIE = "__Host-frostdex-admin";
const SESSION_TTL_SECONDS = 4 * 60 * 60;
const NONCE_PATTERN = /^[a-f0-9]{64}$/;

export class AdminAuthSetupError extends Error {}

export function getConfiguredAdminAddress(): string {
  const address = process.env.ADMIN_WALLET_ADDRESS;
  if (!address || !isAddress(address)) {
    throw new AdminAuthSetupError("Admin wallet is not configured.");
  }
  return getAddress(address);
}

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new AdminAuthSetupError("Admin session secret is not configured.");
  }
  return secret;
}

export function assertAdminAuthConfigured(): void {
  getConfiguredAdminAddress();
  getSessionSecret();
}

export async function createAdminChallenge(
  address: string,
  origin: string,
): Promise<{ nonce: string; message: string }> {
  const nonce = randomBytes(32).toString("hex");
  const normalizedAddress = getAddress(address);
  const message = [
    "FrostDex admin sign-in",
    `Origin: ${origin}`,
    `Address: ${normalizedAddress}`,
    `Nonce: ${nonce}`,
    "This signature only signs in to the FrostDex admin panel. It does not authorize a transaction.",
  ].join("\n");
  await saveAdminChallenge(nonce, normalizedAddress, message);
  return { nonce, message };
}

export async function verifyAdminLogin(
  address: string,
  nonce: string,
  signature: string,
): Promise<boolean> {
  if (!isAddress(address) || !NONCE_PATTERN.test(nonce) || !isHex(signature)) {
    return false;
  }
  if (signature.length !== 132 && signature.length !== 130) {
    return false;
  }

  const normalizedAddress = getAddress(address);
  const ownerAddress = getConfiguredAdminAddress();
  const challenge = await consumeAdminChallenge(nonce);
  if (
    !challenge ||
    challenge.address !== normalizedAddress ||
    normalizedAddress !== ownerAddress
  ) {
    return false;
  }

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

export function setAdminSessionCookie(
  res: ServerResponse,
  address: string,
): void {
  const token = createSessionToken(getAddress(address));
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`,
  );
}

export function clearAdminSessionCookie(res: ServerResponse): void {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  );
}

export function getAdminSessionAddress(req: IncomingMessage): string | null {
  const token = getCookieValue(req, SESSION_COOKIE);
  if (!token) return null;

  const [payload, encodedSignature, ...extra] = token.split(".");
  if (!payload || !encodedSignature || extra.length > 0) return null;

  let expectedAddress: string;
  try {
    expectedAddress = getConfiguredAdminAddress();
  } catch {
    return null;
  }

  let expectedSignature: Buffer;
  try {
    expectedSignature = createHmac("sha256", getSessionSecret())
      .update(payload)
      .digest();
  } catch {
    return null;
  }
  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(encodedSignature, "base64url");
  } catch {
    return null;
  }
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
    !isAddress(session.address) ||
    getAddress(session.address) !== expectedAddress
  ) {
    return null;
  }
  return expectedAddress;
}

export function isValidAdminAddress(address: string): boolean {
  return (
    isAddress(address) && getAddress(address) === getConfiguredAdminAddress()
  );
}
