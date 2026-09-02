import type { CameraView } from "../camera-view";

export type WorldmapZoomBand = CameraView.Close | CameraView.Medium | CameraView.Far;
export type WorldmapZoomStatus = "idle" | "zooming";
export type ZoomRefreshLevel = "none" | "debounced" | "forced";

export type ZoomIntent = { type: "continuous_delta"; delta: number } | { type: "snap_to_distance"; distance: number };

export interface WorldmapZoomState {
  actualDistance: number;
  targetDistance: number;
  minDistance: number;
  maxDistance: number;
  status: WorldmapZoomStatus;
  activeGestureId: number | null;
  resolvedBand: WorldmapZoomBand;
  stableBand: WorldmapZoomBand;
}

export interface WorldmapCameraSnapshot extends WorldmapZoomState {}

export interface WorldmapZoomTickResult {
  snapshot: WorldmapCameraSnapshot;
  didMove: boolean;
}
