import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import handler from "../api/health";

async function startServer() {
  const server = createServer((req, res) => {
    void handler(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to determine health test server address.");
  }

  return { server, url: `http://127.0.0.1:${address.port}/api/health` };
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function isHealthResponse(
  value: unknown,
): value is { status: string; service: string; timestamp: string } {
  return (
    !!value &&
    typeof value === "object" &&
    "status" in value &&
    value.status === "ok" &&
    "service" in value &&
    value.service === "frostdex" &&
    "timestamp" in value &&
    typeof value.timestamp === "string"
  );
}

test("GET health endpoint returns a no-store status response", async (t) => {
  const { server, url } = await startServer();
  t.after(() => closeServer(server));

  const response = await fetch(url);
  const body: unknown = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(isHealthResponse(body));
  assert.ok(Number.isFinite(Date.parse(body.timestamp)));
});

test("health endpoint rejects non-GET requests", async (t) => {
  const { server, url } = await startServer();
  t.after(() => closeServer(server));

  const response = await fetch(url, { method: "POST" });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET");
  assert.deepEqual(await response.json(), { error: "Method not allowed." });
});
