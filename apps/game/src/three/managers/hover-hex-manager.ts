import { HEX_SIZE } from "@/three/constants";
import * as THREE from "three";
import { FLAT_TERRAIN_SURFACE, type TerrainSurface } from "@/three/terrain/terrain-surface";
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

const HOVER_SURFACE_OFFSET = 0.03;

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
  private readonly hoverMaterial: THREE.MeshBasicMaterial;
  private readonly hoverHaloMaterial: THREE.MeshBasicMaterial;
  private readonly hoverOutlineMaterial: THREE.LineBasicMaterial;
  private readonly baseColor = new THREE.Color(0.2, 0.6, 1.0);
  private readonly rimColor = new THREE.Color(0.4, 0.8, 1.0).multiplyScalar(2.0);
  private hoverIntensity = 0.6;
  private pulseTime = 0;
  private readonly animatedColor = new THREE.Color();
  private currentCameraView = 2;

  constructor(
    scene: THREE.Scene,
    private readonly terrain: TerrainSurface = FLAT_TERRAIN_SURFACE,
  ) {
    this.scene = scene;
    this.hoverMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4fd8,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.hoverMaterial.toneMapped = false;
    this.hoverHaloMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb3f5,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.hoverHaloMaterial.toneMapped = false;
    this.hoverOutlineMaterial = new THREE.LineBasicMaterial({
      color: 0xffb3f5,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
    });
    this.hoverOutlineMaterial.toneMapped = false;
    this.applyViewTuning();
    this.applyMaterialState();
    this.createHoverHex();
  }

  private createRingGeometry(outerRadius: number, innerRadius: number): THREE.BufferGeometry {
    const outer = this.getHexagonPoints(outerRadius);
    const inner = this.getHexagonPoints(innerRadius);
    const positions: number[] = [];
    const indices: number[] = [];
    for (let index = 0; index < outer.length; index++) {
      positions.push(outer[index].x, outer[index].y, 0, inner[index].x, inner[index].y, 0);
      const start = index * 2;
      const next = ((index + 1) % outer.length) * 2;
      indices.push(start, next, start + 1, next, next + 1, start + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    return geometry;
  }

  private getHexagonPoints(radius: number): THREE.Vector2[] {
    const points: THREE.Vector2[] = [];
    // Extra samples along straight hex edges follow curved shores and relief.
    for (let edge = 0; edge < 6; edge++) {
      const angle = (Math.PI / 3) * edge - Math.PI / 2;
      const nextAngle = angle + Math.PI / 3;
      const start = new THREE.Vector2(radius * Math.cos(angle), radius * Math.sin(angle));
      const end = new THREE.Vector2(radius * Math.cos(nextAngle), radius * Math.sin(nextAngle));
      for (let step = 0; step < 6; step++) points.push(start.clone().lerp(end, step / 6));
    }
    return points;
  }

  private createOutlineGeometry(): THREE.BufferGeometry {
    const points = this.getHexagonPoints(HEX_SIZE * 1.02);
    const positions: number[] = [];
    for (let index = 0; index < points.length; index++) {
      const next = points[(index + 1) % points.length];
      positions.push(points[index].x, points[index].y, 0, next.x, next.y, 0);
    }
    return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  }

  private createHoverHex(): void {
    const glowGeometry = this.createRingGeometry(HEX_SIZE * 1.08, HEX_SIZE * 0.96);
    const haloGeometry = this.createRingGeometry(HEX_SIZE * 1.14, HEX_SIZE * 0.9);
    const outlineGeometry = this.createOutlineGeometry();

    this.hoverHex = new THREE.Mesh(glowGeometry, this.hoverMaterial);
    this.hoverHex.position.y = HOVER_SURFACE_OFFSET;
    this.hoverHex.rotation.x = -Math.PI / 2; // Rotate to face ground plane
    this.hoverHex.renderOrder = 50; // Lower render order to avoid interfering with labels
    this.hoverHex.raycast = () => {}; // Disable raycasting to prevent interference
    this.hoverHex.visible = false;

    this.hoverHalo = new THREE.Mesh(haloGeometry, this.hoverHaloMaterial);
    this.hoverHalo.position.y = HOVER_SURFACE_OFFSET - 0.002;
    this.hoverHalo.rotation.x = -Math.PI / 2;
    this.hoverHalo.renderOrder = 49;
    this.hoverHalo.raycast = () => {};
    this.hoverHalo.visible = false;

    this.hoverOutline = new THREE.LineSegments(outlineGeometry, this.hoverOutlineMaterial);
    this.hoverOutline.position.y = HOVER_SURFACE_OFFSET + 0.005;
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

    this.hoverHex.position.set(x, HOVER_SURFACE_OFFSET, z);
    if (this.hoverHalo) {
      this.hoverHalo.position.set(x, HOVER_SURFACE_OFFSET - 0.002, z);
    }
    if (this.hoverOutline) {
      this.hoverOutline.position.set(x, HOVER_SURFACE_OFFSET + 0.005, z);
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
      materialType: this.hoverMaterial.type,
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
      this.hoverMaterial.dispose();
      this.hoverHex = null;
    }

    if (this.hoverHalo) {
      this.scene.remove(this.hoverHalo);
      this.hoverHalo.geometry.dispose();
      this.hoverHalo = null;
    }

    this.hoverHaloMaterial.dispose();

    if (this.hoverOutline) {
      this.scene.remove(this.hoverOutline);
      this.hoverOutline.geometry.dispose();
      this.hoverOutline = null;
    }

    this.hoverOutlineMaterial.dispose();

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
    this.hoverMaterial.color.copy(this.rimColor);
    this.hoverHaloMaterial.color.copy(this.rimColor);
    this.hoverOutlineMaterial.color.copy(this.rimColor);

    if (!this.isVisible) {
      this.hoverMaterial.opacity = 0.26 + this.hoverIntensity * 0.1;
      this.hoverHaloMaterial.opacity = 0.12 + this.hoverIntensity * 0.08;
      this.hoverOutlineMaterial.opacity = Math.min(1, 0.9 + this.hoverIntensity * 0.08);
      return;
    }

    const pulse = 0.94 + 0.06 * Math.sin(this.pulseTime * 2.2);
    this.animatedColor.copy(this.rimColor);
    this.hoverMaterial.opacity = 0.22 + this.hoverIntensity * 0.14 + pulse * 0.04;
    this.hoverHaloMaterial.opacity = 0.1 + this.hoverIntensity * 0.12 + pulse * 0.05;
    this.hoverOutlineMaterial.opacity = Math.min(1, 0.88 + this.hoverIntensity * 0.12 + pulse * 0.03);
  }

  private applyViewTuning(): void {}
}
