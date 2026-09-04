export interface CameraTransitionState {
  activeToken: number | null;
  nextToken: number;
}

interface CameraTransitionFrameInput {
  updateControls: () => boolean;
  syncDistanceVisuals: () => void;
  emitFallbackChange: () => void;
  markVisibilityDirty: () => void;
}

export interface CameraTransitionStartResult {
  cancelledToken: number | null;
  nextState: CameraTransitionState;
}

export function createCameraTransitionState(): CameraTransitionState {
  return {
    activeToken: null,
    nextToken: 0,
  };
}

export function resolveCameraTransitionStart(state: CameraTransitionState): CameraTransitionStartResult {
  const nextToken = state.nextToken + 1;
  return {
    cancelledToken: state.activeToken,
    nextState: {
      activeToken: nextToken,
      nextToken,
    },
  };
}

export function resolveCameraTransitionCompletion(
  state: CameraTransitionState,
  completedToken: number,
): CameraTransitionState {
  if (state.activeToken !== completedToken) {
    return state;
  }

  return {
    activeToken: null,
    nextToken: state.nextToken,
  };
}

export function publishCameraTransitionFrame(input: CameraTransitionFrameInput): void {
  const controlsHandledChange = input.updateControls();
  input.syncDistanceVisuals();
  if (!controlsHandledChange) {
    input.emitFallbackChange();
  }
  input.markVisibilityDirty();
}
