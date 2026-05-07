import { CameraView } from "./camera-view";

export const LOCKED_WORLDMAP_CAMERA_VIEW = CameraView.Far;

export function resolveLockedWorldmapCameraView(_requestedView?: CameraView): CameraView {
  return LOCKED_WORLDMAP_CAMERA_VIEW;
}
