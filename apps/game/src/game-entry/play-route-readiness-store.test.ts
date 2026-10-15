import { describe, expect, it, vi } from "vitest";

import { onPlayRouteBootStarted, usePlayRouteReadinessStore } from "./play-route-readiness-store";

describe("play-route readiness store", () => {
  it("tracks critical worldmap readiness separately from ambient convergence", () => {
    const token = usePlayRouteReadinessStore.getState().startBoot();
    usePlayRouteReadinessStore.getState().markWorldmapReady(token);

    expect(usePlayRouteReadinessStore.getState()).toMatchObject({
      worldmapConverged: false,
      worldmapReady: true,
    });

    usePlayRouteReadinessStore.getState().markWorldmapConverged(token);

    expect(usePlayRouteReadinessStore.getState()).toMatchObject({
      worldmapConverged: true,
      worldmapReady: true,
    });
  });

  it("rejects readiness and convergence from a superseded boot", () => {
    const earlier = usePlayRouteReadinessStore.getState().startBoot();
    const current = usePlayRouteReadinessStore.getState().startBoot();
    usePlayRouteReadinessStore.getState().markWorldmapReady(earlier);
    usePlayRouteReadinessStore.getState().markWorldmapConverged(earlier);

    expect(usePlayRouteReadinessStore.getState()).toMatchObject({
      bootToken: current,
      worldmapConverged: false,
      worldmapReady: false,
    });
  });

  it("gives every boot a newer token than the last, so a remounted boot never shares one with the boot before", () => {
    const tokens = [1, 2, 3].map(() => usePlayRouteReadinessStore.getState().startBoot());

    expect(tokens[1]).toBe(tokens[0] + 1);
    expect(tokens[2]).toBe(tokens[1] + 1);
  });

  it("calls back on each boot that starts, and on nothing else", () => {
    const answer = vi.fn();
    const stop = onPlayRouteBootStarted(answer);
    const token = usePlayRouteReadinessStore.getState().startBoot();
    usePlayRouteReadinessStore.getState().markWorldmapReady(token);
    usePlayRouteReadinessStore.getState().markHexReady(token);
    expect(answer).toHaveBeenCalledOnce();

    stop();
    usePlayRouteReadinessStore.getState().startBoot();
    expect(answer).toHaveBeenCalledOnce();
  });
});
