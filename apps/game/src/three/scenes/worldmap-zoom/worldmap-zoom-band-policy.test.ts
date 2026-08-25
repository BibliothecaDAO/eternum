import { describe, expect, it } from "vitest";

import { CameraView } from "../camera-view";
import { createWorldmapZoomBandState, updateWorldmapZoomBandState } from "./worldmap-zoom-band-policy";

describe("updateWorldmapZoomBandState", () => {
  it("resolves bands with hysteresis without flapping near the close threshold", () => {
    const state = createWorldmapZoomBandState(CameraView.Close);

    const preservedClose = updateWorldmapZoomBandState(state, {
      actualDistance: 16.9,
      targetDistance: 16.9,
      status: "idle",
      nowMs: 0,
    });
    const promotedMedium = updateWorldmapZoomBandState(state, {
      actualDistance: 17.1,
      targetDistance: 17.1,
      status: "idle",
      nowMs: 0,
    });

    expect(preservedClose.resolvedBand).toBe(CameraView.Close);
    expect(promotedMedium.resolvedBand).toBe(CameraView.Medium);
  });

  it("preserves the stable band while an active zoom crosses and recrosses thresholds", () => {
    let state = createWorldmapZoomBandState(CameraView.Medium);

    state = updateWorldmapZoomBandState(state, {
      actualDistance: 32,
      targetDistance: 40,
      status: "zooming",
      nowMs: 10,
    });
    state = updateWorldmapZoomBandState(state, {
      actualDistance: 28,
      targetDistance: 20,
      status: "zooming",
      nowMs: 20,
    });

    expect(state.resolvedBand).toBe(CameraView.Medium);
    expect(state.stableBand).toBe(CameraView.Medium);
  });

  it("promotes the resolved band to the stable band only after settle frames", () => {
    let state = createWorldmapZoomBandState(CameraView.Medium);

    state = updateWorldmapZoomBandState(state, {
      actualDistance: 36,
      targetDistance: 40,
      status: "zooming",
      nowMs: 10,
    });

    state = updateWorldmapZoomBandState(state, {
      actualDistance: 40,
      targetDistance: 40,
      status: "idle",
      nowMs: 100,
    });
    expect(state.stableBand).toBe(CameraView.Medium);

    state = updateWorldmapZoomBandState(state, {
      actualDistance: 40,
      targetDistance: 40,
      status: "idle",
      nowMs: 116,
    });
    expect(state.stableBand).toBe(CameraView.Far);
  });
});
