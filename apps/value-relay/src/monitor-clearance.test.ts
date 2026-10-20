import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { resetMonitorRow, runMonitor, type MonitorProgress } from "./monitor";
import type { BlitzResult, MonitorPorts, Withdrawal } from "./ports";

type Stream = "paidClaims" | "postedResults";

/**
 * One faulting ledger row on `stream`, its shard evidence, a monitor whose progress persists as JSON, and a replay of the
 * same ledger row at a new anchor: what an operator's clearance meets once the stream is read again.
 */
const auditedRow = (stream: Stream) => {
  let saved = JSON.stringify({ halted: null } satisfies MonitorProgress);
  let anchor = "0xa";
  let reads = 0;
  let pauses = 0;
  const shard: { receipt: Withdrawal; result: BlitzResult; decision: boolean } = {
    receipt: { chainId: "0x1", transactionHash: "0xabc", seasonId: 1, amount: "100", realmsId: "0x2", confirmedAt: 1 },
    result: { chainId: "0x1", gameId: 1, commitment: "0x12", rows: [] },
    decision: false,
  };
  const paid = {
    chainId: "0x1",
    transactionHash: "0xabc",
    seasonId: 1,
    amount: "100",
    wallet: "0x3",
    paymentTransactionHash: "0xdef",
    paidAt: 1,
  };
  const posted = { chainId: "0x1", gameId: 1, commitment: "0x11" };
  const page = <A>(rows: A[]) =>
    Effect.succeed({ rows, head: 10, next: null, anchor: { number: 10, hash: anchor }, rewind: anchor !== "0xa" });
  const ports: MonitorPorts = {
    identity: { matchesPayDecision: () => Effect.succeed(shard.decision) },
    shard: {
      conservation: () => Effect.succeed([]),
      withdrawal: () => {
        reads++;
        return Effect.succeed(shard.receipt);
      },
      result: () => {
        reads++;
        return Effect.succeed(shard.result);
      },
    },
    ledger: {
      frontierPool: () => Effect.succeed("0"),
      paidClaims: () => page(stream === "paidClaims" ? [paid] : []),
      postedResults: () => page(stream === "postedResults" ? [posted] : []),
      pause: () => {
        pauses++;
        return Effect.void;
      },
    },
  };
  const store = {
    load: async () => JSON.parse(saved) as MonitorProgress,
    save: async (next: MonitorProgress) => {
      saved = JSON.stringify(next);
    },
  };
  const tick = () => Effect.runPromise(runMonitor(ports, store));
  return {
    shard,
    progress: () => JSON.parse(saved) as MonitorProgress,
    counts: () => ({ reads, pauses }),
    tick,
    /** The operator clears the halt, and the ledger replays the same row at a new anchor. */
    clearAndReplay: async () => {
      const halted = JSON.parse(saved) as MonitorProgress;
      saved = JSON.stringify(resetMonitorRow(halted, halted.fault!.row));
      anchor = "0xb";
    },
  };
};

describe.each(["paidClaims", "postedResults"] as const)("an operator's clearance on %s", (stream) => {
  it("keeps an identical observation cleared at a new anchor, after observing it again", async () => {
    const audit = auditedRow(stream);
    await audit.tick();
    expect(audit.counts().pauses).toBe(1);
    await audit.clearAndReplay();
    const before = audit.counts();
    await audit.tick();
    expect(audit.counts().reads).toBe(before.reads + 1);
    expect(audit.counts().pauses).toBe(1);
    expect(audit.progress().halted).toBeNull();
  });

  it("halts and pauses again, durably, when the independent evidence now shows a different fault", async () => {
    const audit = auditedRow(stream);
    await audit.tick();
    await audit.clearAndReplay();
    // The ledger row is unchanged; the shard's receipt amount or result commitment now differs from what was cleared.
    audit.shard.receipt = { ...audit.shard.receipt, amount: "200" };
    audit.shard.result = { ...audit.shard.result, commitment: "0x13" };
    await audit.tick();
    expect(audit.counts().pauses).toBe(2);
    // A paid claim first failed its payment decision; with the amount changed, its receipt no longer matches either.
    expect(audit.progress().halted).toBe(
      stream === "paidClaims" ? "paid_claim_mismatch:0xabc" : "blitz_result_mismatch:1",
    );
    expect(audit.progress().fault?.fact).toMatch(stream === "paidClaims" ? /receipt:.*:200:/ : /result:.*:0x13$/);
    // The halt is persisted: the next tick pauses again rather than auditing.
    await audit.tick();
    expect(audit.counts().pauses).toBe(3);
  });
});

it("treats a cleared receipt mismatch whose receipt now matches but whose payment decision is refused as a new fault", async () => {
  const audit = auditedRow("paidClaims");
  audit.shard.receipt = { ...audit.shard.receipt, amount: "99" };
  await audit.tick();
  expect(audit.progress().halted).toBe("paid_claim_mismatch:0xabc");
  await audit.clearAndReplay();
  audit.shard.receipt = { ...audit.shard.receipt, amount: "100" };
  await audit.tick();
  expect(audit.progress().halted).toBe("paid_wallet_mismatch:0xabc");
  expect(audit.counts().pauses).toBe(2);
});
