import { beforeEach, describe, expect, it } from "vitest";

import { usePlayRouteReadinessStore } from "./play-route-readiness-store";

describe("play-route readiness store", () => {
  beforeEach(() => {
    usePlayRouteReadinessStore.getState().reset(1);
  });

  it("tracks critical worldmap readiness separately from ambient convergence", () => {
    usePlayRouteReadinessStore.getState().markWorldmapReady(1);

    expect(usePlayRouteReadinessStore.getState()).toMatchObject({
      worldmapConverged: false,
      worldmapReady: true,
    });

    usePlayRouteReadinessStore.getState().markWorldmapConverged(1);

    expect(usePlayRouteReadinessStore.getState()).toMatchObject({
      worldmapConverged: true,
      worldmapReady: true,
    });
  });

  it("rejects readiness and convergence from a superseded boot token", () => {
    usePlayRouteReadinessStore.getState().reset(2);
    usePlayRouteReadinessStore.getState().markWorldmapReady(1);
    usePlayRouteReadinessStore.getState().markWorldmapConverged(1);

    expect(usePlayRouteReadinessStore.getState()).toMatchObject({
      bootToken: 2,
      worldmapConverged: false,
      worldmapReady: false,
    });
  });
});
