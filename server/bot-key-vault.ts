import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENCRYPTION_KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export type EncryptedOrderlyKey = {
  version: 1;
  iv: string;
  ciphertext: string;
  authTag: string;
};

function getEncryptionKey(): Buffer {
  const encoded = process.env.BOT_KEY_ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error("Bot key encryption is not configured.");
  }

  const key = Buffer.from(encoded, "base64");
  if (
    key.length !== ENCRYPTION_KEY_BYTES ||
    key.toString("base64") !== encoded
  ) {
    throw new Error("Bot key encryption configuration is invalid.");
  }
  return key;
}

function getAdditionalData(ownerAddress: string, orderlyKey: string): Buffer {
  return Buffer.from(
    `frostdex:orderly-key:v1:${ownerAddress.toLowerCase()}:${orderlyKey}`,
    "utf8",
  );
}

export function encryptOrderlySecret(
  secretKey: string,
  ownerAddress: string,
  orderlyKey: string,
): EncryptedOrderlyKey {
  if (!secretKey || !ownerAddress || !orderlyKey) {
    throw new Error("Orderly key details are required.");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  cipher.setAAD(getAdditionalData(ownerAddress, orderlyKey));
  const ciphertext = Buffer.concat([
    cipher.update(secretKey, "utf8"),
    cipher.final(),
  ]);

  return {
    version: 1,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptOrderlySecret(
  record: EncryptedOrderlyKey,
  ownerAddress: string,
  orderlyKey: string,
): string {
  if (
    !record ||
    record.version !== 1 ||
    typeof record.iv !== "string" ||
    typeof record.ciphertext !== "string" ||
    typeof record.authTag !== "string"
  ) {
    throw new Error("Encrypted Orderly key record is invalid.");
  }

  const iv = Buffer.from(record.iv, "base64");
  const ciphertext = Buffer.from(record.ciphertext, "base64");
  const authTag = Buffer.from(record.authTag, "base64");
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error("Encrypted Orderly key record is invalid.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAAD(getAdditionalData(ownerAddress, orderlyKey));
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
