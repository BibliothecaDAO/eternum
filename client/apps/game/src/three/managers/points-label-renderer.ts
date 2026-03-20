import { ID } from "@bibliothecadao/types";
import * as THREE from "three";
import type { CentralizedVisibilityManager } from "../utils/centralized-visibility-manager";
import { FrustumManager } from "../utils/frustum-manager";

/**
 * Configuration for a single point label
 */
interface PointLabelConfig {
  entityId: ID;
  position: THREE.Vector3;
  size?: number; // Relative size multiplier (default: 1.0)
  colorIndex?: number; // Index for color palette (default: 0)
}

const sharedSpriteTextureReferences = new WeakMap<THREE.Texture, number>();

/**
 * PointsLabelRenderer manages high-performance icon rendering using THREE.Points
 * - Single draw call for all icons
 * - Fixed screen size (doesn't scale with distance)
 * - Hover support via raycasting
 * - Efficient updates via BufferGeometry attributes
 */
export class PointsLabelRenderer {
  private points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private spriteTexture: THREE.Texture;
  private maxPoints: number;
  private currentCount: number = 0;
  private readonly hoverBrightness: number;

  // Track entity ID to point index mapping
  private entityIdToIndex: Map<ID, number> = new Map();
  private indexToEntityId: Map<number, ID> = new Map();

  // Raycaster for hover detection
  private raycaster: THREE.Raycaster;

  // Hover state
  private hoveredEntityId: ID | null = null;

  // Reusable arrays for buffer updates
  private positionsArray: Float32Array;
  private colorsArray: Float32Array;
  private frustumManager?: FrustumManager;
  private unsubscribeFrustum?: () => void;
  private visibilityManager?: Pick<CentralizedVisibilityManager, "isSphereVisible" | "onChange">;
  private unsubscribeVisibility?: () => void;
  private boundsDirty = true;
  private batchMode = false; // When true, setPoint() skips refreshFrustumVisibility()
  private isDisposed = false;

  constructor(
    scene: THREE.Scene,
    spriteTexture: THREE.Texture,
    maxPoints = 1000,
    pointSize = 32,
    _hoverScale = 1.2,
    hoverBrightness = 1.3,
    sizeAttenuation = false,
    frustumManager?: FrustumManager,
    visibilityManager?: Pick<CentralizedVisibilityManager, "isSphereVisible" | "onChange">,
  ) {
    this.maxPoints = maxPoints;
    this.spriteTexture = spriteTexture;
    this.hoverBrightness = hoverBrightness;
    sharedSpriteTextureReferences.set(spriteTexture, (sharedSpriteTextureReferences.get(spriteTexture) ?? 0) + 1);

    // Initialize buffer arrays
    this.positionsArray = new Float32Array(maxPoints * 3);
    this.colorsArray = new Float32Array(maxPoints * 3);
    this.colorsArray.fill(1.0);

    // Create geometry with buffer attributes
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positionsArray, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.colorsArray, 3));

    // Set initial draw range to 0 (no points visible)
    this.geometry.setDrawRange(0, 0);

    // Use stock materials so the icon path stays portable across legacy and WebGPU builds.
    this.material = new THREE.PointsMaterial({
      map: spriteTexture,
      size: pointSize,
      sizeAttenuation,
      transparent: true,
      alphaTest: 0.1,
      depthTest: false,
      depthWrite: false,
      vertexColors: true,
    });

    // Create Points object
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.renderOrder = 999; // Render after everything else (on top)
    scene.add(this.points);

    // Setup raycaster for hover detection
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points = {
      threshold: pointSize / 1.5, // Adjusted threshold for better hit detection
    };

    this.frustumManager = frustumManager;
    this.visibilityManager = visibilityManager;
    if (this.visibilityManager) {
      this.unsubscribeVisibility = this.visibilityManager.onChange(() => {
        this.refreshFrustumVisibility();
      });
    }
    if (this.frustumManager) {
      this.unsubscribeFrustum = this.frustumManager.onChange(() => {
        this.refreshFrustumVisibility();
      });
    }
    this.refreshFrustumVisibility();
  }

  private refreshFrustumVisibility(): void {
    if (this.visibilityManager) {
      if (this.currentCount === 0) {
        this.points.visible = false;
        return;
      }

      if (this.boundsDirty || !this.geometry.boundingSphere) {
        this.geometry.computeBoundingSphere();
        this.boundsDirty = false;
      }

      this.points.visible = this.visibilityManager.isSphereVisible(this.geometry.boundingSphere);
      return;
    }

    if (!this.frustumManager) {
      this.points.visible = this.currentCount > 0;
      return;
    }

    if (this.currentCount === 0) {
      this.points.visible = false;
      return;
    }

    if (this.boundsDirty || !this.geometry.boundingSphere) {
      this.geometry.computeBoundingSphere();
      this.boundsDirty = false;
    }

    this.points.visible = this.frustumManager.isSphereVisible(this.geometry.boundingSphere);
  }

  /**
   * Begin batch mode - setPoint() calls will not trigger refreshFrustumVisibility()
   * Call endBatch() when done to apply all updates at once
   */
  public beginBatch(): void {
    this.batchMode = true;
  }

  /**
   * End batch mode and apply all pending updates
   * Calls refreshFrustumVisibility() once for all batched setPoint() calls
   */
  public endBatch(): void {
    this.batchMode = false;
    this.refreshFrustumVisibility();
  }

  /**
   * Add or update a point label
   */
  public setPoint(config: PointLabelConfig): void {
    const { entityId, position, size: _size = 1.0, colorIndex: _colorIndex = 0 } = config;

    // Check if point already exists
    let index = this.entityIdToIndex.get(entityId);

    if (index === undefined) {
      // New point - find next available index
      if (this.currentCount >= this.maxPoints) {
        console.warn(`PointsLabelRenderer: Maximum points (${this.maxPoints}) reached`);
        return;
      }

      index = this.currentCount;
      this.currentCount++;

      // Update mappings
      this.entityIdToIndex.set(entityId, index);
      this.indexToEntityId.set(index, entityId);
    }

    // Update position
    const posIndex = index * 3;
    this.positionsArray[posIndex] = position.x;
    this.positionsArray[posIndex + 1] = position.y;
    this.positionsArray[posIndex + 2] = position.z;
    this.setPointBrightness(index, this.hoveredEntityId === entityId ? this.hoverBrightness : 1);

    // Mark attributes as needing update
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    // Update draw range
    this.geometry.setDrawRange(0, this.currentCount);
    this.boundsDirty = true;

    // Skip refresh in batch mode - will be called once in endBatch()
    if (!this.batchMode) {
      this.refreshFrustumVisibility();
    }
  }

  /**
   * Remove a point label
   */
  public removePoint(entityId: ID): void {
    const index = this.entityIdToIndex.get(entityId);
    if (index === undefined) return;

    // If this is the last point, just decrement count
    if (index === this.currentCount - 1) {
      this.entityIdToIndex.delete(entityId);
      this.indexToEntityId.delete(index);
      this.currentCount--;
      this.geometry.setDrawRange(0, this.currentCount);
      return;
    }

    // Otherwise, swap with last point and decrement count
    const lastIndex = this.currentCount - 1;
    const lastEntityId = this.indexToEntityId.get(lastIndex);

    if (lastEntityId !== undefined) {
      // Copy last point's data to removed point's index
      const removedPosIndex = index * 3;
      const lastPosIndex = lastIndex * 3;

      this.positionsArray[removedPosIndex] = this.positionsArray[lastPosIndex];
      this.positionsArray[removedPosIndex + 1] = this.positionsArray[lastPosIndex + 1];
      this.positionsArray[removedPosIndex + 2] = this.positionsArray[lastPosIndex + 2];

      this.colorsArray[removedPosIndex] = this.colorsArray[lastPosIndex];
      this.colorsArray[removedPosIndex + 1] = this.colorsArray[lastPosIndex + 1];
      this.colorsArray[removedPosIndex + 2] = this.colorsArray[lastPosIndex + 2];

      // Update mappings
      this.entityIdToIndex.set(lastEntityId, index);
      this.indexToEntityId.set(index, lastEntityId);
    }

    // Remove old mappings
    this.entityIdToIndex.delete(entityId);
    this.indexToEntityId.delete(lastIndex);

    // Decrement count
    this.currentCount--;

    // Mark attributes as needing update
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    // Update draw range
    this.geometry.setDrawRange(0, this.currentCount);

    // If we removed the hovered point, clear hover
    if (this.hoveredEntityId === entityId) {
      this.hoveredEntityId = null;
    }

    this.boundsDirty = true;
    if (!this.batchMode) {
      this.refreshFrustumVisibility();
    }
  }

  public removeMany(entityIds: Iterable<ID>): void {
    this.beginBatch();
    try {
      for (const entityId of entityIds) {
        this.removePoint(entityId);
      }
    } finally {
      this.endBatch();
    }
  }

  public setMany(configs: Iterable<PointLabelConfig>): void {
    this.beginBatch();
    try {
      for (const config of configs) {
        this.setPoint(config);
      }
    } finally {
      this.endBatch();
    }
  }

  /**
   * Clear all points
   */
  public clear(): void {
    this.currentCount = 0;
    this.entityIdToIndex.clear();
    this.indexToEntityId.clear();
    this.hoveredEntityId = null;
    this.geometry.setDrawRange(0, 0);
    this.colorsArray.fill(1.0);
    this.geometry.attributes.color.needsUpdate = true;
    this.boundsDirty = true;
    this.refreshFrustumVisibility();
  }

  /**
   * Check for hover intersection with mouse
   * @returns Entity ID of hovered point, or null
   */
  public checkHover(camera: THREE.Camera, mouseNDC: THREE.Vector2): ID | null {
    if (this.currentCount === 0) return null;

    // Update raycaster from camera and mouse position
    this.raycaster.setFromCamera(mouseNDC, camera);

    // Check intersection with points
    const intersects = this.raycaster.intersectObject(this.points);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const pointIndex = intersect.index!;
      const entityId = this.indexToEntityId.get(pointIndex);

      if (entityId !== undefined) {
        // Update hover state
        if (this.hoveredEntityId !== entityId) {
          this.setHover(entityId);
        }
        return entityId;
      }
    }

    // No hover - clear previous hover state
    if (this.hoveredEntityId !== null) {
      this.clearHover();
    }

    return null;
  }

  /**
   * Set hover state for a specific entity
   */
  public setHover(entityId: ID): void {
    // Clear previous hover
    if (this.hoveredEntityId !== null) {
      const prevIndex = this.entityIdToIndex.get(this.hoveredEntityId);
      if (prevIndex !== undefined) {
        this.setPointBrightness(prevIndex, 1);
      }
    }

    // Set new hover
    this.hoveredEntityId = entityId;
    const index = this.entityIdToIndex.get(entityId);
    if (index !== undefined) {
      this.setPointBrightness(index, this.hoverBrightness);
      this.geometry.attributes.color.needsUpdate = true;
    }
  }

  /**
   * Clear hover state
   */
  public clearHover(): void {
    if (this.hoveredEntityId !== null) {
      const index = this.entityIdToIndex.get(this.hoveredEntityId);
      if (index !== undefined) {
        this.setPointBrightness(index, 1);
        this.geometry.attributes.color.needsUpdate = true;
      }
      this.hoveredEntityId = null;
    }
  }

  /**
   * Get the currently hovered entity ID
   */
  public getHoveredEntityId(): ID | null {
    return this.hoveredEntityId;
  }

  /**
   * Get current point count
   */
  public getCount(): number {
    return this.currentCount;
  }

  /**
   * Get a snapshot of entity IDs currently rendered as points
   */
  public getEntityIds(): ID[] {
    return Array.from(this.entityIdToIndex.keys());
  }

  /**
   * Check if an entity has a point
   */
  public hasPoint(entityId: ID): boolean {
    return this.entityIdToIndex.has(entityId);
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;

    if (this.unsubscribeFrustum) {
      this.unsubscribeFrustum();
      this.unsubscribeFrustum = undefined;
    }
    if (this.unsubscribeVisibility) {
      this.unsubscribeVisibility();
      this.unsubscribeVisibility = undefined;
    }
    this.geometry.dispose();
    this.material.dispose();
    this.points.parent?.remove(this.points);

    const remainingReferences = (sharedSpriteTextureReferences.get(this.spriteTexture) ?? 1) - 1;
    if (remainingReferences <= 0) {
      sharedSpriteTextureReferences.delete(this.spriteTexture);
      this.spriteTexture.dispose();
    } else {
      sharedSpriteTextureReferences.set(this.spriteTexture, remainingReferences);
    }
  }

  private setPointBrightness(index: number, brightness: number): void {
    const colorIndex = index * 3;
    this.colorsArray[colorIndex] = brightness;
    this.colorsArray[colorIndex + 1] = brightness;
    this.colorsArray[colorIndex + 2] = brightness;
  }
}
