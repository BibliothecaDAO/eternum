import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { resetMonitorRow, runMonitor, type MonitorProgress } from "./monitor";
import type { MonitorPorts } from "./ports";

it("keeps checked-through block and page continuation across ticks without rereading old claims", async () => {
  let progress: MonitorProgress = { halted: null };
  const receipt = {
    chainId: "0x1",
    seasonId: 1,
    transactionHash: "0xabc",
    realmsId: "0x2",
    amount: "1",
    confirmedAt: 1,
  };
  const withdrawal = vi.fn(() => Effect.succeed(receipt));
  const paidClaims = vi.fn((cursor: string | null, fromBlock = 0) =>
    Effect.succeed(
      cursor === null && fromBlock === 0
        ? {
            rows: [{ ...receipt, paymentTransactionHash: "0xdef", paidAt: 1, wallet: "0x123" }],
            next: "pinned-page2",
            head: 10,
            anchor: { number: 10, hash: "0xa" },
            rewind: false,
          }
        : { rows: [], next: null, head: 10, anchor: { number: 10, hash: "0xa" }, rewind: false },
    ),
  );
  const ports: MonitorPorts = {
    identity: { matchesPayDecision: () => Effect.succeed(true) },
    shard: { conservation: () => Effect.succeed([]), withdrawal, result: () => Effect.succeed(null) },
    ledger: {
      frontierPool: () => Effect.succeed(String(100n * 10n ** 18n)),
      paidClaims,
      postedResults: () =>
        Effect.succeed({ rows: [], next: null, head: 10, anchor: { number: 10, hash: "0xa" }, rewind: false }),
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
  await Effect.runPromise(runMonitor(ports, store));
  expect(paidClaims.mock.calls[1]![0]).toBe("pinned-page2");
  expect(withdrawal).toHaveBeenCalledOnce();
  await Effect.runPromise(runMonitor(ports, store));
  expect(paidClaims.mock.calls[2]).toEqual([null, 11, { number: 10, hash: "0xa" }]);
});

it("an exact row reset skips only that claim, still faults on the next unchecked claim, and survives a rewind", async () => {
  let progress: MonitorProgress = { halted: null };
  const rows = ["0xabc", "0xdef"].map((transactionHash) => ({
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
    shard: { conservation: () => Effect.succeed([]), withdrawal: checked, result: () => Effect.succeed(null) },
    ledger: {
      frontierPool: () => Effect.succeed(String(100n * 10n ** 18n)),
      paidClaims: () =>
        Effect.succeed({ rows, head: 10, anchor: { number: 10, hash: "0xa" }, rewind: false, next: null }),
      postedResults: () =>
        Effect.succeed({ rows: [], head: 10, anchor: { number: 10, hash: "0xa" }, rewind: false, next: null }),
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
    Effect.succeed({ rows, head: 10, next: null, anchor: { number: 10, hash: "0xb" }, rewind: true });
  const pause = vi.fn(() => Effect.void);
  ports.ledger.pause = pause;
  await Effect.runPromise(runMonitor(ports, store));
  // The rewind rereads the stream from row 0; both rows were cleared by the operator, so neither faults again.
  expect(progress).toMatchObject({ halted: null, fault: null });
  expect(pause).not.toHaveBeenCalled();
  expect(checked.mock.calls.map((call) => call[1])).toEqual(["0xabc", "0xdef"]);
});

it("keeps every cleared conservation row cleared, not only the last one", async () => {
  let progress: MonitorProgress = { halted: null };
  const games = [
    { chainId: "0x1", gameId: 1, confirmedBlock: 5, receipts: "2", netIssued: "1", pool: "0" },
    { chainId: "0x1", gameId: 2, confirmedBlock: 5, receipts: "3", netIssued: "1", pool: "0" },
  ];
  const pause = vi.fn(() => Effect.void);
  const page = { rows: [], head: 10, anchor: { number: 10, hash: "0xa" }, rewind: false, next: null };
  const ports: MonitorPorts = {
    identity: { matchesPayDecision: () => Effect.succeed(true) },
    shard: {
      conservation: () => Effect.succeed(games),
      withdrawal: () => Effect.succeed(null),
      result: () => Effect.succeed(null),
    },
    ledger: {
      frontierPool: () => Effect.succeed("0"),
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
        next: null,
      });
    const ports: MonitorPorts = {
      // Every check fails: the shard and identity never agree with the ledger.
      identity: { matchesPayDecision: () => Effect.succeed(false) },
      shard: {
        conservation: () => Effect.succeed([]),
        withdrawal: (chainId, transactionHash) =>
          Effect.succeed({ chainId, transactionHash, seasonId: 1, amount: "1", realmsId: "0x2", confirmedAt: 1 }),
        result: (chainId, gameId) => Effect.succeed({ chainId, gameId, commitment: "0x1", rows: [] }),
      },
      ledger: {
        frontierPool: () => Effect.succeed("0"),
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
