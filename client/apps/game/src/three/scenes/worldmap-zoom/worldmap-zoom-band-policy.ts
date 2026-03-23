import { CameraView } from "../camera-view";
import type { WorldmapZoomBand, WorldmapZoomStatus } from "./worldmap-zoom-types";

export interface WorldmapZoomBandState {
  resolvedBand: WorldmapZoomBand;
  stableBand: WorldmapZoomBand;
  settledFrameCount: number;
  lastZoomMovementAtMs: number;
}

interface UpdateWorldmapZoomBandStateInput {
  actualDistance: number;
  targetDistance: number;
  status: WorldmapZoomStatus;
  nowMs: number;
  closeMediumBoundary?: number;
  mediumFarBoundary?: number;
  hysteresisWidth?: number;
  settleDistanceEpsilon?: number;
  settleFrameRequirement?: number;
  settleTimeoutMs?: number;
}

export function createWorldmapZoomBandState(initialBand: WorldmapZoomBand = CameraView.Medium): WorldmapZoomBandState {
  return {
    resolvedBand: initialBand,
    stableBand: initialBand,
    settledFrameCount: 0,
    lastZoomMovementAtMs: 0,
  };
}

export function updateWorldmapZoomBandState(
  state: WorldmapZoomBandState,
  input: UpdateWorldmapZoomBandStateInput,
): WorldmapZoomBandState {
  const resolvedBand = resolveWorldmapZoomBand({
    currentBand: state.resolvedBand,
    distance: input.actualDistance,
    closeMediumBoundary: input.closeMediumBoundary,
    mediumFarBoundary: input.mediumFarBoundary,
    hysteresisWidth: input.hysteresisWidth,
  });
  const settleDistanceEpsilon = input.settleDistanceEpsilon ?? 0.25;
  const settleFrameRequirement = input.settleFrameRequirement ?? 2;
  const settleTimeoutMs = input.settleTimeoutMs ?? 120;
  const isDistanceSettled = Math.abs(input.actualDistance - input.targetDistance) <= settleDistanceEpsilon;
  const isActivelyZooming = input.status === "zooming" && !isDistanceSettled;

  if (isActivelyZooming) {
    return {
      resolvedBand,
      stableBand: state.stableBand,
      settledFrameCount: 0,
      lastZoomMovementAtMs: input.nowMs,
    };
  }

  const hasSettledByTimeout = input.nowMs - state.lastZoomMovementAtMs >= settleTimeoutMs;
  const settledFrameCount = isDistanceSettled || hasSettledByTimeout ? state.settledFrameCount + 1 : 0;

  return {
    resolvedBand,
    stableBand: settledFrameCount >= settleFrameRequirement ? resolvedBand : state.stableBand,
    settledFrameCount,
    lastZoomMovementAtMs: state.lastZoomMovementAtMs,
  };
}

export function resolveWorldmapZoomBand(input: {
  currentBand: WorldmapZoomBand;
  distance: number;
  closeMediumBoundary?: number;
  mediumFarBoundary?: number;
  hysteresisWidth?: number;
}): WorldmapZoomBand {
  const closeMediumBoundary = input.closeMediumBoundary ?? 15;
  const mediumFarBoundary = input.mediumFarBoundary ?? 30;
  const hysteresisHalfWidth = (input.hysteresisWidth ?? 4) / 2;

  switch (input.currentBand) {
    case CameraView.Close:
      return input.distance > closeMediumBoundary + hysteresisHalfWidth ? CameraView.Medium : CameraView.Close;
    case CameraView.Far:
      return input.distance < mediumFarBoundary - hysteresisHalfWidth ? CameraView.Medium : CameraView.Far;
    case CameraView.Medium:
    default:
      if (input.distance < closeMediumBoundary - hysteresisHalfWidth) {
        return CameraView.Close;
      }
      if (input.distance > mediumFarBoundary + hysteresisHalfWidth) {
        return CameraView.Far;
      }
      return CameraView.Medium;
  }
}
