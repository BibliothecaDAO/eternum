import { describe, expect, it } from "vitest";

import { CameraView } from "../camera-view";
import { WorldmapZoomCoordinator } from "./worldmap-zoom-coordinator";

describe("WorldmapZoomCoordinator", () => {
  it("lets the latest band request win while a zoom is already in progress", () => {
    const coordinator = new WorldmapZoomCoordinator({
      initialDistance: 20,
      minDistance: 10,
      maxDistance: 40,
    });

    coordinator.requestBand(CameraView.Close);
    coordinator.requestBand(CameraView.Far);

    expect(coordinator.getSnapshot()).toMatchObject({
      targetDistance: 40,
      resolvedBand: CameraView.Far,
      stableBand: CameraView.Medium,
      status: "zooming",
    });
  });

  it("routes band requests through fixed profile distances", () => {
    const coordinator = new WorldmapZoomCoordinator({
      initialDistance: 20,
      minDistance: 10,
      maxDistance: 40,
    });

    coordinator.requestBand(CameraView.Far);

    expect(coordinator.getSnapshot().targetDistance).toBe(40);
    expect(coordinator.getSnapshot().status).toBe("zooming");
  });

  it("emits a stable band after the animated camera reaches the target distance", () => {
    const coordinator = new WorldmapZoomCoordinator({
      initialDistance: 20,
      minDistance: 10,
      maxDistance: 40,
    });

    coordinator.requestBand(CameraView.Close);

    coordinator.tick({ actualDistance: 14, nowMs: 16 });
    expect(coordinator.getSnapshot().stableBand).toBe(CameraView.Medium);

    coordinator.tick({ actualDistance: 10, nowMs: 160 });
    coordinator.tick({ actualDistance: 10, nowMs: 176 });

    const snapshot = coordinator.getSnapshot();

    expect(snapshot.actualDistance).toBe(10);
    expect(snapshot.resolvedBand).toBe(CameraView.Close);
    expect(snapshot.stableBand).toBe(CameraView.Close);
    expect(snapshot.status).toBe("idle");
  });

  it("can sync the zoom state to a band without leaving an initial close-up transition behind", () => {
    const coordinator = new WorldmapZoomCoordinator({
      initialDistance: 10,
      minDistance: 10,
      maxDistance: 40,
    });

    coordinator.syncToBand(CameraView.Medium, 250);

    expect(coordinator.getSnapshot()).toMatchObject({
      actualDistance: 20,
      targetDistance: 20,
      resolvedBand: CameraView.Medium,
      stableBand: CameraView.Medium,
      status: "idle",
    });
  });
});
