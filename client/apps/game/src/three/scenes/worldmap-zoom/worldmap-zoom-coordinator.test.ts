import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import { CameraView } from "../camera-view";
import { WorldmapZoomCoordinator } from "./worldmap-zoom-coordinator";
import { WORLDMAP_STEP_WHEEL_DELTA } from "./worldmap-zoom-input-normalizer";

describe("WorldmapZoomCoordinator", () => {
  it("lets the latest intent win while a zoom is already in progress", () => {
    const coordinator = new WorldmapZoomCoordinator({
      initialDistance: 20,
      minDistance: 10,
      maxDistance: 40,
    });

    coordinator.applyIntent({
      type: "continuous_delta",
      delta: WORLDMAP_STEP_WHEEL_DELTA,
      anchor: { mode: "world_point", worldPoint: new Vector3(0, 0, 0) },
    });
    coordinator.applyIntent({
      type: "continuous_delta",
      delta: -WORLDMAP_STEP_WHEEL_DELTA * 2,
      anchor: { mode: "world_point", worldPoint: new Vector3(2, 0, 0) },
    });

    expect(coordinator.getSnapshot().targetDistance).toBeLessThan(20);
    expect(coordinator.getSnapshot().anchorWorldPoint?.toArray()).toEqual([2, 0, 0]);
  });

  it("routes snap-to-band through the same target distance pipeline", () => {
    const coordinator = new WorldmapZoomCoordinator({
      initialDistance: 20,
      minDistance: 10,
      maxDistance: 40,
    });

    coordinator.applyIntent({
      type: "snap_to_band",
      band: CameraView.Far,
      anchor: { mode: "screen_center", worldPoint: null },
    });

    expect(coordinator.getSnapshot().targetDistance).toBe(40);
    expect(coordinator.getSnapshot().status).toBe("zooming");
  });

  it("eases to the target distance and emits a stable band after settle", () => {
    const coordinator = new WorldmapZoomCoordinator({
      initialDistance: 20,
      minDistance: 10,
      maxDistance: 40,
    });
    const cameraPosition = new Vector3(0, 10, 17.320508075688775);
    const target = new Vector3(0, 0, 0);

    coordinator.applyIntent({
      type: "snap_to_band",
      band: CameraView.Close,
      anchor: { mode: "world_point", worldPoint: target.clone() },
    });

    for (let frame = 0; frame < 24; frame += 1) {
      const nextFrame = coordinator.tick({
        cameraPosition,
        target,
        deltaMs: 16,
        nowMs: frame * 16,
      });
      cameraPosition.copy(nextFrame.cameraPosition);
      target.copy(nextFrame.target);
    }

    const snapshot = coordinator.getSnapshot();

    expect(snapshot.actualDistance).toBeCloseTo(10, 1);
    expect(snapshot.resolvedBand).toBe(CameraView.Close);
    expect(snapshot.stableBand).toBe(CameraView.Close);
    expect(snapshot.status).toBe("idle");
  });
});
