import { HoverHexManager } from "@/three/managers/hover-hex-manager";
import { Particles } from "@/three/managers/particles";
import { resolveHoverVisualPalette } from "@/three/managers/worldmap-interaction-palette";
import { FLAT_TERRAIN_SURFACE, type TerrainSurface } from "@/three/terrain/terrain-surface";
import * as THREE from "three";

/**
 * The selected hex holds the hover's own look on its own layer, so hover and selection never collide, and lifts
 * a particle ring above it so the held hex reads at a glance.
 */
export class SelectedHexManager {
  private readonly hover: HoverHexManager;
  private readonly particles: Particles;

  constructor(
    scene: THREE.Scene,
    private readonly terrainSurface: TerrainSurface = FLAT_TERRAIN_SURFACE,
  ) {
    this.hover = new HoverHexManager(scene, terrainSurface);
    this.hover.applyHoverPalette(resolveHoverVisualPalette({ hasSelection: false }));
    this.particles = new Particles(scene);
    this.particles.setParticleSize(0.2);
    this.particles.setLightIntensity(1);
  }

  setPosition(x: number, z: number) {
    this.hover.showHover(x, z);
    this.particles.setPosition(x, this.terrainSurface.sampleSurface(x, z).height + 0.1, z);
  }

  resetPosition() {
    this.hover.hideHover();
    this.particles.resetPosition();
  }

  update(deltaTime: number) {
    this.hover.update(deltaTime);
    this.particles.update(deltaTime);
  }

  dispose() {
    this.hover.dispose();
    this.particles.dispose();
  }
}
