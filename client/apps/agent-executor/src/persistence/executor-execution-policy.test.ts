import { describe, expect, it } from "vitest";

import {
  DEFAULT_TURN_TIMEOUT_MS,
  resolveStaleExecutionThresholdMs,
  resolveTurnTimeoutMs,
} from "./executor-execution-policy";

describe("resolveTurnTimeoutMs", () => {
  it("prefers per-agent runtime config over the environment default", () => {
    expect(resolveTurnTimeoutMs({ turnTimeoutMs: 12_000 }, 45_000)).toBe(12_000);
  });

  it("falls back to the executor default when no override exists", () => {
    expect(resolveTurnTimeoutMs({}, undefined)).toBe(DEFAULT_TURN_TIMEOUT_MS);
  });
});

describe("resolveStaleExecutionThresholdMs", () => {
  it("uses at least ninety seconds even for short timeouts", () => {
    expect(resolveStaleExecutionThresholdMs(10_000)).toBe(90_000);
  });

  it("scales with twice the turn timeout for longer runs", () => {
    expect(resolveStaleExecutionThresholdMs(60_000)).toBe(120_000);
  });
});
