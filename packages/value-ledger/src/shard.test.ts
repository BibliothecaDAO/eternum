import { gamesAbi as abi, gamesEvent, response } from "../test-support/abi";
import { beforeEach, expect, it, vi } from "vitest";
import { shortString, ec, CallData } from "starknet";
import { ShardOperator, batchRemaining } from "./shard";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { encodeNativeCommand } from "@bibliothecadao/provider";

const rpc = vi.hoisted(() => ({
  chain: vi.fn(),
  block: vi.fn(),
  call: vi.fn(),
  receipt: vi.fn(),
  execute: vi.fn(),
  signer: null as unknown,
}));
vi.mock("./rpc", () => ({
  rpcAt: () => ({
    getChainId: rpc.chain,
    getBlock: rpc.block,
    callContract: rpc.call,
    getTransactionReceipt: rpc.receipt,
    getClassAt: async () => ({ abi }),
  }),
}));
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  Account: vi.fn(function (options: { signer: unknown }) {
    rpc.signer = options.signer;
    return { execute: rpc.execute };
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  rpc.chain.mockResolvedValue("0x1");
  rpc.block.mockResolvedValue({
    block_number: 10,
    block_hash: "0xa",
    timestamp: 100,
    status: "ACCEPTED_ON_L2",
  });
  rpc.call.mockImplementation(async (query) =>
    query.entrypoint === "l2_gas_bound"
      ? ["1000000"]
      : query.entrypoint === "game"
        ? response(abi, "game", {
            name: 0,
            preset_id: 2,
            settled: false,
            ready: false,
            dev_mode_on: false,
            start_settling_at: 0,
            start_main_at: 0,
            end_at: 0,
            end_grace_seconds: 0,
            seed: 0,
          })
        : ["2"],
  );
  rpc.execute.mockResolvedValue({ transaction_hash: "0xabc" });
  rpc.receipt.mockResolvedValue({
    block_number: 11,
    block_hash: "0xb",
    finality_status: "ACCEPTED_ON_L2",
    isReverted: () => false,
    events: [],
  });
});
it("uses the fixed ordinary v3 play frame and a native three-felt device signature", async () => {
  const device = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(31))).toString("hex")}`;
  const operator = new ShardOperator({
    chainId: "0x1",
    rpcUrl: "https://shard.test",
    gamesAddress: "0x10",
    accountAddress: "0x20",
    privateKey: device,
  });
  await operator.playCommand(7, "SettleBlitzRoster");
  expect(rpc.execute).toHaveBeenCalledWith(
    {
      contractAddress: "0x10",
      entrypoint: "play",
      calldata: [
        "7",
        "2",
        "2",
        "1",
        ...encodeNativeCommand(bindings.commandAbi, { kind: "SettleBlitzRoster", value: undefined }),
      ],
    },
    expect.objectContaining({
      tip: 0,
      paymasterData: [],
      accountDeploymentData: [],
      resourceBounds: {
        l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
        l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
        l2_gas: { max_amount: 1000000n, max_price_per_unit: 0n },
      },
    }),
  );
  expect(rpc.execute.mock.calls[0]![0].calldata).toEqual(
    new CallData(abi).compile("play", {
      game_id: 7,
      release_id: 2,
      preset_commitment: 2,
      command: encodeNativeCommand(bindings.commandAbi, { kind: "SettleBlitzRoster", value: undefined }),
    }),
  );
  const signed = await (rpc.signer as { signRaw(hash: string): Promise<string[]> }).signRaw("0x123");
  expect(signed).toHaveLength(3);
  expect(signed[0]).toBe(ec.starkCurve.getStarkKey(device));
});
it("requires the exact transaction-correlated BatchProgress; an absent record is not remaining zero", () => {
  expect(() => batchRemaining([], "0x10", "0xabc", { gameId: 7, missing: "reject" })).toThrow();
  const event = {
    from_address: "0x10",
    ...gamesEvent("BatchProgress", { game_id: 7, actor: "0x20", tx_hash: "0xabc", remaining: 0 }),
  };
  expect(batchRemaining([event], "0x10", "0xabc", { gameId: 7, missing: "reject" })).toBe(0n);
  expect(() => batchRemaining([event], "0x10", "0xdef", { gameId: 7, missing: "reject" })).toThrow();
});

it.each(["MarkGameSettled", "RecordBlitzResults"] as const)(
  "encodes %s from the generated routes without a runtime Command enum",
  async (name) => {
    const operator = new ShardOperator({
      chainId: "0x1",
      rpcUrl: "https://shard.test",
      gamesAddress: "0x10",
      accountAddress: "0x20",
      privateKey: "0x1",
    });
    await operator.playCommand(7, name);
    expect(rpc.execute.mock.calls[0]![0].calldata).toEqual([
      "7",
      "2",
      "2",
      "1",
      ...encodeNativeCommand(bindings.commandAbi, { kind: name, value: undefined }),
    ]);
  },
);

it("rejects a successful invoke carrying the generated GameplayRejected event", async () => {
  rpc.receipt.mockResolvedValue({
    block_number: 11,
    finality_status: "ACCEPTED_ON_L2",
    isReverted: () => false,
    events: [
      {
        from_address: "0x10",
        ...gamesEvent("GameplayRejected", {
          version: 1,
          game_id: 7,
          actor: "0x20",
          tx_hash: "0xabc",
          status_class: shortString.encodeShortString("domain"),
          reason: "roster not ready",
        }),
      },
    ],
  });
  const operator = new ShardOperator({
    chainId: "0x1",
    rpcUrl: "https://shard.test",
    gamesAddress: "0x10",
    accountAddress: "0x20",
    privateKey: "0x1",
  });
  await expect(operator.playCommand(7, "SettleBlitzRoster")).rejects.toThrow("gameplay_refused:roster not ready");
});

it("compiles the labor mutation through the real operator and generated Games ABI", async () => {
  const operator = new ShardOperator({
    chainId: "0x1",
    rpcUrl: "https://shard.test",
    gamesAddress: "0x10",
    accountAddress: "0x20",
    privateKey: "0x1",
  });
  const args = { realm: { game_id: 7, realm_id: 8, home: 2n ** 55n + 9n }, day: 30, account: "0x123" };
  await operator.admin("grant_labor", args);
  expect(rpc.execute.mock.calls[0]![0]).toEqual({
    contractAddress: "0x10",
    entrypoint: "grant_labor",
    calldata: new CallData(abi).compile("grant_labor", args),
  });
});
