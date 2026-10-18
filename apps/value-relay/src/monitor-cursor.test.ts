import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { runMonitor, type MonitorProgress } from "./monitor";
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
  const { resetMonitorRow } = await import("./monitor");
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
  const { resetMonitorRow } = await import("./monitor");
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
