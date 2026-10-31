import { Effect } from "effect";
import { afterEach, expect, it, vi } from "vitest";
import { resetMonitorRow, runMonitor, type MonitorProgress } from "./monitor";
import { RelayFailure, type MonitorPorts } from "./ports";

afterEach(() => vi.restoreAllMocks());

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

const pendingReport = () => {
  const f = fixture();
  let now = 1000;
  vi.spyOn(Date, "now").mockImplementation(() => now * 1000);
  const receipt = { ...f.receipt, amount: "6000000000000000000000", account: "0x3" };
  const report = { ...receipt, wallet: "0x123", reportTransactionHash: "0xdef" };
  const page = { next: null, head: 10, anchor: { number: 10, hash: "0xa" }, rewind: false, fromBlock: 1 };
  const approve = vi.fn(() => Effect.void);
  f.ports.ledger.approvePayment = approve;
  f.ports.shard.withdrawal = () => Effect.succeed(receipt);
  f.ports.shard.withdrawalReceipt = () => Effect.fail(new RelayFailure({ operation: "receipt_unavailable" }));
  f.ports.ledger.reportedClaims = () => Effect.succeed({ ...page, rows: [report] });
  f.ports.ledger.paidClaims = () => Effect.succeed({ ...page, rows: [] });
  return {
    ...f,
    receipt,
    report,
    page,
    approve,
    at: (time: number) => {
      now = time;
    },
  };
};

it("warns on the first read failure, withholds approval, and recovers from a blip without pause or reset", async () => {
  const f = pendingReport();
  await expect(f.tick()).rejects.toMatchObject({ operation: "reported_claim_unverifiable:0xabc" });
  expect(await f.store.load()).toMatchObject({ halted: null, unverifiable: { reportedClaims: { since: 1000 } } });
  expect((await f.store.load()).fault).toBeUndefined();
  f.at(1599);
  await expect(f.tick()).rejects.toMatchObject({ operation: "reported_claim_unverifiable:0xabc" });
  expect(f.approve).not.toHaveBeenCalled();
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
  f.ports.shard.withdrawalReceipt = () => Effect.succeed(f.receipt);
  await expect(f.tick()).resolves.toMatchObject({ halted: null, unverifiable: {} });
  expect(f.approve).toHaveBeenCalledExactlyOnceWith(f.report);
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
  f.at(1600);
  f.ports.shard.withdrawalReceipt = () => Effect.fail(new RelayFailure({ operation: "new_blip" }));
  await expect(f.tick()).rejects.toBeInstanceOf(RelayFailure);
  expect((await f.store.load()).unverifiable?.reportedClaims?.since).toBe(1600);
});

it("persists the ten-minute window across ticks and healthy sibling streams, then retries pause until recovery", async () => {
  const f = pendingReport();
  await expect(f.tick()).rejects.toBeInstanceOf(RelayFailure);
  f.at(1599);
  await expect(f.tick()).rejects.toBeInstanceOf(RelayFailure);
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
  f.at(1600);
  await expect(f.tick()).resolves.toMatchObject({ halted: "report_unverifiable_timeout:reportedClaims" });
  await f.tick();
  expect(f.ports.ledger.pause).toHaveBeenCalledTimes(2);
  expect(f.approve).not.toHaveBeenCalled();
  expect((await f.store.load()).fault?.fact).toBeUndefined();
  await f.store.save(resetMonitorRow(await f.store.load(), "reportedClaims:0x1:0xabc"));
  f.ports.shard.withdrawalReceipt = () => Effect.succeed(f.receipt);
  await expect(f.tick()).resolves.toMatchObject({ halted: null, unverifiable: {} });
  expect(f.approve).toHaveBeenCalledExactlyOnceWith(f.report);
});

it("pauses a proven forgery immediately even behind an unreadable report in the same page", async () => {
  const f = pendingReport();
  f.ports.ledger.reportedClaims = () =>
    Effect.succeed({ ...f.page, rows: [f.report, { ...f.report, transactionHash: "0xbbb" }] });
  f.ports.shard.withdrawalReceipt = (_chain, hash) =>
    hash === "0xabc"
      ? Effect.fail(new RelayFailure({ operation: "receipt_unavailable" }))
      : Effect.succeed({ ...f.receipt, transactionHash: hash, amount: "1" });
  await expect(f.tick()).resolves.toMatchObject({ halted: "reported_claim_mismatch:0xbbb" });
  expect(f.ports.ledger.pause).toHaveBeenCalledOnce();
  expect(f.approve).not.toHaveBeenCalled();
});

it("treats approval submission failures as unavailable and never advances the waiting report", async () => {
  const f = pendingReport();
  f.ports.shard.withdrawalReceipt = () => Effect.succeed(f.receipt);
  f.ports.ledger.approvePayment = () => Effect.fail(new RelayFailure({ operation: "insufficient_strk" }));
  await expect(f.tick()).rejects.toMatchObject({ operation: "reportedClaims_unverifiable" });
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
  expect((await f.store.load()).cursors?.reportedClaims).toBeUndefined();
  f.at(1600);
  await expect(f.tick()).resolves.toMatchObject({ halted: "report_unverifiable_timeout:reportedClaims" });
});

it("retains a waiting report's window when its whole ledger page becomes unreadable", async () => {
  const f = pendingReport();
  await expect(f.tick()).rejects.toBeInstanceOf(RelayFailure);
  f.ports.ledger.reportedClaims = () => Effect.fail(new RelayFailure({ operation: "ledger_unavailable" }));
  f.at(1600);
  await expect(f.tick()).resolves.toMatchObject({ halted: "report_unverifiable_timeout:reportedClaims" });
  expect(f.ports.ledger.pause).toHaveBeenCalledOnce();
});

it("does not pause for unreadable history when no waiting report has been observed", async () => {
  const f = pendingReport();
  f.ports.ledger.reportedClaims = () => Effect.fail(new RelayFailure({ operation: "ledger_unavailable" }));
  for (const at of [1000, 1600, 2200]) {
    f.at(at);
    await expect(f.tick()).rejects.toMatchObject({ operation: "ledger_unavailable" });
  }
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
  expect((await f.store.load()).unverifiable?.reportedClaims).toBeUndefined();
});

it("retries an invalid page with waiting reports and pauses only after sustained failure", async () => {
  const f = pendingReport();
  f.ports.ledger.reportedClaims = () => Effect.succeed({ ...f.page, head: 0, rows: [f.report] });
  await expect(f.tick()).rejects.toMatchObject({ operation: "invalid_ledger_audit_page" });
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
  f.at(1600);
  await expect(f.tick()).resolves.toMatchObject({ halted: "report_unverifiable_timeout:reportedClaims" });
  expect((await f.store.load()).fault?.row).toBe("reportedClaims:unavailable");
});

it("withholds early-settlement approval during a read outage and pauses after ten minutes", async () => {
  const f = pendingReport();
  f.ports.ledger.reportedClaims = () => Effect.succeed({ ...f.page, rows: [] });
  f.ports.ledger.reportedSettlements = () =>
    Effect.succeed({ ...f.page, rows: [{ chainId: "0x1", gameId: 1, chestWithdrawn: "0", prizeWithdrawn: "0" }] });
  const approve = vi.fn(() => Effect.void);
  f.ports.ledger.approveSettlement = approve;
  f.ports.shard.settlementEvidence = () => Effect.fail(new RelayFailure({ operation: "herald_unavailable" }));
  await expect(f.tick()).rejects.toBeInstanceOf(RelayFailure);
  f.at(1599);
  await expect(f.tick()).rejects.toBeInstanceOf(RelayFailure);
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
  f.at(1600);
  await expect(f.tick()).resolves.toMatchObject({ halted: "report_unverifiable_timeout:reportedSettlements" });
  expect(approve).not.toHaveBeenCalled();
});
