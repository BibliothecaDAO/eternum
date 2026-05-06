import { CameraView } from "../camera-view";
import { resolveWorldmapCameraViewProfile } from "../worldmap-camera-view-profile";
import { createWorldmapZoomBandState, updateWorldmapZoomBandState } from "./worldmap-zoom-band-policy";
import type { WorldmapCameraSnapshot, WorldmapZoomState, WorldmapZoomTickResult } from "./worldmap-zoom-types";
import type { WorldmapZoomBandState } from "./worldmap-zoom-band-policy";

interface WorldmapZoomCoordinatorOptions {
  initialDistance: number;
  minDistance: number;
  maxDistance: number;
}

export class WorldmapZoomCoordinator {
  private readonly minDistance: number;
  private readonly maxDistance: number;
  private bandState: WorldmapZoomBandState;
  private state: WorldmapZoomState;

  constructor(options: WorldmapZoomCoordinatorOptions) {
    const initialBand = resolveDistanceBand(options.initialDistance);
    this.minDistance = options.minDistance;
    this.maxDistance = options.maxDistance;
    this.bandState = createWorldmapZoomBandState(initialBand);
    this.state = {
      actualDistance: options.initialDistance,
      targetDistance: options.initialDistance,
      minDistance: options.minDistance,
      maxDistance: options.maxDistance,
      status: "idle",
      resolvedBand: initialBand,
      stableBand: initialBand,
    };
  }

  public requestBand(band: CameraView): WorldmapCameraSnapshot {
    const nextTargetDistance = clamp(resolveBandDistance(band), this.minDistance, this.maxDistance);
    const hasTargetChanged = Math.abs(nextTargetDistance - this.state.targetDistance) > 0.001;

    if (!hasTargetChanged) {
      return this.getSnapshot();
    }

    this.state = {
      ...this.state,
      targetDistance: nextTargetDistance,
      status: "zooming",
      resolvedBand: band,
    };

    return this.getSnapshot();
  }

  public syncToBand(band: CameraView, nowMs: number = 0): WorldmapCameraSnapshot {
    return this.syncToDistance(resolveBandDistance(band), nowMs);
  }

  public syncToDistance(distance: number, nowMs: number = 0): WorldmapCameraSnapshot {
    const nextDistance = clamp(distance, this.minDistance, this.maxDistance);
    const nextBand = resolveDistanceBand(nextDistance);

    this.bandState = {
      resolvedBand: nextBand,
      stableBand: nextBand,
      settledFrameCount: 0,
      lastZoomMovementAtMs: nowMs,
    };
    this.state = {
      ...this.state,
      actualDistance: nextDistance,
      targetDistance: nextDistance,
      status: "idle",
      resolvedBand: nextBand,
      stableBand: nextBand,
    };

    return this.getSnapshot();
  }

  public tick(input: { actualDistance: number; nowMs: number }): WorldmapZoomTickResult {
    const actualDistance = Number.isFinite(input.actualDistance) ? input.actualDistance : this.state.actualDistance;
    const status = Math.abs(this.state.targetDistance - actualDistance) <= 0.05 ? "idle" : "zooming";

    this.bandState = updateWorldmapZoomBandState(this.bandState, {
      actualDistance,
      targetDistance: this.state.targetDistance,
      status,
      nowMs: input.nowMs,
    });
    this.state = {
      ...this.state,
      actualDistance,
      status,
      resolvedBand: this.bandState.resolvedBand,
      stableBand: this.bandState.stableBand,
    };

    return {
      snapshot: this.getSnapshot(),
    };
  }

  public getSnapshot(): WorldmapCameraSnapshot {
    return {
      ...this.state,
    };
  }
}

function resolveDistanceBand(distance: number): CameraView {
  if (distance <= 15) {
    return CameraView.Close;
  }
  if (distance >= 30) {
    return CameraView.Far;
  }
  return CameraView.Medium;
}

function resolveBandDistance(band: CameraView): number {
  return resolveWorldmapCameraViewProfile(band).distance;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
