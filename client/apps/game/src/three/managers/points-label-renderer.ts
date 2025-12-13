import { ID } from "@bibliothecadao/types";
import * as THREE from "three";
import { createPointsLabelMaterial } from "../shaders/points-label-material";
import { FrustumManager } from "../utils/frustum-manager";

/**
 * Configuration for a single point label
 */
export interface PointLabelConfig {
  entityId: ID;
  position: THREE.Vector3;
  size?: number; // Relative size multiplier (default: 1.0)
  colorIndex?: number; // Index for color palette (default: 0)
}

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
  private material: THREE.ShaderMaterial;
  private maxPoints: number;
  private currentCount: number = 0;

  // Track entity ID to point index mapping
  private entityIdToIndex: Map<ID, number> = new Map();
  private indexToEntityId: Map<number, ID> = new Map();

  // Raycaster for hover detection
  private raycaster: THREE.Raycaster;

  // Hover state
  private hoveredEntityId: ID | null = null;

  // Reusable arrays for buffer updates
  private positionsArray: Float32Array;
  private sizesArray: Float32Array;
  private colorIndicesArray: Float32Array;
  private hoverArray: Float32Array;
  // Icons are small and bounded by chunk visibility; frustum culling can be relaxed.
  private frustumManager?: FrustumManager;
  private unsubscribeFrustum?: () => void;
  private boundsDirty = true;

  constructor(
    scene: THREE.Scene,
    spriteTexture: THREE.Texture,
    maxPoints = 1000,
    pointSize = 32,
    hoverScale = 1.2,
    hoverBrightness = 1.3,
    sizeAttenuation = false,
    frustumManager?: FrustumManager,
  ) {
    this.maxPoints = maxPoints;

    // Initialize buffer arrays
    this.positionsArray = new Float32Array(maxPoints * 3);
    this.sizesArray = new Float32Array(maxPoints);
    this.colorIndicesArray = new Float32Array(maxPoints);
    this.hoverArray = new Float32Array(maxPoints);

    // Set default sizes to 1.0
    this.sizesArray.fill(1.0);

    // Create geometry with buffer attributes
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positionsArray, 3));
    this.geometry.setAttribute("size", new THREE.BufferAttribute(this.sizesArray, 1));
    this.geometry.setAttribute("colorIndex", new THREE.BufferAttribute(this.colorIndicesArray, 1));
    this.geometry.setAttribute("hover", new THREE.BufferAttribute(this.hoverArray, 1));

    // Set initial draw range to 0 (no points visible)
    this.geometry.setDrawRange(0, 0);

    // Create material
    this.material = createPointsLabelMaterial(spriteTexture, pointSize, hoverScale, hoverBrightness, sizeAttenuation);

    // Create Points object
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.renderOrder = 999; // Render after everything else (on top)
    // Avoid per-update bounding sphere work; visibility is handled at the chunk level.
    this.points.frustumCulled = false;
    scene.add(this.points);

    // Setup raycaster for hover detection
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points = {
      threshold: pointSize / 1.5, // Adjusted threshold for better hit detection
    };

    this.frustumManager = frustumManager;
    if (this.frustumManager) {
      this.unsubscribeFrustum = this.frustumManager.onChange(() => {
        this.refreshFrustumVisibility();
      });
      this.refreshFrustumVisibility();
    }
  }

  private refreshFrustumVisibility(): void {
    // With frustum culling relaxed, just hide when empty.
    this.points.visible = this.currentCount > 0;
  }

  /**
   * Add or update a point label
   */
  public setPoint(config: PointLabelConfig): void {
    const { entityId, position, size = 1.0, colorIndex = 0 } = config;

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

    // Update attributes only if changed to reduce buffer churn
    if (this.sizesArray[index] !== size) {
      this.sizesArray[index] = size;
      this.geometry.attributes.size.needsUpdate = true;
    }
    if (this.colorIndicesArray[index] !== colorIndex) {
      this.colorIndicesArray[index] = colorIndex;
      this.geometry.attributes.colorIndex.needsUpdate = true;
    }

    // Mark position attribute as needing update
    this.geometry.attributes.position.needsUpdate = true;

    // Update draw range
    this.geometry.setDrawRange(0, this.currentCount);
    this.boundsDirty = true;
    this.refreshFrustumVisibility();
  }

  /**
   * Fast path for updating an existing point's position only.
   * Falls back to setPoint() if the point doesn't exist yet.
   */
  public setPointPosition(entityId: ID, position: THREE.Vector3): void {
    const index = this.entityIdToIndex.get(entityId);
    if (index === undefined) {
      this.setPoint({ entityId, position });
      return;
    }

    const posIndex = index * 3;
    this.positionsArray[posIndex] = position.x;
    this.positionsArray[posIndex + 1] = position.y;
    this.positionsArray[posIndex + 2] = position.z;
    this.geometry.attributes.position.needsUpdate = true;
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

      this.sizesArray[index] = this.sizesArray[lastIndex];
      this.colorIndicesArray[index] = this.colorIndicesArray[lastIndex];
      this.hoverArray[index] = this.hoverArray[lastIndex];

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
    this.geometry.attributes.size.needsUpdate = true;
    this.geometry.attributes.colorIndex.needsUpdate = true;
    this.geometry.attributes.hover.needsUpdate = true;

    // Update draw range
    this.geometry.setDrawRange(0, this.currentCount);

    // If we removed the hovered point, clear hover
    if (this.hoveredEntityId === entityId) {
      this.hoveredEntityId = null;
    }

    this.boundsDirty = true;
    this.refreshFrustumVisibility();
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
    this.hoverArray.fill(0);
    this.geometry.attributes.hover.needsUpdate = true;
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
        this.hoverArray[prevIndex] = 0.0;
      }
    }

    // Set new hover
    this.hoveredEntityId = entityId;
    const index = this.entityIdToIndex.get(entityId);
    if (index !== undefined) {
      this.hoverArray[index] = 1.0;
      this.geometry.attributes.hover.needsUpdate = true;
    }
  }

  /**
   * Clear hover state
   */
  public clearHover(): void {
    if (this.hoveredEntityId !== null) {
      const index = this.entityIdToIndex.get(this.hoveredEntityId);
      if (index !== undefined) {
        this.hoverArray[index] = 0.0;
        this.geometry.attributes.hover.needsUpdate = true;
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
    if (this.unsubscribeFrustum) {
      this.unsubscribeFrustum();
      this.unsubscribeFrustum = undefined;
    }
    this.geometry.dispose();
    this.material.dispose();
    this.points.parent?.remove(this.points);
  }
}
