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
    identity: { payoutWallet: () => Effect.succeed({ status: "ready", address: "0x123" }) },
    shard: {
      conservation: () => Effect.succeed([]),
      withdrawal: vi.fn(() => Effect.fail(new RelayFailure({ operation: "shard_unavailable" }))),
      result: () => Effect.succeed(null),
    },
    ledger: {
      paidClaims: () => Effect.succeed({ rows: [{ ...receipt, wallet: "0x123" }], next: null, head: 1000 }),
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
it("durably pauses after three consecutive ticks that cannot verify a paid claim", async () => {
  const f = fixture();
  await expect(f.tick()).rejects.toThrow();
  await expect(f.tick()).rejects.toThrow();
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
  await f.tick().catch(() => undefined);
  expect((await f.store.load()).halted).toContain("unverified_value:3");
  expect(f.ports.ledger.pause).toHaveBeenCalledOnce();
});
it("resets the consecutive failure budget after a complete verified tick", async () => {
  const f = fixture();
  await expect(f.tick()).rejects.toThrow();
  f.ports.shard.withdrawal = () => Effect.succeed(f.receipt);
  await f.tick();
  f.ports.shard.withdrawal = () => Effect.fail(new RelayFailure({ operation: "shard_unavailable" }));
  await expect(f.tick()).rejects.toThrow();
  await expect(f.tick()).rejects.toThrow();
  expect((await f.store.load()).halted).toBeNull();
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
});
