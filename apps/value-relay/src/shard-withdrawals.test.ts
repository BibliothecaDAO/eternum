import { Effect } from "effect";
import { hash, shortString } from "starknet";
import { beforeEach, expect, it, vi } from "vitest";
import { ShardReader } from "./shard-rpc";
import { shardWithdrawalPorts } from "./shard-withdrawals";
import { RelayFailure } from "./ports";
import { frontierPayment } from "./adapters";

const rpc = vi.hoisted(() => ({
  chain: vi.fn(),
  header: vi.fn(),
  block: vi.fn(),
  contract: vi.fn(),
  receipt: vi.fn(),
}));
vi.mock("./rpc", () => ({
  rpcAt: () => ({
    getChainId: rpc.chain,
    getBlock: rpc.header,
    getBlockWithReceipts: rpc.block,
    getClassAt: rpc.contract,
    getTransactionReceipt: rpc.receipt,
  }),
}));
const address = "0x10";
const abi = [
  {
    type: "event",
    name: "world_native::games::Event",
    kind: "enum",
    variants: [{ name: "Relics", type: "world_native::relics::Event", kind: "nested" }],
  },
  {
    type: "event",
    name: "world_native::relics::Event",
    kind: "enum",
    variants: [{ name: "RowSet", type: "world_native::events::RowSet", kind: "nested" }],
  },
  {
    type: "event",
    name: "world_native::events::RowSet",
    kind: "struct",
    members: [
      { name: "version", kind: "key" },
      { name: "model", kind: "key" },
      { name: "keys", kind: "data" },
      { name: "values", kind: "data" },
    ],
  },
];
const event = () => ({
  from_address: address,
  keys: [
    hash.getSelectorFromName("Relics"),
    hash.getSelectorFromName("RowSet"),
    "0x1",
    shortString.encodeShortString("LordsWithdrawal"),
  ],
  data: ["2", "7", "0xabc", "2", "0x123", "17"],
});
const receipt = () => ({
  transaction_hash: "0xabc",
  block_number: 10,
  block_hash: "0xa",
  execution_status: "SUCCEEDED",
  finality_status: "ACCEPTED_ON_L2",
  events: [event()],
});
const header = { block_number: 10, block_hash: "0xa", parent_hash: "0x9", timestamp: 1000, status: "ACCEPTED_ON_L2" };
const fixture = () => {
  const reader = new ShardReader({ chainId: "0x1", rpcUrl: "https://shard.test/rpc", gamesAddress: address });
  const bindings = { realmsIdForAccount: vi.fn(async () => "0x2"), frontierSeason: vi.fn(() => Effect.succeed(3)) };
  return { reader, bindings, ports: shardWithdrawalPorts(reader, bindings) };
};
beforeEach(() => {
  vi.clearAllMocks();
  rpc.chain.mockResolvedValue("0x1");
  rpc.header.mockResolvedValue(header);
  rpc.contract.mockResolvedValue({ abi });
  rpc.receipt.mockResolvedValue(receipt());
  rpc.block.mockResolvedValue({
    ...header,
    transactions: [{ transaction: { transaction_hash: "0xabc" }, receipt: receipt() }],
  });
});
it("reads a confirmed debit receipt and pays exact wei to the resolved account's wallet", async () => {
  const f = fixture();
  const block = await Effect.runPromise(f.ports.block(10));
  expect(block.withdrawals).toEqual([
    {
      chainId: "0x1",
      seasonId: 3,
      transactionHash: "0xabc",
      realmsId: "0x2",
      amount: "17000000000000000000",
      confirmedAt: 1000,
    },
  ]);
  const submit = vi.fn(async () => {});
  await Effect.runPromise(frontierPayment(submit)(block.withdrawals[0]!, "0x456"));
  expect(submit).toHaveBeenCalledWith("pay", ["0x1", "3", "0xabc", "0x456", "17000000000000000000", "0"]);
  expect(rpc.contract).toHaveBeenCalledWith(address, 10);
  expect(f.bindings.realmsIdForAccount).toHaveBeenCalledWith("0x123");
});
it("does not infer a season when its funding binding is unavailable", async () => {
  const f = fixture();
  f.bindings.frontierSeason.mockReturnValue(Effect.fail(new RelayFailure({ operation: "binding_missing" })) as never);
  await expect(Effect.runPromise(f.ports.block(10))).rejects.toMatchObject({ operation: "binding_missing" });
});
it("rejects unconfirmed blocks, wrong chain and transaction/claim mismatches", async () => {
  const f = fixture();
  rpc.block.mockResolvedValue({ ...header, status: "PRE_CONFIRMED", transactions: [] });
  await expect(Effect.runPromise(f.ports.block(10))).rejects.toThrow();
  rpc.block.mockResolvedValue({
    ...header,
    transactions: [{ transaction: { transaction_hash: "0xdef" }, receipt: receipt() }],
  });
  await expect(Effect.runPromise(f.ports.block(10))).rejects.toThrow();
  const forged = receipt();
  forged.events[0]!.data[2] = "0xdef";
  rpc.block.mockResolvedValue({
    ...header,
    transactions: [{ transaction: { transaction_hash: "0xabc" }, receipt: forged }],
  });
  await expect(Effect.runPromise(f.ports.block(10))).rejects.toThrow();
  rpc.chain.mockResolvedValue("0x2");
  await expect(Effect.runPromise(f.ports.confirmedHead())).rejects.toThrow();
});
it("only a missing confirmed receipt is null; transport faults and pending receipts fail closed", async () => {
  const f = fixture();
  rpc.receipt.mockRejectedValueOnce({ code: 29 });
  expect(await Effect.runPromise(f.ports.withdrawal("0x1", "0xabc"))).toBeNull();
  rpc.receipt.mockRejectedValueOnce(new Error("network offline"));
  await expect(Effect.runPromise(f.ports.withdrawal("0x1", "0xabc"))).rejects.toThrow();
  rpc.receipt.mockResolvedValue({ ...receipt(), block_number: undefined, finality_status: "PRE_CONFIRMED" });
  await expect(Effect.runPromise(f.ports.withdrawal("0x1", "0xabc"))).rejects.toThrow();
});
it("refuses old receipt layouts rather than applying the new interpretation", async () => {
  const old = receipt();
  old.events[0]!.data = ["3", "7", "8", "9", "3", "0x123", "5", "17"];
  rpc.block.mockResolvedValue({
    ...header,
    transactions: [{ transaction: { transaction_hash: "0xabc" }, receipt: old }],
  });
  await expect(Effect.runPromise(fixture().ports.block(10))).rejects.toThrow();
});

it("reads an accepted hash anchor without loading the ABI or resolving a receipt binding", async () => {
  const f = fixture();
  expect(await Effect.runPromise(f.ports.blockHash(10))).toBe("0xa");
  expect(rpc.contract).not.toHaveBeenCalled();
  expect(f.bindings.frontierSeason).not.toHaveBeenCalled();
  rpc.header.mockResolvedValue({ ...header, status: "PRE_CONFIRMED" });
  await expect(Effect.runPromise(f.ports.blockHash(10))).rejects.toThrow();
});
