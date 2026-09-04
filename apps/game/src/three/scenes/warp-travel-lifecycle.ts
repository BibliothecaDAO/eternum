import type { SceneSetupContext } from "./hexagon-scene";

export interface WarpTravelLifecycleState {
  hasInitialized: boolean;
  initialSetupPromise: Promise<void> | null;
  isSwitchedOff: boolean;
}

export interface WarpTravelLifecycleAdapter {
  onSetupStart?: () => void;
  onInitialSetupStart?: () => void;
  onResumeStart?: () => void;
  moveCameraToSceneLocation: () => void;
  attachLabelGroupsToScene: () => void;
  attachManagerLabels: () => void;
  registerStoreSubscriptions: () => void;
  setupCameraZoomHandler: () => void;
  refreshScene: (setupContext: SceneSetupContext) => Promise<void>;
  onInitialSetupComplete?: () => void | Promise<void>;
  onResumeComplete?: () => void | Promise<void>;
  reportSetupError?: (error: unknown, phase: "initial" | "resume") => void;
  onSwitchOffStart?: () => void;
  disposeStoreSubscriptions: () => void;
  onAfterDisposeSubscriptions?: () => void;
  detachLabelGroupsFromScene: () => void;
  detachManagerLabels: () => void;
  onSwitchOffComplete?: () => void;
}

async function activateWarpTravelLifecycle(
  adapter: WarpTravelLifecycleAdapter,
  phase: "initial" | "resume",
  setupContext: SceneSetupContext,
): Promise<void> {
  adapter.moveCameraToSceneLocation();
  adapter.attachLabelGroupsToScene();
  adapter.attachManagerLabels();
  adapter.registerStoreSubscriptions();
  adapter.setupCameraZoomHandler();

  try {
    await adapter.refreshScene(setupContext);
  } catch (error) {
    if (setupContext.isCurrent()) {
      adapter.reportSetupError?.(error, phase);
    }
    if (phase === "initial") {
      throw error;
    }
  }

  if (!setupContext.isCurrent()) {
    return;
  }

  if (phase === "initial") {
    await adapter.onInitialSetupComplete?.();
    return;
  }

  await adapter.onResumeComplete?.();
}

export async function runWarpTravelSetupLifecycle(
  state: WarpTravelLifecycleState,
  adapter: WarpTravelLifecycleAdapter,
  setupContext: SceneSetupContext,
): Promise<WarpTravelLifecycleState> {
  const nextState: WarpTravelLifecycleState = {
    ...state,
    isSwitchedOff: false,
  };

  adapter.onSetupStart?.();

  if (!nextState.hasInitialized) {
    adapter.onInitialSetupStart?.();
    if (!nextState.initialSetupPromise) {
      nextState.initialSetupPromise = activateWarpTravelLifecycle(adapter, "initial", setupContext);
    }

    try {
      await nextState.initialSetupPromise;
      nextState.hasInitialized = true;
    } finally {
      nextState.initialSetupPromise = null;
    }

    return nextState;
  }

  adapter.onResumeStart?.();
  await activateWarpTravelLifecycle(adapter, "resume", setupContext);
  return nextState;
}

export function runWarpTravelSwitchOffLifecycle(
  state: WarpTravelLifecycleState,
  adapter: WarpTravelLifecycleAdapter,
): WarpTravelLifecycleState {
  const nextState: WarpTravelLifecycleState = {
    ...state,
    isSwitchedOff: true,
  };

  adapter.onSwitchOffStart?.();
  adapter.disposeStoreSubscriptions();
  adapter.onAfterDisposeSubscriptions?.();
  adapter.detachLabelGroupsFromScene();
  adapter.detachManagerLabels();
  adapter.onSwitchOffComplete?.();

  return nextState;
}
