import { describe, expect, it } from "vitest";

import { CameraView } from "./camera-view";
import { createWorldmapZoomRefreshPlannerState } from "./worldmap-zoom/worldmap-zoom-refresh-planner";
import { resolveWorldmapControlsChangeRefreshDecision } from "./worldmap-controls-change-refresh-policy";

describe("resolveWorldmapControlsChangeRefreshDecision", () => {
  it("keeps pan-only controls changes on coalesced traversal refreshes", () => {
    const result = resolveWorldmapControlsChangeRefreshDecision({
      previousCameraDistance: 20,
      nextCameraDistance: 20,
      zoomSnapshot: {
        stableBand: CameraView.Medium,
        isSettled: true,
      },
      lastZoomRefreshStableBand: CameraView.Medium,
      zoomRefreshPlannerState: createWorldmapZoomRefreshPlannerState(),
    });

    expect(result.shouldRequestRefresh).toBe(true);
    expect(result.refreshLevel).toBe("debounced");
    expect(result.scheduleMode).toBe("coalesce_earliest");
    expect(result.nextZoomRefreshPlannerState.pendingLevel).toBe("none");
    expect(result.nextLastZoomRefreshStableBand).toBe(CameraView.Medium);
  });

  it("defers zoom-driven refreshes until the zoom snapshot settles", () => {
    const result = resolveWorldmapControlsChangeRefreshDecision({
      previousCameraDistance: 20,
      nextCameraDistance: 24,
      zoomSnapshot: {
        stableBand: CameraView.Medium,
        isSettled: false,
      },
      lastZoomRefreshStableBand: CameraView.Medium,
      zoomRefreshPlannerState: createWorldmapZoomRefreshPlannerState(),
    });

    expect(result.shouldRequestRefresh).toBe(false);
    expect(result.refreshLevel).toBe("none");
    expect(result.scheduleMode).toBe("coalesce_earliest");
    expect(result.nextZoomRefreshPlannerState.pendingLevel).toBe("debounced");
    expect(result.nextLastZoomRefreshStableBand).toBe(CameraView.Medium);
  });

  it("emits one trailing debounced refresh when a same-band zoom settles", () => {
    const zooming = resolveWorldmapControlsChangeRefreshDecision({
      previousCameraDistance: 20,
      nextCameraDistance: 24,
      zoomSnapshot: {
        stableBand: CameraView.Medium,
        isSettled: false,
      },
      lastZoomRefreshStableBand: CameraView.Medium,
      zoomRefreshPlannerState: createWorldmapZoomRefreshPlannerState(),
    });

    const settled = resolveWorldmapControlsChangeRefreshDecision({
      previousCameraDistance: 24,
      nextCameraDistance: 24.2,
      zoomSnapshot: {
        stableBand: CameraView.Medium,
        isSettled: true,
      },
      lastZoomRefreshStableBand: zooming.nextLastZoomRefreshStableBand,
      zoomRefreshPlannerState: zooming.nextZoomRefreshPlannerState,
    });

    expect(settled.shouldRequestRefresh).toBe(true);
    expect(settled.refreshLevel).toBe("debounced");
    expect(settled.scheduleMode).toBe("debounce_trailing");
    expect(settled.nextZoomRefreshPlannerState.pendingLevel).toBe("none");
    expect(settled.nextLastZoomRefreshStableBand).toBe(CameraView.Medium);
  });

  it("collapses repeated unsettled zoom frames into one forced refresh on settle when the stable band changes", () => {
    const firstZoomFrame = resolveWorldmapControlsChangeRefreshDecision({
      previousCameraDistance: 20,
      nextCameraDistance: 28,
      zoomSnapshot: {
        stableBand: CameraView.Medium,
        isSettled: false,
      },
      lastZoomRefreshStableBand: CameraView.Medium,
      zoomRefreshPlannerState: createWorldmapZoomRefreshPlannerState(),
    });

    const secondZoomFrame = resolveWorldmapControlsChangeRefreshDecision({
      previousCameraDistance: 28,
      nextCameraDistance: 34,
      zoomSnapshot: {
        stableBand: CameraView.Far,
        isSettled: false,
      },
      lastZoomRefreshStableBand: firstZoomFrame.nextLastZoomRefreshStableBand,
      zoomRefreshPlannerState: firstZoomFrame.nextZoomRefreshPlannerState,
    });

    const settled = resolveWorldmapControlsChangeRefreshDecision({
      previousCameraDistance: 34,
      nextCameraDistance: 34,
      zoomSnapshot: {
        stableBand: CameraView.Far,
        isSettled: true,
      },
      lastZoomRefreshStableBand: secondZoomFrame.nextLastZoomRefreshStableBand,
      zoomRefreshPlannerState: secondZoomFrame.nextZoomRefreshPlannerState,
    });

    expect(firstZoomFrame.shouldRequestRefresh).toBe(false);
    expect(secondZoomFrame.shouldRequestRefresh).toBe(false);
    expect(secondZoomFrame.nextZoomRefreshPlannerState.pendingLevel).toBe("forced");
    expect(settled.shouldRequestRefresh).toBe(true);
    expect(settled.refreshLevel).toBe("forced");
    expect(settled.scheduleMode).toBe("debounce_trailing");
    expect(settled.nextZoomRefreshPlannerState.pendingLevel).toBe("none");
    expect(settled.nextLastZoomRefreshStableBand).toBe(CameraView.Far);
  });
});
