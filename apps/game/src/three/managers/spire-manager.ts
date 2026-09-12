import { useUIStore } from "@/hooks/store/use-ui-store";
import { SPIRE_MODEL_PATH } from "@/three/constants/scene-constants";
import { activeMapLayer } from "@/three/map-layer";
import { FELT_CENTER } from "@/ui/config";
import {
  projectionChangesForLayer,
  type TileSpatialRenderable,
  type WorldSpatialProjection,
} from "@bibliothecadao/eternum/game-sync";
import { TileOccupier } from "@bibliothecadao/types";
import { Group, Object3D, Scene } from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { SpireModel } from "../structures/spire-model";
import { FLAT_TERRAIN_SURFACE, placePositionOnTerrain, type TerrainSurface } from "../terrain/terrain-surface";
import { getWorldPositionForHex } from "../utils";
import { gltfLoader } from "../utils/utils";

/** Spires belong to tiles, so they never require a Structure component. */
export class SpireManager {
  private readonly dummy = new Object3D();
  private readonly subscriptions: Array<() => void>;
  private model: SpireModel | null = null;
  private loading: Promise<void> | null = null;
  private capacity = 0;
  private modelVisible = true;
  private destroyed = false;

  constructor(
    private readonly scene: Scene,
    private readonly projection: WorldSpatialProjection,
    private readonly labels: Group,
    private readonly terrain: TerrainSurface = FLAT_TERRAIN_SURFACE,
    private readonly markLabelsDirty: () => void = () => {},
  ) {
    this.subscriptions = [
      projection.subscribeTiles((changes) => {
        const relevant = projectionChangesForLayer(changes, activeMapLayer());
        if (
          relevant.some(
            ({ previous, current }) =>
              previous?.occupierType === TileOccupier.Spire || current?.occupierType === TileOccupier.Spire,
          )
        )
          this.refresh();
      }),
      useUIStore.subscribe(
        (state) => state.mapLayer,
        () => this.refresh(),
      ),
    ];
    this.refresh();
  }

  public setModelVisible(visible: boolean): void {
    this.modelVisible = visible;
    if (this.model) this.model.group.visible = visible;
  }

  public update(delta: number): void {
    this.model?.updateAnimations(delta);
  }

  public destroy(): void {
    this.destroyed = true;
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.clearLabels();
    this.model?.dispose();
    this.model = null;
  }

  private refresh(): void {
    if (this.destroyed) return;
    const tiles = this.getSpireTiles();
    this.clearLabels();
    this.model?.setCount(0);
    if (!tiles.length) return;
    if (!this.model || tiles.length > this.capacity) {
      // No spire tiles means no asset request, including every Blitz game.
      if (!this.loading) {
        this.loading = this.loadModel(tiles.length).finally(() => {
          this.loading = null;
        });
      }
      return;
    }
    tiles.forEach((tile, index) => this.placeSpire(tile, index));
    this.model.setCount(tiles.length);
    this.model.needsUpdate();
  }

  private placeSpire(tile: TileSpatialRenderable, index: number): void {
    const position = getWorldPositionForHex({
      col: tile.hexCoords.col - FELT_CENTER(),
      row: tile.hexCoords.row - FELT_CENTER(),
    });
    placePositionOnTerrain(position, this.terrain);
    this.dummy.position.copy(position);
    this.dummy.updateMatrix();
    this.model!.setMatrixAt(index, this.dummy.matrix);
    const element = document.createElement("div");
    element.textContent = "Spire";
    element.className = "rounded-md px-2 py-1 text-xs text-gold bg-dark-brown/90 border border-gold/30";
    element.style.pointerEvents = "none";
    const label = new CSS2DObject(element);
    label.position.copy(position);
    label.position.y += 2.5;
    this.labels.add(label);
  }

  private async loadModel(capacity: number): Promise<void> {
    try {
      const [gltf, { SpireModel }] = await Promise.all([
        gltfLoader.loadAsync(SPIRE_MODEL_PATH),
        import("../structures/spire-model"),
      ]);
      if (this.destroyed) return;
      this.model?.dispose();
      this.capacity = Math.max(capacity, this.getSpireTiles().length);
      this.model = new SpireModel(gltf, this.capacity);
      this.model.group.visible = this.modelVisible;
      this.scene.add(this.model.group);
      this.refresh();
    } catch (error) {
      console.error("[SpireManager] Failed to load spire model", error);
    }
  }

  private getSpireTiles() {
    return this.projection.getTiles(activeMapLayer()).filter((tile) => tile.occupierType === TileOccupier.Spire);
  }

  private clearLabels(): void {
    this.markLabelsDirty();
    for (const child of [...this.labels.children]) {
      if (child instanceof CSS2DObject) child.element.remove();
      this.labels.remove(child);
    }
  }
}
