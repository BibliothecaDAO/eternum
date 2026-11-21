import { gameRegistryRow } from "../../core/src/test-support/game-registry";
import { gamesAbi as abi, gamesEvent, response } from "../test-support/abi";
import { beforeEach, expect, it, vi } from "vitest";
import { shortString, ec, CallData } from "starknet";
import { ShardOperator } from "./shard";
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
    getClassHashAt: async () => "0xabc",
    getClassByHash: async () => ({ abi }),
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
        ? response(
            abi,
            "game",
            gameRegistryRow({
              name: "0",
              start_settling_at: "0",
              start_main_at: "0",
              scheduled_end_at: "0",
              end_at: "0",
              seed: "0",
            }),
          )
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
  await operator.markGameSettled(7);
  expect(rpc.execute).toHaveBeenCalledWith(
    {
      contractAddress: "0x10",
      entrypoint: "play",
      calldata: [
        "7",
        "2",
        "1",
        ...encodeNativeCommand(bindings.commandAbi, { kind: "MarkGameSettled", value: undefined }),
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
      command: encodeNativeCommand(bindings.commandAbi, { kind: "MarkGameSettled", value: undefined }),
    }),
  );
  const signed = await (rpc.signer as { signRaw(hash: string): Promise<string[]> }).signRaw("0x123");
  expect(signed).toHaveLength(3);
  expect(signed[0]).toBe(ec.starkCurve.getStarkKey(device));
});

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
          reason: "game not ended",
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
  await expect(operator.markGameSettled(7)).rejects.toThrow("gameplay_refused:game not ended");
});

it("waits past a pre-confirmed receipt for the closed block", async () => {
  const preConfirmed = { finality_status: "PRE_CONFIRMED", isReverted: () => false, events: [] };
  const accepted = { block_number: 11, finality_status: "ACCEPTED_ON_L2", isReverted: () => false, events: [] };
  const operator = new ShardOperator({
    chainId: "0x1",
    rpcUrl: "https://shard.test",
    gamesAddress: "0x10",
    accountAddress: "0x20",
    privateKey: "0x1",
  });
  rpc.receipt.mockResolvedValueOnce(preConfirmed).mockResolvedValueOnce(accepted);
  await operator.markGameSettled(7);
  expect(rpc.receipt).toHaveBeenCalledTimes(2);
});

it("sweeps one structure's LORDS through the generated Games ABI with its full u64 id", async () => {
  const operator = new ShardOperator({
    chainId: "0x1",
    rpcUrl: "https://shard.test",
    gamesAddress: "0x10",
    accountAddress: "0x20",
    privateKey: "0x1",
  });
  await operator.admin("sweep_lords", { game_id: 7, structure_id: 2n ** 55n + 9n });
  expect(rpc.execute).toHaveBeenCalledTimes(1);
  expect(rpc.execute.mock.calls[0]![0]).toEqual({
    contractAddress: "0x10",
    entrypoint: "sweep_lords",
    calldata: ["7", "36028797018963977"],
  });
});

it("settles an ended game one batch at a time until it reads settled, and sends nothing for a settled game", async () => {
  const batches = [3, 0];
  let settled = false;
  const game = () =>
    response(
      abi,
      "game",
      gameRegistryRow({
        name: "0",
        settled,
        start_settling_at: "0",
        start_main_at: "0",
        scheduled_end_at: "0",
        end_at: "0",
        seed: "0",
      }),
    );
  const views = rpc.call.getMockImplementation()!;
  rpc.call.mockImplementation(async (query) => (query.entrypoint === "game" ? game() : views(query)));
  rpc.receipt.mockImplementation(async () => {
    const remaining = batches.shift()!;
    settled = remaining === 0;
    return {
      block_number: 11,
      finality_status: "ACCEPTED_ON_L2",
      isReverted: () => false,
      events: [
        {
          from_address: "0x10",
          ...gamesEvent("BatchProgress", { game_id: 7, actor: "0x20", tx_hash: "0xabc", remaining }),
        },
      ],
    };
  });
  const operator = new ShardOperator({
    chainId: "0x1",
    rpcUrl: "https://shard.test",
    gamesAddress: "0x10",
    accountAddress: "0x20",
    privateKey: "0x1",
  });
  await operator.settleGame(7);
  expect(rpc.execute).toHaveBeenCalledTimes(2);
  for (const [call] of rpc.execute.mock.calls)
    expect(call.calldata.slice(3)).toEqual(
      encodeNativeCommand(bindings.commandAbi, { kind: "MarkGameSettled", value: undefined }),
    );
  await operator.settleGame(7);
  expect(rpc.execute).toHaveBeenCalledTimes(2);
});

it("refuses a settlement batch that reports nothing left while the game still reads unsettled", async () => {
  rpc.receipt.mockResolvedValue({
    block_number: 11,
    finality_status: "ACCEPTED_ON_L2",
    isReverted: () => false,
    events: [
      {
        from_address: "0x10",
        ...gamesEvent("BatchProgress", { game_id: 7, actor: "0x20", tx_hash: "0xabc", remaining: 0 }),
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
  await expect(operator.settleGame(7)).rejects.toThrow("point_settlement_not_complete");
});
it("refuses an administrative argument the Games ABI does not name", async () => {
  const operator = new ShardOperator({
    chainId: "0x1",
    rpcUrl: "https://shard.test",
    gamesAddress: "0x10",
    accountAddress: "0x20",
    privateKey: "0x12345",
  });
  await expect(operator.admin("apply_release", { game_id: 1, release_id: 2, preset_id: 7 })).rejects.toThrow(
    "shard_argument_unknown:preset_id",
  );
  await expect(operator.admin("create_game", { params: { name: "0x1", roster: [] } })).rejects.toThrow(
    "shard_argument_unknown:roster",
  );
  expect(rpc.execute).not.toHaveBeenCalled();
});
