import type { CentralizedVisibilityManager } from "@/three/utils/centralized-visibility-manager";
import type { Vector3 } from "three";

export interface AnimationVisibilityContext {
  /**
   * Centralized visibility manager for optimized frustum checks.
   */
  visibilityManager?: CentralizedVisibilityManager;
  cameraPosition?: Vector3;
  /**
   * Optional maximum distance (world units) from the camera in which animations remain active.
   * Distance is measured to the center of the instance set's bounding sphere.
   */
  maxDistance?: number;
}
