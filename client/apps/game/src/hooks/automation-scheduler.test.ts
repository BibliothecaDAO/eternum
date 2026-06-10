// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PROCESS_INTERVAL_MS } from "@/ui/features/infrastructure/automation/model/automation-processor";
import {
  computeNextEligibleMs,
  computePostPassSchedulerUpdate,
  computeScheduleDelayMs,
  shouldAdvanceSchedulerBookkeeping,
} from "./automation-scheduler";

describe("computeNextEligibleMs", () => {
  it("picks the later of (lastRun + interval) and automationEnabledAt", () => {
    const lastRun = 1_000;
    const enabledAt = 5_000;
    expect(computeNextEligibleMs(lastRun, enabledAt)).toBe(Math.max(lastRun + PROCESS_INTERVAL_MS, enabledAt));
  });

  it("defaults to lastRun + interval when enable-gate is in the past", () => {
    const lastRun = 100_000;
    expect(computeNextEligibleMs(lastRun, 0)).toBe(lastRun + PROCESS_INTERVAL_MS);
  });

  it("honours a future enable-gate even when lastRun is recent", () => {
    const lastRun = 0;
    const enabledAt = lastRun + PROCESS_INTERVAL_MS + 10_000;
    expect(computeNextEligibleMs(lastRun, enabledAt)).toBe(enabledAt);
  });
});

describe("computeScheduleDelayMs", () => {
  it("aligns to the next whole-second boundary", () => {
    // 1700000000.250 → next boundary 1700000001.000 → 750ms
    expect(computeScheduleDelayMs(1_700_000_000_250)).toBe(750);
  });

  it("applies a 250ms minimum floor when already near the boundary", () => {
    // 1700000000.999 → next boundary 1700000001.000 → 1ms, floored to 250
    expect(computeScheduleDelayMs(1_700_000_000_999)).toBe(250);
  });

  it("returns 1000 at an exact whole second", () => {
    expect(computeScheduleDelayMs(1_700_000_000_000)).toBe(1000);
  });
});

describe("shouldAdvanceSchedulerBookkeeping", () => {
  it("only advances when the pass ran and no prune happened mid-flight", () => {
    expect(shouldAdvanceSchedulerBookkeeping(true, false)).toBe(true);
    expect(shouldAdvanceSchedulerBookkeeping(true, true)).toBe(false);
    expect(shouldAdvanceSchedulerBookkeeping(false, false)).toBe(false);
    expect(shouldAdvanceSchedulerBookkeeping(false, true)).toBe(false);
  });
});

describe("computePostPassSchedulerUpdate", () => {
  it("sets lastRun to now and enableAt/nextRun to now + interval", () => {
    const nowMs = 10_000;
    expect(computePostPassSchedulerUpdate(nowMs)).toEqual({
      lastRunMs: nowMs,
      automationEnabledAtMs: nowMs + PROCESS_INTERVAL_MS,
      nextRunMs: nowMs + PROCESS_INTERVAL_MS,
    });
  });
});
