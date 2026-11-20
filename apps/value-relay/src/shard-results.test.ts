import { gamesAbi as abi } from "../../../packages/value-ledger/test-support/abi";
import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { blitzCommitment } from "@realms-world/value-ledger/commitment";
import { decodeBlitzResult, shardResultPort } from "./shard-results";
import { ShardReader, type ValueRow } from "./shard-rpc";
import { shardWithdrawalPorts } from "./shard-withdrawals";

const rpc = vi.hoisted(() => ({
  classHash: vi.fn(),
  chain: vi.fn(),
  block: vi.fn(),
  contract: vi.fn(),
  call: vi.fn(),
}));
vi.mock("../../../packages/value-ledger/src/rpc", async (original) => ({
  ...(await original<typeof import("../../../packages/value-ledger/src/rpc")>()),
  rpcAt: () => ({
    getChainId: rpc.chain,
    getBlock: rpc.block,
    getClassHashAt: rpc.classHash,
    getClassByHash: rpc.contract,
    callContract: rpc.call,
  }),
}));
const rows = [
  { wallet: "0x123", rank: 1 },
  { wallet: "0x456", rank: 1 },
  { wallet: "0x789", rank: 3 },
];
const result = { chainId: "0x1", gameId: 7, rows, commitment: blitzCommitment({ chainId: "0x1", gameId: 7, rows }) };
const resultValues = (players: typeof rows, complete: boolean, commitment: string) => [
  String(players.length),
  ...players.flatMap(({ wallet, rank }) => [wallet, String(rank)]),
  complete ? "1" : "0",
  commitment,
];
const row = (): ValueRow => ({
  model: "BlitzResult",
  keys: ["7"],
  transactionHash: "0xabc",
  values: resultValues(rows, true, result.commitment),
});
const span = (values: string[]) => [String(values.length), ...values];
const reader = () =>
  new ShardReader({ chainId: "0x1", gamesAddress: "0x10", rpcUrl: "https://shard.test/rpc", firstRelease: 1 });
let classVersion = 0;
beforeEach(() => {
  vi.clearAllMocks();
  rpc.classHash.mockResolvedValue(`0x${(++classVersion).toString(16)}`);
  rpc.chain.mockResolvedValue("0x1");
  rpc.block.mockResolvedValue({
    block_number: 10,
    block_hash: "0xa",
    parent_hash: "0x9",
    timestamp: 1000,
    status: "ACCEPTED_ON_L2",
  });
  rpc.contract.mockResolvedValue({ abi });
  rpc.call.mockResolvedValue(span(row().values));
});
it("reads precisely the committed frozen wallets and competition ranks at a confirmed head", async () => {
  expect(await Effect.runPromise(shardResultPort(reader())("0x1", 7))).toEqual(result);
  expect(rpc.call).toHaveBeenCalledWith({ contractAddress: "0x10", entrypoint: "game_result", calldata: ["7"] }, 10);
  expect(rpc.classHash).toHaveBeenCalledWith("0x10", 10);
});
it("ingests only completed records while retaining withdrawals in the same confirmed block", async () => {
  const source = reader();
  const partial = { ...row(), values: resultValues([], false, "0x0") };
  vi.spyOn(source, "page").mockResolvedValue({
    block: {
      block_number: 10,
      block_hash: "0xa",
      parent_hash: "0x9",
      timestamp: 1000,
      status: "ACCEPTED_ON_L2",
      transactions: [],
    },
    first: { block_number: 10, block_hash: "0xa", parent_hash: "0x9", timestamp: 1000, status: "ACCEPTED_ON_L2" },
    anchors: [{ number: 10, hash: "0xa" }],
    next: null,
    rows: [
      { ...partial, confirmedAt: 1000 },
      { ...row(), confirmedAt: 1000 },
      {
        model: "LordsWithdrawal",
        keys: ["8", "0xdef"],
        values: ["0x321", "9", "0", "0"],
        transactionHash: "0xdef",
        confirmedAt: 1000,
      },
    ],
  });
  const ports = shardWithdrawalPorts(source, {
    realmsIdForAccount: async () => "0x2",
    frontierSeason: () => Effect.succeed(4),
  });
  const block = await Effect.runPromise(ports.eventsPage(10, 10, null));
  expect(block.results).toEqual([{ ...result, blockNumber: 10 }]);
  expect(block.withdrawals[0]).toMatchObject({ transactionHash: "0xdef", seasonId: 4, amount: "9000000000000000000" });
});
it("ignores a genuinely incomplete result but rejects its premature commitment", () => {
  expect(decodeBlitzResult("0x1", { ...row(), values: ["0", "0", "0x0"] })).toBeNull();
  expect(() => decodeBlitzResult("0x1", { ...row(), values: ["0", "0", "0x1"] })).toThrow();
  expect(() => decodeBlitzResult("0x1", { ...row(), values: ["1", "0x123", "1", "0", "0x0"] })).toThrow(
    "invalid_incomplete_result",
  );
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
it.each([
  ["no game_result", abi.filter((entry) => entry.name !== "game_result")],
  [
    "a typed game_result",
    abi.map((entry) =>
      entry.name === "game_result"
        ? { ...entry, outputs: [{ type: "world_native::blitz_results::BlitzResult" }] }
        : entry,
    ),
  ],
])("refuses a Games class with %s before reading it", async (_case, classAbi) => {
  rpc.contract.mockResolvedValue({ abi: classAbi });
  await expect(Effect.runPromise(shardResultPort(reader())("0x1", 7))).rejects.toThrow();
  expect(rpc.call).not.toHaveBeenCalled();
});
it.each([[[]], [["10", ...row().values]], [["8", ...row().values]]])(
  "refuses a result span whose length differs from its values (%j)",
  async (values) => {
    rpc.call.mockResolvedValue(values);
    await expect(Effect.runPromise(shardResultPort(reader())("0x1", 7))).rejects.toThrow();
  },
);

it("propagates an absent game's roster refusal instead of calling it an incomplete result", async () => {
  rpc.call.mockRejectedValue(new Error("game has no Blitz roster"));
  await expect(Effect.runPromise(shardResultPort(reader())("0x1", 7))).rejects.toMatchObject({
    operation: "read confirmed Blitz result",
  });
});
