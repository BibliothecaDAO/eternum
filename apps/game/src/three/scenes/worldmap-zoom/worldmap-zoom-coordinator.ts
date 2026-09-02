import {
  createWorldmapZoomBandState,
  resolveWorldmapZoomBand,
  updateWorldmapZoomBandState,
} from "./worldmap-zoom-band-policy";
import { applyContinuousWorldmapZoomDelta } from "./worldmap-zoom-input-normalizer";
import type {
  WorldmapCameraSnapshot,
  WorldmapZoomBand,
  WorldmapZoomState,
  WorldmapZoomTickResult,
  ZoomIntent,
} from "./worldmap-zoom-types";
import type { WorldmapZoomBandState } from "./worldmap-zoom-band-policy";
import { CameraView } from "../camera-view";

interface WorldmapZoomCoordinatorOptions {
  initialDistance: number;
  minDistance: number;
  maxDistance: number;
  easingPerSecond?: number;
}

/**
 * Owns the worldmap's target camera distance: intents move the target, `tick`
 * eases the actual distance toward it and derives the content band from it.
 */
export class WorldmapZoomCoordinator {
  private readonly minDistance: number;
  private readonly maxDistance: number;
  private readonly easingPerSecond: number;
  private nextGestureId = 1;
  private bandState: WorldmapZoomBandState;
  private state: WorldmapZoomState;

  constructor(options: WorldmapZoomCoordinatorOptions) {
    const initialBand = resolveBandForDistance(options.initialDistance);
    this.minDistance = options.minDistance;
    this.maxDistance = options.maxDistance;
    this.easingPerSecond = options.easingPerSecond ?? 16;
    this.bandState = createWorldmapZoomBandState(initialBand);
    this.state = {
      actualDistance: options.initialDistance,
      targetDistance: options.initialDistance,
      minDistance: options.minDistance,
      maxDistance: options.maxDistance,
      status: "idle",
      activeGestureId: null,
      resolvedBand: initialBand,
      stableBand: initialBand,
    };
  }

  public applyIntent(intent: ZoomIntent): WorldmapCameraSnapshot {
    const nextTargetDistance = this.resolveTargetDistance(intent);
    const hasTargetChanged = Math.abs(nextTargetDistance - this.state.targetDistance) > 0.001;

    if (!hasTargetChanged) {
      return this.getSnapshot();
    }

    this.state = {
      ...this.state,
      targetDistance: nextTargetDistance,
      status: "zooming",
      activeGestureId: this.nextGestureId++,
    };

    return this.getSnapshot();
  }

  public syncToDistance(distance: number, nowMs: number = 0): WorldmapCameraSnapshot {
    const nextDistance = clamp(distance, this.minDistance, this.maxDistance);
    const nextBand = resolveBandForDistance(nextDistance);

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
      activeGestureId: null,
      resolvedBand: nextBand,
      stableBand: nextBand,
    };

    return this.getSnapshot();
  }

  public tick(input: { actualDistance: number; deltaMs: number; nowMs: number }): WorldmapZoomTickResult {
    const nextDistance = resolveNextDistance({
      actualDistance: input.actualDistance,
      targetDistance: this.state.targetDistance,
      deltaMs: input.deltaMs,
      easingPerSecond: this.easingPerSecond,
    });
    const didMove = Math.abs(nextDistance - input.actualDistance) > 0.0001;
    const status = Math.abs(this.state.targetDistance - nextDistance) <= 0.05 ? "idle" : "zooming";

    this.bandState = updateWorldmapZoomBandState(this.bandState, {
      actualDistance: nextDistance,
      targetDistance: this.state.targetDistance,
      status,
      nowMs: input.nowMs,
    });
    this.state = {
      ...this.state,
      actualDistance: nextDistance,
      status,
      activeGestureId: status === "idle" ? null : this.state.activeGestureId,
      resolvedBand: this.bandState.resolvedBand,
      stableBand: this.bandState.stableBand,
    };

    return { snapshot: this.getSnapshot(), didMove };
  }

  public getSnapshot(): WorldmapCameraSnapshot {
    return { ...this.state };
  }

  private resolveTargetDistance(intent: ZoomIntent): number {
    switch (intent.type) {
      case "continuous_delta":
        return applyContinuousWorldmapZoomDelta({
          currentDistance: this.state.targetDistance,
          normalizedDelta: intent.delta,
          minDistance: this.minDistance,
          maxDistance: this.maxDistance,
        });
      case "snap_to_distance":
        return clamp(intent.distance, this.minDistance, this.maxDistance);
    }
  }
}

function resolveNextDistance(input: {
  actualDistance: number;
  targetDistance: number;
  deltaMs: number;
  easingPerSecond: number;
}): number {
  if (Math.abs(input.targetDistance - input.actualDistance) <= 0.05) {
    return input.targetDistance;
  }

  const alpha = 1 - Math.exp((-input.easingPerSecond * input.deltaMs) / 1000);
  const nextDistance = input.actualDistance + (input.targetDistance - input.actualDistance) * alpha;

  return Math.abs(input.targetDistance - nextDistance) <= 0.05 ? input.targetDistance : nextDistance;
}

function resolveBandForDistance(distance: number): WorldmapZoomBand {
  return resolveWorldmapZoomBand({ currentBand: CameraView.Medium, distance });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
