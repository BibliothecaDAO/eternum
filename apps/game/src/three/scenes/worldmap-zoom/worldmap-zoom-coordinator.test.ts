import { describe, expect, it } from "vitest";

import { CameraView } from "../camera-view";
import { WorldmapZoomCoordinator } from "./worldmap-zoom-coordinator";

const WHEEL_NOTCH_DELTA = 120;

function createCoordinator(initialDistance = 20) {
  return new WorldmapZoomCoordinator({ initialDistance, minDistance: 10, maxDistance: 80 });
}

function settle(coordinator: WorldmapZoomCoordinator, startDistance: number) {
  let actualDistance = startDistance;
  let nowMs = 0;
  for (let frame = 0; frame < 120; frame += 1) {
    nowMs += 16;
    actualDistance = coordinator.tick({ actualDistance, deltaMs: 16, nowMs }).snapshot.actualDistance;
  }
  return coordinator.getSnapshot();
}

describe("WorldmapZoomCoordinator", () => {
  it("cancels wheel easing on touch, holds bands through direct zoom, and settles after release", () => {
    const coordinator = createCoordinator();
    coordinator.applyIntent({ type: "continuous_delta", delta: 120 });
    coordinator.beginDirectManipulation(20);
    expect(coordinator.tick({ actualDistance: 20, deltaMs: 16, nowMs: 16 }).didMove).toBe(false);
    coordinator.applyIntent({ type: "continuous_delta", delta: 120 });
    expect(coordinator.getSnapshot().targetDistance).toBe(20);

    coordinator.applyDirectDistance(12);
    for (let frame = 0; frame < 20; frame++) {
      const result = coordinator.tick({ actualDistance: 12, deltaMs: 16, nowMs: 32 + frame * 16 });
      expect(result.didMove).toBe(false);
      expect(result.snapshot).toMatchObject({
        status: "zooming",
        resolvedBand: CameraView.Close,
        stableBand: CameraView.Medium,
      });
    }
    coordinator.endDirectManipulation();
    coordinator.tick({ actualDistance: 12, deltaMs: 16, nowMs: 400 });
    const settled = coordinator.tick({ actualDistance: 12, deltaMs: 16, nowMs: 416 });
    expect(settled.snapshot).toMatchObject({ status: "idle", stableBand: CameraView.Close, targetDistance: 12 });
    coordinator.applyIntent({ type: "continuous_delta", delta: 120 });
    expect(coordinator.getSnapshot().targetDistance).toBeGreaterThan(12);
  });

  it("lets the latest wheel delta win while a zoom is already in progress", () => {
    const coordinator = createCoordinator();

    coordinator.applyIntent({ type: "continuous_delta", delta: WHEEL_NOTCH_DELTA });
    const afterZoomOut = coordinator.getSnapshot().targetDistance;
    coordinator.applyIntent({ type: "continuous_delta", delta: -WHEEL_NOTCH_DELTA * 2 });

    expect(afterZoomOut).toBeGreaterThan(20);
    expect(coordinator.getSnapshot().targetDistance).toBeLessThan(20);
    expect(coordinator.getSnapshot().status).toBe("zooming");
  });

  it("clamps snap and delta targets to the zoom range without starting a gesture at the bound", () => {
    const coordinator = createCoordinator();

    coordinator.applyIntent({ type: "snap_to_distance", distance: 500 });
    expect(coordinator.getSnapshot().targetDistance).toBe(80);

    const gestureBefore = coordinator.getSnapshot().activeGestureId;
    coordinator.applyIntent({ type: "continuous_delta", delta: WHEEL_NOTCH_DELTA });
    expect(coordinator.getSnapshot().activeGestureId).toBe(gestureBefore);
  });

  it("eases to the target distance and emits a stable band after settling", () => {
    const coordinator = createCoordinator();

    coordinator.applyIntent({ type: "snap_to_distance", distance: 12 });
    const firstFrame = coordinator.tick({ actualDistance: 20, deltaMs: 16, nowMs: 16 });
    expect(firstFrame.didMove).toBe(true);
    expect(firstFrame.snapshot.actualDistance).toBeLessThan(20);
    expect(firstFrame.snapshot.actualDistance).toBeGreaterThan(12);

    const settled = settle(coordinator, firstFrame.snapshot.actualDistance);
    expect(settled.actualDistance).toBe(12);
    expect(settled.status).toBe("idle");
    expect(settled.resolvedBand).toBe(CameraView.Close);
    expect(settled.stableBand).toBe(CameraView.Close);
  });

  it("resolves the far band beyond the medium/far boundary", () => {
    const coordinator = createCoordinator();

    coordinator.applyIntent({ type: "snap_to_distance", distance: 70 });
    const settled = settle(coordinator, 20);

    expect(settled.stableBand).toBe(CameraView.Far);
  });

  it("can sync the zoom state to a distance without leaving a transition behind", () => {
    const coordinator = createCoordinator(10);

    coordinator.syncToDistance(20, 250);

    expect(coordinator.getSnapshot()).toMatchObject({
      actualDistance: 20,
      targetDistance: 20,
      resolvedBand: CameraView.Medium,
      stableBand: CameraView.Medium,
      status: "idle",
    });
  });
});
