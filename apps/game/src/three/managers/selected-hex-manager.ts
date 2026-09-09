import { HoverHexManager } from "@/three/managers/hover-hex-manager";
import { FLAT_TERRAIN_SURFACE, type TerrainSurface } from "@/three/terrain/terrain-surface";
import * as THREE from "three";

/** The selected hex holds the same outline the hover draws, on its own layer so hover and selection never collide. */
export class SelectedHexManager {
  private readonly outline: HoverHexManager;

  constructor(scene: THREE.Scene, terrainSurface: TerrainSurface = FLAT_TERRAIN_SURFACE) {
    this.outline = new HoverHexManager(scene, terrainSurface);
    this.outline.setVisualMode("outline");
  }

  setPosition(x: number, z: number) {
    this.outline.showHover(x, z);
  }

  resetPosition() {
    this.outline.hideHover();
  }

  update(deltaTime: number) {
    this.outline.update(deltaTime);
  }

  dispose() {
    this.outline.dispose();
  }
}
