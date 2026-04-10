import { describe, expect, it } from "vitest";

import { CameraView } from "./camera-view";
import {
  applyWorldmapWheelIntent,
  createWorldmapZoomControllerState,
  resetWorldmapWheelIntent,
  setWorldmapZoomTargetView,
} from "./worldmap-zoom-controller";

describe("applyWorldmapWheelIntent", () => {
  it("does not step bands until the accumulated wheel gesture crosses the threshold", () => {
    const state = createWorldmapZoomControllerState(CameraView.Medium);

    const result = applyWorldmapWheelIntent(state, {
      currentView: CameraView.Medium,
      normalizedDelta: 40,
      wheelThreshold: 120,
    });

    expect(result.didRequestViewChange).toBe(false);
    expect(result.nextTargetView).toBe(CameraView.Medium);
    expect(result.nextState.wheelAccumulator).toBe(40);
  });

  it("steps one band farther when a full wheel-out gesture crosses the threshold", () => {
    const state = createWorldmapZoomControllerState(CameraView.Medium);

    const result = applyWorldmapWheelIntent(state, {
      currentView: CameraView.Medium,
      normalizedDelta: 120,
      wheelThreshold: 120,
    });

    expect(result.didRequestViewChange).toBe(true);
    expect(result.nextTargetView).toBe(CameraView.Far);
    expect(result.nextState.targetView).toBe(CameraView.Far);
    expect(result.nextState.wheelAccumulator).toBe(0);
  });

  it("resets accumulation when the wheel direction reverses and steps back toward the current band", () => {
    const state = setWorldmapZoomTargetView(createWorldmapZoomControllerState(CameraView.Medium), CameraView.Far);

    const result = applyWorldmapWheelIntent(state, {
      currentView: CameraView.Far,
      normalizedDelta: -120,
      wheelThreshold: 120,
    });

    expect(result.didRequestViewChange).toBe(true);
    expect(result.nextTargetView).toBe(CameraView.Medium);
    expect(result.nextState.targetView).toBe(CameraView.Medium);
  });

  it("clamps at the far band instead of inventing a fourth zoom level", () => {
    const state = createWorldmapZoomControllerState(CameraView.Far);

    const result = applyWorldmapWheelIntent(state, {
      currentView: CameraView.Far,
      normalizedDelta: 240,
      wheelThreshold: 120,
    });

    expect(result.didRequestViewChange).toBe(false);
    expect(result.nextTargetView).toBe(CameraView.Far);
    expect(result.nextState.targetView).toBe(CameraView.Far);
  });

  it("resets the gesture accumulator without losing the current target band", () => {
    const nextState = resetWorldmapWheelIntent({
      targetView: CameraView.Close,
      wheelAccumulator: 32,
      wheelDirection: -1,
    });

    expect(nextState).toEqual({
      targetView: CameraView.Close,
      wheelAccumulator: 0,
      wheelDirection: 0,
    });
  });
});
