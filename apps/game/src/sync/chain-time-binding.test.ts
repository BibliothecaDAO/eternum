import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { configManager, getBlockTimestamp, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { bindChainTime } from "./chain-time-binding";
import { createGameSyncObserver } from "./game-sync-observer";

const HEAD_SECONDS = 1_787_000_000;

beforeEach(() => {
  vi.spyOn(configManager, "getTick").mockReturnValue(1);
  useChainTimeStore.setState({
    lastHeartbeat: null,
    executionFloorMs: null,
    anchorTimestampMs: null,
    anchorPerfMs: null,
    nowMs: null,
  });
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

it("projects production at the confirmed floor, not at a pre-confirmed head, so MAX never outruns execution", () => {
  bindChainTime();
  const observer = createGameSyncObserver({ reportProgress: () => undefined, onSetupCompleted: () => undefined });
  // Game 8's Knight T1 barracks: 9.1667 a second, last settled at the barracks' creation.
  const settledAt = HEAD_SECONDS;
  const knightsPerSecond = 9_166_666_608 / 1_000_000_000;
  const knightsAt = (seconds: number) => Math.floor(knightsPerSecond * (seconds - settledAt));
  const confirmedAt = settledAt + 52;

  observer.onHead?.({ block: 32_944, preconfirmed: false, timestamp: confirmedAt });
  observer.onHead?.({ block: 32_945, preconfirmed: true, timestamp: confirmedAt + 2 });

  const { currentBlockTimestamp, currentDefaultTick } = getBlockTimestamp();
  expect(currentBlockTimestamp).toBeGreaterThanOrEqual(confirmedAt + 2);
  expect(currentDefaultTick).toBe(confirmedAt);
  // The gateway records the action at its latest confirmed head, so the chain holds at least this much when it runs.
  expect(knightsAt(currentDefaultTick)).toBeLessThanOrEqual(knightsAt(confirmedAt));
  expect(knightsAt(confirmedAt + 2)).toBeGreaterThan(knightsAt(confirmedAt));
});
