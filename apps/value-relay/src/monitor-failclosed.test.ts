import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { runMonitor, type MonitorProgress } from "./monitor";
import { RelayFailure, type MonitorPorts } from "./ports";

const fixture = () => {
  let progress: MonitorProgress = { halted: null };
  const receipt = {
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
      conservation: () => Effect.succeed([]),
      withdrawal: vi.fn(() => Effect.fail(new RelayFailure({ operation: "shard_unavailable" }))),
      result: () => Effect.succeed(null),
    },
    ledger: {
      paidClaims: () =>
        Effect.succeed({
          rows: [{ ...receipt, paymentTransactionHash: "0xdef", paidAt: 1, wallet: "0x123" }],
          next: null,
          head: 1000,
        }),
      postedResults: () => Effect.succeed({ rows: [], next: null, head: 1000 }),
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
    expect(await f.store.load()).toEqual({ halted: null, cursors: { postedResults: { fromBlock: 1001, page: null } } });
  }
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
  f.ports.shard.withdrawal = () => Effect.succeed(f.receipt);
  await expect(f.tick()).resolves.toMatchObject({
    halted: null,
    cursors: { paidClaims: { fromBlock: 1001, page: null } },
  });
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
});
