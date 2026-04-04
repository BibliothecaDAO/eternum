export type WorldNavigationMode = "three_d" | "transition" | "strategic_2d";

export const WORLDMAP_TRANSITION_START_DISTANCE = 40;
const WORLDMAP_STRATEGIC_ENTRY_DISTANCE = 52;
export const WORLDMAP_STRATEGIC_CAMERA_DISTANCE = 56;
export const WORLDMAP_STRATEGIC_SETTLE_MS = 120;
export const WORLDMAP_STRATEGIC_ENTRY_SCALE = 1.4;
export const WORLDMAP_STRATEGIC_EXIT_SCALE = 2.2;
export const WORLDMAP_STRATEGIC_MIN_SCALE = 0.6;
export const WORLDMAP_STRATEGIC_MAX_SCALE = 4;

export interface WorldNavigationModeMachineState {
  mode: WorldNavigationMode;
  strategicPoseActive: boolean;
  eligibleStrategicSinceMs: number | null;
  transitionProgress: number;
  zoomLevel: number;
}

interface UpdateWorldNavigationModeMachineInput {
  actualDistance: number;
  status: "idle" | "zooming";
  nowMs: number;
  exitStrategicMode?: boolean;
  minZoomDistance?: number;
  maxZoomDistance?: number;
  transitionStartDistance?: number;
  strategicEntryDistance?: number;
  strategicSettleMs?: number;
}

export function createWorldNavigationModeMachineState(): WorldNavigationModeMachineState {
  return {
    mode: "three_d",
    strategicPoseActive: false,
    eligibleStrategicSinceMs: null,
    transitionProgress: 0,
    zoomLevel: 0,
  };
}

export function updateWorldNavigationModeMachine(
  state: WorldNavigationModeMachineState,
  input: UpdateWorldNavigationModeMachineInput,
): WorldNavigationModeMachineState {
  const minZoomDistance = input.minZoomDistance ?? 10;
  const maxZoomDistance = input.maxZoomDistance ?? WORLDMAP_STRATEGIC_CAMERA_DISTANCE;
  const transitionStartDistance = input.transitionStartDistance ?? WORLDMAP_TRANSITION_START_DISTANCE;
  const strategicEntryDistance = input.strategicEntryDistance ?? WORLDMAP_STRATEGIC_ENTRY_DISTANCE;
  const strategicSettleMs = input.strategicSettleMs ?? WORLDMAP_STRATEGIC_SETTLE_MS;

  const transitionProgress = clamp(
    (input.actualDistance - transitionStartDistance) / (strategicEntryDistance - transitionStartDistance),
    0,
    1,
  );
  const zoomLevel = clamp((input.actualDistance - minZoomDistance) / (maxZoomDistance - minZoomDistance), 0, 1);

  if (input.exitStrategicMode) {
    return {
      mode: input.actualDistance > transitionStartDistance ? "transition" : "three_d",
      strategicPoseActive: false,
      eligibleStrategicSinceMs: null,
      transitionProgress,
      zoomLevel,
    };
  }

  let eligibleStrategicSinceMs = state.eligibleStrategicSinceMs;
  const isStrategicEntryEligible = input.actualDistance >= strategicEntryDistance && input.status === "idle";
  if (!isStrategicEntryEligible) {
    eligibleStrategicSinceMs = null;
  } else if (eligibleStrategicSinceMs === null) {
    eligibleStrategicSinceMs = input.nowMs;
  }

  if (state.strategicPoseActive) {
    return {
      mode: "strategic_2d",
      strategicPoseActive: true,
      eligibleStrategicSinceMs,
      transitionProgress: 1,
      zoomLevel: 1,
    };
  }

  const shouldPromoteToStrategicMode =
    eligibleStrategicSinceMs !== null && input.nowMs - eligibleStrategicSinceMs >= strategicSettleMs;
  if (shouldPromoteToStrategicMode) {
    return {
      mode: "strategic_2d",
      strategicPoseActive: true,
      eligibleStrategicSinceMs,
      transitionProgress: 1,
      zoomLevel: 1,
    };
  }

  return {
    mode: input.actualDistance > transitionStartDistance ? "transition" : "three_d",
    strategicPoseActive: false,
    eligibleStrategicSinceMs,
    transitionProgress,
    zoomLevel,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
