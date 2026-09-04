import type { AnimationVisibilityContext } from "@/three/types/animation";
import type { Vector3 } from "three";

/** Shared visibility gate for CPU-driven animation and articulated actors. */
export function isAnimationPositionVisible(
  position: Vector3,
  visibility: AnimationVisibilityContext | undefined,
): boolean {
  if (!visibility) return true;

  const isInFrustum = visibility.visibilityManager
    ? visibility.visibilityManager.isPointVisible(position)
    : (visibility.frustumManager?.isPointVisible(position) ?? true);
  if (!isInFrustum) return false;

  if (!visibility.cameraPosition || visibility.maxDistance === undefined) return true;
  return visibility.cameraPosition.distanceToSquared(position) <= visibility.maxDistance * visibility.maxDistance;
}
