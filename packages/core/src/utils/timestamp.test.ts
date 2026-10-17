// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatClockTime,
  getBlockTimestamp,
  setBlockTimestampSource,
  setChainProvenTimestampSource,
} from "./timestamp";

import { configManager } from "../managers/config-manager";
beforeEach(() => {
  vi.spyOn(configManager, "getTick").mockReturnValue(1);
});

// The default tick is one second, so it names the proven second.
const SOURCE_SECONDS = 1_787_000_000;

afterEach(() => {
  vi.restoreAllMocks();
  setBlockTimestampSource(null);
  setChainProvenTimestampSource(null);
});

describe("chain time", () => {
  it("projects production and stamina at chain-proven time while countdowns keep the estimate", () => {
    setBlockTimestampSource(() => SOURCE_SECONDS + 4);
    setChainProvenTimestampSource(() => SOURCE_SECONDS);

    const { currentBlockTimestamp, currentDefaultTick } = getBlockTimestamp();
    expect(currentBlockTimestamp).toBe(SOURCE_SECONDS + 4);
    expect(currentDefaultTick).toBe(SOURCE_SECONDS);
  });

  it("does not project balances before the confirmed clock is known", () => {
    setBlockTimestampSource(() => SOURCE_SECONDS);
    setChainProvenTimestampSource(() => null);
    expect(() => getBlockTimestamp().currentDefaultTick).toThrow("No chain-proven timestamp");
  });
});

describe("a moment on a feed row", () => {
  it("reads as the viewer's 24-hour clock, HH:MM", () => {
    expect(formatClockTime(new Date(2026, 8, 9, 14, 5).getTime())).toBe("14:05");
    expect(formatClockTime(new Date(2026, 8, 9, 9, 7).getTime())).toBe("09:07");
  });
});
