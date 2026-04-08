import { describe, expect, it, vi } from "vitest";

import { runWorldmapArmySelectionRecovery } from "./worldmap-army-selection-recovery-runtime";

describe("runWorldmapArmySelectionRecovery", () => {
  it("waits for the active chunk switch, refreshes, and retries until the army appears", async () => {
    const awaitActiveChunkSwitch = vi.fn(async () => undefined);
    const forceChunkRefresh = vi.fn(async () => undefined);
    const onRecovered = vi.fn();
    const wait = vi.fn(async () => undefined);
    let attempts = 0;

    await runWorldmapArmySelectionRecovery({
      awaitActiveChunkSwitch,
      forceChunkRefresh,
      isArmyAvailable: () => {
        attempts += 1;
        return attempts >= 3;
      },
      isArmyPendingMovement: () => false,
      onRecovered,
      wait,
    });

    expect(awaitActiveChunkSwitch).toHaveBeenCalledTimes(1);
    expect(forceChunkRefresh).toHaveBeenCalledTimes(1);
    expect(onRecovered).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("stops retrying when the army enters pending movement", async () => {
    const onRecovered = vi.fn();
    const onUnavailable = vi.fn();
    let checks = 0;

    await runWorldmapArmySelectionRecovery({
      forceChunkRefresh: vi.fn(async () => undefined),
      isArmyAvailable: () => false,
      isArmyPendingMovement: () => {
        checks += 1;
        return checks >= 2;
      },
      onRecovered,
      onUnavailable,
      wait: vi.fn(async () => undefined),
    });

    expect(onRecovered).not.toHaveBeenCalled();
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it("reports failure when refresh throws", async () => {
    const onError = vi.fn();

    await runWorldmapArmySelectionRecovery({
      forceChunkRefresh: vi.fn(async () => {
        throw new Error("refresh failed");
      }),
      isArmyAvailable: () => false,
      isArmyPendingMovement: () => false,
      onError,
      wait: vi.fn(async () => undefined),
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
