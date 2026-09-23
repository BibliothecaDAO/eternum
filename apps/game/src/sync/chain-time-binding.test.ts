import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { configManager, getBlockTimestamp, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { bindChainTime } from "./chain-time-binding";

const HEAD_SECONDS = 1_787_000_000;

beforeEach(() => {
  vi.spyOn(configManager, "getTick").mockReturnValue(1);
  useChainTimeStore.setState({ lastHeartbeat: null, anchorTimestampMs: null, anchorPerfMs: null, nowMs: null });
});
afterEach(() => {
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

it("has no chain time before a confirmed head, and never guesses one from the local clock", () => {
  bindChainTime();
  expect(useChainTimeStore.getState().nowMs).toBeNull();
  expect(() => getBlockTimestamp()).toThrow("Chain time is not known yet");
});

it("projects production at the newest chain-written timestamp while the clock runs on the estimate", () => {
  bindChainTime();
  useChainTimeStore.getState().setHeartbeat({ timestamp: HEAD_SECONDS * 1000, source: "herald-head" });

  const { currentBlockTimestamp, currentDefaultTick } = getBlockTimestamp();
  expect(currentDefaultTick).toBe(HEAD_SECONDS);
  expect(currentBlockTimestamp).toBeGreaterThanOrEqual(HEAD_SECONDS);
});
