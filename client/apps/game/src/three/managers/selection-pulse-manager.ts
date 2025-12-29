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
  private ownershipPulseMeshes: THREE.Mesh[] = [];
  private isVisible = false;
  private selectedEntityId: number | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createPulseMesh();
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

  private shouldAnimate(): boolean {
    if (this.isVisible) {
      return true;
    }

    return this.ownershipPulseMeshes.some((mesh) => mesh.visible);
  }

  public update(deltaTime: number): void {
    if (!this.shouldAnimate()) {
      return;
    }

    if (deltaTime <= 0) {
      return;
    }

    updateSelectionPulseMaterial(deltaTime);
    this.ownershipPulseMeshes.forEach((mesh) => {
      if (!mesh.visible) return;
      const material = mesh.material as THREE.ShaderMaterial;
      if (material.uniforms.time) {
        material.uniforms.time.value += deltaTime;
      }
    });
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
   * Show ownership pulses for a set of hex coordinates using provided colors
   */
  public showOwnershipPulses(
    positions: Array<{ x: number; z: number }>,
    baseColor: THREE.Color,
    pulseColor: THREE.Color,
  ): void {
    // Lazy-create ownership meshes up to required count
    positions.forEach((pos, index) => {
      let mesh = this.ownershipPulseMeshes[index];
      if (!mesh) {
        const hexShape = createHexagonShape(HEX_SIZE * 1.1);
        const geometry = new THREE.ShapeGeometry(hexShape);
        mesh = new THREE.Mesh(geometry, selectionPulseMaterial.clone());
        mesh.position.y = 0.5;
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = 99; // Slightly below primary pulse so focus pulse stays on top
        mesh.raycast = () => {};
        this.scene.add(mesh);
        this.ownershipPulseMeshes[index] = mesh;
      }

      mesh.visible = true;
      mesh.position.set(pos.x, 0.5, pos.z);
      const uniforms = (mesh.material as THREE.ShaderMaterial).uniforms;
      uniforms.color.value.copy(baseColor);
      uniforms.pulseColor.value.copy(pulseColor);
      if (uniforms.time) {
        uniforms.time.value = 0;
      }
    });

    // Hide unused meshes
    for (let i = positions.length; i < this.ownershipPulseMeshes.length; i++) {
      const mesh = this.ownershipPulseMeshes[i];
      mesh.visible = false;
    }

  }

  /**
   * Clear all ownership pulses
   */
  public clearOwnershipPulses(): void {
    this.ownershipPulseMeshes.forEach((mesh) => {
      mesh.visible = false;
    });
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
    if (this.pulseMesh) {
      this.scene.remove(this.pulseMesh);
      this.pulseMesh.geometry.dispose();
      this.pulseMesh = null;
    }

    this.ownershipPulseMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.ShaderMaterial).dispose();
    });
    this.ownershipPulseMeshes = [];

    this.isVisible = false;
    this.selectedEntityId = null;
  }
}
