import { CameraView } from "./camera-view";

export interface WorldmapZoomControllerState {
  targetView: CameraView;
  wheelAccumulator: number;
  wheelDirection: -1 | 0 | 1;
}

interface ApplyWorldmapWheelIntentInput {
  currentView: CameraView;
  normalizedDelta: number;
  wheelThreshold: number;
}

interface ResolveWorldmapViewFromDistanceInput {
  currentView: CameraView;
  distance: number;
  closeMediumBoundary?: number;
  mediumFarBoundary?: number;
  hysteresisWidth?: number;
}

export interface ApplyWorldmapWheelIntentResult {
  didRequestViewChange: boolean;
  nextTargetView: CameraView;
  nextState: WorldmapZoomControllerState;
}

function stepWorldmapCameraView(view: CameraView, zoomOut: boolean): CameraView {
  if (zoomOut) {
    return Math.min(CameraView.Far, view + 1) as CameraView;
  }

  return Math.max(CameraView.Close, view - 1) as CameraView;
}

export function createWorldmapZoomControllerState(
  targetView: CameraView = CameraView.Medium,
): WorldmapZoomControllerState {
  return {
    targetView,
    wheelAccumulator: 0,
    wheelDirection: 0,
  };
}

export function setWorldmapZoomTargetView(
  state: WorldmapZoomControllerState,
  targetView: CameraView,
): WorldmapZoomControllerState {
  return {
    targetView,
    wheelAccumulator: 0,
    wheelDirection: 0,
  };
}

export function resetWorldmapWheelIntent(state: WorldmapZoomControllerState): WorldmapZoomControllerState {
  return {
    targetView: state.targetView,
    wheelAccumulator: 0,
    wheelDirection: 0,
  };
}

export function applyWorldmapWheelIntent(
  state: WorldmapZoomControllerState,
  input: ApplyWorldmapWheelIntentInput,
): ApplyWorldmapWheelIntentResult {
  const direction = Math.sign(input.normalizedDelta) as -1 | 0 | 1;
  if (direction === 0) {
    return {
      didRequestViewChange: false,
      nextTargetView: state.targetView,
      nextState: state,
    };
  }

  const isDirectionChange = state.wheelDirection !== 0 && state.wheelDirection !== direction;
  const baselineView = isDirectionChange ? input.currentView : state.targetView;
  const nextAccumulator = (isDirectionChange ? 0 : state.wheelAccumulator) + input.normalizedDelta;
  const threshold = Math.max(1, input.wheelThreshold);
  const steps = Math.floor(Math.abs(nextAccumulator) / threshold);

  if (steps === 0) {
    return {
      didRequestViewChange: false,
      nextTargetView: state.targetView,
      nextState: {
        targetView: state.targetView,
        wheelAccumulator: nextAccumulator,
        wheelDirection: direction,
      },
    };
  }

  let nextTargetView = baselineView;
  for (let step = 0; step < steps; step += 1) {
    nextTargetView = stepWorldmapCameraView(nextTargetView, direction > 0);
  }

  const consumed = steps * threshold * direction;
  const remainder = nextAccumulator - consumed;

  return {
    didRequestViewChange: nextTargetView !== state.targetView,
    nextTargetView,
    nextState: {
      targetView: nextTargetView,
      wheelAccumulator: remainder,
      wheelDirection: direction,
    },
  };
}

export function resolveWorldmapViewFromDistance(input: ResolveWorldmapViewFromDistanceInput): CameraView {
  const closeMediumBoundary = input.closeMediumBoundary ?? 15;
  const mediumFarBoundary = input.mediumFarBoundary ?? 30;
  const hysteresisHalfWidth = (input.hysteresisWidth ?? 4) / 2;

  switch (input.currentView) {
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
