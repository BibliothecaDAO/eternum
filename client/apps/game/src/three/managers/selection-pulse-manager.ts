import * as THREE from "three";
import { HEX_SIZE } from "@/three/constants";
import { createHexagonShape } from "@/three/geometry/hexagon-geometry";
import { selectionPulseMaterial, updateSelectionPulseMaterial } from "@/three/shaders/selection-pulse-material";

/**
 * Manages pulsing selection effects for armies and structures
 */
export class SelectionPulseManager {
  private scene: THREE.Scene;
  private pulseMesh: THREE.Mesh | null = null;
  private isVisible = false;
  private animationId: number | null = null;
  private lastTime = 0;
  private selectedEntityId: number | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createPulseMesh();
    this.startAnimation();
  }

  private createPulseMesh(): void {
    // Create hexagon shape and convert to BufferGeometry
    const hexShape = createHexagonShape(HEX_SIZE * 1.1); // Slightly larger than normal hex
    const geometry = new THREE.ShapeGeometry(hexShape);

    this.pulseMesh = new THREE.Mesh(geometry, selectionPulseMaterial);
    this.pulseMesh.position.y = 0.5; // Much higher above ground for visibility
    this.pulseMesh.rotation.x = -Math.PI / 2; // Rotate to face ground plane
    this.pulseMesh.renderOrder = 100; // Very high render order to ensure visibility
    this.pulseMesh.raycast = () => {}; // Disable raycasting to prevent interference
    this.pulseMesh.visible = false;

    // Add to scene once on creation
    this.scene.add(this.pulseMesh);
  }

  private startAnimation(): void {
    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - this.lastTime) * 0.001; // Convert to seconds
      this.lastTime = currentTime;

      if (this.isVisible && deltaTime > 0) {
        updateSelectionPulseMaterial(deltaTime);
      }

      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * Show selection pulse at the specified position for an entity
   */
  public showSelection(x: number, z: number, entityId: number): void {
    if (!this.pulseMesh) return;

    // Update position and entity
    this.pulseMesh.position.set(x, 0.5, z);
    this.selectedEntityId = entityId;

    if (!this.isVisible) {
      this.pulseMesh.visible = true;
      this.isVisible = true;
    }
  }

  /**
   * Hide the selection pulse
   */
  public hideSelection(): void {
    if (!this.pulseMesh || !this.isVisible) return;

    this.pulseMesh.visible = false;
    this.isVisible = false;
    this.selectedEntityId = null;
  }

  /**
   * Check if selection pulse is currently visible
   */
  public isSelectionVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Get the currently selected entity ID
   */
  public getSelectedEntityId(): number | null {
    return this.selectedEntityId;
  }

  /**
   * Update pulse colors - can be used for different entity types
   */
  public setPulseColor(baseColor: THREE.Color, pulseColor: THREE.Color): void {
    selectionPulseMaterial.uniforms.color.value.copy(baseColor);
    selectionPulseMaterial.uniforms.pulseColor.value.copy(pulseColor);
  }

  /**
   * Set pulse intensity (0.0 to 1.0)
   */
  public setPulseIntensity(intensity: number): void {
    selectionPulseMaterial.uniforms.opacity.value = intensity;
    selectionPulseMaterial.uniforms.pulseStrength.value = intensity;
  }

  /**
   * Set pulse speed multiplier
   */
  public setPulseSpeed(speed: number): void {
    selectionPulseMaterial.uniforms.speed.value = speed;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.pulseMesh) {
      this.scene.remove(this.pulseMesh);
      this.pulseMesh.geometry.dispose();
      this.pulseMesh = null;
    }

    this.isVisible = false;
    this.selectedEntityId = null;
  }
}
