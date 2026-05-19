export interface TelemetryTransaction {
  status: "pending" | "success" | "reverted";
  submittedAt: number;
}

export interface StaleTransactionTelemetry {
  pendingCount: number;
  stuckCount: number;
  oldestPendingAgeMs: number;
}

export function computeStaleTransactionTelemetry(
  transactions: ReadonlyArray<TelemetryTransaction>,
  nowMs: number,
  stuckThresholdMs: number,
): StaleTransactionTelemetry {
  let pendingCount = 0;
  let stuckCount = 0;
  let oldestPendingAgeMs = 0;

  for (const tx of transactions) {
    if (tx.status !== "pending") {
      continue;
    }
    pendingCount += 1;
    const ageMs = nowMs - tx.submittedAt;
    if (ageMs >= stuckThresholdMs) {
      stuckCount += 1;
    }
    if (ageMs > oldestPendingAgeMs) {
      oldestPendingAgeMs = ageMs;
    }
  }

  return { pendingCount, stuckCount, oldestPendingAgeMs };
}
