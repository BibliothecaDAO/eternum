import * as THREE from "three";
import { ID } from "@bibliothecadao/types";
import {
  INDICATOR_OPACITY,
  INDICATOR_RENDER_ORDER,
  INDICATOR_SEGMENTS_HEIGHT,
  INDICATOR_SEGMENTS_WIDTH,
  INDICATOR_SIZE,
} from "../constants/indicator-constants";

/**
 * PlayerIndicatorManager
 *
 * Manages colored indicator dots above units to show player ownership.
 * Uses InstancedMesh for efficient rendering of 1000+ indicators.
 *
 * Features:
 * - Single draw call for all indicators
 * - Per-instance position and color
 * - Automatic cleanup and resource management
 * - Synchronized with unit visibility
 */
export class PlayerIndicatorManager {
  private indicatorMesh: THREE.InstancedMesh;
  private visibleIndicators: Map<ID, number>; // entityId -> matrixIndex
  private availableSlots: number[]; // Reusable slots from removed indicators
  private scene: THREE.Scene;
  private capacity: number;

  // Temporary objects to avoid allocations
  private tempPosition = new THREE.Vector3();
  private tempMatrix = new THREE.Matrix4();
  private tempColor = new THREE.Color();

  constructor(scene: THREE.Scene, capacity: number) {
    this.scene = scene;
    this.capacity = capacity;
    this.visibleIndicators = new Map();
    this.availableSlots = [];

    // Create low-poly sphere geometry for indicators
    const geometry = new THREE.SphereGeometry(
      INDICATOR_SIZE / 2, // radius (diameter / 2)
      INDICATOR_SEGMENTS_WIDTH,
      INDICATOR_SEGMENTS_HEIGHT,
    );

    // Create unlit material (InstancedMesh handles instance colors automatically)
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff, // White base color
      transparent: true,
      opacity: INDICATOR_OPACITY,
      depthTest: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    // Create instanced mesh
    this.indicatorMesh = new THREE.InstancedMesh(geometry, material, capacity);

    // Initialize instance color buffer
    // NOTE: Don't use geometry.setAttribute() - InstancedMesh handles instanceColor internally
    this.indicatorMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);

    // Configure rendering properties (match army units)
    this.indicatorMesh.frustumCulled = true; // Enable frustum culling for performance
    this.indicatorMesh.castShadow = false;
    this.indicatorMesh.receiveShadow = false;
    this.indicatorMesh.renderOrder = INDICATOR_RENDER_ORDER;

    // Start with no visible instances (we'll increase count as indicators are added)
    this.indicatorMesh.count = 0;

    // Add to scene
    scene.add(this.indicatorMesh);
  }

  /**
   * Update or create an indicator for a unit
   */
  public updateIndicator(entityId: ID, position: THREE.Vector3, color: THREE.Color, yOffset: number): void {
    // Get existing slot or allocate new one
    let index = this.visibleIndicators.get(entityId);

    if (index === undefined) {
      // Allocate new slot
      if (this.availableSlots.length > 0) {
        // Reuse a previously freed slot
        index = this.availableSlots.pop()!;
      } else {
        // Use next available slot
        index = this.visibleIndicators.size;
      }

      if (index >= this.capacity) {
        console.warn(`PlayerIndicatorManager: Capacity exceeded (${this.capacity})`);
        return;
      }

      this.visibleIndicators.set(entityId, index);

      // Increase mesh count to include this new instance
      if (index >= this.indicatorMesh.count) {
        this.indicatorMesh.count = index + 1;
      }
    }

    // Update position (above unit)
    this.tempPosition.set(position.x, position.y + yOffset, position.z);
    this.tempMatrix.makeTranslation(this.tempPosition.x, this.tempPosition.y, this.tempPosition.z);
    this.indicatorMesh.setMatrixAt(index, this.tempMatrix);

    // Update color using setColorAt (same as army-model.ts does)
    this.indicatorMesh.setColorAt(index, color);
    if (this.indicatorMesh.instanceColor) {
      this.indicatorMesh.instanceColor.needsUpdate = true;
    }

    // Mark for GPU update
    this.indicatorMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Remove an indicator for a unit
   */
  public removeIndicator(entityId: ID): void {
    const index = this.visibleIndicators.get(entityId);

    if (index === undefined) {
      return;
    }

    // Hide by setting scale to 0
    this.tempMatrix.makeScale(0, 0, 0);
    this.indicatorMesh.setMatrixAt(index, this.tempMatrix);
    this.indicatorMesh.instanceMatrix.needsUpdate = true;

    // Free the slot for reuse
    this.availableSlots.push(index);
    this.visibleIndicators.delete(entityId);
  }

  /**
   * Enable or disable all indicators
   */
  public setEnabled(enabled: boolean): void {
    this.indicatorMesh.visible = enabled;
  }

  /**
   * Update opacity of all indicators
   */
  public setOpacity(opacity: number): void {
    const material = this.indicatorMesh.material as THREE.MeshBasicMaterial;
    material.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
    material.needsUpdate = true;
  }

  /**
   * Update size of all indicators
   */
  public setSize(size: number): void {
    // Dispose old geometry
    this.indicatorMesh.geometry.dispose();

    // Create new geometry with updated size
    const newGeometry = new THREE.SphereGeometry(
      size / 2,
      INDICATOR_SEGMENTS_WIDTH,
      INDICATOR_SEGMENTS_HEIGHT,
    );

    this.indicatorMesh.geometry = newGeometry;
  }

  /**
   * Compute bounding sphere for proper frustum culling
   * Should be called after batch updates (same as army-model)
   */
  public computeBoundingSphere(): void {
    this.indicatorMesh.computeBoundingSphere();
  }

  /**
   * Get the current number of visible indicators
   */
  public getVisibleCount(): number {
    return this.visibleIndicators.size;
  }

  /**
   * Check if an indicator exists for an entity
   */
  public hasIndicator(entityId: ID): boolean {
    return this.visibleIndicators.has(entityId);
  }

  /**
   * Clean up all resources
   */
  public dispose(): void {
    this.indicatorMesh.geometry.dispose();
    (this.indicatorMesh.material as THREE.Material).dispose();
    this.scene.remove(this.indicatorMesh);
    this.visibleIndicators.clear();
    this.availableSlots.length = 0;
  }
}
