import { response } from "../../../packages/value-ledger/test-support/abi";
import { ledgerAbi, ledgerCall, ledgerEvent } from "../../../packages/value-ledger/test-support/ledger-abi";
import { Effect } from "effect";
import { finishChestNow } from "./chests";
import { beforeEach, expect, it, vi } from "vitest";
import { chestLedgerReads, finishChestOnLedger } from "./chest-ledger";
import { ledgerChestChanges } from "./ledger";
const rpc = vi.hoisted(() => ({
  call: vi.fn(),
  execute: vi.fn(),
  wait: vi.fn(),
  block: vi.fn(),
  events: vi.fn(),
  number: vi.fn(),
  classAt: vi.fn(),
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
      getClassHashAt: rpc.classAt,
    };
  }),
  Account: vi.fn(function () {
    return { execute: rpc.execute };
  }),
}));
const connection = {
  rpcUrl: "https://ledger.test",
  contractAddress: "0x10",
  // The ledger first exists at block 50, as its address book says.
  deploymentBlock: 50,
  accountAddress: "0x20",
  privateKey: "unused-test-key",
};
const chest = (finished = false) =>
  response(ledgerAbi, "get_chest", {
    exists: true,
    season_id: 1,
    band: 2,
    requested: true,
    finished,
    requester: "0x123",
    request_block: 100,
  });
beforeEach(() => {
  vi.clearAllMocks();
  rpc.call.mockResolvedValue(chest());
  rpc.execute.mockResolvedValue({ transaction_hash: "0xabc" });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
  rpc.number.mockResolvedValue(111);
  rpc.block.mockResolvedValue({ block_number: 111, block_hash: "0xa", timestamp: 699, status: "ACCEPTED_ON_L2" });
});
it("finishes the original token with no caller-supplied draw or recipient and makes retry harmless", async () => {
  await Effect.runPromise(finishChestOnLedger(connection, String(2n ** 128n + 7n)));
  expect(rpc.execute).toHaveBeenCalledWith({
    contractAddress: "0x10",
    entrypoint: "open_finish",
    calldata: ledgerCall("open_finish", { token_id: { low: 7, high: 1 } }),
  });
  expect(rpc.wait).toHaveBeenCalledWith("0xabc");
  expect(rpc.call).toHaveBeenCalledExactlyOnceWith(
    {
      contractAddress: "0x10",
      entrypoint: "get_chest",
      calldata: ledgerCall("get_chest", { token_id: { low: 7, high: 1 } }),
    },
    "latest",
  );
  rpc.call.mockResolvedValue(chest(true));
  await Effect.runPromise(finishChestOnLedger(connection, "7"));
  expect(rpc.execute).toHaveBeenCalledOnce();
});
it("keeps reverted or malformed chest finishes unsuccessful", async () => {
  rpc.wait.mockResolvedValue({ isReverted: () => true });
  await expect(Effect.runPromise(finishChestOnLedger(connection, "7"))).rejects.toThrow();
  rpc.call.mockResolvedValue(["1"]);
  await expect(Effect.runPromise(chestLedgerReads(connection).chest("7"))).rejects.toThrow();
});
it.each([
  { kind: 3, cosmetic: 0, lords: { low: 4n * 100n * 10n ** 18n, high: 0 } },
  { kind: 1, cosmetic: 0, lords: { low: 0n, high: 0 } },
])("completes the chest queue for either the settled shares or the non-token fallback: $kind", async (content) => {
  rpc.events.mockResolvedValue({
    events: [
      {
        from_address: "0x10",
        ...ledgerEvent("ChestRequested", { token_id: { low: 7, high: 0 }, wallet: "0x123", request_block: 100 }),
      },
      {
        from_address: "0x10",
        ...ledgerEvent("ChestOpened", {
          token_id: { low: 7, high: 0 },
          wallet: "0x123",
          content,
        }),
      },
    ],
  });
  rpc.classAt.mockImplementation(async (_address: string, block: number) => {
    if (block < 50) throw Object.assign(new Error("Contract not found"), { code: 20 });
    return "0xc1a55";
  });
  // A saved block without its anchor cannot continue: the scan restarts at the ledger's deployment block.
  const page = await Effect.runPromise(ledgerChestChanges(connection.rpcUrl, connection, 90, null));
  expect(page.rows).toEqual([
    { kind: "requested", request: { tokenId: "7", requester: "0x123", requestBlock: 100 } },
    { kind: "finished", tokenId: "7" },
  ]);
  expect(rpc.events.mock.calls[0]![0]).toMatchObject({
    from_block: { block_number: 50 },
    to_block: { block_number: 111 },
  });
});

it("fails a missing chest read and never submits its finish", async () => {
  rpc.call.mockRejectedValue(new Error("Ledger: unknown chest"));
  await expect(Effect.runPromise(chestLedgerReads(connection).chest("999"))).rejects.toMatchObject({
    operation: "read requested chest",
  });
  await expect(Effect.runPromise(finishChestOnLedger(connection, "999"))).rejects.toMatchObject({
    operation: "finish requested chest",
  });
  expect(rpc.execute).not.toHaveBeenCalled();
});

/** The page's ask and the tick's, as the Worker composes them: the ledger's reads and this finish. */
const finishPorts = () => ({
  ...chestLedgerReads(connection),
  finish: (id: string) => finishChestOnLedger(connection, id),
});

it("shows a duplicate finish's 'already finished' revert as the chest finished, with no error or retry", async () => {
  // The tick's finish landed first; the page's, read before it, lands second and the ledger refuses it.
  rpc.call.mockResolvedValueOnce(chest(false)).mockResolvedValueOnce(chest(false)).mockResolvedValue(chest(true));
  rpc.wait.mockResolvedValue({
    isReverted: () => true,
    revert_reason: "Execution failed. Failure reason: ('Ledger: chest already finished').",
  });
  expect(await Effect.runPromise(finishChestNow(finishPorts(), "7"))).toEqual({ status: "finished" });
  expect(rpc.execute).toHaveBeenCalledOnce();
});

it("takes the ledger refusing a duplicate at its fee estimate as the chest finished", async () => {
  rpc.call.mockResolvedValueOnce(chest(false)).mockResolvedValueOnce(chest(false)).mockResolvedValue(chest(true));
  rpc.execute.mockRejectedValue(new Error("RPC: starknet_estimateFee: Ledger: chest already finished"));
  expect(await Effect.runPromise(finishChestNow(finishPorts(), "7"))).toEqual({ status: "finished" });
});
