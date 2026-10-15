import * as THREE from "three";
import { FLAT_TERRAIN_SURFACE, type TerrainSurface } from "@/three/terrain/terrain-surface";
import { applyHexRingLook, createHexRingMaterials, createHexRingShapes, HEX_RING_LIFT } from "./hex-ring";
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

/**
 * Manages hover effects with rim lighting on hexagons
 */
export class HoverHexManager {
  private scene: THREE.Scene;
  private hoverHex: THREE.Mesh | null = null;
  private hoverHalo: THREE.Mesh | null = null;
  private hoverOutline: THREE.LineSegments | null = null;
  private isVisible = false;
  private visualMode: HoverVisualMode = "fill";
  private readonly materials = createHexRingMaterials();
  private readonly baseColor = new THREE.Color(0.2, 0.6, 1.0);
  private readonly rimColor = new THREE.Color(0.4, 0.8, 1.0).multiplyScalar(2.0);
  private hoverIntensity = 0.6;
  private pulseTime = 0;
  private currentCameraView = 2;

  constructor(
    scene: THREE.Scene,
    private readonly terrain: TerrainSurface = FLAT_TERRAIN_SURFACE,
  ) {
    this.scene = scene;
    this.applyViewTuning();
    this.applyMaterialState();
    this.createHoverHex();
  }

  private createHoverHex(): void {
    const shapes = createHexRingShapes();

    this.hoverHex = new THREE.Mesh(shapes.glow, this.materials.glow);
    this.hoverHex.position.y = HEX_RING_LIFT.glow;
    this.hoverHex.rotation.x = -Math.PI / 2; // Rotate to face ground plane
    this.hoverHex.renderOrder = 50; // Lower render order to avoid interfering with labels
    this.hoverHex.raycast = () => {}; // Disable raycasting to prevent interference
    this.hoverHex.visible = false;

    this.hoverHalo = new THREE.Mesh(shapes.halo, this.materials.halo);
    this.hoverHalo.position.y = HEX_RING_LIFT.halo;
    this.hoverHalo.rotation.x = -Math.PI / 2;
    this.hoverHalo.renderOrder = 49;
    this.hoverHalo.raycast = () => {};
    this.hoverHalo.visible = false;

    this.hoverOutline = new THREE.LineSegments(shapes.outline, this.materials.outline);
    this.hoverOutline.position.y = HEX_RING_LIFT.outline;
    this.hoverOutline.rotation.x = -Math.PI / 2;
    this.hoverOutline.renderOrder = 51;
    this.hoverOutline.raycast = () => {};
    this.hoverOutline.visible = false;
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

    this.attachHoverFill();
  }

  /**
   * Show hover effect at the specified position
   */
  public showHover(x: number, z: number): void {
    if (!this.hoverHex) return;

    this.hoverHex.position.set(x, HEX_RING_LIFT.glow, z);
    if (this.hoverHalo) {
      this.hoverHalo.position.set(x, HEX_RING_LIFT.halo, z);
    }
    if (this.hoverOutline) {
      this.hoverOutline.position.set(x, HEX_RING_LIFT.outline, z);
    }
    this.drapeOnTerrain();
    this.attachHoverFill();
    this.isVisible = true;
  }

  private drapeOnTerrain(): void {
    for (const object of [this.hoverHex, this.hoverHalo, this.hoverOutline]) {
      if (!object) continue;
      const positions = object.geometry.getAttribute("position");
      for (let index = 0; index < positions.count; index++) {
        const worldX = object.position.x + positions.getX(index);
        const worldZ = object.position.z - positions.getY(index);
        positions.setZ(index, this.terrain.sampleSurface(worldX, worldZ).height);
      }
      positions.needsUpdate = true;
      object.geometry.computeBoundingSphere();
    }
  }

  /**
   * Hide the hover effect
   */
  public hideHover(): void {
    if (!this.hoverHex || !this.isVisible) return;

    this.detachHoverFill();

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
      centerAlpha: 0,
      fillAttached: Boolean(this.hoverHex?.parent),
      isVisible: this.isVisible,
      materialType: this.materials.glow.type,
      scanWidth: 0,
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
      this.materials.glow.dispose();
      this.hoverHex = null;
    }

    if (this.hoverHalo) {
      this.scene.remove(this.hoverHalo);
      this.hoverHalo.geometry.dispose();
      this.hoverHalo = null;
    }

    this.materials.halo.dispose();

    if (this.hoverOutline) {
      this.scene.remove(this.hoverOutline);
      this.hoverOutline.geometry.dispose();
      this.hoverOutline = null;
    }

    this.materials.outline.dispose();

    this.isVisible = false;
  }

  private attachHoverFill(): void {
    if (!this.hoverHex) {
      return;
    }

    if (this.hoverHalo) {
      if (this.visualMode === "fill") {
        if (!this.hoverHalo.parent) {
          this.scene.add(this.hoverHalo);
        }

        this.hoverHalo.visible = true;
      } else {
        if (this.hoverHalo.parent) {
          this.scene.remove(this.hoverHalo);
        }

        this.hoverHalo.visible = false;
      }
    }

    if (this.visualMode === "fill") {
      if (!this.hoverHex.parent) {
        this.scene.add(this.hoverHex);
      }

      this.hoverHex.visible = true;
    } else {
      if (this.hoverHex.parent) {
        this.scene.remove(this.hoverHex);
      }

      this.hoverHex.visible = false;
    }

    if (this.hoverOutline) {
      if (!this.hoverOutline.parent) {
        this.scene.add(this.hoverOutline);
      }

      this.hoverOutline.visible = true;
    }
  }

  private detachHoverFill(): void {
    if (!this.hoverHex) {
      return;
    }

    if (this.hoverHalo) {
      if (this.hoverHalo.parent) {
        this.scene.remove(this.hoverHalo);
      }

      this.hoverHalo.visible = false;
    }

    if (this.hoverHex.parent) {
      this.scene.remove(this.hoverHex);
    }

    this.hoverHex.visible = false;

    if (this.hoverOutline) {
      if (this.hoverOutline.parent) {
        this.scene.remove(this.hoverOutline);
      }

      this.hoverOutline.visible = false;
    }
  }

  private applyMaterialState(): void {
    const pulse = this.isVisible ? 0.94 + 0.06 * Math.sin(this.pulseTime * 2.2) : undefined;
    applyHexRingLook(this.materials, this.rimColor, this.hoverIntensity, pulse);
  }

  private applyViewTuning(): void {}
}
