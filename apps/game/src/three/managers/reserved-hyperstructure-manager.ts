import { activeMapLayer } from "@/three/map-layer";
import { createHyperstructureKit } from "../structures/hyperstructure-kit";
import InstancedModel from "@/three/managers/instanced-model";
import { FELT_CENTER } from "@/ui/config";
import {
  projectionChangesForLayer,
  type StructureSpatialProjectionChange,
  type WorldSpatialProjection,
} from "@bibliothecadao/eternum/game-sync";
import { type HexPosition } from "@bibliothecadao/types";
import { Color, Material, Matrix4, Mesh, MeshStandardMaterial, Object3D, Scene } from "three";
import { incrementWorldmapRenderCounter } from "../perf/worldmap-render-diagnostics";
import { getWorldPositionForHex } from "../utils";
import { FLAT_TERRAIN_SURFACE, placePositionOnTerrain, type TerrainSurface } from "../terrain/terrain-surface";

const RESERVED_HYPERSTRUCTURE_CAPACITY = 128;
const RESERVED_HYPERSTRUCTURE_COLOR = new Color(0xf3cc5b);
const RESERVED_HYPERSTRUCTURE_OPACITY = 0.42;
const RESERVED_HYPERSTRUCTURE_Y_OFFSET = 0.05;

/** Ordinary structure churn never touches the reserved instances; only a reserved site appearing, moving or being claimed does. */
const changesTouchReservedSites = (changes: readonly StructureSpatialProjectionChange[]): boolean =>
  changes.some((change) => change.previous?.reserved === true || change.current?.reserved === true);

const cloneReservedHyperstructureMaterial = (material: Material) => {
  const cloned = material.clone();

  if (cloned instanceof MeshStandardMaterial) {
    cloned.transparent = true;
    cloned.opacity = RESERVED_HYPERSTRUCTURE_OPACITY;
    cloned.depthWrite = false;
    cloned.emissive = RESERVED_HYPERSTRUCTURE_COLOR.clone();
    cloned.emissiveIntensity = Math.max(cloned.emissiveIntensity, 0.7);
    cloned.roughness = 0.68;
    cloned.metalness = 0.18;
  }

  return cloned;
};

const applyReservedHyperstructureMaterialStyle = (gltf: any) => {
  gltf.scene.traverse((child: unknown) => {
    if (!(child instanceof Mesh) || !child.material) {
      return;
    }

    child.material = Array.isArray(child.material)
      ? child.material.map(cloneReservedHyperstructureMaterial)
      : cloneReservedHyperstructureMaterial(child.material);
  });
};

export class ReservedHyperstructureManager {
  private readonly dummy = new Object3D();
  private readonly instanceMatrix = new Matrix4();
  private readonly unsubscribeProjection: () => void;
  private reservedHyperstructureModel: InstancedModel | null = null;
  private modelVisible = true;
  private destroyed = false;
  private placedTerrainHeights: number[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly worldSpatialProjection: WorldSpatialProjection,
    private readonly terrainSurface: TerrainSurface = FLAT_TERRAIN_SURFACE,
  ) {
    this.unsubscribeProjection = worldSpatialProjection.subscribeStructures((changes) => {
      if (!changesTouchReservedSites(projectionChangesForLayer(changes, activeMapLayer()))) return;
      this.renderReservedHyperstructures();
    });
    void this.loadModel();
  }

  /** Reserved sites are structure models for the content ladder: hidden in the far band. */
  public setModelVisible(visible: boolean): void {
    this.modelVisible = visible;
    if (this.reservedHyperstructureModel) this.reservedHyperstructureModel.group.visible = visible;
  }

  public getVisibleCount(): number {
    return this.getReservedHyperstructureHexes().length;
  }

  public destroy(): void {
    this.destroyed = true;
    this.unsubscribeProjection();
    this.reservedHyperstructureModel?.dispose();
    this.reservedHyperstructureModel = null;
  }

  private async loadModel(): Promise<void> {
    try {
      const gltf = createHyperstructureKit(true);

      if (this.destroyed) {
        return;
      }

      applyReservedHyperstructureMaterialStyle(gltf);
      const reservedHyperstructureModel = new InstancedModel(
        gltf,
        RESERVED_HYPERSTRUCTURE_CAPACITY,
        false,
        "ReservedHyperstructure",
      );
      reservedHyperstructureModel.setContactShadowsEnabled(false);
      reservedHyperstructureModel.group.visible = this.modelVisible;
      this.scene.add(reservedHyperstructureModel.group);
      this.reservedHyperstructureModel = reservedHyperstructureModel;
      this.renderReservedHyperstructures();
    } catch (error) {
      console.error("[ReservedHyperstructureManager] Failed to load reserved hyperstructure model", error);
    }
  }

  public resetLayer(): void {
    this.renderReservedHyperstructures();
  }

  /** Terrain pages can arrive after the sites are placed; re-place them once a sampled height has moved. */
  public refreshTerrainPlacement(): void {
    if (!this.reservedHyperstructureModel || this.destroyed) return;
    const heights = this.getReservedHyperstructureHexes().map((hexCoords) => this.sampleTerrainHeight(hexCoords));
    const moved =
      heights.length !== this.placedTerrainHeights.length ||
      heights.some((height, index) => height !== this.placedTerrainHeights[index]);
    if (moved) this.renderReservedHyperstructures();
  }

  private renderReservedHyperstructures(): void {
    const reservedHyperstructureModel = this.reservedHyperstructureModel;
    if (!reservedHyperstructureModel) {
      return;
    }

    incrementWorldmapRenderCounter("reservedSiteRebuilds");
    const entries = this.getReservedHyperstructureHexes();
    const previousCount = reservedHyperstructureModel.getCount();
    this.placedTerrainHeights = entries.map((hexCoords) => this.sampleTerrainHeight(hexCoords));

    entries.forEach((hexCoords, index) => {
      this.instanceMatrix.copy(this.resolveInstanceMatrix(hexCoords));
      reservedHyperstructureModel.setMatrixAt(index, this.instanceMatrix);
      reservedHyperstructureModel.setColorAt(index, RESERVED_HYPERSTRUCTURE_COLOR);
    });

    for (let index = entries.length; index < previousCount; index += 1) {
      reservedHyperstructureModel.removeInstance(index);
    }

    reservedHyperstructureModel.setCount(entries.length);
    reservedHyperstructureModel.needsUpdate();
  }

  private getReservedHyperstructureHexes(): HexPosition[] {
    return this.worldSpatialProjection
      .getStructures(activeMapLayer())
      .filter((structure) => structure.reserved)
      .map((structure) => this.normalizeHexCoords(structure.hexCoords));
  }

  private sampleTerrainHeight(hexCoords: HexPosition): number {
    const position = getWorldPositionForHex(hexCoords);
    return this.terrainSurface.sampleSurface(position.x, position.z).height;
  }

  private resolveInstanceMatrix(hexCoords: HexPosition): Matrix4 {
    const position = getWorldPositionForHex(hexCoords);
    placePositionOnTerrain(position, this.terrainSurface);
    this.dummy.position.set(position.x, position.y + RESERVED_HYPERSTRUCTURE_Y_OFFSET, position.z);
    this.dummy.updateMatrix();
    return this.dummy.matrix;
  }

  private normalizeHexCoords(hexCoords: HexPosition): HexPosition {
    return {
      col: hexCoords.col - FELT_CENTER(),
      row: hexCoords.row - FELT_CENTER(),
    };
  }
}
