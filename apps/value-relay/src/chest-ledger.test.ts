import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { chestLedgerReads, finishChestOnLedger } from "./chest-ledger";
import { ledgerChestChanges } from "./ledger";
import { hash } from "starknet";
const rpc = vi.hoisted(() => ({
  call: vi.fn(),
  execute: vi.fn(),
  wait: vi.fn(),
  block: vi.fn(),
  events: vi.fn(),
  number: vi.fn(),
}));
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  RpcProvider: vi.fn(function () {
    return {
      callContract: rpc.call,
      waitForTransaction: rpc.wait,
      getBlock: rpc.block,
      getEvents: rpc.events,
      getBlockNumber: rpc.number,
    };
  }),
  Account: vi.fn(function () {
    return { execute: rpc.execute };
  }),
}));
const connection = {
  rpcUrl: "https://ledger.test",
  contractAddress: "0x10",
  accountAddress: "0x20",
  privateKey: "unused-test-key",
};
beforeEach(() => {
  vi.clearAllMocks();
  rpc.call.mockResolvedValue(["1", "1", "2", "1", "0", "0x123", "100"]);
  rpc.execute.mockResolvedValue({ transaction_hash: "0xabc" });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
  rpc.number.mockResolvedValue(111);
});
it("finishes the original token with no caller-supplied draw or recipient and makes retry harmless", async () => {
  await Effect.runPromise(finishChestOnLedger(connection, String(2n ** 128n + 7n)));
  expect(rpc.execute).toHaveBeenCalledWith({
    contractAddress: "0x10",
    entrypoint: "open_finish",
    calldata: ["7", "1"],
  });
  expect(rpc.wait).toHaveBeenCalledWith("0xabc");
  rpc.call.mockResolvedValue(["1", "1", "2", "1", "1", "0x123", "100"]);
  await Effect.runPromise(finishChestOnLedger(connection, "7"));
  expect(rpc.execute).toHaveBeenCalledOnce();
});
it("keeps reverted or malformed chest finishes unsuccessful", async () => {
  rpc.wait.mockResolvedValue({ isReverted: () => true });
  await expect(Effect.runPromise(finishChestOnLedger(connection, "7"))).rejects.toThrow();
  rpc.call.mockResolvedValue(["1"]);
  await expect(Effect.runPromise(chestLedgerReads(connection).chest("7"))).rejects.toThrow();
});
it("decodes both lifecycle events from the durable completed-block boundary", async () => {
  rpc.events.mockResolvedValue({
    events: [
      { from_address: "0x10", keys: [hash.getSelectorFromName("ChestRequested"), "7", "0", "0x123"], data: ["100"] },
      {
        from_address: "0x10",
        keys: [hash.getSelectorFromName("ChestOpened"), "7", "0", "0x123"],
        data: ["1", "0", "0", "0"],
      },
    ],
  });
  const page = await Effect.runPromise(ledgerChestChanges(connection.rpcUrl, connection.contractAddress, 90, null));
  expect(page.rows).toEqual([
    { kind: "requested", request: { tokenId: "7", requester: "0x123", requestBlock: 100 } },
    { kind: "finished", tokenId: "7" },
  ]);
  expect(rpc.events.mock.calls[0]![0]).toMatchObject({
    from_block: { block_number: 90 },
    to_block: { block_number: 111 },
  });
});

it("reads the eligibility time from exactly the requested confirmed block", async () => {
  rpc.block.mockResolvedValue({ block_number: 111, timestamp: 699 });
  expect(await Effect.runPromise(chestLedgerReads(connection).blockTime(111))).toBe(699);
  rpc.block.mockResolvedValue({ block_number: 112, timestamp: 699 });
  await expect(Effect.runPromise(chestLedgerReads(connection).blockTime(111))).rejects.toThrow();
});
