import type { TerrainSurface } from "@/three/terrain/terrain-surface";
import type { HexPosition } from "@bibliothecadao/types";
import * as THREE from "three";
import { getWorldPositionForHex } from "../utils/utils";
import {
  applyHexRingLook,
  createHexRingMaterials,
  createHexRingShapes,
  drapeHexRingCopies,
  HEX_RING_LIFT,
  type HexRingShapes,
} from "./hex-ring";
import { OWNERSHIP_RING_LOOK } from "./worldmap-interaction-palette";

type RingLayerName = keyof HexRingShapes;

/** Below the hover ring (49–51), so the hex under the pointer still reads on top of a held one. */
const RENDER_ORDER: Record<RingLayerName, number> = { halo: 46, glow: 47, outline: 48 };

/**
 * The hover ring on every hex a player holds, all of them in one geometry per ring layer: a new set of hexes is one
 * rebuild, drawn in the next frame, and an unchanged set costs nothing.
 */
export class OwnershipRingLayer {
  private readonly shapes = createHexRingShapes();
  private readonly materials = createHexRingMaterials();
  private readonly objects: Record<RingLayerName, THREE.Mesh | THREE.LineSegments>;
  private centres: THREE.Vector3[] = [];
  private shownKey = "";

  constructor(
    private readonly scene: THREE.Scene,
    private readonly terrain: TerrainSurface,
  ) {
    applyHexRingLook(this.materials, new THREE.Color(OWNERSHIP_RING_LOOK.color), OWNERSHIP_RING_LOOK.intensity);
    this.objects = {
      halo: new THREE.Mesh(new THREE.BufferGeometry(), this.materials.halo),
      glow: new THREE.Mesh(new THREE.BufferGeometry(), this.materials.glow),
      outline: new THREE.LineSegments(new THREE.BufferGeometry(), this.materials.outline),
    };
    for (const [name, object] of Object.entries(this.objects) as [RingLayerName, THREE.Object3D][]) {
      object.renderOrder = RENDER_ORDER[name];
      object.raycast = () => {};
      object.visible = false;
      scene.add(object);
    }
  }

  /** Rings exactly these normalized hexes, replacing whatever was ringed. */
  show(hexes: readonly HexPosition[]): void {
    const key = hexes.map(({ col, row }) => `${col},${row}`).join(";");
    if (key === this.shownKey) return;
    this.shownKey = key;
    this.centres = hexes.map((hex) => getWorldPositionForHex(hex));
    this.drape();
  }

  /** Terrain pages stream in after the rings are placed; each one that lands re-grounds them. */
  refreshTerrainPlacement(): void {
    if (this.centres.length > 0) this.drape();
  }

  dispose(): void {
    for (const object of Object.values(this.objects)) {
      this.scene.remove(object);
      object.geometry.dispose();
    }
    for (const shape of Object.values(this.shapes)) shape.dispose();
    for (const material of Object.values(this.materials)) material.dispose();
  }

  private drape(): void {
    for (const [name, object] of Object.entries(this.objects) as [RingLayerName, THREE.Mesh | THREE.LineSegments][]) {
      object.geometry.dispose();
      object.geometry = drapeHexRingCopies(this.shapes[name], this.centres, this.terrain, HEX_RING_LIFT[name]);
      object.visible = this.centres.length > 0;
    }
  }
}
