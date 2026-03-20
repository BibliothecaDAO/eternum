import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { CameraView } from "./camera-view";
import {
  applyWorldmapWheelIntent,
  createWorldmapZoomControllerState,
  resetWorldmapWheelIntent,
  resolveWorldmapViewFromDistance,
  setWorldmapZoomTargetView,
} from "./worldmap-zoom-controller";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

describe("applyWorldmapWheelIntent", () => {
  it("allows sustained wheel intent to advance more than one view without waiting for gesture reset", () => {
    const state = createWorldmapZoomControllerState(CameraView.Close);

    const result = applyWorldmapWheelIntent(state, {
      currentView: CameraView.Close,
      normalizedDelta: 25,
      wheelThreshold: 10,
    });

    expect(result.didRequestViewChange).toBe(true);
    expect(result.nextTargetView).toBe(CameraView.Far);
    expect(result.nextState.targetView).toBe(CameraView.Far);
  });

  it("retargets scripted zoom when wheel direction reverses mid-transition", () => {
    const state = setWorldmapZoomTargetView(createWorldmapZoomControllerState(CameraView.Medium), CameraView.Far);

    const result = applyWorldmapWheelIntent(state, {
      currentView: CameraView.Far,
      normalizedDelta: -12,
      wheelThreshold: 10,
    });

    expect(result.didRequestViewChange).toBe(true);
    expect(result.nextTargetView).toBe(CameraView.Medium);
  });

  it("resets the gesture accumulator without losing the current target view", () => {
    const nextState = resetWorldmapWheelIntent({
      targetView: CameraView.Far,
      wheelAccumulator: 7,
      wheelDirection: 1,
    });

    expect(nextState).toEqual({
      targetView: CameraView.Far,
      wheelAccumulator: 0,
      wheelDirection: 0,
    });
  });
});

describe("resolveWorldmapViewFromDistance", () => {
  it("does not flap near the close-medium boundary", () => {
    expect(
      resolveWorldmapViewFromDistance({
        currentView: CameraView.Close,
        distance: 16.9,
      }),
    ).toBe(CameraView.Close);

    expect(
      resolveWorldmapViewFromDistance({
        currentView: CameraView.Close,
        distance: 17.1,
      }),
    ).toBe(CameraView.Medium);

    expect(
      resolveWorldmapViewFromDistance({
        currentView: CameraView.Medium,
        distance: 13.1,
      }),
    ).toBe(CameraView.Medium);

    expect(
      resolveWorldmapViewFromDistance({
        currentView: CameraView.Medium,
        distance: 12.9,
      }),
    ).toBe(CameraView.Close);
  });
});

describe("worldmap zoom controller wiring", () => {
  it("routes wheel handling through the zoom controller instead of the one-step gesture lock", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/applyWorldmapWheelIntent\(/);
    expect(source).toMatch(/setWorldmapZoomTargetView\(/);
    expect(source).not.toMatch(/wheelStepsThisGesture/);
  });
});
