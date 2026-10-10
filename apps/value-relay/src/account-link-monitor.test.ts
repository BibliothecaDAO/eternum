import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { runMonitor, type MonitorProgress } from "./monitor";
import { RelayFailure, type MonitorPorts } from "./ports";
const event = {
  id: "0xabc:0",
  transactionHash: "0xabc",
  wallet: "0x10",
  account: "0x20",
  previousAccount: "0x30",
  previousWallet: "0x40",
};
const fixture = (allowed = true) => {
  let progress: MonitorProgress = { halted: null };
  const pause = vi.fn(() => Effect.void);
  const ports = {
    identity: {
      matchesPayDecision: () => Effect.succeed(true),
      matchesLedgerLinkWrite: vi.fn(() => Effect.succeed(allowed)),
    },
    shard: { conservation: () => Effect.succeed([]) },
    ledger: {
      auditSeasons: () => Effect.succeed(null),
      pause,
      paidClaims: () => Effect.succeed({ rows: [], head: 1, next: null }),
      postedResults: () => Effect.succeed({ rows: [], head: 1, next: null }),
      accountLinks: () => Effect.succeed({ rows: [event], head: 1, next: null }),
    },
  } as unknown as MonitorPorts;
  return {
    run: () =>
      Effect.runPromise(
        runMonitor(ports, {
          load: async () => progress,
          save: async (p) => {
            progress = p;
          },
        }),
      ),
    ports,
    pause,
    progress: () => progress,
  };
};
it("audits the new pair and both displaced pairs, and keeps an exact checked-through link cursor", async () => {
  const f = fixture();
  await f.run();
  expect(f.ports.identity.matchesLedgerLinkWrite).toHaveBeenCalledWith(event);
  expect(f.progress().cursors?.accountLinks).toEqual({ fromBlock: 2, page: null });
  expect(f.pause).not.toHaveBeenCalled();
});
it("pauses a link identity never authorized, including a replay of an old pair under a new hash", async () => {
  const f = fixture(false);
  await f.run();
  expect(f.pause).toHaveBeenCalledOnce();
  expect(f.progress()).toMatchObject({
    halted: "account_link_mismatch:0xabc:0",
    fault: { row: "accountLinks:0xabc:0", stream: "accountLinks" },
  });
});

it("fails closed after three ticks when private history cannot be read", async () => {
  const f = fixture();
  f.ports.identity.matchesLedgerLinkWrite = () =>
    Effect.fail(new RelayFailure({ operation: "identity_link_history_unavailable" }));
  await expect(f.run()).rejects.toThrow();
  expect(f.pause).not.toHaveBeenCalled();
  await expect(f.run()).rejects.toThrow();
  await f.run();
  expect(f.pause).toHaveBeenCalledOnce();
});
