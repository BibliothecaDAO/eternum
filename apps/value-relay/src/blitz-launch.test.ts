import { ledgerCall, ledgerEvent } from "../../../packages/value-ledger/test-support/ledger-abi";
import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { openSlotOnLedger, refundSlotOnLedger, markSlotRefundable } from "./blitz-launch";

const rpc = vi.hoisted(() => ({
  block: vi.fn(),
  number: vi.fn(),
  events: vi.fn(),
  call: vi.fn(),
  execute: vi.fn(),
  wait: vi.fn(),
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({
    getBlock: rpc.block,
    getBlockNumber: rpc.number,
    getEvents: rpc.events,
    callContract: rpc.call,
    waitForTransaction: rpc.wait,
  }),
}));
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  Account: vi.fn(function () {
    return { execute: rpc.execute };
  }),
}));
const credentials = {
  rpcUrl: "https://ledger.test",
  contractAddress: "0x10",
  accountAddress: "0x20",
  privateKey: "unused-test-key",
};
const key = { chainId: "0x1", slotId: 7 };
const game = (cancelled = false) => ["3", "1", "9", "100", "160", "0", "0", "1", cancelled ? "1" : "0"];
beforeEach(() => {
  vi.clearAllMocks();
  rpc.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 10, block_hash: "0xa", timestamp: 50 });
  rpc.number.mockResolvedValue(11);
  rpc.execute.mockResolvedValue({ transaction_hash: "0xabc" });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
});
it("opens the created shard key under the containing season's economic preset, then recognizes an identical retry", async () => {
  let opened = false;
  rpc.execute.mockImplementation(async () => {
    opened = true;
    return { transaction_hash: "0xabc" };
  });
  rpc.events.mockResolvedValue({
    events: [
      { from_address: "0x10", ...ledgerEvent("SeasonOpened", { season_id: 3, preset_id: 9, start: 60, end: 300 }) },
    ],
  });
  rpc.call.mockImplementation(async (query) =>
    query.entrypoint === "get_season"
      ? ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "1", "9", "60", "300", "0", "0"]
      : opened
        ? game()
        : Array(9).fill("0"),
  );
  const open = () => Effect.runPromise(openSlotOnLedger(credentials, key, { start: 100, end: 160 }));
  await open();
  expect(rpc.execute.mock.calls[0]![0].calldata.map(BigInt)).toEqual(
    ledgerCall("open_slot", {
      key: { shard: key.chainId, slot_id: key.slotId },
      season_id: 3,
      preset_id: 9,
      close: 100,
      end: 160,
    }).map(BigInt),
  );
  await open();
  expect(rpc.execute).toHaveBeenCalledOnce();
  expect(rpc.execute).toHaveBeenCalledWith({
    contractAddress: "0x10",
    entrypoint: "open_slot",
    calldata: ["0x1", "7", "3", "9", "100", "160"],
  });
});
it("cancels before start and automatically waits until the earliest legal abort after start", async () => {
  let cancelled = false;
  rpc.call.mockImplementation(async () => game(cancelled));
  rpc.execute.mockImplementation(async () => {
    cancelled = true;
    return { transaction_hash: "0xabc" };
  });
  expect(await Effect.runPromise(refundSlotOnLedger(credentials, key))).toBeNull();
  expect(rpc.execute.mock.calls[0]![0].calldata.map(BigInt)).toEqual(
    ledgerCall("cancel_slot", { key: { shard: key.chainId, slot_id: key.slotId } }).map(BigInt),
  );
  cancelled = false;
  rpc.execute.mockClear();
  rpc.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 10, block_hash: "0xa", timestamp: 120 });
  expect(await Effect.runPromise(refundSlotOnLedger(credentials, key))).toBe(40);
  expect(rpc.execute).not.toHaveBeenCalled();
  rpc.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 10, block_hash: "0xa", timestamp: 160 });
  expect(await Effect.runPromise(refundSlotOnLedger(credentials, key))).toBeNull();
  expect(rpc.execute.mock.calls[0]![0].calldata.map(BigInt)).toEqual(
    ledgerCall("abort_slot", { key: { shard: key.chainId, slot_id: key.slotId } }).map(BigInt),
  );
});

it("refuses slots outside a season without inventing a services settlement margin", async () => {
  rpc.events.mockResolvedValue({
    events: [
      { from_address: "0x10", ...ledgerEvent("SeasonOpened", { season_id: 3, preset_id: 9, start: 60, end: 300 }) },
    ],
  });
  rpc.call.mockImplementation(async (query) =>
    query.entrypoint === "get_season"
      ? ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "1", "9", "60", "300", "0", "0"]
      : Array(9).fill("0"),
  );
  await expect(Effect.runPromise(openSlotOnLedger(credentials, key, { start: 100, end: 300 }))).rejects.toThrow();
  expect(rpc.execute).not.toHaveBeenCalled();
});

it("encodes refunds with the committed SlotKey and wallet array", async () => {
  await Effect.runPromise(markSlotRefundable(credentials, key, ["0xa", "0xb"]));
  expect(rpc.execute.mock.calls[0]![0].calldata.map(BigInt)).toEqual(
    ledgerCall("mark_refundable", { key: { shard: key.chainId, slot_id: key.slotId }, wallets: ["0xa", "0xb"] }).map(
      BigInt,
    ),
  );
});
