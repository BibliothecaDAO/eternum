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
  private directManipulation = false;

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
    if (this.directManipulation) return this.getSnapshot();
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
    this.directManipulation = false;
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
    const nextDistance = this.directManipulation
      ? input.actualDistance
      : resolveNextDistance({
          actualDistance: input.actualDistance,
          targetDistance: this.state.targetDistance,
          deltaMs: input.deltaMs,
          easingPerSecond: this.easingPerSecond,
        });
    const didMove = Math.abs(nextDistance - input.actualDistance) > 0.0001;
    const status = this.resolveZoomStatus(nextDistance);

    this.bandState = updateWorldmapZoomBandState(this.bandState, {
      actualDistance: nextDistance,
      targetDistance: this.state.targetDistance,
      status,
      nowMs: input.nowMs,
      isDirectManipulation: this.directManipulation,
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

  /** Touch takes the visible distance immediately, cancelling any pending wheel easing. */
  public beginDirectManipulation(distance: number): WorldmapCameraSnapshot {
    this.directManipulation = true;
    this.state = {
      ...this.state,
      actualDistance: distance,
      targetDistance: distance,
      status: "idle",
      activeGestureId: null,
    };
    return this.getSnapshot();
  }

  public applyDirectDistance(distance: number): WorldmapCameraSnapshot {
    const nextDistance = clamp(distance, this.minDistance, this.maxDistance);
    if (Math.abs(nextDistance - this.state.actualDistance) <= 0.0001) return this.getSnapshot();
    this.state = {
      ...this.state,
      actualDistance: nextDistance,
      targetDistance: nextDistance,
      status: "zooming",
      activeGestureId: this.state.activeGestureId ?? this.nextGestureId++,
    };
    return this.getSnapshot();
  }

  public endDirectManipulation(): void {
    // The next frame settles the band and publishes the ordinary zoom completion.
    this.directManipulation = false;
  }

  private resolveZoomStatus(distance: number): WorldmapZoomState["status"] {
    if (this.directManipulation) return this.state.status;
    return Math.abs(this.state.targetDistance - distance) <= 0.05 ? "idle" : "zooming";
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
