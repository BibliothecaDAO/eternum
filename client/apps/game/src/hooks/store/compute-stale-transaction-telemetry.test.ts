import { describe, expect, it } from "vitest";

import { computeStaleTransactionTelemetry } from "./compute-stale-transaction-telemetry";

const tx = (status: "pending" | "success" | "reverted", submittedAt: number) => ({
  hash: `0x${submittedAt}`,
  status,
  submittedAt,
});

describe("computeStaleTransactionTelemetry", () => {
  it("returns zero counts when there are no transactions", () => {
    const result = computeStaleTransactionTelemetry([], 100_000, 30_000);
    expect(result).toEqual({
      pendingCount: 0,
      stuckCount: 0,
      oldestPendingAgeMs: 0,
    });
  });

  it("counts pending transactions and marks ones older than the threshold as stuck", () => {
    const now = 100_000;
    const result = computeStaleTransactionTelemetry(
      [tx("pending", 10_000), tx("pending", 80_000), tx("success", 50_000)],
      now,
      30_000,
    );
    expect(result.pendingCount).toBe(2);
    expect(result.stuckCount).toBe(1);
    expect(result.oldestPendingAgeMs).toBe(90_000);
  });

  it("ignores non-pending transactions for stuck calculations", () => {
    const result = computeStaleTransactionTelemetry([tx("success", 10_000), tx("reverted", 20_000)], 100_000, 30_000);
    expect(result.pendingCount).toBe(0);
    expect(result.stuckCount).toBe(0);
    expect(result.oldestPendingAgeMs).toBe(0);
  });

  it("treats a pending tx exactly at the threshold as stuck", () => {
    const now = 100_000;
    const result = computeStaleTransactionTelemetry([tx("pending", 70_000)], now, 30_000);
    expect(result.stuckCount).toBe(1);
  });
});
