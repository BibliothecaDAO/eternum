import { CameraView } from "../camera-view";
import { solveWorldmapZoomAnchor } from "./worldmap-zoom-anchor-solver";
import { createWorldmapZoomBandState, updateWorldmapZoomBandState } from "./worldmap-zoom-band-policy";
import { applyContinuousWorldmapZoomDelta } from "./worldmap-zoom-input-normalizer";
import type {
  WorldmapCameraSnapshot,
  WorldmapZoomState,
  WorldmapZoomTickResult,
  ZoomIntent,
} from "./worldmap-zoom-types";
import type { WorldmapZoomBandState } from "./worldmap-zoom-band-policy";
import { Vector3 } from "three";

interface WorldmapZoomCoordinatorOptions {
  initialDistance: number;
  minDistance: number;
  maxDistance: number;
  easingPerSecond?: number;
}

export class WorldmapZoomCoordinator {
  private readonly minDistance: number;
  private readonly maxDistance: number;
  private readonly easingPerSecond: number;
  private nextGestureId = 1;
  private bandState: WorldmapZoomBandState;
  private state: WorldmapZoomState;

  constructor(options: WorldmapZoomCoordinatorOptions) {
    const initialBand = resolveDistanceBand(options.initialDistance);
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
      anchorMode: "screen_center",
      anchorWorldPoint: null,
      resolvedBand: initialBand,
      stableBand: initialBand,
    };
  }

  public applyIntent(intent: ZoomIntent): WorldmapCameraSnapshot {
    const nextTargetDistance = resolveTargetDistanceFromIntent(intent, this.state, this.minDistance, this.maxDistance);
    const hasTargetChanged = Math.abs(nextTargetDistance - this.state.targetDistance) > 0.001;

    this.state = {
      ...this.state,
      targetDistance: nextTargetDistance,
      status: hasTargetChanged ? "zooming" : this.state.status,
      activeGestureId: hasTargetChanged ? this.nextGestureId++ : this.state.activeGestureId,
      anchorMode: intent.anchor.mode,
      anchorWorldPoint: intent.anchor.worldPoint?.clone() ?? null,
    };

    return this.getSnapshot();
  }

  public tick(input: {
    cameraPosition: Vector3;
    target: Vector3;
    deltaMs: number;
    nowMs: number;
  }): WorldmapZoomTickResult {
    const actualDistance = input.cameraPosition.distanceTo(input.target);
    const nextDistance = resolveNextDistance({
      actualDistance,
      targetDistance: this.state.targetDistance,
      deltaMs: input.deltaMs,
      easingPerSecond: this.easingPerSecond,
    });
    const solveResult = solveWorldmapZoomAnchor({
      cameraPosition: input.cameraPosition,
      target: input.target,
      anchorWorldPoint: this.state.anchorWorldPoint,
      nextDistance,
    });
    const didMove = Math.abs(nextDistance - actualDistance) > 0.0001;
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

    return {
      cameraPosition: solveResult.cameraPosition,
      target: solveResult.target,
      snapshot: this.getSnapshot(),
      didMove,
    };
  }

  public getSnapshot(): WorldmapCameraSnapshot {
    return {
      ...this.state,
      anchorWorldPoint: this.state.anchorWorldPoint?.clone() ?? null,
    };
  }
}

function resolveTargetDistanceFromIntent(
  intent: ZoomIntent,
  state: WorldmapZoomState,
  minDistance: number,
  maxDistance: number,
): number {
  switch (intent.type) {
    case "continuous_delta":
      return applyContinuousWorldmapZoomDelta({
        currentDistance: state.targetDistance,
        normalizedDelta: intent.delta,
        minDistance,
        maxDistance,
      });
    case "snap_to_distance":
      return clamp(intent.distance, minDistance, maxDistance);
    case "snap_to_band":
      return resolveBandDistance(intent.band);
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
  switch (band) {
    case CameraView.Close:
      return 10;
    case CameraView.Far:
      return 40;
    case CameraView.Medium:
    default:
      return 20;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
