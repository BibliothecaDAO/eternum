import { describe, expect, it } from "vitest";

import { createWorldmapZoomRefreshPlannerState, planWorldmapZoomRefresh } from "./worldmap-zoom-refresh-planner";

describe("planWorldmapZoomRefresh", () => {
  it("requests a debounced refresh for pan-only motion", () => {
    const result = planWorldmapZoomRefresh(createWorldmapZoomRefreshPlannerState(), {
      distanceChanged: false,
      shouldForceRefresh: false,
      status: "idle",
    });

    expect(result.immediateLevel).toBe("debounced");
  });

  it("defers heavy refresh work while continuous zoom is still active", () => {
    const result = planWorldmapZoomRefresh(createWorldmapZoomRefreshPlannerState(), {
      distanceChanged: true,
      shouldForceRefresh: false,
      status: "zooming",
    });

    expect(result.immediateLevel).toBe("none");
    expect(result.nextState.pendingLevel).toBe("debounced");
  });

  it("upgrades the pending refresh to forced when a larger zoom threshold is crossed", () => {
    let state = createWorldmapZoomRefreshPlannerState();

    state = planWorldmapZoomRefresh(state, {
      distanceChanged: true,
      shouldForceRefresh: false,
      status: "zooming",
    }).nextState;

    const result = planWorldmapZoomRefresh(state, {
      distanceChanged: true,
      shouldForceRefresh: true,
      status: "zooming",
    });

    expect(result.immediateLevel).toBe("none");
    expect(result.nextState.pendingLevel).toBe("forced");
  });

  it("flushes exactly one pending refresh when zoom settles", () => {
    const zooming = planWorldmapZoomRefresh(createWorldmapZoomRefreshPlannerState(), {
      distanceChanged: true,
      shouldForceRefresh: true,
      status: "zooming",
    });

    const settled = planWorldmapZoomRefresh(zooming.nextState, {
      distanceChanged: true,
      shouldForceRefresh: false,
      status: "idle",
    });

    expect(settled.immediateLevel).toBe("forced");
    expect(settled.nextState.pendingLevel).toBe("none");
  });
});
