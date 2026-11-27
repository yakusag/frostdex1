import type { EncryptedOrderlyKey } from "./bot-key-vault.js";
import { redisCommand, RedisStoreError } from "./redis.js";

export type BotNetwork = "testnet" | "mainnet";
export type BotWorkerStrategy =
  | "grid"
  | "dca"
  | "signal"
  | "trend"
  | "sniper"
  | "rotation";

export interface BotWorkerConfig {
  id: string;
  ownerAddress: string;
  network: BotNetwork;
  strategy: BotWorkerStrategy;
  symbol: string;
  investment: number;
  liveMode: boolean;
  status: "running" | "stopped" | "paused";
  params: Record<string, string | number>;
  updatedAt: number;
}

export interface StoredOrderlyKey {
  orderlyKey: string;
  accountId: string;
  scope: "read,trading";
  encryptedSecret: EncryptedOrderlyKey;
  network: BotNetwork;
}

export interface BotLoginChallenge {
  address: string;
  message: string;
}

function ownerKey(address: string) {
  return address.toLowerCase();
}

function keysKey(owner: string, network: BotNetwork) {
  return `frostdex:bot-key:${network}:${ownerKey(owner)}`;
}

function botsKey(owner: string, network: BotNetwork) {
  return `frostdex:bot-list:${network}:${ownerKey(owner)}`;
}

function botKey(owner: string, network: BotNetwork, botId: string) {
  return `frostdex:bot:${network}:${ownerKey(owner)}:${botId}`;
}

function parseStored<T>(
  value: unknown,
  label: string,
  isExpected: (value: unknown) => value is T,
): T | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new RedisStoreError(`${label} is invalid.`);
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isExpected(parsed)) {
      throw new RedisStoreError(`${label} is invalid.`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof RedisStoreError) throw error;
    throw new RedisStoreError(`${label} is invalid.`, { cause: error });
  }
}

function isStoredOrderlyKey(value: unknown): value is StoredOrderlyKey {
  return (
    !!value &&
    typeof value === "object" &&
    "orderlyKey" in value &&
    typeof value.orderlyKey === "string" &&
    "accountId" in value &&
    typeof value.accountId === "string" &&
    "scope" in value &&
    value.scope === "read,trading" &&
    "network" in value &&
    (value.network === "testnet" || value.network === "mainnet") &&
    "encryptedSecret" in value &&
    !!value.encryptedSecret &&
    typeof value.encryptedSecret === "object"
  );
}

function isBotWorkerConfig(value: unknown): value is BotWorkerConfig {
  return (
    !!value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string" &&
    "ownerAddress" in value &&
    typeof value.ownerAddress === "string" &&
    "network" in value &&
    (value.network === "testnet" || value.network === "mainnet") &&
    "strategy" in value &&
    ["grid", "dca", "signal", "trend", "sniper", "rotation"].includes(
      String(value.strategy),
    ) &&
    "symbol" in value &&
    typeof value.symbol === "string" &&
    "investment" in value &&
    typeof value.investment === "number" &&
    Number.isFinite(value.investment) &&
    value.investment > 0 &&
    "liveMode" in value &&
    typeof value.liveMode === "boolean" &&
    "status" in value &&
    ["running", "stopped", "paused"].includes(String(value.status)) &&
    "params" in value &&
    !!value.params &&
    typeof value.params === "object" &&
    "updatedAt" in value &&
    typeof value.updatedAt === "number"
  );
}

export async function saveOrderlyKey(
  ownerAddress: string,
  key: StoredOrderlyKey,
): Promise<void> {
  if (!ownerAddress || key.network === undefined) {
    throw new Error("Orderly key owner and network are required.");
  }
  const result = await redisCommand(
    "SET",
    keysKey(ownerAddress, key.network),
    JSON.stringify(key),
  );
  if (result !== "OK") {
    throw new RedisStoreError("Unable to save the encrypted Orderly key.");
  }
  await redisCommand(
    "SADD",
    `frostdex:bot-owners:${key.network}`,
    ownerKey(ownerAddress),
  );
}

export async function getOrderlyKey(
  ownerAddress: string,
  network: BotNetwork,
): Promise<StoredOrderlyKey | null> {
  const stored = await redisCommand("GET", keysKey(ownerAddress, network));
  return parseStored<StoredOrderlyKey>(
    stored,
    "Stored Orderly key",
    isStoredOrderlyKey,
  );
}

export async function removeOrderlyKey(
  ownerAddress: string,
  network: BotNetwork,
): Promise<void> {
  await redisCommand("DEL", keysKey(ownerAddress, network));
}

export async function saveBotConfig(bot: BotWorkerConfig): Promise<void> {
  const result = await redisCommand(
    "SET",
    botKey(bot.ownerAddress, bot.network, bot.id),
    JSON.stringify(bot),
  );
  if (result !== "OK") {
    throw new RedisStoreError("Unable to save background bot settings.");
  }

  const listResult = await redisCommand(
    "SADD",
    botsKey(bot.ownerAddress, bot.network),
    bot.id,
  );
  if (typeof listResult !== "number") {
    throw new RedisStoreError("Unable to index background bot settings.");
  }
  await redisCommand(
    "SADD",
    `frostdex:bot-owners:${bot.network}`,
    ownerKey(bot.ownerAddress),
  );
}

export async function removeBotConfig(
  ownerAddress: string,
  network: BotNetwork,
  botId: string,
): Promise<void> {
  await redisCommand("DEL", botKey(ownerAddress, network, botId));
  await redisCommand("SREM", botsKey(ownerAddress, network), botId);
}

export async function listBotConfigs(
  ownerAddress: string,
  network: BotNetwork,
): Promise<BotWorkerConfig[]> {
  const ids = await redisCommand("SMEMBERS", botsKey(ownerAddress, network));
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
    throw new RedisStoreError("Stored background bot index is invalid.");
  }

  const bots = await Promise.all(
    ids.map(async (id) => {
      const value = await redisCommand(
        "GET",
        botKey(ownerAddress, network, id),
      );
      return parseStored<BotWorkerConfig>(
        value,
        "Stored background bot",
        isBotWorkerConfig,
      );
    }),
  );
  return bots.filter((bot): bot is BotWorkerConfig => bot !== null);
}

export async function listBotOwners(network: BotNetwork): Promise<string[]> {
  const result = await redisCommand(
    "SMEMBERS",
    `frostdex:bot-owners:${network}`,
  );
  if (
    !Array.isArray(result) ||
    !result.every((address) => typeof address === "string")
  ) {
    throw new RedisStoreError("Stored background bot owners are invalid.");
  }
  return result;
}

export async function saveBotLoginChallenge(
  nonce: string,
  challenge: BotLoginChallenge,
): Promise<void> {
  const result = await redisCommand(
    "SET",
    `frostdex:bot-auth-nonce:${nonce}`,
    JSON.stringify(challenge),
    "EX",
    "300",
    "NX",
  );
  if (result !== "OK") {
    throw new RedisStoreError("Unable to create a wallet sign-in challenge.");
  }
}

export async function consumeBotLoginChallenge(
  nonce: string,
): Promise<BotLoginChallenge | null> {
  const stored = await redisCommand(
    "GETDEL",
    `frostdex:bot-auth-nonce:${nonce}`,
  );
  return parseStored<BotLoginChallenge>(
    stored,
    "Stored wallet sign-in challenge",
    (value): value is BotLoginChallenge =>
      !!value &&
      typeof value === "object" &&
      "address" in value &&
      typeof value.address === "string" &&
      "message" in value &&
      typeof value.message === "string",
  );
}

export async function consumeBotRateLimit(
  bucket: string,
  maxRequests: number,
): Promise<boolean> {
  const key = `frostdex:bot-auth-rate:${bucket}`;
  const count = await redisCommand("INCR", key);
  if (typeof count !== "number") {
    throw new RedisStoreError(
      "Bot authentication rate limit storage is invalid.",
    );
  }
  if (count === 1) await redisCommand("EXPIRE", key, "60");
  return count <= maxRequests;
}
