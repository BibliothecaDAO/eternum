import { Vector3 } from "three";

import { CameraView } from "../camera-view";
import {
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraViewProfile,
} from "../worldmap-camera-view-profile";
import { resolveWorldmapStrategicCameraProfile } from "./worldmap-strategic-camera-profile";

interface ResolveWorldmapStrategicTransitionPoseInput {
  target: Vector3;
  actualDistance: number;
  transitionProgress: number;
  lockStrategicDistance?: boolean;
}

interface WorldmapStrategicTransitionPose {
  cameraPosition: Vector3;
  target: Vector3;
  fovDegrees: number;
}

export function resolveWorldmapStrategicTransitionPose(
  input: ResolveWorldmapStrategicTransitionPoseInput,
): WorldmapStrategicTransitionPose {
  const strategicProfile = resolveWorldmapStrategicCameraProfile();
  const farProfile = resolveWorldmapCameraViewProfile(CameraView.Far);
  const transitionProgress = clamp(input.transitionProgress, 0, 1);
  const resolvedDistance = input.lockStrategicDistance ? strategicProfile.distance : input.actualDistance;
  const tiltRadians = lerp(farProfile.angleRadians, strategicProfile.tiltRadians, transitionProgress);
  const fovDegrees = lerp(resolveWorldmapCameraFieldOfViewDegrees(), strategicProfile.fovDegrees, transitionProgress);
  const cameraHeight = Math.sin(tiltRadians) * resolvedDistance;
  const cameraDepth = Math.cos(tiltRadians) * resolvedDistance;

  return {
    cameraPosition: new Vector3(input.target.x, input.target.y + cameraHeight, input.target.z + cameraDepth),
    target: input.target.clone(),
    fovDegrees,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}
