import { HEX_SIZE } from "@/three/constants";
import { createHexagonShape } from "@/three/geometry/hexagon-geometry";
import { hoverHexMaterial, updateHoverHexMaterial } from "@/three/shaders/hover-hex-material";
import { gltfLoader } from "@/three/utils/utils";
import * as THREE from "three";

/**
 * Manages hover effects with rim lighting on hexagons
 */
export class HoverHexManager {
  private scene: THREE.Scene;
  private hoverHex: THREE.Mesh | null = null;
  private outlineModel: THREE.Object3D | null = null;
  private isVisible = false;
  private animationId: number | null = null;
  private lastTime = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createHoverHex();
    this.loadOutlineModel();
    // Don't start animation immediately - only when hover becomes visible
  }

  private createHoverHex(): void {
    // Create hexagon shape and convert to BufferGeometry
    const hexShape = createHexagonShape(HEX_SIZE * 1.02);
    const geometry = new THREE.ShapeGeometry(hexShape);

    this.hoverHex = new THREE.Mesh(geometry, hoverHexMaterial);
    this.hoverHex.position.y = 0.2; // Very slightly above ground, lower than labels
    this.hoverHex.rotation.x = -Math.PI / 2; // Rotate to face ground plane
    this.hoverHex.renderOrder = 50; // Lower render order to avoid interfering with labels
    this.hoverHex.raycast = () => {}; // Disable raycasting to prevent interference
    this.hoverHex.visible = false;
  }

  private async loadOutlineModel(): Promise<void> {
    try {
      const gltf = await gltfLoader.loadAsync("/models/outline_pink_small.glb");
      this.outlineModel = gltf.scene;

      this.outlineModel.position.y = 0.01;
      // this.outlineModel.rotation.x = -Math.PI / 2;
      this.outlineModel.renderOrder = 45;
      this.outlineModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.raycast = () => {};
        }
      });
      this.outlineModel.visible = false;
    } catch (error) {
      console.warn("Failed to load outline model:", error);
    }
  }

  private startAnimation(): void {
    // Only start animation loop if not already running and visible
    if (this.animationId !== null || !this.isVisible) {
      return;
    }

    const animate = (currentTime: number) => {
      // Exit if no longer visible
      if (!this.isVisible) {
        this.stopAnimation();
        return;
      }

      const deltaTime = (currentTime - this.lastTime) * 0.001; // Convert to seconds
      this.lastTime = currentTime;

      if (deltaTime > 0) {
        updateHoverHexMaterial(deltaTime);
      }

      this.animationId = requestAnimationFrame(animate);
    };

    this.lastTime = performance.now();
    this.animationId = requestAnimationFrame(animate);
  }

  private stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Show hover effect at the specified position
   */
  public showHover(x: number, z: number): void {
    if (!this.hoverHex) return;

    this.hoverHex.position.set(x, 0.2, z);

    if (this.outlineModel) {
      this.outlineModel.position.set(x, 0.01, z);
    }

    if (!this.isVisible) {
      this.scene.add(this.hoverHex);
      this.hoverHex.visible = true;

      if (this.outlineModel) {
        this.scene.add(this.outlineModel);
        this.outlineModel.visible = true;
      }

      this.isVisible = true;
      // Start animation when hover becomes visible
      this.startAnimation();
    }
  }

  /**
   * Hide the hover effect
   */
  public hideHover(): void {
    if (!this.hoverHex || !this.isVisible) return;

    this.scene.remove(this.hoverHex);
    this.hoverHex.visible = false;

    if (this.outlineModel) {
      this.scene.remove(this.outlineModel);
      this.outlineModel.visible = false;
    }

    this.isVisible = false;
    // Stop animation when hover is hidden
    this.stopAnimation();
  }

  /**
   * Check if hover effect is currently visible
   */
  public isHoverVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Update hover colors - can be used for different hover states
   */
  public setHoverColor(baseColor: THREE.Color, rimColor: THREE.Color): void {
    hoverHexMaterial.uniforms.color.value.copy(baseColor);
    hoverHexMaterial.uniforms.rimColor.value.copy(rimColor);
  }

  /**
   * Set hover intensity (0.0 to 1.0)
   */
  public setHoverIntensity(intensity: number): void {
    hoverHexMaterial.uniforms.opacity.value = intensity;
    hoverHexMaterial.uniforms.rimStrength.value = intensity;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stopAnimation();

    if (this.hoverHex) {
      this.scene.remove(this.hoverHex);
      this.hoverHex.geometry.dispose();
      this.hoverHex = null;
    }

    if (this.outlineModel) {
      this.scene.remove(this.outlineModel);
      this.outlineModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
      this.outlineModel = null;
    }

    this.isVisible = false;
  }
}
