import { CameraView } from "./camera-view";

export interface WorldmapZoomControllerState {
  targetView: CameraView;
  wheelAccumulator: number;
  wheelDirection: -1 | 0 | 1;
}

export type WorldmapZoomInputKind = "trackpad" | "wheel";

interface ApplyWorldmapWheelIntentInput {
  currentView: CameraView;
  normalizedDelta: number;
  wheelThreshold: number;
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

export function resolveWorldmapWheelThreshold(inputKind: WorldmapZoomInputKind, baseThreshold: number = 120): number {
  const normalizedBaseThreshold = Math.max(1, baseThreshold);
  if (inputKind === "trackpad") {
    return Math.max(48, Math.round(normalizedBaseThreshold * 0.6));
  }

  return normalizedBaseThreshold;
}

export function resolveWorldmapWheelGestureTimeoutMs(
  inputKind: WorldmapZoomInputKind,
  baseTimeoutMs: number = 50,
): number {
  const normalizedBaseTimeoutMs = Math.max(0, baseTimeoutMs);
  if (inputKind === "trackpad") {
    return Math.max(normalizedBaseTimeoutMs, 90);
  }

  return normalizedBaseTimeoutMs;
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
