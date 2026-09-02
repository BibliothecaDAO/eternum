import * as THREE from "three";
import { HEX_SIZE } from "@/three/constants";
import { createHexagonShape } from "@/three/geometry/hexagon-geometry";
import { FLAT_TERRAIN_SURFACE, type TerrainSurface } from "@/three/terrain/terrain-surface";
import { type PulseVisualPalette, resolveSelectionPulsePalette } from "./worldmap-interaction-palette";

/**
 * Manages pulsing selection effects for armies and structures
 * Optimized to share geometry and material instances where possible
 */
export class SelectionPulseManager {
  private scene: THREE.Scene;
  private pulseMesh: THREE.Mesh | null = null;
  private isVisible = false;
  private selectedEntityId: number | null = null;

  private readonly primaryPulseMaterial: THREE.MeshBasicMaterial;
  private readonly primaryBaseColor = new THREE.Color();
  private readonly primaryPulseColor = new THREE.Color();
  private primaryPulseIntensity = 0.28;
  private primaryPulseTime = 0;
  private readonly animatedPrimaryColor = new THREE.Color();

  constructor(
    scene: THREE.Scene,
    private readonly terrainSurface: TerrainSurface = FLAT_TERRAIN_SURFACE,
  ) {
    this.scene = scene;
    const defaultPulsePalette = resolveSelectionPulsePalette("army");
    this.primaryBaseColor.setHex(defaultPulsePalette.baseColor);
    this.primaryPulseColor.setHex(defaultPulsePalette.pulseColor);
    this.primaryPulseIntensity = defaultPulsePalette.intensity;

    this.primaryPulseMaterial = new THREE.MeshBasicMaterial({
      color: this.primaryBaseColor.clone(),
      opacity: this.primaryPulseIntensity,
      transparent: true,
    });

    this.createPulseMesh();
  }

  private createPulseMesh(): void {
    const geometry = this.createRingGeometry(HEX_SIZE * 1.16, HEX_SIZE * 0.82);

    this.pulseMesh = new THREE.Mesh(geometry, this.primaryPulseMaterial);
    this.pulseMesh.position.y = 0.5; // Much higher above ground for visibility
    this.pulseMesh.rotation.x = -Math.PI / 2; // Rotate to face ground plane
    this.pulseMesh.renderOrder = 100; // Very high render order to ensure visibility
    this.pulseMesh.raycast = () => {}; // Disable raycasting to prevent interference
    this.pulseMesh.visible = false;

    // Add to scene once on creation
    this.scene.add(this.pulseMesh);
  }

  private createRingGeometry(outerRadius: number, innerRadius: number): THREE.ShapeGeometry {
    const outer = createHexagonShape(outerRadius);
    const innerPoints = createHexagonShape(innerRadius).getPoints().slice().reverse();

    outer.holes.push(new THREE.Path(innerPoints));
    return new THREE.ShapeGeometry(outer);
  }

  private shouldAnimate(): boolean {
    return this.isVisible;
  }

  public update(deltaTime: number): void {
    if (!this.shouldAnimate()) {
      return;
    }

    if (deltaTime <= 0) {
      return;
    }

    this.primaryPulseTime += deltaTime;
    this.applyMaterialState(
      this.primaryPulseMaterial,
      this.primaryBaseColor,
      this.primaryPulseColor,
      this.primaryPulseIntensity,
      this.primaryPulseTime,
      this.animatedPrimaryColor,
      this.isVisible,
    );
  }

  /**
   * Show selection pulse at the specified position for an entity
   */
  public showSelection(x: number, z: number, entityId: number): void {
    if (!this.pulseMesh) return;

    // Update position and entity
    this.pulseMesh.position.set(x, this.terrainSurface.sampleSurface(x, z).height + 0.5, z);
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
    this.primaryBaseColor.copy(baseColor);
    this.primaryPulseColor.copy(pulseColor);
    this.applyMaterialState(
      this.primaryPulseMaterial,
      this.primaryBaseColor,
      this.primaryPulseColor,
      this.primaryPulseIntensity,
      this.primaryPulseTime,
      this.animatedPrimaryColor,
      this.isVisible,
    );
  }

  public applyPulsePalette(palette: PulseVisualPalette): void {
    this.primaryBaseColor.setHex(palette.baseColor);
    this.primaryPulseColor.setHex(palette.pulseColor);
    this.primaryPulseIntensity = palette.intensity;
    this.applyMaterialState(
      this.primaryPulseMaterial,
      this.primaryBaseColor,
      this.primaryPulseColor,
      this.primaryPulseIntensity,
      this.primaryPulseTime,
      this.animatedPrimaryColor,
      this.isVisible,
    );
  }

  /**
   * Set pulse intensity (0.0 to 1.0)
   */
  public setPulseIntensity(intensity: number): void {
    this.primaryPulseIntensity = intensity;
    this.applyMaterialState(
      this.primaryPulseMaterial,
      this.primaryBaseColor,
      this.primaryPulseColor,
      this.primaryPulseIntensity,
      this.primaryPulseTime,
      this.animatedPrimaryColor,
      this.isVisible,
    );
  }

  /**
   * Set pulse speed multiplier
   */
  public setPulseSpeed(speed: number): void {
    this.primaryPulseTime *= Math.max(speed, 0.1);
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.pulseMesh) {
      this.scene.remove(this.pulseMesh);
      this.pulseMesh.geometry.dispose();
      this.primaryPulseMaterial.dispose();
      this.pulseMesh = null;
    }

    this.isVisible = false;
    this.selectedEntityId = null;
  }

  private applyMaterialState(
    material: THREE.MeshBasicMaterial,
    baseColor: THREE.Color,
    pulseColor: THREE.Color,
    intensity: number,
    time: number,
    animatedColor: THREE.Color,
    animate: boolean,
  ): void {
    if (!animate) {
      material.color.copy(baseColor);
      material.opacity = intensity;
      return;
    }

    const pulse = 0.5 + 0.5 * Math.sin(time * 4.0);
    animatedColor.copy(baseColor).lerp(pulseColor, 0.35 * pulse);
    material.color.copy(animatedColor);
    material.opacity = intensity * (0.65 + 0.35 * pulse);
  }
}
