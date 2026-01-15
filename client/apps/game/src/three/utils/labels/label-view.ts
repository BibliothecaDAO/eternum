import { CameraView } from "../../scenes/hexagon-scene";

// Central toggle to keep label visuals locked to a single camera view
export const FORCE_LABEL_CAMERA_VIEW = true;
export const FORCED_LABEL_CAMERA_VIEW = 1;

export const resolveCameraView = (view: CameraView): CameraView =>
  FORCE_LABEL_CAMERA_VIEW ? FORCED_LABEL_CAMERA_VIEW : view;
