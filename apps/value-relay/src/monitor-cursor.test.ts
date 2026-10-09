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
        ? { rows: [{ ...receipt, wallet: "0x123" }], next: "pinned-page2", head: 10 }
        : { rows: [], next: null, head: 10 },
    ),
  );
  const ports: MonitorPorts = {
    identity: { payoutWallet: () => Effect.succeed({ status: "ready", address: "0x123" }) },
    shard: { conservation: () => Effect.succeed([]), withdrawal, result: () => Effect.succeed(null) },
    ledger: {
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
