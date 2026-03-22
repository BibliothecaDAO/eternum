// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getRealmStatusColor,
  getRealmStatusLabel,
  getRealmStatusBorder,
  isRealmStale,
  getFailureSeverity,
  timeAgo,
} from "../automation-status";
import type { RealmExecutionStatus } from "@/hooks/store/use-automation-store";

function makeStatus(
  overrides: Partial<RealmExecutionStatus> & { status: RealmExecutionStatus["status"] },
): RealmExecutionStatus {
  return {
    attemptedAt: Date.now(),
    consecutiveFailures: 0,
    ...overrides,
  };
}

describe("getRealmStatusColor", () => {
  it("returns muted gold for undefined status", () => {
    expect(getRealmStatusColor(undefined)).toBe("text-gold/50");
  });

  it("returns emerald for success", () => {
    expect(getRealmStatusColor(makeStatus({ status: "success" }))).toBe("text-emerald-400");
  });

  it("returns danger for failed", () => {
    expect(getRealmStatusColor(makeStatus({ status: "failed" }))).toBe("text-danger");
  });

  it("returns amber for skipped", () => {
    expect(getRealmStatusColor(makeStatus({ status: "skipped" }))).toBe("text-amber-400");
  });
});

describe("getRealmStatusBorder", () => {
  it("returns default border for undefined status", () => {
    expect(getRealmStatusBorder(undefined)).toBe("border-gold/20 bg-black/30");
  });

  it("returns emerald border for success", () => {
    expect(getRealmStatusBorder(makeStatus({ status: "success" }))).toBe("border-emerald-500/30 bg-emerald-500/5");
  });

  it("returns red border for failed", () => {
    expect(getRealmStatusBorder(makeStatus({ status: "failed" }))).toBe("border-red-500/30 bg-red-500/5");
  });

  it("returns amber border for skipped", () => {
    expect(getRealmStatusBorder(makeStatus({ status: "skipped" }))).toBe("border-amber-500/30 bg-amber-500/5");
  });
});

describe("getRealmStatusLabel", () => {
  it("returns 'Pending' for undefined status", () => {
    expect(getRealmStatusLabel(undefined)).toBe("Pending");
  });

  it("returns 'Success' for success status", () => {
    expect(getRealmStatusLabel(makeStatus({ status: "success" }))).toBe("Success");
  });

  it("returns 'Failed' without message", () => {
    expect(getRealmStatusLabel(makeStatus({ status: "failed" }))).toBe("Failed");
  });

  it("includes message for failed status", () => {
    expect(getRealmStatusLabel(makeStatus({ status: "failed", message: "RPC timeout" }))).toBe("Failed: RPC timeout");
  });

  it("returns 'Skipped' without message", () => {
    expect(getRealmStatusLabel(makeStatus({ status: "skipped" }))).toBe("Skipped");
  });

  it("includes message for skipped status", () => {
    expect(getRealmStatusLabel(makeStatus({ status: "skipped", message: "Idle preset" }))).toBe("Skipped: Idle preset");
  });
});

describe("isRealmStale", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for undefined status", () => {
    expect(isRealmStale(undefined)).toBe(false);
  });

  it("returns false for recent attempt", () => {
    const status = makeStatus({ status: "success", attemptedAt: Date.now() - 30_000 });
    expect(isRealmStale(status)).toBe(false);
  });

  it("returns false at exactly 3x interval boundary", () => {
    // 3 * 60_000 = 180_000ms — at the boundary, not stale (not strictly greater)
    const status = makeStatus({ status: "success", attemptedAt: Date.now() - 180_000 });
    expect(isRealmStale(status)).toBe(false);
  });

  it("returns true when attemptedAt exceeds 3x interval", () => {
    const status = makeStatus({ status: "success", attemptedAt: Date.now() - 180_001 });
    expect(isRealmStale(status)).toBe(true);
  });

  it("respects custom intervalMs", () => {
    const customInterval = 10_000; // 10s
    const status = makeStatus({ status: "success", attemptedAt: Date.now() - 30_001 });
    expect(isRealmStale(status, customInterval)).toBe(true);
  });

  it("returns false for custom intervalMs when recent", () => {
    const customInterval = 10_000;
    const status = makeStatus({ status: "success", attemptedAt: Date.now() - 20_000 });
    expect(isRealmStale(status, customInterval)).toBe(false);
  });
});

describe("getFailureSeverity", () => {
  it("returns 'none' for undefined status", () => {
    expect(getFailureSeverity(undefined)).toBe("none");
  });

  it("returns 'none' when consecutiveFailures is 0", () => {
    expect(getFailureSeverity(makeStatus({ status: "success", consecutiveFailures: 0 }))).toBe("none");
  });

  it("returns 'warning' for 1 consecutive failure", () => {
    expect(getFailureSeverity(makeStatus({ status: "failed", consecutiveFailures: 1 }))).toBe("warning");
  });

  it("returns 'warning' for 2 consecutive failures", () => {
    expect(getFailureSeverity(makeStatus({ status: "failed", consecutiveFailures: 2 }))).toBe("warning");
  });

  it("returns 'critical' for 3 consecutive failures", () => {
    expect(getFailureSeverity(makeStatus({ status: "failed", consecutiveFailures: 3 }))).toBe("critical");
  });

  it("returns 'critical' for more than 3 consecutive failures", () => {
    expect(getFailureSeverity(makeStatus({ status: "failed", consecutiveFailures: 10 }))).toBe("critical");
  });
});

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:10:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns seconds for recent timestamps", () => {
    const thirtySecsAgo = Date.now() - 30_000;
    expect(timeAgo(thirtySecsAgo)).toBe("30s ago");
  });

  it("returns 0s ago for current timestamp", () => {
    expect(timeAgo(Date.now())).toBe("0s ago");
  });

  it("returns 0s ago for future timestamps (clamped)", () => {
    expect(timeAgo(Date.now() + 10_000)).toBe("0s ago");
  });

  it("returns minutes for timestamps over 60s ago", () => {
    const fiveMinsAgo = Date.now() - 5 * 60_000;
    expect(timeAgo(fiveMinsAgo)).toBe("5m ago");
  });

  it("returns hours for timestamps over 60m ago", () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60_000;
    expect(timeAgo(twoHoursAgo)).toBe("2h ago");
  });

  it("returns 59s for 59 seconds", () => {
    const fiftyNineSecsAgo = Date.now() - 59_000;
    expect(timeAgo(fiftyNineSecsAgo)).toBe("59s ago");
  });

  it("returns 1m for exactly 60 seconds", () => {
    const sixtySecsAgo = Date.now() - 60_000;
    expect(timeAgo(sixtySecsAgo)).toBe("1m ago");
  });

  it("returns 1h for exactly 60 minutes", () => {
    const sixtyMinsAgo = Date.now() - 60 * 60_000;
    expect(timeAgo(sixtyMinsAgo)).toBe("1h ago");
  });
});
