import { expect, test } from "bun:test";
import { burst } from "./part2-run";
import { now, ms } from "../spikes/node-first/common";

test("part2 uses the shared clock and 2,000 distinct emulated client addresses", async () => {
  const clients = new Set<string>();
  let actions = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const call = (await request.json()) as { method: string; id: number };
      if (call.method === "starknet_addInvokeTransaction") {
        actions++;
        clients.add(request.headers.get("x-forwarded-for")!);
      }
      return Response.json({ jsonrpc: "2.0", id: call.id, result: "0x1" });
    },
  });
  try {
    const payloads = Array.from({ length: 2000 }, (_, index) => ({
      hash: String(index),
      body: JSON.stringify({ jsonrpc: "2.0", id: index + 1, method: "starknet_addInvokeTransaction", params: [] }),
    }));
    let before = 0n;
    const result = await burst(server.url.href, payloads, 8, () => {
      before = now();
    });
    const after = now();
    expect(actions).toBe(2000);
    expect(clients.size).toBe(2000);
    expect(result.every((row) => !row.error)).toBe(true);
    for (const row of result) expect(BigInt(row.sentNs) >= before && BigInt(row.sentNs) <= after).toBe(true);
    const times = result.map((row) => BigInt(row.sentNs));
    const spread = ms(times.reduce((a, b) => (a > b ? a : b)) - times.reduce((a, b) => (a < b ? a : b)));
    expect(Number.isFinite(spread)).toBe(true);
  } finally {
    server.stop(true);
  }
}, 30_000);
