import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HEXCEPTION_GRID_READY_EVENT, waitForHexceptionGridReady } from "./game-loading-overlay.utils";

describe("waitForHexceptionGridReady", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when matching grid-ready event arrives", async () => {
    const promise = waitForHexceptionGridReady({ col: 12, row: 34 }, 5000);

    window.dispatchEvent(
      new CustomEvent(HEXCEPTION_GRID_READY_EVENT, {
        detail: { col: 12, row: 34 },
      }),
    );

    await expect(promise).resolves.toBeUndefined();
  });

  it("ignores non-matching events and resolves on timeout", async () => {
    const promise = waitForHexceptionGridReady({ col: 5, row: 6 }, 1200);

    window.dispatchEvent(
      new CustomEvent(HEXCEPTION_GRID_READY_EVENT, {
        detail: { col: 99, row: 100 },
      }),
    );

    await vi.advanceTimersByTimeAsync(1200);

    await expect(promise).resolves.toBeUndefined();
  });
});
