import { expect, test, mock } from "bun:test";
import { RpcProvider, WebSocketChannel } from "starknet";
import { HarnessProvider, measureHarnessRequests } from "./provider";
import { trackTransaction } from "./driver";

test("one shared connection catches up both transactions after reconnect, with one completion each", async () => {
  let connections = 0;
  let subscriptions = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response("WebSocket required", { status: 400 });
    },
    websocket: {
      open() {
        connections++;
      },
      message(socket, data) {
        const request = JSON.parse(String(data));
        if (request.method === "starknet_unsubscribe") {
          socket.send(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: true }));
          return;
        }
        expect(request.method).toBe("starknet_subscribeTransactionStatus");
        const id = String(++subscriptions);
        socket.send(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: id }));
        const notify = () =>
          socket.send(
            JSON.stringify({
              jsonrpc: "2.0",
              method: "starknet_subscriptionTransactionStatus",
              params: {
                subscription_id: id,
                result: {
                  transaction_hash: request.params.transaction_hash,
                  status: {
                    finality_status: connections === 1 ? "PRE_CONFIRMED" : "ACCEPTED_ON_L2",
                    execution_status: "SUCCEEDED",
                  },
                },
              },
            }),
          );
        notify();
        if (connections > 1) notify();
        if (subscriptions === 2) setTimeout(() => socket.close(), 10);
      },
    },
  });
  const provider = new HarnessProvider(`http://127.0.0.1:${server.port}`);
  provider.getTransactionStatus = mock(async () => ({
    finality_status: connections === 1 ? "PRE_CONFIRMED" : "ACCEPTED_ON_L2",
    execution_status: "SUCCEEDED",
  })) as typeof provider.getTransactionStatus;
  try {
    const results = await Promise.all(
      ["0x1", "0x2"].map((transactionHash, botId) =>
        trackTransaction({
          botId,
          gameId: 1,
          kind: "move",
          stage: "workload",
          provider,
          confirmationTimeoutMs: 8_000,
          send: async () => ({ transactionHash, confirmed: Promise.resolve() }),
        }),
      ),
    );
    expect(results.map(({ outcome }) => outcome)).toEqual(["completed", "completed"]);
    expect(connections).toBe(2);
    expect(subscriptions).toBeGreaterThanOrEqual(2);
    expect(results.every(({ rpc }) => rpc.getTransactionStatus.calls <= 2 && rpc.getTransactionStatus.calls > 0)).toBe(
      true,
    );
  } finally {
    provider.dispose();
    server.stop(true);
  }
}, 10_000);

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
        socket.send(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: "ticket-1" }));
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
