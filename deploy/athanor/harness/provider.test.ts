import { expect, test, mock } from "bun:test";
import { RpcProvider, WebSocketChannel } from "starknet";
import { HarnessProvider, measureHarnessRequests } from "./provider";
import { trackTransaction } from "./driver";

test("receipt tracking polls POST RPC and disposal stops further observations", async () => {
  let calls = 0;
  const provider = new HarnessProvider("http://127.0.0.1:1");
  provider.getTransactionStatus = mock(async () => ({
    finality_status: ++calls < 3 ? "PRE_CONFIRMED" : "ACCEPTED_ON_L2",
    execution_status: "SUCCEEDED",
  })) as typeof provider.getTransactionStatus;
  const result = await trackTransaction({
    botId: 0,
    gameId: 1,
    kind: "move",
    stage: "workload",
    provider,
    confirmationTimeoutMs: 2000,
    send: async () => ({ transactionHash: "0x1", confirmed: Promise.resolve() }),
  });
  expect(result.outcome).toBe("completed");
  provider.dispose();
  const stoppedAt = calls;
  await Bun.sleep(300);
  expect(calls).toBe(stoppedAt);
});

test("request measurement includes SDK HTTP and action subscriptions only in its window", async () => {
  const server = Bun.serve({
    port: 0,
    async fetch(request, server) {
      if (server.upgrade(request)) return;
      const payload = await request.json();
      const respond = ({ id, method }: { id: number; method: string }) => ({
        jsonrpc: "2.0",
        id,
        result: method === "starknet_specVersion" ? "0.10.2" : 42,
      });
      return Response.json(Array.isArray(payload) ? payload.map(respond) : respond(payload));
    },
    websocket: {
      message(socket, data) {
        const request = JSON.parse(String(data));
        socket.send(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: "subscription-1" }));
      },
    },
  });
  const url = `http://127.0.0.1:${server.port}`;
  const measurement = measureHarnessRequests(url);
  const provider = new RpcProvider({ nodeUrl: url });
  const channel = new WebSocketChannel({ nodeUrl: url.replace("http:", "ws:") });
  try {
    await provider.getBlockNumber();
    await channel.waitForConnection();
    measurement.start();
    await provider.getBlockNumber();
    await channel.sendReceive("game_subscribeAction", [{}]);
    expect(measurement.finish()).toEqual({
      http: { starknet_blockNumber: 1 },
      websocket: { game_subscribeAction: 1 },
    });
    await provider.getBlockNumber();
    expect(measurement.finish().http).toEqual({ starknet_blockNumber: 1 });
  } finally {
    channel.disconnect();
    measurement.dispose();
    server.stop(true);
  }
});
