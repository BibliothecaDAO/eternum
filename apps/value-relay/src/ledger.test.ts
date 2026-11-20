import { response } from "../../../packages/value-ledger/test-support/abi";
import { ledgerAbi, ledgerCall, ledgerEvent } from "../../../packages/value-ledger/test-support/ledger-abi";
import { Effect } from "effect";
import { hash } from "starknet";
import { beforeEach, expect, it, vi } from "vitest";
import { ledgerChestChanges, ledgerMonitorReads } from "./ledger";
import { runMonitor, type MonitorProgress } from "./monitor";

const rpc = vi.hoisted(() => ({
  call: vi.fn(),
  events: vi.fn(),
  head: vi.fn(),
  block: vi.fn(),
  classAt: vi.fn(),
}));
vi.mock("starknet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("starknet")>()),
  RpcProvider: vi.fn(function () {
    return {
      callContract: rpc.call,
      getEvents: rpc.events,
      getBlockNumber: rpc.head,
      getBlock: rpc.block,
      getClassHashAt: rpc.classAt,
    };
  }),
}));
/** The ledger under test first exists at block 500, as its address book says. */
const ledger = { contractAddress: "0x10", deploymentBlock: 500 };
const existsFrom = (first: number) =>
  rpc.classAt.mockImplementation(async (_address: string, block: number) => {
    if (block < first) throw Object.assign(new Error("Contract not found"), { code: 20 });
    return "0xc1a55";
  });
const credentials = {
  rpcUrl: "https://ledger.test",
  contractAddress: "0x10",
  accountAddress: "0x20",
  privateKey: "unused-test-key",
};
beforeEach(() => {
  vi.clearAllMocks();
  rpc.head.mockResolvedValue(1000);
  rpc.block.mockImplementation(async (number) => ({
    status: "ACCEPTED_ON_L2",
    block_number: number === "latest" ? 1000 : number,
    block_hash: "0xa",
    timestamp: 1000,
  }));
  existsFrom(500);
});

it("decodes confirmed payments and pins the event head across pagination", async () => {
  rpc.events
    .mockResolvedValueOnce({
      events: [
        {
          from_address: "0x10",
          transaction_hash: "0xdef",
          block_number: 100,
          block_hash: "0xa",
          ...ledgerEvent("WithdrawalPaid", {
            prize_rank: 0,
            prize_count: 0,
            shard: 1,
            claim_id: "0xabc",
            season_id: 7,
            wallet: "0x123",
            amount: { low: 5, high: 1 },
          }),
        },
      ],
      continuation_token: "next",
    })
    .mockResolvedValueOnce({ events: [], continuation_token: undefined });
  const reads = ledgerMonitorReads("https://ledger.test", ledger);
  const page = await Effect.runPromise(reads.paidClaims(null));
  expect(page.rows).toEqual([
    {
      prizeRank: 0,
      prizeCount: 0,
      chainId: "0x1",
      transactionHash: "0xabc",
      seasonId: 7,
      wallet: "0x123",
      paymentTransactionHash: "0xdef",
      paidAt: 1000,
      amount: String(2n ** 128n + 5n),
    },
  ]);
  rpc.head.mockResolvedValue(2000);
  await Effect.runPromise(reads.paidClaims(page.next));
  expect(rpc.events.mock.calls[1]![0]).toMatchObject({ to_block: { block_number: 1000 }, continuation_token: "next" });
});
it("refuses malformed payment events", async () => {
  const reads = ledgerMonitorReads("https://ledger.test", ledger);
  expect(rpc.call).not.toHaveBeenCalled();
  rpc.events.mockResolvedValueOnce({
    events: [
      {
        from_address: "0x10",
        transaction_hash: "0xdef",
        keys: [hash.getSelectorFromName("WithdrawalPaid"), "0x1", "0xabc"],
        data: ["7", "0x123", String(2n ** 128n), "0", "0", "0"],
      },
    ],
  });
  await expect(Effect.runPromise(reads.paidClaims(null))).rejects.toThrow();
});

it("reads the funded deposit through the committed ledger ABI at a confirmed head", async () => {
  const pool = 123n * 10n ** 18n;
  rpc.call.mockResolvedValue(
    response(ledgerAbi, "get_frontier", {
      prize_pool: { low: 0, high: 0 },
      prize_paid: { low: 0, high: 0 },
      funded: true,
      start: 10,
      end: 110,
      pool: { low: pool, high: 0 },
      paid: { low: 0, high: 0 },
      closed: false,
      preset_id: 2,
      seed: 153,
    }),
  );
  expect(await Effect.runPromise(ledgerMonitorReads(credentials.rpcUrl, ledger).frontierPool("0x1", 7))).toBe(
    String(pool),
  );
  expect(rpc.call).toHaveBeenCalledWith(
    { contractAddress: "0x10", entrypoint: "get_frontier", calldata: ["0x1", "7"] },
    1000,
  );
  rpc.call.mockRejectedValue(new Error("Ledger: unknown Frontier season"));
  await expect(
    Effect.runPromise(ledgerMonitorReads(credentials.rpcUrl, ledger).frontierPool("0x1", 7)),
  ).rejects.toMatchObject({ operation: "read ledger Frontier pool" });
});

it("rediscovers a chest request inserted behind the cursor by an L2 rewrite", async () => {
  const request = {
    from_address: "0x10",
    transaction_hash: "0x123",
    block_number: 1000,
    block_hash: "0xa",
    keys: [hash.getSelectorFromName("ChestRequested"), "7", "0", "0x123"],
    data: ["1000"],
  };
  rpc.events.mockImplementation(async ({ from_block }) => ({
    events: from_block.block_number <= 1000 ? [request] : [],
  }));
  const page = await Effect.runPromise(
    ledgerChestChanges("https://ledger.test", ledger, 1001, null, { number: 1000, hash: "0xdead" }),
  );
  expect(page.rows).toEqual([{ kind: "requested", request: { tokenId: "7", requester: "0x123", requestBlock: 1000 } }]);
  expect(page.rewind).toBe(true);
});

it("fails the read, without a rewind, when the RPC answers a head below the anchor", async () => {
  rpc.events.mockResolvedValue({ events: [] });
  await expect(
    Effect.runPromise(ledgerChestChanges("https://ledger.test", ledger, 1002, null, { number: 1001, hash: "0xa" })),
  ).rejects.toMatchObject({ operation: "ledger_head_behind_anchor" });
  expect(rpc.events).not.toHaveBeenCalled();
  const caughtUp = await Effect.runPromise(
    ledgerChestChanges("https://ledger.test", ledger, 1000, null, { number: 1000, hash: "0xa" }),
  );
  expect(caughtUp).toMatchObject({ rewind: false, head: 1000 });
});

it("refuses a ledger event page whose head changes while it is read", async () => {
  rpc.events.mockImplementation(async () => {
    rpc.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 1000, block_hash: "0xb", timestamp: 1000 });
    return { events: [] };
  });
  await expect(Effect.runPromise(ledgerChestChanges("https://ledger.test", ledger, undefined, null))).rejects.toThrow();
});

it("restarts pagination on a replaced checkpoint and anchors an old cursor by replaying it once", async () => {
  const reads = ledgerMonitorReads("https://ledger.test", ledger);
  rpc.events.mockResolvedValue({ events: [], continuation_token: "next" });
  const first = await Effect.runPromise(reads.paidClaims(null));
  rpc.block.mockImplementation(async (number) => ({
    status: "ACCEPTED_ON_L2",
    block_number: number === "latest" ? 1001 : number,
    block_hash: "0xb",
    timestamp: 1001,
  }));
  const replay = await Effect.runPromise(reads.paidClaims(first.next, first.fromBlock, first.anchor));
  expect(replay).toMatchObject({ rewind: true, head: 1001, anchor: { number: 1001, hash: "0xb" } });
  expect(rpc.events.mock.calls[1]![0]).not.toHaveProperty("continuation_token");
  expect(rpc.events.mock.calls[1]![0].from_block).toEqual({ block_number: 500 });
  const legacy = await Effect.runPromise(reads.paidClaims(JSON.stringify({ head: 999, token: "old" }), 900));
  expect(legacy.rewind).toBe(true);
  rpc.events.mockResolvedValue({ events: [] });
  const resumed = await Effect.runPromise(reads.paidClaims(legacy.next, legacy.fromBlock, legacy.anchor));
  expect(resumed.rewind).toBe(false);
  expect(rpc.events.mock.calls.at(-1)![0].continuation_token).toBe("next");
});

it("starts a fresh scan of the ledger's history at its deployment block, never block 0", async () => {
  rpc.events.mockResolvedValue({ events: [] });
  const reads = ledgerMonitorReads("https://ledger.test", ledger);
  const claims = await Effect.runPromise(reads.paidClaims(null));
  const chests = await Effect.runPromise(ledgerChestChanges("https://ledger.test", ledger, undefined, null));
  expect(rpc.events.mock.calls.map(([query]) => query.from_block)).toEqual([
    { block_number: 500 },
    { block_number: 500 },
  ]);
  expect([claims.fromBlock, chests.fromBlock]).toEqual([500, 500]);
});

it.each([
  ["after the ledger's first block, which would skip its earliest events", 499],
  ["before the ledger existed", 501],
])("refuses an address-book deployment block %s", async (_case, first) => {
  existsFrom(first);
  rpc.events.mockResolvedValue({ events: [] });
  await expect(
    Effect.runPromise(ledgerMonitorReads("https://ledger.test", ledger).paidClaims(null)),
  ).rejects.toMatchObject({ operation: "ledger_deployment_block_wrong" });
  expect(rpc.events).not.toHaveBeenCalled();
});

it("continues an anchored scan from its saved block, even one saved below the deployment block", async () => {
  rpc.events.mockResolvedValue({ events: [] });
  const page = await Effect.runPromise(
    ledgerMonitorReads("https://ledger.test", ledger).paidClaims(null, 100, { number: 1000, hash: "0xa" }),
  );
  expect(page).toMatchObject({ rewind: false, fromBlock: 100 });
  expect(rpc.events.mock.calls[0]![0].from_block).toEqual({ block_number: 100 });
  expect(rpc.classAt).not.toHaveBeenCalled();
});

it("enumerates confirmed withdrawal reports before payments using the compiled report event", async () => {
  const event = ledgerEvent("WithdrawalReported", {
    wallet: "0x0",
    shard: "0x1",
    claim_id: "0xabc",
    season_id: 7,
    amount: { low: 100, high: 0 },
    prize_rank: 0,
    prize_count: 0,
  });
  rpc.events.mockResolvedValue({
    events: [{ ...event, from_address: "0x10", transaction_hash: "0xdef", block_number: 900, block_hash: "0xa" }],
    continuation_token: "",
  });
  const page = await Effect.runPromise(ledgerMonitorReads(credentials.rpcUrl, ledger).reportedClaims(null));
  expect(page.rows).toEqual([
    {
      wallet: event.data[1],
      reportTransactionHash: "0xdef",
      chainId: event.keys[1],
      transactionHash: event.keys[2],
      seasonId: 7,
      amount: "100",
      prizeRank: 0,
      prizeCount: 0,
    },
  ]);
  expect(rpc.events).toHaveBeenCalledWith(
    expect.objectContaining({
      keys: [[hash.getSelectorFromName("WithdrawalReported")]],
      from_block: { block_number: 500 },
      to_block: { block_number: 1000 },
    }),
  );
});
it("pauses payouts on any result the ledger records, since no game family posts one", async () => {
  const event = ledgerEvent("ResultsApplied", {
    key: { shard: 1, game_id: 7 },
    slot_id: 12,
    season_id: 1,
    result_commitment: "0x5",
    pool: { low: 0, high: 0 },
  });
  rpc.events.mockImplementation(async ({ keys }: { keys: string[][] }) => ({
    events:
      keys[0]![0] === hash.getSelectorFromName("ResultsApplied")
        ? [{ ...event, from_address: "0x10", transaction_hash: "0xdef", block_number: 900, block_hash: "0xa" }]
        : [],
    continuation_token: "",
  }));
  const pause = vi.fn(() => Effect.void);
  const reads = ledgerMonitorReads(credentials.rpcUrl, ledger);
  let saved: MonitorProgress = { halted: null };
  const progress = await Effect.runPromise(
    runMonitor(
      {
        identity: { matchesPayDecision: () => Effect.succeed(true) },
        shard: {
          withdrawalReceipt: () => Effect.succeed(null),
          withdrawal: () => Effect.succeed(null),
          conservation: () => Effect.succeed([]),
        },
        ledger: { ...reads, pause },
      },
      {
        load: async () => saved,
        save: async (next) => {
          saved = next;
        },
      },
    ),
  );
  expect(progress.halted).toBe("blitz_result_posted:7");
  expect(progress.fault?.row).toBe("postedResults:0x1:7");
  expect(pause).toHaveBeenCalledTimes(1);
});
