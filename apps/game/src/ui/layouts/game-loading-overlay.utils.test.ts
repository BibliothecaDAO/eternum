// @vitest-environment node

import { describe, expect, it } from "vitest";

import { getSceneWarmupProgress, resolveEntryOverlayPhase } from "./game-loading-overlay.utils";

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
