import { activeMapLayer } from "@/three/map-layer";
import InstancedModel from "@/three/managers/instanced-model";
import { FELT_CENTER } from "@/ui/config";
import { nativeTileOccupierConstants } from "@bibliothecadao/eternum/game-client";
import { projectionChangesForLayer, type WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { Object3D, Scene } from "three";
import { FLAT_TERRAIN_SURFACE, placePositionOnTerrain, type TerrainSurface } from "../terrain/terrain-surface";
import { getWorldPositionForHex } from "../utils";
import { gltfLoader } from "../utils/utils";

/** Frontier's single-use sites: tile occupancy only, with no Structure, so the tile's category alone places them. */
const MAP_SITES = [
  { occupier: nativeTileOccupierConstants.SHRINE_OCCUPIER, path: "/models/frontier/shrine.glb", name: "Shrine" },
  { occupier: nativeTileOccupierConstants.WELL_OCCUPIER, path: "/models/frontier/well.glb", name: "Well" },
] as const;

type MapSite = (typeof MAP_SITES)[number];
type SiteHex = { col: number; row: number };

/**
 * Draws each Shrine and Well where its tile says it stands, and lets it go the moment its occupancy is consumed. A
 * kind's model loads only once a tile of it is seen, so a game without them never requests the assets.
 */
export class MapSiteManager {
  private readonly dummy = new Object3D();
  private readonly models = new Map<MapSite["occupier"], InstancedModel>();
  private readonly loading = new Map<MapSite["occupier"], Promise<void>>();
  private readonly unsubscribe: () => void;
  private modelVisible = true;
  private destroyed = false;

  constructor(
    private readonly scene: Scene,
    private readonly projection: WorldSpatialProjection,
    private readonly terrain: TerrainSurface = FLAT_TERRAIN_SURFACE,
  ) {
    this.unsubscribe = projection.subscribeTiles((changes) => {
      const touched = projectionChangesForLayer(changes, activeMapLayer()).some(
        ({ previous, current }) => isMapSite(previous?.occupierType) || isMapSite(current?.occupierType),
      );
      if (touched) this.refresh();
    });
    this.refresh();
  }

  public setModelVisible(visible: boolean): void {
    this.modelVisible = visible;
    this.models.forEach((model) => (model.group.visible = visible));
  }

  public resetLayer(): void {
    this.refresh();
  }

  /** Terrain pages can arrive after the sites are placed; re-place them on the surface they now stand on. */
  public refreshTerrainPlacement(): void {
    this.refresh();
  }

  public destroy(): void {
    this.destroyed = true;
    this.unsubscribe();
    this.models.forEach((model) => model.dispose());
    this.models.clear();
  }

  private refresh(): void {
    if (this.destroyed) return;
    for (const site of MAP_SITES) {
      const hexes = this.siteHexes(site);
      const model = this.models.get(site.occupier);
      if (!model) {
        if (hexes.length > 0) this.load(site);
        continue;
      }
      const previous = model.getCount();
      hexes.forEach((hex, index) => model.setMatrixAt(index, this.placement(hex)));
      for (let index = hexes.length; index < previous; index += 1) model.removeInstance(index);
      model.setCount(hexes.length);
      model.needsUpdate();
    }
  }

  private load(site: MapSite): void {
    if (this.loading.has(site.occupier)) return;
    const loading = gltfLoader
      .loadAsync(site.path)
      .then((gltf) => {
        if (this.destroyed) return;
        const model = new InstancedModel(gltf, SITE_CAPACITY, false, site.name);
        model.group.visible = this.modelVisible;
        this.scene.add(model.group);
        this.models.set(site.occupier, model);
        this.refresh();
      })
      .catch((error) => console.error(`[MapSiteManager] Failed to load the ${site.name} model`, error))
      .finally(() => this.loading.delete(site.occupier));
    this.loading.set(site.occupier, loading);
  }

  private siteHexes(site: MapSite): SiteHex[] {
    return this.projection
      .getTiles(activeMapLayer())
      .filter((tile) => tile.occupierType === site.occupier)
      .slice(0, SITE_CAPACITY)
      .map(({ hexCoords }) => ({ col: hexCoords.col, row: hexCoords.row }));
  }

  private placement(hex: SiteHex) {
    const position = getWorldPositionForHex({ col: hex.col - FELT_CENTER(), row: hex.row - FELT_CENTER() });
    this.dummy.position.copy(placePositionOnTerrain(position, this.terrain));
    this.dummy.updateMatrix();
    return this.dummy.matrix;
  }
}

/** Sites a day's map can hold at once; the draw spaces them far below this. */
const SITE_CAPACITY = 64;

const isMapSite = (occupier: number | undefined): boolean => MAP_SITES.some((site) => site.occupier === occupier);
