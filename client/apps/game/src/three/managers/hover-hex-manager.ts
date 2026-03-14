import { HEX_SIZE } from "@/three/constants";
import { createHexagonShape } from "@/three/geometry/hexagon-geometry";
import { createHoverHexMaterial, type HoverHexMaterialController } from "@/three/shaders/hover-hex-material";
import { gltfLoader } from "@/three/utils/utils";
import * as THREE from "three";
import { resolveHoverHexViewTuning } from "./hover-hex-view-policy";
import { type HoverVisualPalette } from "./worldmap-interaction-palette";

export type HoverVisualMode = "fill" | "outline";
export interface HoverHexDebugState {
  centerAlpha: number;
  fillAttached: boolean;
  isVisible: boolean;
  materialType: string;
  scanWidth: number;
  visualMode: HoverVisualMode;
}

const HOVER_FILL_Y = 0.32;

/**
 * Manages hover effects with rim lighting on hexagons
 */
export class HoverHexManager {
  private scene: THREE.Scene;
  private hoverHex: THREE.Mesh | null = null;
  private outlineModel: THREE.Object3D | null = null;
  private isVisible = false;
  private visualMode: HoverVisualMode = "fill";
  private readonly hoverMaterialController: HoverHexMaterialController;
  private readonly hoverMaterial: THREE.MeshBasicMaterial;
  private outlineMaterials: THREE.Material[] = [];
  private readonly baseColor = new THREE.Color(0.2, 0.6, 1.0);
  private readonly rimColor = new THREE.Color(0.4, 0.8, 1.0).multiplyScalar(2.0);
  private hoverIntensity = 0.6;
  private pulseTime = 0;
  private readonly animatedColor = new THREE.Color();
  private currentCameraView = 2;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.hoverMaterialController = createHoverHexMaterial();
    this.hoverMaterial = this.hoverMaterialController.material;
    this.applyViewTuning();
    this.applyMaterialState();
    this.createHoverHex();
    this.loadOutlineModel();
    // Don't start animation immediately - only when hover becomes visible
  }

  private createHoverHex(): void {
    // Create hexagon shape and convert to BufferGeometry
    const hexShape = createHexagonShape(HEX_SIZE * 1.02);
    const geometry = new THREE.ShapeGeometry(hexShape);

    this.hoverHex = new THREE.Mesh(geometry, this.hoverMaterial);
    this.hoverHex.position.y = HOVER_FILL_Y; // Lifted off the terrain enough to survive dense ground detail.
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
      this.outlineMaterials = [];
      this.outlineModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.raycast = () => {};
          if (Array.isArray(child.material)) {
            child.material = child.material.map((material) => {
              const clone = material.clone();
              this.outlineMaterials.push(clone);
              return clone;
            });
          } else if (child.material) {
            child.material = child.material.clone();
            this.outlineMaterials.push(child.material);
          }
        }
      });
      this.applyOutlineMaterialState();

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

    this.pulseTime += deltaTime;
    this.applyMaterialState();
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

    this.hoverHex.position.set(x, HOVER_FILL_Y, z);

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
    this.baseColor.copy(baseColor);
    this.rimColor.copy(rimColor);
    this.applyMaterialState();
    this.applyOutlineMaterialState();
  }

  /**
   * Set hover intensity (0.0 to 1.0)
   */
  public setHoverIntensity(intensity: number): void {
    this.hoverIntensity = intensity;
    this.applyMaterialState();
  }

  public applyHoverPalette(palette: HoverVisualPalette): void {
    this.baseColor.setHex(palette.baseColor);
    this.rimColor.setHex(palette.rimColor);
    this.hoverIntensity = palette.intensity;
    this.setVisualMode(palette.visualMode);
    this.applyMaterialState();
    this.applyOutlineMaterialState();
  }

  public setCameraView(cameraView: number): void {
    if (this.currentCameraView === cameraView) {
      return;
    }

    this.currentCameraView = cameraView;
    this.applyViewTuning();
  }

  public getDebugState(): HoverHexDebugState {
    return {
      centerAlpha: this.hoverMaterialController.uniforms.centerAlpha.value,
      fillAttached: Boolean(this.hoverHex?.parent),
      isVisible: this.isVisible,
      materialType: this.hoverMaterial.type,
      scanWidth: this.hoverMaterialController.uniforms.scanWidth.value,
      visualMode: this.visualMode,
    };
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.hoverHex) {
      this.scene.remove(this.hoverHex);
      this.hoverHex.geometry.dispose();
      this.hoverMaterialController.dispose();
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

    this.outlineMaterials = [];

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

  private applyMaterialState(): void {
    if (!this.isVisible) {
      this.hoverMaterialController.setPalette(this.baseColor, this.rimColor, this.hoverIntensity);
      this.hoverMaterialController.setTime(0);
      return;
    }

    const pulse = 0.8 + 0.2 * Math.sin(this.pulseTime * 3.0);
    this.animatedColor.copy(this.rimColor).lerp(this.baseColor, 0.24 - 0.08 * pulse);
    this.hoverMaterialController.setPalette(this.baseColor, this.animatedColor, this.hoverIntensity);
    this.hoverMaterialController.setTime(this.pulseTime);
  }

  private applyViewTuning(): void {
    const tuning = resolveHoverHexViewTuning(this.currentCameraView);
    this.hoverMaterialController.setParameters(tuning);
  }

  private applyOutlineMaterialState(): void {
    this.outlineMaterials.forEach((material) => {
      if ("color" in material && material.color instanceof THREE.Color) {
        material.color.copy(this.rimColor);
      }

      if ("emissive" in material && material.emissive instanceof THREE.Color) {
        material.emissive.copy(this.rimColor);
      }

      if ("opacity" in material && typeof material.opacity === "number") {
        material.opacity = Math.min(1, this.hoverIntensity + 0.12);
      }

      if ("transparent" in material && typeof material.transparent === "boolean") {
        material.transparent = true;
      }
    });
  }
}
