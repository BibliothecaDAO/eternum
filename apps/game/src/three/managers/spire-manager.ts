import { useUIStore } from "@/hooks/store/use-ui-store";
import { SPIRE_MODEL_PATH } from "@/three/constants/scene-constants";
import { activeMapLayer } from "@/three/map-layer";
import { FELT_CENTER } from "@/ui/config";
import { projectionChangesForLayer, type WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { TileOccupier } from "@bibliothecadao/types";
import { Camera, Group, Object3D, Scene, type Vector3 } from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { SpireModel } from "../structures/spire-model";
import { FLAT_TERRAIN_SURFACE, placePositionOnTerrain, type TerrainSurface } from "../terrain/terrain-surface";
import { getWorldPositionForHex } from "../utils";
import { gltfLoader } from "../utils/utils";

/** Spires stood on the surface by a rule rather than a tile: a Frontier realm's spire, lit by depth research. */
export interface RuleSpires {
  /** Their hexes on the surface, in contract coordinates. */
  hexes(): Array<{ col: number; row: number }>;
  /** Calls back when a rule input changes: a realm's knowledge, or the day turning over. */
  subscribe(onChange: () => void): () => void;
}

/** A spire's hex; a dormant one, found by a Blitz reveal, stands without its portal or a name over it, as scenery. */
type SpireHex = { col: number; row: number; dormant: boolean };

const isSpireTile = (occupierType: number | undefined) =>
  occupierType === TileOccupier.Spire || occupierType === TileOccupier.DormantSpire;

/** Spires belong to tiles or to a rule, so they never require a Structure component. */
export class SpireManager {
  private readonly dummy = new Object3D();
  private readonly subscriptions: Array<() => void>;
  /** Each placed spire, the height it stands at on the terrain, and its name label (none for a dormant spire). */
  private placements: Array<{ hex: SpireHex; y: number; label: CSS2DObject | null }> = [];
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
    private readonly ruleSpires?: RuleSpires,
  ) {
    this.subscriptions = [
      projection.subscribeTiles((changes) => {
        const relevant = projectionChangesForLayer(changes, activeMapLayer());
        if (
          relevant.some(
            ({ previous, current }) => isSpireTile(previous?.occupierType) || isSpireTile(current?.occupierType),
          )
        )
          this.refresh();
      }),
      useUIStore.subscribe(
        (state) => state.mapLayer,
        () => this.refresh(),
      ),
      ...(ruleSpires ? [ruleSpires.subscribe(() => this.refresh())] : []),
    ];
    this.refresh();
  }

  public setModelVisible(visible: boolean): void {
    this.modelVisible = visible;
    if (this.model) this.model.group.visible = visible;
  }

  public update(delta: number, camera?: Camera): void {
    this.model?.updateAnimations(delta, { camera });
  }

  /** Terrain pages can arrive after the asset; move existing instances and labels onto the new surface. */
  public refreshTerrainPlacement(): void {
    if (!this.model || this.destroyed) return;
    let changed = false;
    this.placements.forEach((placement, index) => {
      const position = this.getSpirePosition(placement.hex);
      if (placement.y === position.y) return;
      this.dummy.position.copy(position);
      this.dummy.updateMatrix();
      this.model!.placeSpire(index, this.dummy.matrix, placement.hex.dormant);
      placement.y = position.y;
      if (placement.label) placement.label.position.y = position.y + this.model!.labelHeight;
      changed = true;
    });
    if (changed) {
      this.model.needsUpdate();
      this.markLabelsDirty();
    }
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
    const tiles = this.getSpireHexes();
    this.clearLabels();
    this.model?.setCount(0);
    if (!tiles.length) return;
    if (!this.model || tiles.length > this.capacity) {
      // No spire tiles means no asset request: a Blitz game loads it only once a reveal finds a dormant spire.
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

  private placeSpire(hex: SpireHex, index: number): void {
    const position = this.getSpirePosition(hex);
    this.dummy.position.copy(position);
    this.dummy.updateMatrix();
    this.model!.placeSpire(index, this.dummy.matrix, hex.dormant);
    this.placements.push({ hex, y: position.y, label: hex.dormant ? null : this.addLabel(position) });
  }

  private addLabel(position: Vector3): CSS2DObject {
    const element = document.createElement("div");
    element.textContent = "Spire";
    element.className = "rounded-md px-2 py-1 text-xs text-gold bg-dark-brown/90 border border-gold/30";
    element.style.pointerEvents = "none";
    const label = new CSS2DObject(element);
    label.position.copy(position);
    label.position.y += this.model!.labelHeight;
    this.labels.add(label);
    return label;
  }

  private getSpirePosition(hex: SpireHex) {
    const position = getWorldPositionForHex({ col: hex.col - FELT_CENTER(), row: hex.row - FELT_CENTER() });
    return placePositionOnTerrain(position, this.terrain);
  }

  private async loadModel(capacity: number): Promise<void> {
    try {
      const [gltf, { SpireModel }] = await Promise.all([
        gltfLoader.loadAsync(SPIRE_MODEL_PATH),
        import("../structures/spire-model"),
      ]);
      if (this.destroyed) return;
      this.model?.dispose();
      this.capacity = Math.max(capacity, this.getSpireHexes().length);
      this.model = new SpireModel(gltf, this.capacity);
      this.model.group.visible = this.modelVisible;
      this.scene.add(this.model.group);
      this.refresh();
    } catch (error) {
      console.error("[SpireManager] Failed to load spire model", error);
    }
  }

  private getSpireHexes(): SpireHex[] {
    const layer = activeMapLayer();
    const tileSpires = this.projection
      .getTiles(layer)
      .filter((tile) => isSpireTile(tile.occupierType))
      .map((tile) => ({
        col: tile.hexCoords.col,
        row: tile.hexCoords.row,
        dormant: tile.occupierType === TileOccupier.DormantSpire,
      }));
    // A rule spire stands on the realm's surface ring.
    if (layer || !this.ruleSpires) return tileSpires;
    return [...tileSpires, ...this.ruleSpires.hexes().map((hex) => ({ ...hex, dormant: false }))];
  }

  private clearLabels(): void {
    this.markLabelsDirty();
    this.placements = [];
    for (const child of [...this.labels.children]) {
      if (child instanceof CSS2DObject) child.element.remove();
      this.labels.remove(child);
    }
  }
}
