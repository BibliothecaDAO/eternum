import { HEX_SIZE } from "@/three/constants";
import { createHexagonShape } from "@/three/geometry/hexagon-geometry";
import { createHoverHexMaterial, updateHoverHexMaterial } from "@/three/shaders/hover-hex-material";
import { gltfLoader } from "@/three/utils/utils";
import * as THREE from "three";

export type HoverVisualMode = "fill" | "outline";

/**
 * Manages hover effects with rim lighting on hexagons
 */
export class HoverHexManager {
  private scene: THREE.Scene;
  private hoverHex: THREE.Mesh | null = null;
  private outlineModel: THREE.Object3D | null = null;
  private isVisible = false;
  private visualMode: HoverVisualMode = "fill";
  private readonly hoverMaterial: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.hoverMaterial = createHoverHexMaterial();
    this.createHoverHex();
    this.loadOutlineModel();
    // Don't start animation immediately - only when hover becomes visible
  }

  private createHoverHex(): void {
    // Create hexagon shape and convert to BufferGeometry
    const hexShape = createHexagonShape(HEX_SIZE * 1.02);
    const geometry = new THREE.ShapeGeometry(hexShape);

    this.hoverHex = new THREE.Mesh(geometry, this.hoverMaterial);
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

      if (this.isVisible) {
        // Hover is already active – attach the outline immediately.
        this.outlineModel.visible = true;
        if (!this.outlineModel.parent) {
          this.scene.add(this.outlineModel);
        }
      } else {
        this.outlineModel.visible = false;
      }
    } catch (error) {
      console.warn("Failed to load outline model:", error);
    }
  }

  public update(deltaTime: number): void {
    if (!this.isVisible) {
      return;
    }

    if (deltaTime <= 0) {
      return;
    }

    updateHoverHexMaterial(this.hoverMaterial, deltaTime);
  }

  public setVisualMode(mode: HoverVisualMode): void {
    this.visualMode = mode;

    if (!this.isVisible) {
      return;
    }

    if (this.visualMode === "fill") {
      this.attachHoverFill();
    } else {
      this.detachHoverFill();
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

    if (this.visualMode === "fill") {
      this.attachHoverFill();
    } else {
      this.detachHoverFill();
    }

    this.attachOutlineModel();
    this.isVisible = true;
  }

  /**
   * Hide the hover effect
   */
  public hideHover(): void {
    if (!this.hoverHex || !this.isVisible) return;

    this.detachHoverFill();
    this.detachOutlineModel();

    this.isVisible = false;
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
    this.hoverMaterial.uniforms.color.value.copy(baseColor);
    this.hoverMaterial.uniforms.rimColor.value.copy(rimColor);
  }

  /**
   * Set hover intensity (0.0 to 1.0)
   */
  public setHoverIntensity(intensity: number): void {
    this.hoverMaterial.uniforms.opacity.value = intensity;
    this.hoverMaterial.uniforms.rimStrength.value = intensity;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.hoverHex) {
      this.scene.remove(this.hoverHex);
      this.hoverHex.geometry.dispose();
      this.hoverMaterial.dispose();
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

  private attachHoverFill(): void {
    if (!this.hoverHex) {
      return;
    }

    if (!this.hoverHex.parent) {
      this.scene.add(this.hoverHex);
    }

    this.hoverHex.visible = true;
  }

  private detachHoverFill(): void {
    if (!this.hoverHex) {
      return;
    }

    if (this.hoverHex.parent) {
      this.scene.remove(this.hoverHex);
    }

    this.hoverHex.visible = false;
  }

  private attachOutlineModel(): void {
    if (!this.outlineModel) {
      return;
    }

    if (!this.outlineModel.parent) {
      this.scene.add(this.outlineModel);
    }

    this.outlineModel.visible = true;
  }

  private detachOutlineModel(): void {
    if (!this.outlineModel) {
      return;
    }

    if (this.outlineModel.parent) {
      this.scene.remove(this.outlineModel);
    }

    this.outlineModel.visible = false;
  }
}
