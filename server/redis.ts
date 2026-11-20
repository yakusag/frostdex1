export class RedisSetupError extends Error {}

export class RedisStoreError extends Error {}

export async function redisCommand(...command: string[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new RedisSetupError("Redis storage is not configured.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  let result: { result?: unknown; error?: string };
  try {
    result = (await response.json()) as { result?: unknown; error?: string };
  } catch (error) {
    throw new RedisStoreError("Redis returned an invalid response.", {
      cause: error,
    });
  }

  if (!response.ok || result.error) {
    throw new RedisStoreError("Redis request failed.");
  }
  return result.result;
}
