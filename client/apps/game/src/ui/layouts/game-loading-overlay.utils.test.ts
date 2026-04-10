// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  HEXCEPTION_GRID_READY_EVENT,
  WORLDMAP_SCENE_READY_EVENT,
  getSceneWarmupProgress,
  resolveEntryOverlayPhase,
  waitForHexceptionGridReady,
  waitForWorldmapSceneReady,
} from "./game-loading-overlay.utils";

describe("waitForHexceptionGridReady", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        setTimeout,
        clearTimeout,
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, "window");
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

describe("waitForWorldmapSceneReady", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        setTimeout,
        clearTimeout,
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, "window");
  });

  it("resolves when the worldmap ready event arrives", async () => {
    const promise = waitForWorldmapSceneReady(5000);

    window.dispatchEvent(new Event(WORLDMAP_SCENE_READY_EVENT));

    await expect(promise).resolves.toBe(true);
  });

  it("resolves on timeout when the worldmap ready event never arrives", async () => {
    const promise = waitForWorldmapSceneReady(1200);

    await vi.advanceTimersByTimeAsync(1200);

    await expect(promise).resolves.toBe(false);
  });
});

describe("entry overlay helpers", () => {
  it("returns a bounded warmup progress curve", () => {
    expect(getSceneWarmupProgress(0)).toBe(82);
    expect(getSceneWarmupProgress(2500)).toBeGreaterThan(82);
    expect(getSceneWarmupProgress(2500)).toBeLessThanOrEqual(95);
    expect(getSceneWarmupProgress(999999)).toBe(95);
  });

  it("resolves phase order from handoff to ready", () => {
    expect(
      resolveEntryOverlayPhase({ isReady: false, hasNavigated: false, isSlow: false, didSafetyTimeout: false }),
    ).toBe("handoff");
    expect(
      resolveEntryOverlayPhase({ isReady: false, hasNavigated: true, isSlow: false, didSafetyTimeout: false }),
    ).toBe("scene_warmup");
    expect(
      resolveEntryOverlayPhase({ isReady: false, hasNavigated: true, isSlow: true, didSafetyTimeout: false }),
    ).toBe("slow");
    expect(resolveEntryOverlayPhase({ isReady: true, hasNavigated: true, isSlow: true, didSafetyTimeout: false })).toBe(
      "ready",
    );
  });
});
