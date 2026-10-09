import { afterEach, describe, expect, it } from "bun:test";
import { byteArray, CallData, hash, RpcProvider, shortString } from "starknet";
import schema from "../../../../../contracts/l3/world-native/schema/schema.json";
import { completeNativeAdminCommand, executeNativeAdminCommand } from "./command";
import type { NativeWorldManifest } from "./types";

type Invoke = {
  version: string;
  nonce: string;
  signature: string[];
  calldata: string[];
  resource_bounds: { l2_gas: { max_amount: string } };
};
type Event = { from_address: string; keys: string[]; data: string[] };
type RpcRequest = {
  id: number;
  method: string;
  params: { request?: { entry_point_selector: string }; invoke_transaction?: Invoke; transaction_hash?: string } & {
    [index: number]: unknown;
  };
};
const servers: Array<ReturnType<typeof Bun.serve>> = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
});
function setup() {
  const invokes: Invoke[] = [];
  let remaining = [0n];
  let events: (hash: string) => Event[] = (transactionHash) => [
    {
      from_address: "0x77",
      keys: [hash.getSelectorFromName("BatchProgress"), "7"],
      data: ["0x123", transactionHash, String(remaining.shift() ?? 0n)],
    },
  ];
  const calls: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const rpc = (await request.json()) as RpcRequest;
      calls.push(rpc.method);
      let result: unknown;
      switch (rpc.method) {
        case "starknet_specVersion":
          result = "0.9.0";
          break;
        case "starknet_chainId":
          result = "0x1";
          break;
        case "starknet_getNonce":
          result = `0x${invokes.length.toString(16)}`;
          break;
        case "starknet_call": {
          const call = (rpc.params.request ?? rpc.params[0]) as { entry_point_selector: string };
          const selector = BigInt(call.entry_point_selector);
          result =
            selector === BigInt(hash.getSelectorFromName("game"))
              ? ["1", "2", "291", "0", "1", "0", "100", "200", "300", "5", "1"]
              : selector === BigInt(hash.getSelectorFromName("game_release"))
                ? ["2"]
                : ["4"];
          break;
        }
        case "starknet_addInvokeTransaction":
          invokes.push((rpc.params.invoke_transaction ?? rpc.params[0]) as Invoke);
          result = { transaction_hash: `0x${(0x54 + invokes.length).toString(16)}` };
          break;
        case "starknet_getTransactionStatus":
          result = { finality_status: "ACCEPTED_ON_L2", execution_status: "SUCCEEDED" };
          break;
        case "starknet_getTransactionReceipt": {
          const transactionHash = (rpc.params.transaction_hash ?? rpc.params[0]) as string;
          result = {
            type: "INVOKE",
            transaction_hash: transactionHash,
            block_hash: "0x44",
            block_number: 42,
            execution_status: "SUCCEEDED",
            finality_status: "ACCEPTED_ON_L2",
            events: events(transactionHash),
            actual_fee: { amount: "0x0", unit: "FRI" },
            messages_sent: [],
            execution_resources: {},
          };
          break;
        }
        default:
          throw new Error(`Unexpected test RPC ${rpc.method}`);
      }
      return Response.json({ jsonrpc: "2.0", id: rpc.id, result });
    },
  });
  servers.push(server);
  const manifest = {
    world: { address: "0x77" },
    shard: { chainId: "0x1", l2GasBound: "0x1234" },
    native: { activeSchema: schema.identity, schemas: { [schema.identity]: schema } },
  } as unknown as NativeWorldManifest;
  const input = {
    provider: new RpcProvider({ nodeUrl: `http://127.0.0.1:${server.port}`, specVersion: "0.9.0" }),
    manifest,
    gameId: 7,
    accountAddress: "0x123",
    privateKey: "0x1234",
    command: { kind: "MarkGameSettled", value: undefined } as const,
  };
  return {
    input,
    invokes,
    calls,
    progress: (values: bigint[]) => {
      remaining = values;
    },
    events: (value: typeof events) => {
      events = value;
    },
  };
}

describe("player-signed administrative gameplay", () => {
  it("sends one v3 play at current nonce and pinned bounds, and reads progress by transaction hash", async () => {
    const { input, invokes } = setup();
    expect(await executeNativeAdminCommand(input)).toEqual({ transactionHash: "0x55", remaining: "0" });
    expect(invokes).toHaveLength(1);
    const invoke = invokes[0];
    expect(invoke.version).toBe("0x3");
    expect(BigInt(invoke.nonce)).toBe(0n);
    expect(invoke.signature).toHaveLength(3);
    expect(BigInt(invoke.resource_bounds.l2_gas.max_amount)).toBe(0x1234n);
    // Realms Cairo-1 account: one call, target, selector, span length, play(game,pins,command span).
    expect(invoke.calldata.slice(0, 8).map(BigInt)).toEqual([
      1n,
      0x77n,
      BigInt(hash.getSelectorFromName("play")),
      5n,
      7n,
      2n,
      4n,
      1n,
    ]);
  });
  it("continues a batch with a new nonce and stops at zero", async () => {
    const { input, invokes, progress } = setup();
    progress([2n, 0n]);
    expect(await completeNativeAdminCommand(input)).toEqual({
      transactionHash: "0x56",
      remaining: "0",
      transactions: 2,
    });
    expect(invokes.map((invoke) => BigInt(invoke.nonce))).toEqual([0n, 1n]);
  });
  it("does not infer completion from a different transaction's progress", async () => {
    const { input, events } = setup();
    events(() => [
      { from_address: "0x77", keys: [hash.getSelectorFromName("BatchProgress"), "7"], data: ["0x123", "0x99", "0"] },
    ]);
    await expect(completeNativeAdminCommand(input)).rejects.toThrow("no remaining count");
  });
  it("stops a non-progressing batch", async () => {
    const { input, progress, invokes } = setup();
    progress([2n, 2n]);
    await expect(completeNativeAdminCommand(input)).rejects.toThrow("no progress");
    expect(invokes).toHaveLength(2);
  });
  it("preserves a domain refusal in a successful invoke", async () => {
    const { input, events } = setup();
    events((transactionHash) => [
      {
        from_address: "0x77",
        keys: [hash.getSelectorFromName("GameplayRejected"), "1", "7", "0x123", transactionHash],
        data: [
          shortString.encodeShortString("GAMEPLAY_REJECTED"),
          ...CallData.compile(byteArray.byteArrayFromString("game has not ended")),
        ],
      },
    ]);
    await expect(executeNativeAdminCommand(input)).rejects.toThrow("GAMEPLAY_REJECTED: game has not ended");
  });
  it("refuses player commands and missing bounds before RPC or signing", async () => {
    const { input, invokes, calls } = setup();
    await expect(
      executeNativeAdminCommand({ ...input, command: { kind: "Explore", value: { explorer_id: 1, direction: 0 } } }),
    ).rejects.toThrow("Not an administrative");
    input.manifest.shard.l2GasBound = "0x0";
    await expect(executeNativeAdminCommand(input)).rejects.toThrow("canonical nonzero");
    expect(invokes).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
});
