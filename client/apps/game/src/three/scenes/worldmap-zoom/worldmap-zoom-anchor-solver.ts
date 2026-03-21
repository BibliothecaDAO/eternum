import { Vector3 } from "three";

import type { WorldmapNavigationBounds } from "./worldmap-zoom-types";

interface SolveWorldmapZoomAnchorInput {
  cameraPosition: Vector3;
  target: Vector3;
  anchorWorldPoint: Vector3 | null;
  nextDistance: number;
  navigationBounds?: WorldmapNavigationBounds;
}

export interface SolveWorldmapZoomAnchorResult {
  cameraPosition: Vector3;
  target: Vector3;
  didUseAnchor: boolean;
}

export function solveWorldmapZoomAnchor(input: SolveWorldmapZoomAnchorInput): SolveWorldmapZoomAnchorResult {
  const nextTarget = input.target.clone();
  const nextCameraPosition = input.cameraPosition.clone();
  const currentDistance = nextCameraPosition.distanceTo(nextTarget);

  if (!Number.isFinite(currentDistance) || currentDistance <= 1e-6) {
    return {
      cameraPosition: nextCameraPosition,
      target: nextTarget,
      didUseAnchor: false,
    };
  }

  const anchor = input.anchorWorldPoint ?? nextTarget;
  const scale = input.nextDistance / currentDistance;

  nextCameraPosition.sub(anchor).multiplyScalar(scale).add(anchor);
  nextTarget.sub(anchor).multiplyScalar(scale).add(anchor);

  applyNavigationBounds(nextCameraPosition, nextTarget, input.navigationBounds);

  return {
    cameraPosition: nextCameraPosition,
    target: nextTarget,
    didUseAnchor: input.anchorWorldPoint !== null,
  };
}

function applyNavigationBounds(
  cameraPosition: Vector3,
  target: Vector3,
  navigationBounds?: WorldmapNavigationBounds,
): void {
  if (!navigationBounds) {
    return;
  }

  const clampedTargetX = clamp(target.x, navigationBounds.minX, navigationBounds.maxX);
  const clampedTargetZ = clamp(target.z, navigationBounds.minZ, navigationBounds.maxZ);
  const targetOffsetX = clampedTargetX - target.x;
  const targetOffsetZ = clampedTargetZ - target.z;

  if (targetOffsetX === 0 && targetOffsetZ === 0) {
    return;
  }

  target.set(clampedTargetX, target.y, clampedTargetZ);
  cameraPosition.set(cameraPosition.x + targetOffsetX, cameraPosition.y, cameraPosition.z + targetOffsetZ);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
