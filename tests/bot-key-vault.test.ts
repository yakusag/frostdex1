import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import {
  decryptOrderlySecret,
  encryptOrderlySecret,
} from "../server/bot-key-vault";

const ownerAddress = "0x1234567890123456789012345678901234567890";
const orderlyKey = "ed25519:example-public-key";
const secretKey = "testnet-orderly-secret";

test("Orderly secrets can be encrypted and decrypted for their owner", () => {
  const previousKey = process.env.BOT_KEY_ENCRYPTION_KEY;
  process.env.BOT_KEY_ENCRYPTION_KEY = randomBytes(32).toString("base64");

  try {
    const encrypted = encryptOrderlySecret(secretKey, ownerAddress, orderlyKey);

    assert.notEqual(encrypted.ciphertext, secretKey);
    assert.equal(
      decryptOrderlySecret(encrypted, ownerAddress, orderlyKey),
      secretKey,
    );
  } finally {
    if (previousKey === undefined) {
      delete process.env.BOT_KEY_ENCRYPTION_KEY;
    } else {
      process.env.BOT_KEY_ENCRYPTION_KEY = previousKey;
    }
  }
});

test("Orderly secrets cannot be decrypted for a different owner or key", () => {
  const previousKey = process.env.BOT_KEY_ENCRYPTION_KEY;
  process.env.BOT_KEY_ENCRYPTION_KEY = randomBytes(32).toString("base64");

  try {
    const encrypted = encryptOrderlySecret(secretKey, ownerAddress, orderlyKey);

    assert.throws(() =>
      decryptOrderlySecret(
        encrypted,
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        orderlyKey,
      ),
    );
    assert.throws(() =>
      decryptOrderlySecret(encrypted, ownerAddress, "ed25519:another-key"),
    );
  } finally {
    if (previousKey === undefined) {
      delete process.env.BOT_KEY_ENCRYPTION_KEY;
    } else {
      process.env.BOT_KEY_ENCRYPTION_KEY = previousKey;
    }
  }
});
