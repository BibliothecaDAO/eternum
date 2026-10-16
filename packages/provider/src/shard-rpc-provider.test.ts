import { describe, expect, it, vi } from "vitest";

// starknet binds the global fetch when it loads, so the stub must be in place before the import.
const fetch = vi.hoisted(() => {
  const fetch = vi.fn(
    async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 0, result: "0x534e5f5345504f4c4941" })),
  );
  globalThis.fetch = fetch;
  return fetch;
});

import { createShardRpcProvider } from "./index";

describe("createShardRpcProvider", () => {
  it("posts JSON-RPC as text/plain, a request the browser sends without a CORS preflight", async () => {
    await createShardRpcProvider("https://rpc.shard.test").getChainId();

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://rpc.shard.test");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "text/plain" });
    expect(JSON.parse(init.body as string).method).toBe("starknet_chainId");
  });
});
