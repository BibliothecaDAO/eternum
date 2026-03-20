import { describe, expect, it } from "vitest";

import { flushDeferredWorldmapZoomRefresh, resolveWorldmapZoomRefreshPlan } from "./worldmap-zoom-refresh-policy";

describe("resolveWorldmapZoomRefreshPlan", () => {
  it("defers expensive chunk refresh during scripted zoom when chunk does not change", () => {
    const result = resolveWorldmapZoomRefreshPlan({
      previousDistance: 20,
      nextDistance: 20.4,
      threshold: 0.75,
      isScriptedTransitionActive: true,
      hasDeferredRefresh: false,
      deferredForceRefresh: false,
    });

    expect(result.shouldRequestRefreshNow).toBe(false);
    expect(result.nextHasDeferredRefresh).toBe(true);
    expect(result.nextDeferredForceRefresh).toBe(false);
  });

  it("executes one deferred refresh on settle", () => {
    expect(
      flushDeferredWorldmapZoomRefresh({
        hasDeferredRefresh: true,
        deferredForceRefresh: false,
      }),
    ).toEqual({
      shouldRequestRefresh: true,
      shouldForceRefresh: false,
      nextHasDeferredRefresh: false,
      nextDeferredForceRefresh: false,
    });
  });

  it("still forces refresh when a hard zoom threshold is crossed", () => {
    const result = resolveWorldmapZoomRefreshPlan({
      previousDistance: 20,
      nextDistance: 21,
      threshold: 0.75,
      isScriptedTransitionActive: true,
      hasDeferredRefresh: false,
      deferredForceRefresh: false,
    });

    expect(result.shouldRequestRefreshNow).toBe(false);
    expect(result.nextHasDeferredRefresh).toBe(true);
    expect(result.nextDeferredForceRefresh).toBe(true);
  });
});
