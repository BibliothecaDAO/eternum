import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { resetMonitorRow, runMonitor, type MonitorProgress } from "./monitor";
import type { MonitorPorts } from "./ports";

it("keeps checked-through block and page continuation across ticks without rereading old claims", async () => {
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
  const withdrawal = vi.fn(() => Effect.succeed(receipt));
  // The reader starts a fresh scan at the ledger's deployment block, 5 here, and reports it.
  const paidClaims = vi.fn((cursor: string | null, fromBlock?: number) =>
    Effect.succeed(
      cursor === null && fromBlock === undefined
        ? {
            rows: [{ ...receipt, paymentTransactionHash: "0xdef", paidAt: 1, wallet: "0x123" }],
            next: "pinned-page2",
            head: 10,
            anchor: { number: 10, hash: "0xa" },
            rewind: false,
            fromBlock: 5,
          }
        : { rows: [], next: null, head: 10, anchor: { number: 10, hash: "0xa" }, rewind: false, fromBlock: fromBlock! },
    ),
  );
  const ports: MonitorPorts = {
    identity: { matchesPayDecision: () => Effect.succeed(true) },
    shard: {
      withdrawalReceipt: () => Effect.succeed(null),
      settlementEvidence: () => Effect.succeed(null),
      conservation: () => Effect.succeed([]),
      withdrawal,
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
      paidClaims,
      postedResults: () =>
        Effect.succeed({
          rows: [],
          next: null,
          head: 10,
          anchor: { number: 10, hash: "0xa" },
          rewind: false,
          fromBlock: 1,
        }),
      pause: () => Effect.void,
    },
  };
  const store = {
    load: async () => progress,
    save: async (next: MonitorProgress) => {
      progress = next;
    },
  };
  await Effect.runPromise(runMonitor(ports, store));
  expect(paidClaims).toHaveBeenCalledTimes(1);
  expect(paidClaims.mock.calls[0]![1]).toBeUndefined();
  expect(progress.cursors?.paidClaims).toMatchObject({ fromBlock: 5, page: "pinned-page2" });
  await Effect.runPromise(runMonitor(ports, store));
  expect(paidClaims.mock.calls[1]!.slice(0, 2)).toEqual(["pinned-page2", 5]);
  expect(withdrawal).toHaveBeenCalledOnce();
  await Effect.runPromise(runMonitor(ports, store));
  expect(paidClaims.mock.calls[2]).toEqual([null, 11, { number: 10, hash: "0xa" }]);
});

it("an exact row reset skips only that claim, still faults on the next unchecked claim, and survives a rewind", async () => {
  let progress: MonitorProgress = { halted: null };
  const rows = ["0xabc", "0xdef"].map((transactionHash) => ({
    prizeRank: 0,
    prizeCount: 0,
    chainId: "0x1",
    seasonId: 1,
    transactionHash,
    wallet: "0x123",
    amount: "1",
    paymentTransactionHash: "0xdef",
    paidAt: 1,
  }));
  const checked = vi.fn((chainId: string, transactionHash: string) =>
    Effect.succeed({
      ...rows.find((row) => row.transactionHash === transactionHash)!,
      chainId,
      realmsId: "0x2",
      confirmedAt: 1,
    }),
  );
  const ports: MonitorPorts = {
    identity: { matchesPayDecision: () => Effect.succeed(false) },
    shard: {
      withdrawalReceipt: () => Effect.succeed(null),
      settlementEvidence: () => Effect.succeed(null),
      conservation: () => Effect.succeed([]),
      withdrawal: checked,
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
          rows,
          head: 10,
          anchor: { number: 10, hash: "0xa" },
          rewind: false,
          fromBlock: 1,
          next: null,
        }),
      postedResults: () =>
        Effect.succeed({
          rows: [],
          head: 10,
          anchor: { number: 10, hash: "0xa" },
          rewind: false,
          fromBlock: 1,
          next: null,
        }),
      pause: () => Effect.void,
    },
  };
  const store = {
    load: async () => progress,
    save: async (p: MonitorProgress) => {
      progress = p;
    },
  };
  await Effect.runPromise(runMonitor(ports, store));
  expect(() => resetMonitorRow(progress, "paidClaims:0x1:wrong")).toThrow("fault_row_mismatch");
  progress = resetMonitorRow(progress, "paidClaims:0x1:0xabc");
  await Effect.runPromise(runMonitor(ports, store));
  expect(progress.fault?.row).toBe("paidClaims:0x1:0xdef");
  expect(checked.mock.calls.map((call) => call[1])).toEqual(["0xabc", "0xdef"]);
  progress = resetMonitorRow(progress, "paidClaims:0x1:0xdef");
  ports.ledger.paidClaims = () =>
    Effect.succeed({ rows, head: 10, next: null, anchor: { number: 10, hash: "0xb" }, rewind: true, fromBlock: 1 });
  const pause = vi.fn(() => Effect.void);
  ports.ledger.pause = pause;
  await Effect.runPromise(runMonitor(ports, store));
  // The rewind rereads the stream from row 0 and observes both rows again; each still shows what the operator cleared,
  // so neither faults again.
  expect(progress).toMatchObject({ halted: null, fault: null });
  expect(pause).not.toHaveBeenCalled();
  expect(checked.mock.calls.map((call) => call[1])).toEqual(["0xabc", "0xdef", "0xabc", "0xdef"]);
});

it("keeps every cleared conservation row cleared, not only the last one", async () => {
  let progress: MonitorProgress = { halted: null };
  const games = [
    { chainId: "0x1", gameId: 1, confirmedBlock: 5, receipts: "2", netIssued: "1", pool: "0" },
    { chainId: "0x1", gameId: 2, confirmedBlock: 5, receipts: "3", netIssued: "1", pool: "0" },
  ];
  const pause = vi.fn(() => Effect.void);
  const page = { rows: [], head: 10, anchor: { number: 10, hash: "0xa" }, rewind: false, fromBlock: 1, next: null };
  const ports: MonitorPorts = {
    identity: { matchesPayDecision: () => Effect.succeed(true) },
    shard: {
      withdrawalReceipt: () => Effect.succeed(null),
      settlementEvidence: () => Effect.succeed(null),
      conservation: () => Effect.succeed(games),
      withdrawal: () => Effect.succeed(null),
      result: () => Effect.succeed(null),
    },
    ledger: {
      approvePayment: () => Effect.void,
      approveSettlement: () => Effect.void,
      frontierPool: () => Effect.succeed("0"),
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
      paidClaims: () => Effect.succeed(page),
      postedResults: () => Effect.succeed(page),
      pause,
    },
  };
  const store = {
    load: async () => progress,
    save: async (p: MonitorProgress) => {
      progress = p;
    },
  };
  await Effect.runPromise(runMonitor(ports, store));
  expect(progress.fault?.row).toBe("conservation:0x1:1:5:2:1");
  progress = resetMonitorRow(progress, "conservation:0x1:1:5:2:1");
  await Effect.runPromise(runMonitor(ports, store));
  expect(progress.fault?.row).toBe("conservation:0x1:2:5:3:1");
  progress = resetMonitorRow(progress, "conservation:0x1:2:5:3:1");
  pause.mockClear();
  await Effect.runPromise(runMonitor(ports, store));
  expect(progress).toMatchObject({ halted: null, fault: null });
  expect(pause).not.toHaveBeenCalled();
});

describe.each(["paidClaims", "postedResults"] as const)("a cleared %s fault", (stream) => {
  /** Progress kept only as JSON, read through a fresh store each tick, as the Durable Object keeps it. */
  const persistedStore = () => {
    let persisted = JSON.stringify({ halted: null });
    const store = () => ({
      load: async (): Promise<MonitorProgress> => JSON.parse(persisted),
      save: async (next: MonitorProgress) => {
        persisted = JSON.stringify(next);
      },
    });
    return store;
  };
  const scenario = () => {
    const ledger = {
      paid: [
        {
          prizeRank: 0,
          prizeCount: 0,
          chainId: "0x1",
          transactionHash: "0xabc",
          seasonId: 1,
          wallet: "0x123",
          amount: "1",
          paymentTransactionHash: "0xdef",
          paidAt: 1,
        },
      ],
      posted: [{ chainId: "0x1", gameId: 1, commitment: "0x2" }],
      rewind: false,
      anchor: "0xa",
    };
    const store = persistedStore();
    const haltedAtPause: (string | null)[] = [];
    const pause = vi.fn(() =>
      Effect.promise(async () => {
        haltedAtPause.push((await store().load()).halted);
      }),
    );
    const page = <A>(rows: A[]) =>
      Effect.succeed({
        rows,
        head: 10,
        anchor: { number: 10, hash: ledger.anchor },
        rewind: ledger.rewind,
        fromBlock: 1,
        next: null,
      });
    const ports: MonitorPorts = {
      // Every check fails: the shard and identity never agree with the ledger.
      identity: { matchesPayDecision: () => Effect.succeed(false) },
      shard: {
        withdrawalReceipt: () => Effect.succeed(null),
        settlementEvidence: () => Effect.succeed(null),
        conservation: () => Effect.succeed([]),
        withdrawal: (chainId, transactionHash) =>
          Effect.succeed({
            prizeRank: 0,
            prizeCount: 0,
            chainId,
            transactionHash,
            seasonId: 1,
            amount: "1",
            realmsId: "0x2",
            confirmedAt: 1,
          }),
        result: (chainId, gameId) => Effect.succeed({ chainId, gameId, commitment: "0x1", rows: [] }),
      },
      ledger: {
        approvePayment: () => Effect.void,
        approveSettlement: () => Effect.void,
        frontierPool: () => Effect.succeed("0"),
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
        paidClaims: () => page(stream === "paidClaims" ? ledger.paid : []),
        postedResults: () => page(stream === "postedResults" ? ledger.posted : []),
        pause,
      },
    };
    const tick = () => Effect.runPromise(runMonitor(ports, store()));
    /** The operator resets the recorded fault, then the ledger rewinds to a new anchor. */
    const resetAndRewind = async (anchor: string) => {
      const stopped = await store().load();
      await store().save(resetMonitorRow(stopped, stopped.fault!.row));
      ledger.rewind = true;
      ledger.anchor = anchor;
      pause.mockClear();
      haltedAtPause.length = 0;
    };
    return { ledger, store, pause, haltedAtPause, tick, resetAndRewind };
  };

  it("stays cleared when a rewind replays the same evidence at a new anchor", async () => {
    const run = scenario();
    await run.tick();
    expect(run.pause).toHaveBeenCalledOnce();
    await run.resetAndRewind("0xb");
    await run.tick();
    expect((await run.store().load()).halted).toBeNull();
    expect(run.pause).not.toHaveBeenCalled();
  });

  it("pauses again, halt persisted first, when the rewritten row says something else", async () => {
    const run = scenario();
    await run.tick();
    await run.resetAndRewind("0xb");
    if (stream === "paidClaims")
      run.ledger.paid = [{ ...run.ledger.paid[0]!, amount: "2", wallet: "0x999", paymentTransactionHash: "0x456" }];
    else run.ledger.posted = [{ ...run.ledger.posted[0]!, commitment: "0x3" }];
    await run.tick();
    expect(run.pause).toHaveBeenCalledOnce();
    expect(run.haltedAtPause).toEqual([expect.stringMatching(/mismatch/)]);
    expect((await run.store().load()).fault?.row).toBe(
      stream === "paidClaims" ? "paidClaims:0x1:0xabc" : "postedResults:0x1:1",
    );
  });

  it("still faults on a new row beside the cleared one", async () => {
    const run = scenario();
    await run.tick();
    await run.resetAndRewind("0xb");
    if (stream === "paidClaims")
      run.ledger.paid = [...run.ledger.paid, { ...run.ledger.paid[0]!, transactionHash: "0xbbb" }];
    else run.ledger.posted = [...run.ledger.posted, { ...run.ledger.posted[0]!, gameId: 2 }];
    await run.tick();
    expect(run.pause).toHaveBeenCalledOnce();
    expect((await run.store().load()).fault?.row).toBe(
      stream === "paidClaims" ? "paidClaims:0x1:0xbbb" : "postedResults:0x1:2",
    );
  });
});

it.each([null, "999"])(
  "pauses on an unpaid forged report before any payment exists (receipt amount %s)",
  async (amount) => {
    const report = {
      wallet: "0x0",
      reportTransactionHash: "0xdef",
      chainId: "0x1",
      seasonId: 7,
      transactionHash: "0xabc",
      amount: "100",
      prizeRank: 0,
      prizeCount: 0,
    };
    let progress: MonitorProgress = { halted: null };
    const page = { next: null, head: 10, anchor: { number: 10, hash: "0xa" }, rewind: false, fromBlock: 1 };
    const pause = vi.fn(() => Effect.void);
    const paidClaims = vi.fn(() => Effect.succeed({ ...page, rows: [] }));
    const ports: MonitorPorts = {
      identity: { matchesPayDecision: () => Effect.succeed(true) },
      shard: {
        withdrawalReceipt: () =>
          Effect.succeed(amount === null ? null : { ...report, amount, account: "0x3", confirmedAt: 100 }),
        settlementEvidence: () => Effect.succeed(null),
        conservation: () => Effect.succeed([]),
        result: () => Effect.succeed(null),
        withdrawal: () =>
          Effect.succeed(amount === null ? null : { ...report, amount, realmsId: "0x2", confirmedAt: 100 }),
      },
      ledger: {
        approvePayment: () => Effect.void,
        approveSettlement: () => Effect.void,
        frontierPool: () => Effect.succeed("1000"),
        pause,
        paidClaims,
        reportedSettlements: () =>
          Effect.succeed({
            rows: [],
            next: null,
            head: 0,
            anchor: { number: 0, hash: "0x1" },
            rewind: false,
            fromBlock: 0,
          }),
        reportedClaims: () => Effect.succeed({ ...page, rows: [report] }),
        postedResults: () => Effect.succeed({ ...page, rows: [] }),
      },
    };
    const store = {
      load: async () => progress,
      save: async (next: MonitorProgress) => {
        progress = next;
      },
    };
    await Effect.runPromise(runMonitor(ports, store));
    expect(progress.halted).toBe("reported_claim_mismatch:0xabc");
    expect(progress.fault?.stream).toBe("reportedClaims");
    expect(pause).toHaveBeenCalledOnce();
    expect(paidClaims).not.toHaveBeenCalled();
    await Effect.runPromise(runMonitor(ports, store));
    expect(pause).toHaveBeenCalledTimes(2);
  },
);

it.each([false, true])(
  "checks the identity decision before paying a prepared recipient (authorized=%s)",
  async (authorized) => {
    let progress: MonitorProgress = { halted: null };
    const report = {
      chainId: "0x1",
      transactionHash: "0xabc",
      reportTransactionHash: "0xdef",
      wallet: "0x999",
      seasonId: 7,
      amount: "100",
      prizeRank: 0,
      prizeCount: 0,
    };
    const page = { next: null, head: 10, anchor: { number: 10, hash: "0xa" }, rewind: false, fromBlock: 1 };
    const pause = vi.fn(() => Effect.void);
    const approve = vi.fn(() => Effect.void);
    const decision = vi.fn(() => Effect.succeed(authorized));
    const ports: MonitorPorts = {
      identity: { matchesPayDecision: decision },
      shard: {
        withdrawalReceipt: () => Effect.succeed({ ...report, account: "0x3", confirmedAt: 1 }),
        settlementEvidence: () => Effect.succeed(null),
        conservation: () => Effect.succeed([]),
        result: () => Effect.succeed(null),
        withdrawal: () => Effect.succeed({ ...report, realmsId: "0x2", confirmedAt: 1 }),
      },
      ledger: {
        approvePayment: approve,
        approveSettlement: () => Effect.void,
        frontierPool: () => Effect.succeed("1000"),
        pause,
        reportedSettlements: () =>
          Effect.succeed({
            rows: [],
            next: null,
            head: 0,
            anchor: { number: 0, hash: "0x1" },
            rewind: false,
            fromBlock: 0,
          }),
        reportedClaims: () => Effect.succeed({ ...page, rows: [report] }),
        paidClaims: () => Effect.succeed({ ...page, rows: [] }),
        postedResults: () => Effect.succeed({ ...page, rows: [] }),
      },
    };
    await Effect.runPromise(
      runMonitor(ports, {
        load: async () => progress,
        save: async (next) => {
          progress = next;
        },
      }),
    );
    expect(approve).toHaveBeenCalledTimes(authorized ? 1 : 0);
    if (authorized) expect(approve).toHaveBeenCalledWith(report);
    expect(progress.halted).toBe(authorized ? null : "reported_wallet_mismatch:0xabc");
    expect(pause).toHaveBeenCalledTimes(authorized ? 0 : 1);
    expect(decision).toHaveBeenCalledWith({
      chainId: "0x1",
      claimId: "0xabc",
      transactionHash: "0xdef",
      realmsId: "0x2",
      wallet: "0x999",
      seasonId: 7,
      amount: "100",
    });
    if (!authorized) {
      progress = resetMonitorRow(progress, "reportedClaims:0x1:0xabc");
      decision.mockReturnValue(Effect.succeed(true));
      await Effect.runPromise(
        runMonitor(ports, {
          load: async () => progress,
          save: async (next) => {
            progress = next;
          },
        }),
      );
      expect(approve).toHaveBeenCalledExactlyOnceWith(report);
    }
  },
);

it("pauses on a false early-settlement proposal before checking payments", async () => {
  let progress: MonitorProgress = { halted: null };
  const page = { next: null, head: 10, anchor: { number: 10, hash: "0xa" }, rewind: false, fromBlock: 1 };
  const report = { chainId: "0x1", gameId: 7, chestWithdrawn: "0", prizeWithdrawn: "0" };
  const pause = vi.fn(() => Effect.void);
  const paidClaims = vi.fn(() => Effect.succeed({ ...page, rows: [] }));
  const approval = vi.fn(() => Effect.void);
  const evidence = vi.fn(() => Effect.succeed("unswept realms:3,9"));
  const ports: MonitorPorts = {
    identity: { matchesPayDecision: () => Effect.succeed(true) },
    shard: {
      withdrawalReceipt: () => Effect.succeed(null),
      settlementEvidence: evidence,
      conservation: () => Effect.succeed([]),
      withdrawal: () => Effect.succeed(null),
      result: () => Effect.succeed(null),
    },
    ledger: {
      pause,
      approvePayment: () => Effect.void,
      approveSettlement: approval,
      frontierPool: () => Effect.succeed("0"),
      paidClaims,
      reportedSettlements: () => Effect.succeed({ ...page, rows: [report] }),
      reportedClaims: () => Effect.succeed({ ...page, rows: [] }),
      postedResults: () => Effect.succeed({ ...page, rows: [] }),
    },
  };
  const store = {
    load: async () => progress,
    save: async (next: MonitorProgress) => {
      progress = next;
    },
  };
  await Effect.runPromise(runMonitor(ports, store));
  expect(evidence).toHaveBeenCalledWith(report);
  expect(progress.halted).toBe("reported_settlement_mismatch:7");
  expect(progress.fault?.stream).toBe("reportedSettlements");
  expect(pause).toHaveBeenCalledOnce();
  expect(paidClaims).not.toHaveBeenCalled();
  expect(approval).not.toHaveBeenCalled();
  const faulted = progress;
  progress = resetMonitorRow(faulted, "reportedSettlements:0x1:7");
  await Effect.runPromise(runMonitor(ports, store));
  expect(approval).not.toHaveBeenCalled();
  progress = resetMonitorRow(faulted, "reportedSettlements:0x1:7");
  ports.shard.settlementEvidence = () => Effect.succeed(null);
  await Effect.runPromise(runMonitor(ports, store));
  expect(approval).toHaveBeenCalledExactlyOnceWith(report);
});
