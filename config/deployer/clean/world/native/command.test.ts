import { afterEach, describe, expect, it, mock } from "bun:test";
import { ec, hash, type RpcProvider } from "starknet";
import schema from "../../../../../contracts/l3/world-native/schema/schema.json";
import { completeNativeAdminCommand, executeNativeAdminCommand } from "./command";
import type { NativeWorldManifest } from "./types";

const servers: Array<ReturnType<typeof Bun.serve>> = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
});
function setup(outcome?: string[]) {
  const receipt = {
    block_number: 42,
    execution_status: "SUCCEEDED",
    events: [
      { from_address: "0x77", keys: [hash.getSelectorFromName("BatchProgress"), "7"], data: ["291", "3", "0"] },
      {
        from_address: "0x77",
        keys: [hash.getSelectorFromName("ExecutionRecorded")],
        data: outcome ?? ["7", "291", "3", "1", "8", "1", "0"],
      },
    ],
  };
  const provider = {
    getChainId: mock(async () => "0x1"),
    callContract: mock(async () => ["2", "4", "3", "5", "1000"]),
    getTransactionStatus: mock(async () => ({ finality_status: "ACCEPTED_ON_L2" })),
    getTransactionReceipt: mock(async () => receipt),
  };
  const requests: unknown[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request, server) {
      return server.upgrade(request) ? undefined : new Response("WebSocket required", { status: 400 });
    },
    websocket: {
      message(socket, message) {
        const request = JSON.parse(String(message));
        expect(request.method).toBe("game_subscribeAction");
        const [signed] = request.params;
        requests.push(signed);
        const action = hash.computePoseidonHashOnElements(signed.intent);
        expect(BigInt(signed.signature[0])).toBe(BigInt(ec.starkCurve.getStarkKey("0x1234")));
        expect(
          ec.starkCurve.verify(
            new ec.starkCurve.Signature(BigInt(signed.signature[1]), BigInt(signed.signature[2])),
            action,
            ec.starkCurve.getPublicKey("0x1234"),
          ),
        ).toBe(true);
        const subscription = String(requests.length);
        socket.send(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: subscription }));
        socket.send(
          JSON.stringify({
            jsonrpc: "2.0",
            method: "game_action",
            params: {
              subscription,
              result: {
                action,
                status: "recorded",
                order: 7 + requests.length,
                transaction_hash: "0x55",
                succeeded: true,
                nonce_consumed: true,
                reason: "0x0",
              },
            },
          }),
        );
      },
    },
  });
  servers.push(server);
  const manifest = {
    world: { address: "0x77" },
    native: {
      activeSchema: schema.identity,
      schemas: { [schema.identity]: schema },
    },
  } as unknown as NativeWorldManifest;
  const input = {
    provider: provider as unknown as RpcProvider,
    manifest,
    admissionUrl: `http://127.0.0.1:${server.port}/rpc/v0_10_2`,
    gameId: 7,
    accountAddress: "0x123",
    privateKey: "0x1234",
    command: { kind: "MarkGameSettled", value: undefined } as const,
  };
  return { input, provider, requests, receipt };
}
describe("native administrative command", () => {
  it("signs the compiled command and confirms its accepted outcome", async () => {
    const { input, provider, requests } = setup();
    expect(await executeNativeAdminCommand(input)).toEqual({ transactionHash: "0x55", remaining: "0" });
    expect(requests).toHaveLength(1);
    expect(provider.getTransactionReceipt).toHaveBeenCalledWith("0x55");
  });
  it("waits for the node's accepted status over HTTP, reading the receipt once and never resubmitting", async () => {
    const { input, provider, requests } = setup();
    provider.getTransactionStatus.mockImplementationOnce(async () => ({ finality_status: "PRE_CONFIRMED" }));
    expect(await executeNativeAdminCommand(input)).toEqual({ transactionHash: "0x55", remaining: "0" });
    expect(provider.getTransactionStatus).toHaveBeenCalledTimes(2);
    expect(provider.getTransactionReceipt).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(1);
  });
  it("does not treat a pre-confirmed receipt as durable completion", async () => {
    const { input, provider, receipt } = setup();
    provider.getTransactionReceipt.mockImplementation(async () => {
      const { block_number: _, ...preConfirmed } = receipt;
      return preConfirmed as typeof receipt;
    });
    await expect(executeNativeAdminCommand(input)).rejects.toThrow("no confirmed block");
  });
  it("rejects an included transaction revert", async () => {
    const { input, receipt } = setup();
    receipt.execution_status = "REVERTED";
    await expect(executeNativeAdminCommand(input)).rejects.toThrow("transaction reverted");
  });
  it("reports a refused transaction without fetching a receipt", async () => {
    const { input, provider } = setup();
    provider.getTransactionStatus.mockImplementation(async () => ({ finality_status: "REJECTED" }));
    await expect(executeNativeAdminCommand(input)).rejects.toThrow("rejected: REJECTED");
    expect(provider.getTransactionReceipt).not.toHaveBeenCalled();
  });
  it("returns the remaining count for an incomplete administrative batch", async () => {
    const { input, receipt } = setup();
    receipt.events[0].data[2] = "1";
    expect(await executeNativeAdminCommand(input)).toEqual({ transactionHash: "0x55", remaining: "1" });
  });
  it("completes roster preparation only after the final ticket-scoped remaining count", async () => {
    const { input, receipt, provider, requests } = setup();
    let calls = 0;
    provider.callContract.mockImplementation(async () => ["2", "4", String(3 + calls), "5", "1000"]);
    provider.getTransactionReceipt.mockImplementation(async () => {
      receipt.events[0].data[1] = String(3 + calls);
      receipt.events[0].data[2] = calls === 0 ? "1" : "0";
      receipt.events[1].data[2] = String(3 + calls);
      receipt.events[1].data[4] = String(8 + calls++);
      return receipt;
    });
    expect(
      await completeNativeAdminCommand({ ...input, command: { kind: "SettleBlitzRoster", value: undefined } }),
    ).toEqual({ transactionHash: "0x55", remaining: "0", transactions: 2 });
    expect(requests).toHaveLength(2);
  });
  it("refuses to infer completion from a successful receipt without progress", async () => {
    const { input, receipt } = setup();
    receipt.events.shift();
    await expect(completeNativeAdminCommand(input)).rejects.toThrow("no remaining count");
  });
  it("stops administrative work that cannot advance", async () => {
    const { input, receipt, requests, provider } = setup();
    let calls = 0;
    provider.callContract.mockImplementation(async () => ["2", "4", String(3 + calls), "5", "1000"]);
    provider.getTransactionReceipt.mockImplementation(async () => {
      receipt.events[0].data = ["291", String(3 + calls), "1"];
      receipt.events[1].data[2] = String(3 + calls);
      receipt.events[1].data[4] = String(8 + calls++);
      return receipt;
    });
    await expect(completeNativeAdminCommand(input)).rejects.toThrow("no progress");
    expect(requests).toHaveLength(2);
  });
  it("rejects a receipt for another ticket", async () => {
    const { input } = setup(["7", "291", "3", "1", "9", "1", "0"]);
    await expect(executeNativeAdminCommand(input)).rejects.toThrow("Missing or ambiguous");
  });
  it("reports the recorded rejection reason", async () => {
    const { input, receipt } = setup(["7", "291", "3", "1", "8", "2", "0x52454a4543544544"]);
    receipt.events.shift();
    await expect(executeNativeAdminCommand(input)).rejects.toThrow("Native command rejected: REJECTED");
  });
  it("selects its ticket when another command in the transaction failed", async () => {
    const { input, receipt } = setup();
    receipt.events.unshift({
      from_address: "0x77",
      keys: [hash.getSelectorFromName("ExecutionRecorded")],
      data: ["7", "292", "0", "1", "7", "2", "0x52454a4543544544"],
    });
    expect(await executeNativeAdminCommand(input)).toEqual({ transactionHash: "0x55", remaining: "0" });
  });
  it("refuses a player command before reading admission", async () => {
    const { input, provider } = setup();
    await expect(
      executeNativeAdminCommand({ ...input, command: { kind: "Explore", value: { explorer_id: 1, direction: 0 } } }),
    ).rejects.toThrow("Not an administrative");
    expect(provider.callContract).not.toHaveBeenCalled();
  });
});
