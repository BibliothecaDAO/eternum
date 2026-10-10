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
  hashes: vi.fn(),
  events: vi.fn(),
  contract: vi.fn(),
  receipt: vi.fn(),
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({
    getEvents: rpc.events,
    getChainId: rpc.chain,
    getBlock: rpc.header,
    getBlockWithReceipts: rpc.block,
    getBlockWithTxHashes: rpc.hashes,
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
const emitted = () => ({ ...event(), transaction_hash: "0xabc", block_number: 10, block_hash: "0xa" });
const header = { block_number: 10, block_hash: "0xa", parent_hash: "0x9", timestamp: 1000, status: "ACCEPTED_ON_L2" };
const fixture = () => {
  const reader = new ShardReader({ chainId: "0x1", rpcUrl: "https://shard.test/rpc", gamesAddress: address });
  const bindings = {
    realmsIdForAccount: vi.fn(async (_account: string) => "0x2"),
    frontierSeason: vi.fn(() => Effect.succeed(3)),
  };
  return { reader, bindings, ports: shardWithdrawalPorts(reader, bindings) };
};
beforeEach(() => {
  vi.clearAllMocks();
  rpc.chain.mockResolvedValue("0x1");
  rpc.header.mockResolvedValue(header);
  rpc.contract.mockResolvedValue({ abi });
  rpc.receipt.mockResolvedValue(receipt());
  rpc.events.mockResolvedValue({ events: [emitted()] });
});
it("reads a confirmed debit receipt and pays exact wei to the resolved account's wallet", async () => {
  const f = fixture();
  const block = await Effect.runPromise(f.ports.eventsPage(10, 10, null));
  expect(block.withdrawals).toEqual([
    {
      blockNumber: 10,
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
  expect(await Effect.runPromise(f.ports.eventsPage(10, 10, null))).toMatchObject({
    withdrawals: [],
    held: [{ reason: "binding_missing" }],
  });
});
it("rejects unconfirmed blocks, wrong chain and transaction/claim mismatches", async () => {
  const f = fixture();
  rpc.header.mockResolvedValueOnce({ ...header, status: "PRE_CONFIRMED" });
  await expect(Effect.runPromise(f.ports.eventsPage(10, 10, null))).rejects.toThrow();
  rpc.events.mockResolvedValueOnce({ events: [{ ...emitted(), block_hash: "0xb" }] });
  await expect(Effect.runPromise(f.ports.eventsPage(10, 10, null))).rejects.toThrow();
  const forged = emitted();
  forged.data[2] = "0xdef";
  rpc.events.mockResolvedValue({ events: [forged] });
  expect(await Effect.runPromise(f.ports.eventsPage(10, 10, null))).toMatchObject({
    withdrawals: [],
    held: [{ reason: "decode withdrawal receipt" }],
  });
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
  rpc.events.mockResolvedValue({
    events: old.events.map((event) => ({ ...event, transaction_hash: "0xabc", block_number: 10, block_hash: "0xa" })),
  });
  expect(await Effect.runPromise(fixture().ports.eventsPage(10, 10, null))).toMatchObject({
    withdrawals: [],
    held: [{ reason: "decode withdrawal receipt" }],
  });
});

it("reads an accepted hash anchor without loading the ABI or resolving a receipt binding", async () => {
  const f = fixture();
  expect(await Effect.runPromise(f.ports.blockHash(10))).toBe("0xa");
  expect(rpc.contract).not.toHaveBeenCalled();
  expect(f.bindings.frontierSeason).not.toHaveBeenCalled();
  rpc.header.mockResolvedValue({ ...header, status: "PRE_CONFIRMED" });
  await expect(Effect.runPromise(f.ports.blockHash(10))).rejects.toThrow();
});

it("reads confirmed rows when the public proxy refuses block-with-receipts", async () => {
  rpc.block.mockRejectedValue({ code: -32601, message: "Method not public" });
  rpc.events.mockResolvedValue({ events: [emitted()] });
  const rows = await fixture().reader.page(10, 10, null);
  expect(rows.rows[0]).toMatchObject({ model: "LordsWithdrawal", transactionHash: "0xabc" });
  expect(rpc.block).not.toHaveBeenCalled();
  expect(rpc.hashes).not.toHaveBeenCalled();
  expect(rpc.receipt).not.toHaveBeenCalled();
  expect(rpc.events).toHaveBeenCalledWith(expect.objectContaining({ address, chunk_size: 100 }));
});

it("sets aside a bot receipt with no Realms id while still decoding the next player's receipt", async () => {
  const f = fixture();
  f.bindings.realmsIdForAccount.mockImplementation(async (account) => (account === "0x123" ? (null as never) : "0x2"));
  rpc.events.mockResolvedValue({
    events: ["0xabc", "0xdef"].map((hash) => {
      const row = emitted();
      row.transaction_hash = hash;
      row.data[2] = hash;
      row.data[4] = hash === "0xabc" ? "0x123" : "0x456";
      return row;
    }),
  });
  expect(await Effect.runPromise(f.ports.eventsPage(10, 10, null))).toMatchObject({
    withdrawals: [{ transactionHash: "0xdef" }],
    held: [{ kind: "receipt", reason: "withdrawal_account_unknown", receipt: { transactionHash: "0xabc" } }],
  });
});

it("pins one bounded Games event page without reading 2000 unrelated transaction receipts", async () => {
  rpc.hashes.mockResolvedValue({ ...header, transactions: Array(2000).fill("0xabc") });
  rpc.events.mockResolvedValue({ events: [emitted()], continuation_token: "more" });
  const page = await fixture().reader.page(10, 10, null);
  expect(page.next).toBe("more");
  expect(rpc.events).toHaveBeenCalledTimes(1);
  expect(rpc.receipt).not.toHaveBeenCalled();
  expect(rpc.hashes).not.toHaveBeenCalled();
});

it("keeps every header in a bounded event range, including blocks with no value rows", async () => {
  rpc.events.mockResolvedValue({ events: [] });
  rpc.header.mockImplementation(async (number: number) => ({
    ...header,
    block_number: number,
    block_hash: `0x${number + 1}`,
    parent_hash: `0x${number}`,
  }));
  const page = await Effect.runPromise(fixture().ports.eventsPage(10, 14, null));
  expect(page.anchors).toEqual([10, 11, 12, 13, 14].map((number) => ({ number, hash: `0x${number + 1}` })));
  expect(page.withdrawals).toEqual([]);
});
it("refuses a mixed-fork header range before persisting any receipts", async () => {
  rpc.events.mockResolvedValue({ events: [] });
  rpc.header.mockImplementation(async (number: number) => ({
    ...header,
    block_number: number,
    block_hash: `0x${number + 1}`,
    parent_hash: number === 12 ? "0xff" : `0x${number}`,
  }));
  await expect(Effect.runPromise(fixture().ports.eventsPage(10, 14, null))).rejects.toMatchObject({
    operation: "confirmed_block_changed:11",
  });
});
