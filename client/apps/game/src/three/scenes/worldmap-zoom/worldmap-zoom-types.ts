import type { Vector3 } from "three";

import type { CameraView } from "../camera-view";

export type WorldmapZoomBand = CameraView.Close | CameraView.Medium | CameraView.Far;
export type WorldmapZoomStatus = "idle" | "zooming";
export type WorldmapZoomAnchorMode = "cursor" | "screen_center" | "world_point";
export type ZoomRefreshLevel = "none" | "debounced" | "forced";

export interface WorldmapNavigationBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface WorldmapZoomAnchor {
  mode: WorldmapZoomAnchorMode;
  worldPoint: Vector3 | null;
}

export type ZoomIntent =
  | { type: "continuous_delta"; delta: number; anchor: WorldmapZoomAnchor }
  | { type: "snap_to_distance"; distance: number; anchor: WorldmapZoomAnchor }
  | { type: "snap_to_band"; band: WorldmapZoomBand; anchor: WorldmapZoomAnchor };

export interface WorldmapZoomState {
  actualDistance: number;
  targetDistance: number;
  minDistance: number;
  maxDistance: number;
  status: WorldmapZoomStatus;
  activeGestureId: number | null;
  anchorMode: WorldmapZoomAnchorMode;
  anchorWorldPoint: Vector3 | null;
  resolvedBand: WorldmapZoomBand;
  stableBand: WorldmapZoomBand;
}

export interface WorldmapCameraSnapshot extends WorldmapZoomState {}

export interface WorldmapZoomTickResult {
  cameraPosition: Vector3;
  target: Vector3;
  snapshot: WorldmapCameraSnapshot;
  didMove: boolean;
}
