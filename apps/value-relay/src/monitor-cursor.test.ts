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
          }
        : { rows: [], next: null, head: 10 },
    ),
  );
  const ports: MonitorPorts = {
    identity: { matchesLedgerLinkWrite: () => Effect.succeed(true), matchesPayDecision: () => Effect.succeed(true) },
    shard: { conservation: () => Effect.succeed([]), withdrawal, result: () => Effect.succeed(null) },
    ledger: {
      accountLinks: () => Effect.succeed({ rows: [], head: 1000, next: null }),
      paidClaims,
      postedResults: () => Effect.succeed({ rows: [], next: null, head: 10 }),
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
  expect(paidClaims.mock.calls[2]).toEqual([null, 11]);
});

it("an exact row reset skips only that claim and still faults on the next unchecked claim", async () => {
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
    identity: { matchesLedgerLinkWrite: () => Effect.succeed(true), matchesPayDecision: () => Effect.succeed(false) },
    shard: { conservation: () => Effect.succeed([]), withdrawal: checked, result: () => Effect.succeed(null) },
    ledger: {
      accountLinks: () => Effect.succeed({ rows: [], head: 1000, next: null }),
      paidClaims: () => Effect.succeed({ rows, head: 10, next: null }),
      postedResults: () => Effect.succeed({ rows: [], head: 10, next: null }),
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
});
