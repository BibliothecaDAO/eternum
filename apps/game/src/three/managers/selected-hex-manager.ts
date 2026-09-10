import { HoverHexManager } from "@/three/managers/hover-hex-manager";
import { Particles } from "@/three/managers/particles";
import { FLAT_TERRAIN_SURFACE, type TerrainSurface } from "@/three/terrain/terrain-surface";
import * as THREE from "three";

/**
 * The selected hex holds the hover's filled look in the hover manager's own blue, the same ring the terrain lab
 * draws, so a held hex and the hex under the pointer never read as one thing; a particle ring lifts above it.
 */
export class SelectedHexManager {
  private readonly hover: HoverHexManager;
  private readonly particles: Particles;

  constructor(
    scene: THREE.Scene,
    private readonly terrainSurface: TerrainSurface = FLAT_TERRAIN_SURFACE,
  ) {
    this.hover = new HoverHexManager(scene, terrainSurface);
    this.hover.setVisualMode("fill");
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
