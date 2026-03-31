import type { ZoomRefreshLevel } from "./worldmap-zoom-types";

export interface WorldmapZoomRefreshPlannerState {
  pendingLevel: ZoomRefreshLevel;
}

interface PlanWorldmapZoomRefreshInput {
  zoomDistanceChanged: boolean;
  zoomSettled: boolean;
  stableBandChanged: boolean;
}

interface PlanWorldmapZoomRefreshResult {
  immediateLevel: ZoomRefreshLevel;
  nextState: WorldmapZoomRefreshPlannerState;
}

export function createWorldmapZoomRefreshPlannerState(): WorldmapZoomRefreshPlannerState {
  return {
    pendingLevel: "none",
  };
}

export function planWorldmapZoomRefresh(
  state: WorldmapZoomRefreshPlannerState,
  input: PlanWorldmapZoomRefreshInput,
): PlanWorldmapZoomRefreshResult {
  if (!input.zoomDistanceChanged) {
    return {
      immediateLevel: "none",
      nextState: state,
    };
  }

  const requestedLevel = input.stableBandChanged ? "forced" : "debounced";
  if (!input.zoomSettled) {
    return {
      immediateLevel: "none",
      nextState: {
        pendingLevel: maxRefreshLevel(state.pendingLevel, requestedLevel),
      },
    };
  }

  const flushLevel = maxRefreshLevel(state.pendingLevel, requestedLevel);
  return {
    immediateLevel: flushLevel,
    nextState: createWorldmapZoomRefreshPlannerState(),
  };
}

function maxRefreshLevel(left: ZoomRefreshLevel, right: ZoomRefreshLevel): ZoomRefreshLevel {
  const priority: Record<ZoomRefreshLevel, number> = {
    none: 0,
    debounced: 1,
    forced: 2,
  };

  return priority[left] >= priority[right] ? left : right;
}
