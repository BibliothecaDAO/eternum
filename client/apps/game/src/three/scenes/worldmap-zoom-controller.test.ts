import { describe, expect, it } from "vitest";

import { CameraView } from "./camera-view";
import {
  applyWorldmapWheelIntent,
  createWorldmapZoomControllerState,
  resetWorldmapWheelIntent,
  resolveWorldmapWheelGestureTimeoutMs,
  resolveWorldmapWheelThreshold,
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

describe("worldmap zoom controller thresholds", () => {
  it("uses a lower step threshold for trackpad gestures than for wheel gestures", () => {
    expect(resolveWorldmapWheelThreshold("trackpad", 120)).toBeLessThan(resolveWorldmapWheelThreshold("wheel", 120));
    expect(resolveWorldmapWheelThreshold("wheel", 120)).toBe(120);
  });

  it("keeps trackpad gesture accumulation alive longer than wheel accumulation", () => {
    expect(resolveWorldmapWheelGestureTimeoutMs("trackpad", 50)).toBeGreaterThan(
      resolveWorldmapWheelGestureTimeoutMs("wheel", 50),
    );
    expect(resolveWorldmapWheelGestureTimeoutMs("wheel", 50)).toBe(50);
  });
});
