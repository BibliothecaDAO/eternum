import type { CentralizedVisibilityManager } from "@/three/utils/centralized-visibility-manager";
import type { FrustumManager } from "@/three/utils/frustum-manager";
import type { Vector3 } from "three";

export interface AnimationVisibilityContext {
  /**
   * Centralized visibility manager for optimized frustum checks.
   * Preferred over frustumManager for better performance.
   */
  visibilityManager?: CentralizedVisibilityManager;
  /**
   * @deprecated Use visibilityManager instead for better performance.
   * Kept for backward compatibility during migration.
   */
  frustumManager?: FrustumManager;
  cameraPosition?: Vector3;
  /**
   * Optional maximum distance (world units) from the camera in which animations remain active.
   * Distance is measured to the center of the instance set's bounding sphere.
   */
  maxDistance?: number;
}

