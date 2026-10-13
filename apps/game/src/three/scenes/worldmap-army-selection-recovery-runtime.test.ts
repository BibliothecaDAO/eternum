import { afterEach, describe, expect, it, vi } from "vitest";
import { runWorldmapArmySelectionRecovery } from "./worldmap-army-selection-recovery-runtime";

afterEach(() => vi.useRealTimers());

describe("army selection recovery", () => {
  it("recovers the army after its chunk becomes available", async () => {
    vi.useFakeTimers();
    let switched = false;
    let available = false;
    let outcome = "pending";
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const recovery = runWorldmapArmySelectionRecovery({
      awaitActiveChunkSwitch: async () => {
        await wait(10);
        switched = true;
      },
      forceChunkRefresh: async () => {
        if (!switched) throw new Error("chunk not ready");
        setTimeout(() => {
          available = true;
        }, 400);
      },
      isArmyAvailable: () => available,
      onRecovered: () => {
        outcome = "recovered";
      },
      onUnavailable: () => {
        outcome = "unavailable";
      },
      onError: () => {
        outcome = "error";
      },
      wait,
    });
    await vi.advanceTimersByTimeAsync(409);
    expect(outcome).toBe("pending");
    await vi.advanceTimersByTimeAsync(1);
    await recovery;
    expect(outcome).toBe("recovered");
  });

  it("reports the refresh failure to its caller", async () => {
    let failure: unknown;
    await runWorldmapArmySelectionRecovery({
      forceChunkRefresh: async () => {
        throw new Error("refresh failed");
      },
      isArmyAvailable: () => false,
      onError: (error) => {
        failure = error;
      },
      wait: async () => {},
    });
    expect(failure).toEqual(new Error("refresh failed"));
  });
});
