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
});
