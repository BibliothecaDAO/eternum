import { describe, expect, it } from "vitest";

import { createWorldmapZoomRefreshPlannerState, planWorldmapZoomRefresh } from "./worldmap-zoom-refresh-planner";

describe("planWorldmapZoomRefresh", () => {
  it("ignores non-zoom controls changes", () => {
    const result = planWorldmapZoomRefresh(createWorldmapZoomRefreshPlannerState(), {
      zoomDistanceChanged: false,
      zoomSettled: true,
      stableBandChanged: false,
    });

    expect(result.immediateLevel).toBe("none");
  });

  it("defers heavy refresh work while continuous zoom is still unsettled", () => {
    const result = planWorldmapZoomRefresh(createWorldmapZoomRefreshPlannerState(), {
      zoomDistanceChanged: true,
      zoomSettled: false,
      stableBandChanged: false,
    });

    expect(result.immediateLevel).toBe("none");
    expect(result.nextState.pendingLevel).toBe("debounced");
  });

  it("upgrades the pending refresh to forced when the stable band changes before settle", () => {
    let state = createWorldmapZoomRefreshPlannerState();

    state = planWorldmapZoomRefresh(state, {
      zoomDistanceChanged: true,
      zoomSettled: false,
      stableBandChanged: false,
    }).nextState;

    const result = planWorldmapZoomRefresh(state, {
      zoomDistanceChanged: true,
      zoomSettled: false,
      stableBandChanged: true,
    });

    expect(result.immediateLevel).toBe("none");
    expect(result.nextState.pendingLevel).toBe("forced");
  });

  it("flushes exactly one debounced refresh when a same-band zoom settles", () => {
    const zooming = planWorldmapZoomRefresh(createWorldmapZoomRefreshPlannerState(), {
      zoomDistanceChanged: true,
      zoomSettled: false,
      stableBandChanged: false,
    });

    const settled = planWorldmapZoomRefresh(zooming.nextState, {
      zoomDistanceChanged: true,
      zoomSettled: true,
      stableBandChanged: false,
    });

    expect(settled.immediateLevel).toBe("debounced");
    expect(settled.nextState.pendingLevel).toBe("none");
  });

  it("flushes exactly one forced refresh when a stable-band-changing zoom settles", () => {
    const zooming = planWorldmapZoomRefresh(createWorldmapZoomRefreshPlannerState(), {
      zoomDistanceChanged: true,
      zoomSettled: false,
      stableBandChanged: true,
    });

    const settled = planWorldmapZoomRefresh(zooming.nextState, {
      zoomDistanceChanged: true,
      zoomSettled: true,
      stableBandChanged: true,
    });

    expect(settled.immediateLevel).toBe("forced");
    expect(settled.nextState.pendingLevel).toBe("none");
  });
});
