import { response } from "../../../packages/value-ledger/test-support/abi";
import { ledgerAbi, ledgerCall, ledgerEvent } from "../../../packages/value-ledger/test-support/ledger-abi";
import { Effect, Semaphore } from "effect";
import { finishChestNow } from "./chests";
import { beforeEach, expect, it, vi } from "vitest";
import { chestLedgerReads, finishChestOnLedger, type SubmittedFinish } from "./chest-ledger";
import { ledgerChestChanges } from "./ledger";
const rpc = vi.hoisted(() => ({
  call: vi.fn(),
  execute: vi.fn(),
  wait: vi.fn(),
  block: vi.fn(),
  events: vi.fn(),
  number: vi.fn(),
  classAt: vi.fn(),
  status: vi.fn(),
  nonce: vi.fn(),
  spent: vi.fn(),
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
      getTransactionStatus: rpc.status,
      getNonceForAddress: rpc.spent,
    };
  }),
  Account: vi.fn(function () {
    return { execute: rpc.execute, getNonce: rpc.nonce };
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
/** The relay's durable record of sent finishes, in memory. */
const sentFinishes = () => {
  const kept = new Map<string, SubmittedFinish>();
  return {
    kept,
    submitted: async (tokenId: string) => kept.get(tokenId),
    submit: async (tokenId: string, finish: SubmittedFinish) => void kept.set(tokenId, finish),
    settle: async (tokenId: string) => void kept.delete(tokenId),
  };
};
let finishes = sentFinishes();
/** The page's and the tick's finish, as the Worker composes it: the relay's record behind the ledger's signing permit. */
const finishPorts = () => {
  const permit = Semaphore.makeUnsafe(1);
  return {
    ...chestLedgerReads(connection),
    finish: (id: string) => permit.withPermit(finishChestOnLedger(connection, id, finishes)),
  };
};
beforeEach(() => {
  vi.clearAllMocks();
  finishes = sentFinishes();
  rpc.call.mockResolvedValue(chest());
  rpc.execute.mockResolvedValue({ transaction_hash: "0xabc" });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
  rpc.number.mockResolvedValue(111);
  rpc.block.mockResolvedValue({ block_number: 111, block_hash: "0xa", timestamp: 699, status: "ACCEPTED_ON_L2" });
  // The relay account signs its next send with nonce 5; none of it is spent in an accepted block yet.
  rpc.nonce.mockResolvedValue("0x5");
  rpc.spent.mockResolvedValue("0x5");
});
it("finishes the original token with no caller-supplied draw or recipient and makes retry harmless", async () => {
  await Effect.runPromise(finishChestOnLedger(connection, String(2n ** 128n + 7n), finishes));
  expect(rpc.execute).toHaveBeenCalledWith(
    {
      contractAddress: "0x10",
      entrypoint: "open_finish",
      calldata: ledgerCall("open_finish", { token_id: { low: 7, high: 1 } }),
    },
    { nonce: "0x5" },
  );
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
  await Effect.runPromise(finishChestOnLedger(connection, "7", finishes));
  expect(rpc.execute).toHaveBeenCalledOnce();
});
it("keeps reverted or malformed chest finishes unsuccessful", async () => {
  rpc.wait.mockResolvedValue({ isReverted: () => true });
  await expect(Effect.runPromise(finishChestOnLedger(connection, "7", finishes))).rejects.toThrow();
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
  await expect(Effect.runPromise(finishChestOnLedger(connection, "999", finishes))).rejects.toMatchObject({
    operation: "finish requested chest",
  });
  expect(rpc.execute).not.toHaveBeenCalled();
});

it("does not send a finish again while the one sent is in flight, after its receipt wait failed (review P2)", async () => {
  const ports = finishPorts();
  rpc.wait.mockRejectedValueOnce(new Error("receipt temporarily unavailable"));
  await expect(Effect.runPromise(finishChestNow(ports, "7"))).rejects.toThrow();
  expect(finishes.kept.get("7")?.hash).toBe("0xabc");
  // The hash was accepted but has not reached the latest accepted block: the page's next ask, and the tick's.
  rpc.status.mockResolvedValue({ finality_status: "RECEIVED" });
  expect(await Effect.runPromise(finishChestNow(ports, "7"))).toEqual({ status: "finishing" });
  expect(await Effect.runPromise(ports.finish("7"))).toBe("in_flight");
  expect(rpc.execute).toHaveBeenCalledOnce();
  // It lands: the chest reads finished, and the record is settled with nothing sent.
  rpc.call.mockResolvedValue(chest(true));
  expect(await Effect.runPromise(ports.finish("7"))).toBe("finished");
  expect(finishes.kept.size).toBe(0);
  expect(rpc.execute).toHaveBeenCalledOnce();
});

it("sends again only once the kept finish reverted, or its nonce is spent by another transaction", async () => {
  const ports = finishPorts();
  finishes.kept.set("7", { hash: "0xreverted", nonce: "0x4" });
  rpc.status.mockResolvedValue({ finality_status: "ACCEPTED_ON_L2", execution_status: "REVERTED" });
  expect(await Effect.runPromise(ports.finish("7"))).toBe("finished");
  expect(rpc.execute).toHaveBeenCalledOnce();

  // Unknown to the node, its nonce not spent: still in flight, however long ago it was sent.
  rpc.status.mockRejectedValue(new Error("RPC: starknet_getTransactionStatus: 29: Transaction hash not found"));
  finishes.kept.set("7", { hash: "0xunknown", nonce: "0x5" });
  expect(await Effect.runPromise(ports.finish("7"))).toBe("in_flight");
  expect(rpc.execute).toHaveBeenCalledOnce();
  // Its nonce spent in an accepted block by another transaction: it can never land.
  rpc.spent.mockResolvedValue("0x6");
  expect(await Effect.runPromise(ports.finish("7"))).toBe("finished");
  expect(rpc.execute).toHaveBeenCalledTimes(2);
});

it("keeps a finish the node knew in flight when a later read cannot find it (re-review 1)", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    const sent = Date.now();
    const ports = finishPorts();
    rpc.wait.mockRejectedValueOnce(new Error("receipt temporarily unavailable"));
    await expect(Effect.runPromise(ports.finish("7"))).rejects.toThrow();
    // +70 s: the node reports it received; +71 s: a lagging read cannot find it. No outcome either time.
    vi.setSystemTime(sent + 70_000);
    rpc.status.mockResolvedValueOnce({ finality_status: "RECEIVED" });
    expect(await Effect.runPromise(ports.finish("7"))).toBe("in_flight");
    vi.setSystemTime(sent + 71_000);
    rpc.status.mockRejectedValueOnce(new Error("RPC: starknet_getTransactionStatus: 29: Transaction hash not found"));
    expect(await Effect.runPromise(ports.finish("7"))).toBe("in_flight");
    expect(rpc.execute).toHaveBeenCalledOnce();
    expect(finishes.kept.get("7")?.hash).toBe("0xabc");
  } finally {
    vi.useRealTimers();
  }
});

it("meets the same kept finish under every spelling of the token (re-review 2)", async () => {
  const ports = finishPorts();
  rpc.wait.mockRejectedValueOnce(new Error("receipt temporarily unavailable"));
  await expect(Effect.runPromise(ports.finish("7"))).rejects.toThrow();
  rpc.status.mockResolvedValue({ finality_status: "RECEIVED" });
  expect(await Effect.runPromise(ports.finish("007"))).toBe("in_flight");
  expect(await Effect.runPromise(finishChestNow(ports, "0x7"))).toEqual({ status: "finishing" });
  expect(rpc.execute).toHaveBeenCalledOnce();
  expect([...finishes.kept.keys()]).toEqual(["7"]);
});

it("sends once for two page asks at the same moment", async () => {
  const ports = finishPorts();
  rpc.wait.mockImplementation(async () => {
    rpc.call.mockResolvedValue(chest(true));
    return { isReverted: () => false };
  });
  await Promise.all([Effect.runPromise(finishChestNow(ports, "7")), Effect.runPromise(finishChestNow(ports, "7"))]);
  expect(rpc.execute).toHaveBeenCalledOnce();
});
