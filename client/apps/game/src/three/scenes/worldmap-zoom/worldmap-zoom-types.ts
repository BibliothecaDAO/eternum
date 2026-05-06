import type { CameraView } from "../camera-view";

export type WorldmapZoomBand = CameraView.Close | CameraView.Medium | CameraView.Far;
export type WorldmapZoomStatus = "idle" | "zooming";

export interface WorldmapZoomState {
  actualDistance: number;
  targetDistance: number;
  minDistance: number;
  maxDistance: number;
  status: WorldmapZoomStatus;
  resolvedBand: WorldmapZoomBand;
  stableBand: WorldmapZoomBand;
}

export interface WorldmapCameraSnapshot extends WorldmapZoomState {}

export interface WorldmapZoomTickResult {
  snapshot: WorldmapCameraSnapshot;
}
