import { describe, expect, it } from "vitest";

import {
  clearCompletedRenderAreaHydrationState,
  clearRenderAreaHydrationState,
  createWorldmapRenderAreaHydrationState,
  finalizePendingRenderAreaHydrationOwnership,
  getMissingRenderAreaHydrationStages,
  getPendingRenderAreaHydrationPromise,
  isRenderAreaHydrationComplete,
  markRenderAreaHydrationStagesComplete,
  registerPendingRenderAreaHydration,
  retainRenderAreaHydrationStages,
  resolveFetchResultRetainedAreaKeys,
  resolveRecentRenderAreaRetention,
  type WorldmapRenderAreaHydrationStage,
} from "./worldmap-render-area-hydration-state";

const PREFETCH_STAGES: WorldmapRenderAreaHydrationStage[] = ["tileOpt", "explorerTroops"];
const ACTIVE_STAGES: WorldmapRenderAreaHydrationStage[] = ["tileOpt", "explorerTroops", "structures"];

describe("worldmap render area hydration state", () => {
  it("does not let prefetch hydration satisfy active presentation requirements", () => {
    const state = createWorldmapRenderAreaHydrationState();

    markRenderAreaHydrationStagesComplete(state, "area-a", PREFETCH_STAGES);

    expect(isRenderAreaHydrationComplete(state, "area-a", PREFETCH_STAGES)).toBe(true);
    expect(isRenderAreaHydrationComplete(state, "area-a", ACTIVE_STAGES)).toBe(false);
    expect(getMissingRenderAreaHydrationStages(state, "area-a", ACTIVE_STAGES)).toEqual(["structures"]);
  });

  it("dedupes pending work by stage and ownership identity", () => {
    const state = createWorldmapRenderAreaHydrationState();
    const tileFetch = Promise.resolve(true);
    const structureFetch = Promise.resolve(true);
    const staleTileFetch = Promise.resolve(false);

    registerPendingRenderAreaHydration(state, "area-a", PREFETCH_STAGES, tileFetch);
    registerPendingRenderAreaHydration(state, "area-a", ["structures"], structureFetch);

    expect(getPendingRenderAreaHydrationPromise(state, "area-a", PREFETCH_STAGES)).toBe(tileFetch);
    expect(getPendingRenderAreaHydrationPromise(state, "area-a", ACTIVE_STAGES)).toBe(null);

    expect(finalizePendingRenderAreaHydrationOwnership(state, "area-a", PREFETCH_STAGES, staleTileFetch)).toBe(false);
    expect(getPendingRenderAreaHydrationPromise(state, "area-a", PREFETCH_STAGES)).toBe(tileFetch);

    expect(finalizePendingRenderAreaHydrationOwnership(state, "area-a", PREFETCH_STAGES, tileFetch)).toBe(true);
    expect(getPendingRenderAreaHydrationPromise(state, "area-a", PREFETCH_STAGES)).toBe(null);
    expect(getPendingRenderAreaHydrationPromise(state, "area-a", ["structures"])).toBe(structureFetch);
  });

  it("clears completed and pending state for a render area", () => {
    const state = createWorldmapRenderAreaHydrationState();
    const pendingFetch = Promise.resolve(true);

    markRenderAreaHydrationStagesComplete(state, "area-a", ["tileOpt"]);
    registerPendingRenderAreaHydration(state, "area-a", ["structures"], pendingFetch);
    clearRenderAreaHydrationState(state, "area-a");

    expect(isRenderAreaHydrationComplete(state, "area-a", ["tileOpt"])).toBe(false);
    expect(getPendingRenderAreaHydrationPromise(state, "area-a", ["structures"])).toBe(null);
  });

  it("can clear completed stages while preserving in-flight ownership for dedupe", () => {
    const state = createWorldmapRenderAreaHydrationState();
    const pendingFetch = Promise.resolve(true);

    markRenderAreaHydrationStagesComplete(state, "area-a", ["tileOpt"]);
    registerPendingRenderAreaHydration(state, "area-a", ["structures"], pendingFetch);
    clearCompletedRenderAreaHydrationState(state, "area-a");

    expect(isRenderAreaHydrationComplete(state, "area-a", ["tileOpt"])).toBe(false);
    expect(getPendingRenderAreaHydrationPromise(state, "area-a", ["structures"])).toBe(pendingFetch);
  });

  it("retains recently unpinned completed areas until the retention budget is exceeded", () => {
    expect(
      resolveRecentRenderAreaRetention({
        maxRetainedAreas: 2,
        protectedAreaKeys: new Set(["area-live"]),
        recentlyUnpinnedAreaKeys: ["area-c"],
        retainedAreaKeys: ["area-a", "area-b", "area-live"],
      }),
    ).toEqual({
      areaKeysToClear: ["area-a"],
      areaKeysToRetainTerrainOnly: [],
      nextRetainedAreaKeys: ["area-b", "area-c"],
    });
  });

  it("downgrades retained areas to terrain-only once they leave active subscription coverage", () => {
    expect(
      resolveRecentRenderAreaRetention({
        maxRetainedAreas: 8,
        protectedAreaKeys: new Set(["area-pinned"]),
        recentlyUnpinnedAreaKeys: [],
        retainedAreaKeys: ["area-live", "area-stale", "area-pinned"],
        isAreaCoveredByActiveSubscription: (areaKey) => areaKey === "area-live",
      }),
    ).toEqual({
      areaKeysToClear: [],
      areaKeysToRetainTerrainOnly: ["area-stale"],
      nextRetainedAreaKeys: ["area-live", "area-stale"],
    });
  });

  it("can keep terrain hydration while clearing dynamic stage ownership", () => {
    const state = createWorldmapRenderAreaHydrationState();
    const dynamicFetch = Promise.resolve(true);

    markRenderAreaHydrationStagesComplete(state, "area-a", ACTIVE_STAGES);
    registerPendingRenderAreaHydration(state, "area-a", ["explorerTroops", "structures"], dynamicFetch);
    retainRenderAreaHydrationStages(state, "area-a", ["tileOpt"]);

    expect(isRenderAreaHydrationComplete(state, "area-a", ["tileOpt"])).toBe(true);
    expect(isRenderAreaHydrationComplete(state, "area-a", PREFETCH_STAGES)).toBe(false);
    expect(isRenderAreaHydrationComplete(state, "area-a", ACTIVE_STAGES)).toBe(false);
    expect(getPendingRenderAreaHydrationPromise(state, "area-a", ["explorerTroops", "structures"])).toBe(null);
  });

  it("excludes terrain-only retained areas from late dynamic fetch result ownership", () => {
    expect(
      Array.from(
        resolveFetchResultRetainedAreaKeys({
          pinnedAreaKeys: new Set(["area-pinned"]),
          directionalPrefetchAreaKeys: new Set(["area-prefetch"]),
          retainedAreaKeys: ["area-live", "area-terrain-only"],
          isRetainedAreaCoveredByActiveSubscription: (areaKey) => areaKey === "area-live",
        }),
      ),
    ).toEqual(["area-pinned", "area-prefetch", "area-live"]);
  });
});
