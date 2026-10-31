import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { resetMonitorRow, runMonitor, type MonitorProgress } from "./monitor";
import { RelayFailure, type MonitorPorts } from "./ports";

const fixture = () => {
  let progress: MonitorProgress = { halted: null };
  const receipt = {
    prizeRank: 0,
    prizeCount: 0,
    chainId: "0x1",
    seasonId: 1,
    transactionHash: "0xabc",
    realmsId: "0x2",
    amount: "1",
    confirmedAt: 1,
  };
  const ports: MonitorPorts = {
    identity: { matchesPayDecision: () => Effect.succeed(true) },
    shard: {
      withdrawalReceipt: () => Effect.succeed(null),
      settlementEvidence: () => Effect.succeed(null),
      conservation: () => Effect.succeed([]),
      withdrawal: vi.fn(() => Effect.fail(new RelayFailure({ operation: "shard_unavailable" }))),
      result: () => Effect.succeed(null),
    },
    ledger: {
      approvePayment: () => Effect.void,
      approveSettlement: () => Effect.void,
      frontierPool: () => Effect.succeed(String(100n * 10n ** 18n)),
      reportedSettlements: () =>
        Effect.succeed({
          rows: [],
          next: null,
          head: 0,
          anchor: { number: 0, hash: "0x1" },
          rewind: false,
          fromBlock: 0,
        }),
      reportedClaims: () =>
        Effect.succeed({
          rows: [],
          next: null,
          head: 0,
          anchor: { number: 0, hash: "0x1" },
          rewind: false,
          fromBlock: 0,
        }),
      paidClaims: () =>
        Effect.succeed({
          rows: [{ ...receipt, paymentTransactionHash: "0xdef", paidAt: 1, wallet: "0x123" }],
          next: null,
          head: 1000,
          anchor: { number: 1000, hash: "0xa" },
          rewind: false,
          fromBlock: 1,
        }),
      postedResults: () =>
        Effect.succeed({
          rows: [],
          next: null,
          head: 1000,
          anchor: { number: 1000, hash: "0xa" },
          rewind: false,
          fromBlock: 1,
        }),
      pause: vi.fn(() => Effect.void),
    },
  };
  const store = {
    load: async () => progress,
    save: async (next: MonitorProgress) => {
      progress = next;
    },
  };
  return { ports, store, receipt, tick: () => Effect.runPromise(runMonitor(ports, store)) };
};
it("never stores a fault or pauses for repeated unavailable reads, and recovers on the next verified tick", async () => {
  const f = fixture();
  for (let tick = 0; tick < 5; tick++) {
    await expect(f.tick()).rejects.toMatchObject({ operation: "shard_unavailable" });
    expect(await f.store.load()).toMatchObject({
      halted: null,
      cursors: { postedResults: { fromBlock: 1001, page: null, anchor: { number: 1000, hash: "0xa" } } },
    });
  }
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
  f.ports.shard.withdrawal = () => Effect.succeed(f.receipt);
  await expect(f.tick()).resolves.toMatchObject({
    halted: null,
    cursors: { paidClaims: { fromBlock: 1001, page: null, anchor: { number: 1000, hash: "0xa" } } },
  });
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
});

it("waits for a funded carry to reach the shard and still pauses an overpublished pool", async () => {
  const f = fixture();
  f.ports.shard.withdrawal = () => Effect.succeed(f.receipt);
  let pool = "70";
  f.ports.shard.conservation = () =>
    Effect.succeed([{ chainId: "0x1", gameId: 1, confirmedBlock: 10, receipts: "0", netIssued: "0", pool }]);
  await expect(f.tick()).rejects.toMatchObject({ operation: "frontier_pool_publication_pending" });
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
  expect((await f.store.load()).halted).toBeNull();
  pool = "100";
  await expect(f.tick()).resolves.toMatchObject({ halted: null });
  pool = "101";
  await expect(f.tick()).resolves.toMatchObject({ halted: "frontier_pool_mismatch:0x1:1" });
  expect(f.ports.ledger.pause).toHaveBeenCalledOnce();
});

it("persists a stop and retries pause when a reported receipt cannot be verified", async () => {
  const f = fixture();
  f.ports.shard.withdrawalReceipt = () => Effect.fail(new RelayFailure({ operation: "receipt_unavailable" }));
  f.ports.ledger.reportedClaims = () =>
    Effect.succeed({
      rows: [{ ...f.receipt, wallet: "0x0", reportTransactionHash: "0xdef" }],
      next: null,
      head: 10,
      anchor: { number: 10, hash: "0xa" },
      rewind: false,
      fromBlock: 1,
    });
  await expect(f.tick()).resolves.toMatchObject({ halted: "reported_claim_unverifiable:0xabc" });
  await f.tick();
  expect(f.ports.ledger.pause).toHaveBeenCalledTimes(2);
  expect((await f.store.load()).fault?.stream).toBe("reportedClaims");
  expect((await f.store.load()).fault?.fact).toBeUndefined();
  await f.store.save(resetMonitorRow(await f.store.load(), "reportedClaims:0x1:0xabc"));
  const recheck = vi.fn(() => Effect.succeed({ ...f.receipt, account: "0x3" }));
  f.ports.shard.withdrawalReceipt = recheck;
  f.ports.shard.withdrawal = () => Effect.succeed(f.receipt);
  await expect(f.tick()).resolves.toMatchObject({ halted: null });
  expect(recheck).toHaveBeenCalledOnce();
});

it("pauses on an invalid report page instead of leaving reports hidden behind the cursor", async () => {
  const f = fixture();
  f.ports.ledger.reportedClaims = () =>
    Effect.succeed({
      rows: [{ ...f.receipt, wallet: "0x0", reportTransactionHash: "0xdef" }],
      next: null,
      head: 0,
      anchor: { number: 0, hash: "0xa" },
      rewind: false,
      fromBlock: 1,
    });
  await expect(f.tick()).resolves.toMatchObject({ halted: "reportedClaims_unverifiable" });
  expect(f.ports.ledger.pause).toHaveBeenCalledOnce();
  expect((await f.store.load()).fault).toEqual({ row: "reportedClaims:unavailable" });
});
