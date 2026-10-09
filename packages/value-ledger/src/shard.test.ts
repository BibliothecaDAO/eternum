import { beforeEach, expect, it, vi } from "vitest";
import { hash, ec } from "starknet";
import { ShardOperator, batchRemaining } from "./shard";

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
const abi = [
  { type: "struct", name: "Game", members: [{ name: "preset_id", type: "core::integer::u32" }] },
  ...["l2_gas_bound", "game_release", "preset_commitment"].map((name) => ({
    type: "function",
    name,
    inputs: [],
    outputs: [{ type: "core::felt252" }],
    state_mutability: "view",
  })),
  { type: "function", name: "game", inputs: [], outputs: [{ type: "Game" }], state_mutability: "view" },
];
beforeEach(() => {
  vi.clearAllMocks();
  rpc.chain.mockResolvedValue("0x1");
  rpc.block.mockResolvedValue({ block_number: 10, block_hash: "0xa", timestamp: 100, status: "ACCEPTED_ON_L2" });
  rpc.call.mockImplementation(async (query) => (query.entrypoint === "l2_gas_bound" ? ["1000000"] : ["2"]));
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
  await operator.play(7, ["7"]);
  expect(rpc.execute).toHaveBeenCalledWith(
    { contractAddress: "0x10", entrypoint: "play", calldata: ["7", "2", "2", "1", "7"] },
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
  const signed = await (rpc.signer as { signRaw(hash: string): Promise<string[]> }).signRaw("0x123");
  expect(signed).toHaveLength(3);
  expect(signed[0]).toBe(ec.starkCurve.getStarkKey(device));
});
it("requires the exact transaction-correlated BatchProgress; an absent record is not remaining zero", () => {
  expect(() => batchRemaining([], "0x10", 7, "0xabc")).toThrow();
  const event = {
    from_address: "0x10",
    keys: [hash.getSelectorFromName("BatchProgress"), "0x7"],
    data: ["0x20", "0xabc", "0"],
  };
  expect(batchRemaining([event], "0x10", 7, "0xabc")).toBe(0n);
  expect(() => batchRemaining([event], "0x10", 7, "0xdef")).toThrow();
});
