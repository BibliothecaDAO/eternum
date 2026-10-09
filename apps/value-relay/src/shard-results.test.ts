import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { blitzCommitment } from "./blitz-commitment";
import { decodeBlitzResult, shardResultPort } from "./shard-results";
import { ShardReader, type ValueRow } from "./shard-rpc";
import { shardWithdrawalPorts } from "./shard-withdrawals";

const rpc = vi.hoisted(() => ({ chain: vi.fn(), block: vi.fn(), contract: vi.fn(), call: vi.fn() }));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({ getChainId: rpc.chain, getBlock: rpc.block, getClassAt: rpc.contract, callContract: rpc.call }),
}));
const rows = [
  { wallet: "0x123", rank: 1 },
  { wallet: "0x456", rank: 1 },
  { wallet: "0x789", rank: 3 },
];
const result = { chainId: "0x1", gameId: 7, rows, commitment: blitzCommitment({ chainId: "0x1", gameId: 7, rows }) };
const row = (): ValueRow => ({
  model: "BlitzResult",
  keys: ["7"],
  transactionHash: "0xabc",
  values: ["3", "0x123", "1", "0x456", "1", "0x789", "3", "1", result.commitment],
});
const reader = () => new ShardReader({ chainId: "0x1", gamesAddress: "0x10", rpcUrl: "https://shard.test/rpc" });
const ranked = {
  type: "struct",
  name: "world_native::blitz_results::RankedPlayer",
  members: [
    { name: "wallet", type: "core::starknet::contract_address::ContractAddress" },
    { name: "rank", type: "core::integer::u16" },
  ],
};
const record = {
  type: "struct",
  name: "world_native::blitz_results::BlitzResult",
  members: [
    { name: "players", type: `core::array::Span::<${ranked.name}>` },
    { name: "complete", type: "core::bool" },
    { name: "commitment", type: "core::felt252" },
  ],
};
const abi = [
  ranked,
  record,
  {
    type: "function",
    name: "blitz_result",
    inputs: [{ name: "game_id", type: "core::integer::u32" }],
    outputs: [{ type: record.name }],
  },
];
beforeEach(() => {
  vi.clearAllMocks();
  rpc.chain.mockResolvedValue("0x1");
  rpc.block.mockResolvedValue({
    block_number: 10,
    block_hash: "0xa",
    parent_hash: "0x9",
    timestamp: 1000,
    status: "ACCEPTED_ON_L2",
  });
  rpc.contract.mockResolvedValue({ abi });
  rpc.call.mockResolvedValue(row().values);
});
it("reads precisely the committed frozen wallets and competition ranks at a confirmed head", async () => {
  expect(await Effect.runPromise(shardResultPort(reader())("0x1", 7))).toEqual(result);
  expect(rpc.call).toHaveBeenCalledWith({ contractAddress: "0x10", entrypoint: "blitz_result", calldata: ["7"] }, 10);
  expect(rpc.contract).toHaveBeenCalledWith("0x10", 10);
});
it("ingests only completed records while retaining withdrawals in the same confirmed block", async () => {
  const source = reader();
  const partial = { ...row(), values: ["1", "0x123", "1", "0", "0x0"] };
  vi.spyOn(source, "block").mockResolvedValue({
    block: {
      block_number: 10,
      block_hash: "0xa",
      parent_hash: "0x9",
      timestamp: 1000,
      status: "ACCEPTED_ON_L2",
      transactions: [],
    },
    rows: [
      partial,
      row(),
      { model: "LordsWithdrawal", keys: ["8", "0xdef"], values: ["0x321", "9"], transactionHash: "0xdef" },
    ],
  });
  const ports = shardWithdrawalPorts(source, {
    realmsIdForAccount: async () => "0x2",
    frontierSeason: () => Effect.succeed(4),
  });
  const block = await Effect.runPromise(ports.block(10));
  expect(block.results).toEqual([result]);
  expect(block.withdrawals[0]).toMatchObject({ transactionHash: "0xdef", seasonId: 4, amount: "9000000000000000000" });
});
it("ignores a genuinely incomplete result but rejects its premature commitment", () => {
  expect(decodeBlitzResult("0x1", { ...row(), values: ["0", "0", "0x0"] })).toBeNull();
  expect(() => decodeBlitzResult("0x1", { ...row(), values: ["0", "0", "0x1"] })).toThrow();
});
it.each([
  ["3", "0x123", "1", "0x456", "1", "0x789", "2", "1", result.commitment],
  ["3", "0x456", "1", "0x123", "1", "0x789", "3", "1", result.commitment],
  ["3", "0x123", "1", "0x123", "1", "0x789", "3", "1", result.commitment],
  ["1", "0x0", "1", "1", result.commitment],
  ["0", "1", "0x0"],
  ["1", "0x123", "1", "2", result.commitment],
  ["3", "0x123", "1", "0x456", "1", "0x789", "3", "1", "0xbad"],
])("refuses malformed ranks, bools, ordering or commitments (%s)", (...values) => {
  expect(() => decodeBlitzResult("0x1", { ...row(), values })).toThrow();
});
it("refuses the previous account/points result ABI even when the raw record is empty", async () => {
  rpc.contract.mockResolvedValue({
    abi: [
      record,
      {
        ...ranked,
        members: [
          { name: "player", type: "ContractAddress" },
          { name: "points", type: "u64" },
          { name: "rank", type: "u16" },
        ],
      },
      abi[2],
    ],
  });
  rpc.call.mockResolvedValue(["0", "0", "0x0"]);
  await expect(Effect.runPromise(shardResultPort(reader())("0x1", 7))).rejects.toThrow();
  expect(rpc.call).not.toHaveBeenCalled();
});
