import type { CameraView } from "./camera-view";
import type { WorldmapChunkRefreshScheduleMode } from "./worldmap-chunk-switch-delay-policy";
import {
  planWorldmapZoomRefresh,
  type WorldmapZoomRefreshPlannerState,
} from "./worldmap-zoom/worldmap-zoom-refresh-planner";
import type { ZoomRefreshLevel } from "./worldmap-zoom/worldmap-zoom-types";

interface WorldmapControlsChangeRefreshSnapshot {
  stableBand: CameraView;
  isSettled: boolean;
}

interface WorldmapZoomTickControlsNotificationInput {
  didMove: boolean;
  previousZoomSnapshot: WorldmapControlsChangeRefreshSnapshot;
  nextZoomSnapshot: WorldmapControlsChangeRefreshSnapshot;
  zoomRefreshPlannerState: WorldmapZoomRefreshPlannerState;
}

interface ResolveWorldmapControlsChangeRefreshDecisionInput {
  previousCameraDistance: number | null;
  nextCameraDistance: number;
  zoomSnapshot: WorldmapControlsChangeRefreshSnapshot;
  lastZoomRefreshStableBand: CameraView;
  zoomRefreshPlannerState: WorldmapZoomRefreshPlannerState;
  cameraDistanceEpsilon?: number;
}

interface WorldmapControlsChangeRefreshDecision {
  shouldRequestRefresh: boolean;
  refreshLevel: ZoomRefreshLevel;
  scheduleMode: WorldmapChunkRefreshScheduleMode;
  nextZoomRefreshPlannerState: WorldmapZoomRefreshPlannerState;
  nextLastZoomRefreshStableBand: CameraView;
}

export function resolveWorldmapControlsChangeRefreshDecision(
  input: ResolveWorldmapControlsChangeRefreshDecisionInput,
): WorldmapControlsChangeRefreshDecision {
  const cameraDistanceEpsilon = input.cameraDistanceEpsilon ?? 0.01;
  const zoomDistanceChanged =
    input.previousCameraDistance === null ||
    Math.abs(input.previousCameraDistance - input.nextCameraDistance) > cameraDistanceEpsilon;
  const hasPendingZoomRefresh = input.zoomRefreshPlannerState.pendingLevel !== "none";

  if (!zoomDistanceChanged) {
    if (!hasPendingZoomRefresh || !input.zoomSnapshot.isSettled) {
      return {
        shouldRequestRefresh: true,
        refreshLevel: "debounced",
        scheduleMode: "coalesce_earliest",
        nextZoomRefreshPlannerState: input.zoomRefreshPlannerState,
        nextLastZoomRefreshStableBand: input.lastZoomRefreshStableBand,
      };
    }
  }

  const refreshPlan = planWorldmapZoomRefresh(input.zoomRefreshPlannerState, {
    zoomDistanceChanged: true,
    zoomSettled: zoomDistanceChanged ? input.zoomSnapshot.isSettled : true,
    stableBandChanged: input.zoomSnapshot.stableBand !== input.lastZoomRefreshStableBand,
  });
  const shouldRequestRefresh = refreshPlan.immediateLevel !== "none";

  return {
    shouldRequestRefresh,
    refreshLevel: refreshPlan.immediateLevel,
    scheduleMode: shouldRequestRefresh ? "debounce_trailing" : "coalesce_earliest",
    nextZoomRefreshPlannerState: refreshPlan.nextState,
    nextLastZoomRefreshStableBand: shouldRequestRefresh
      ? input.zoomSnapshot.stableBand
      : input.lastZoomRefreshStableBand,
  };
}

export function shouldNotifyWorldmapControlsChangeAfterZoomTick(
  input: WorldmapZoomTickControlsNotificationInput,
): boolean {
  if (input.didMove) {
    return true;
  }

  if (input.zoomRefreshPlannerState.pendingLevel === "none") {
    return false;
  }

  return (
    input.nextZoomSnapshot.isSettled &&
    (!input.previousZoomSnapshot.isSettled ||
      input.previousZoomSnapshot.stableBand !== input.nextZoomSnapshot.stableBand)
  );
}
