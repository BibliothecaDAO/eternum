import { describe, expect, it, vi } from "vitest";

import {
  settleWorldmapShortcutSelectionProtection,
  shouldResetWorldmapShortcutRefreshUiReason,
} from "./worldmap-shortcut-selection-runtime";

describe("settleWorldmapShortcutSelectionProtection", () => {
  it("waits for the chunk switch and pending refresh when protection should be held", async () => {
    const awaitActiveChunkSwitch = vi.fn(async () => undefined);
    const awaitRequestedRefresh = vi.fn(async () => undefined);
    const warn = vi.fn();

    await settleWorldmapShortcutSelectionProtection({
      awaitActiveChunkSwitch,
      awaitRequestedRefresh,
      currentRefreshToken: 5,
      hasGlobalChunkSwitchPromise: true,
      hasPendingChunkRefreshTimer: true,
      isChunkRefreshRunning: false,
      warn,
    });

    expect(awaitActiveChunkSwitch).toHaveBeenCalledTimes(1);
    expect(awaitRequestedRefresh).toHaveBeenCalledWith(5);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns and continues when either wait path fails", async () => {
    const awaitActiveChunkSwitch = vi.fn(async () => {
      throw new Error("switch failed");
    });
    const awaitRequestedRefresh = vi.fn(async () => {
      throw new Error("refresh failed");
    });
    const warn = vi.fn();

    await settleWorldmapShortcutSelectionProtection({
      awaitActiveChunkSwitch,
      awaitRequestedRefresh,
      currentRefreshToken: 2,
      hasGlobalChunkSwitchPromise: true,
      hasPendingChunkRefreshTimer: false,
      isChunkRefreshRunning: true,
      warn,
    });

    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("skips all waits when no protection hold is needed", async () => {
    const awaitActiveChunkSwitch = vi.fn(async () => undefined);
    const awaitRequestedRefresh = vi.fn(async () => undefined);

    await settleWorldmapShortcutSelectionProtection({
      awaitActiveChunkSwitch,
      awaitRequestedRefresh,
      currentRefreshToken: 0,
      hasGlobalChunkSwitchPromise: false,
      hasPendingChunkRefreshTimer: false,
      isChunkRefreshRunning: false,
      warn: vi.fn(),
    });

    expect(awaitActiveChunkSwitch).not.toHaveBeenCalled();
    expect(awaitRequestedRefresh).not.toHaveBeenCalled();
  });
});

describe("shouldResetWorldmapShortcutRefreshUiReason", () => {
  it("resets the pending UI reason only when all chunk work has drained", () => {
    expect(
      shouldResetWorldmapShortcutRefreshUiReason({
        hasGlobalChunkSwitchPromise: false,
        hasPendingChunkRefreshTimer: false,
        isChunkRefreshRunning: false,
      }),
    ).toBe(true);

    expect(
      shouldResetWorldmapShortcutRefreshUiReason({
        hasGlobalChunkSwitchPromise: true,
        hasPendingChunkRefreshTimer: false,
        isChunkRefreshRunning: false,
      }),
    ).toBe(false);
  });
});
