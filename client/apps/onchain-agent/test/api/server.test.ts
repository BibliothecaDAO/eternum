import { describe, expect, it, beforeEach, afterEach } from "vitest";
import http from "node:http";
import { createApiServer, type ApiDeps } from "../../src/api/server";
import { JsonEmitter } from "../../src/output/json-emitter";

function makeRequest(
  port: number,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, method, path }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode!, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

describe("HTTP API server", () => {
  let port: number;
  let closeServer: () => Promise<void>;
  let promptQueue: string[];
  let shutdownCalled: boolean;
  let emitter: JsonEmitter;

  beforeEach(async () => {
    promptQueue = [];
    shutdownCalled = false;
    emitter = new JsonEmitter({ verbosity: "all", write: () => {} });

    // Use port 0 for OS-assigned port
    port = 0;
    const deps: ApiDeps = {
      enqueuePrompt: async (content) => {
        promptQueue.push(content);
      },
      getStatus: () => ({ tick: 42, session: "active", loopEnabled: true }),
      getState: () => ({ structures: [], armies: [] }),
      shutdown: async () => {
        shutdownCalled = true;
      },
      applyConfig: async (changes) => ({ ok: true, changes }),
      emitter,
    };

    const { server, close } = createApiServer(deps, 0, "127.0.0.1");
    closeServer = close;

    // Wait for server to be listening and get actual port
    await new Promise<void>((resolve) => {
      server.on("listening", () => {
        const addr = server.address();
        if (typeof addr === "object" && addr) {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    await closeServer();
  });

  it("POST /prompt queues a prompt", async () => {
    const res = await makeRequest(port, "POST", "/prompt", { content: "build farms" });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ queued: true });
    expect(promptQueue).toEqual(["build farms"]);
  });

  it("POST /prompt rejects empty content", async () => {
    const res = await makeRequest(port, "POST", "/prompt", { content: "" });
    expect(res.status).toBe(400);
  });

  it("GET /status returns status", async () => {
    const res = await makeRequest(port, "GET", "/status");
    expect(res.status).toBe(200);
    const parsed = JSON.parse(res.body);
    expect(parsed.tick).toBe(42);
    expect(parsed.session).toBe("active");
  });

  it("GET /state returns state", async () => {
    const res = await makeRequest(port, "GET", "/state");
    expect(res.status).toBe(200);
    const parsed = JSON.parse(res.body);
    expect(parsed.structures).toEqual([]);
  });

  it("POST /config applies config changes", async () => {
    const res = await makeRequest(port, "POST", "/config", {
      changes: [{ path: "tickIntervalMs", value: 30000 }],
    });
    expect(res.status).toBe(200);
    const parsed = JSON.parse(res.body);
    expect(parsed.ok).toBe(true);
  });

  it("POST /shutdown responds and triggers shutdown", async () => {
    const res = await makeRequest(port, "POST", "/shutdown");
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
    // Shutdown is deferred via setImmediate
    await new Promise((r) => setTimeout(r, 50));
    expect(shutdownCalled).toBe(true);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await makeRequest(port, "GET", "/unknown");
    expect(res.status).toBe(404);
  });
});
