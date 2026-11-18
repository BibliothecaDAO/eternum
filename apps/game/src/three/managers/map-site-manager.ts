import { DEEP_SITE_FACES } from "@/ui/features/frontier/deep/deep-site-faces";
import { configManager, getBlockTimestamp } from "@bibliothecadao/eternum";
import { readDeepBeastTroops, safeInteger, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  DEEP_BEASTS,
  beastModel,
  deepSites,
  MineKinds,
  TileOccupier,
  type BeastIdle,
  type BeastModel,
} from "@bibliothecadao/types";
import type { MapPlateInput, MapPlateScope } from "../map-plates/map-plate-layer";
import { PLATE_CLEARANCE } from "./structure-visible-presentation";
import { presentResult } from "@/three/presented-results";
import { activeMapLayer } from "@/three/map-layer";
import { frontierPaintedPath } from "../structures/frontier-painted-buildings";
import { FRONTIER_BEASTS } from "../structures/frontier-beast";
import { FrontierModel } from "../structures/frontier-model";
import InstancedModel from "@/three/managers/instanced-model";
import { FELT_CENTER } from "@/ui/config";
import {
  projectionChangesForLayer,
  type WorldSpatialProjection,
  type TileSpatialRenderable,
} from "@bibliothecadao/eternum/game-sync";
import { Box3, Object3D, Scene } from "three";
import { FLAT_TERRAIN_SURFACE, placePositionOnTerrain, type TerrainSurface } from "../terrain/terrain-surface";
import { getWorldPositionForHex } from "../utils";
import { gltfLoader } from "../utils/utils";
import { publishMapSelection } from "@/observability/map-selection";
import { HYPERSTRUCTURE_BASE_HEIGHT } from "../structures/hyperstructure-design";
import { HyperstructureModel } from "../structures/hyperstructure-model";

/** How a Deep site stands on the map: the hyperstructure's own foundation, or a model's file. */
type DeepSiteLook = { kind: "hyperstructure-foundation" } | { kind: "model"; path: () => string };

const DEEP_SITE_LOOKS = {
  foundation: { kind: "hyperstructure-foundation" },
  core: { kind: "model", path: () => MineKinds[1].model },
  mine: { kind: "model", path: () => MineKinds[2].model },
  altar: { kind: "model", path: () => frontierPaintedPath("shrine") },
} as const satisfies Record<(typeof deepSites)[number]["key"], DeepSiteLook>;

/** A site the manager draws: which tiles it stands on, and the model it loads once a tile of it is seen. */
type DrawnSite = {
  key: string;
  name: string;
  stands: (tile: TileSpatialRenderable) => boolean;
  model: () => Promise<{ model: InstancedModel; height: number }>;
  scale: number;
  idle?: BeastIdle;
};
type SiteHex = { col: number; row: number };
type PlacedSite = SiteHex & { entityId: number };

/**
 * Draws each Deep site where its tile says it stands. A
 * kind's model loads only once a tile of it is seen, so a game without them never requests the assets.
 */
export class MapSiteManager {
  private readonly dummy = new Object3D();
  private readonly models = new Map<DrawnSite["key"], InstancedModel>();
  private readonly loading = new Map<DrawnSite["key"], Promise<void>>();
  private readonly unsubscribe: () => void;
  private readonly unsubscribeRewards: () => void;
  private readonly heights = new Map<DrawnSite["key"], number>();
  private modelVisible = true;
  private destroyed = false;
  private readonly sites: DrawnSite[] = [
    ...deepSites.map((kind) => {
      const look: DeepSiteLook = DEEP_SITE_LOOKS[kind.key];
      return {
        key: `deep:${kind.key}`,
        name: kind.name,
        stands: (tile: TileSpatialRenderable) =>
          tile.occupierType === TileOccupier.DeepSite &&
          this.deepKindOf(tile.occupierId) === kind.id &&
          !this.beastGuards(tile.occupierId),
        model: () => (look.kind === "model" ? modelOf(look.path(), kind.name) : Promise.resolve(foundationModel())),
        scale: 1,
      };
    }),
    ...deepSites.map((kind) => {
      const beast = DEEP_BEASTS[kind.key];
      return {
        key: `deep-beast:${kind.key}`,
        name: beast.name,
        stands: (tile: TileSpatialRenderable) =>
          tile.occupierType === TileOccupier.DeepSite &&
          this.deepKindOf(tile.occupierId) === kind.id &&
          this.beastGuards(tile.occupierId),
        model: () => beastModelOf(beastModel(beast)),
        scale: beast.scale,
        idle: beast.idle,
      };
    }),
  ];

  constructor(
    private readonly scene: Scene,
    private readonly projection: WorldSpatialProjection,
    private readonly store: NativeFactStore,
    private readonly plates: MapPlateScope,
    private readonly terrain: TerrainSurface = FLAT_TERRAIN_SURFACE,
  ) {
    this.unsubscribe = projection.subscribeTiles((changes) => {
      const onLayer = projectionChangesForLayer(changes, activeMapLayer());
      const touched = onLayer.some(
        ({ previous, current }) => isMapSite(previous?.occupierType) || isMapSite(current?.occupierType),
      );
      if (!touched) return;
      this.refresh();
      for (const { previous, current } of onLayer) {
        if (previous && isMapSite(previous.occupierType) && !isMapSite(current?.occupierType)) {
          presentResult(`site-gone:${previous.hexCoords.col},${previous.hexCoords.row}`);
        }
      }
    });
    this.unsubscribeRewards = store.subscribe((changes) => {
      const touched = changes.some(
        (change) =>
          change.model === "DeepSite" ||
          (change.model === "Guard" && this.guardsDeepSite(change.current ?? change.previous)),
      );
      if (touched) this.refresh();
    });
    this.refresh();
  }

  public hover(tile: SiteHex | null): void {
    const site =
      tile &&
      this.projection
        .getTiles(activeMapLayer())
        .find(
          (row) =>
            row.hexCoords.col === tile.col &&
            row.hexCoords.row === tile.row &&
            row.occupierType === TileOccupier.DeepSite,
        );
    if (site) this.plates.setHover(site.occupierId);
    else this.plates.clearHover();
  }

  public setModelVisible(visible: boolean): void {
    this.modelVisible = visible;
    this.models.forEach((model) => (model.group.visible = visible));
    this.refreshPlates();
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
    this.unsubscribeRewards();
    this.plates.dispose();
    this.models.forEach((model) => model.dispose());
    this.models.clear();
  }

  private refresh(): void {
    if (this.destroyed) return;
    this.refreshPlates();
    for (const site of this.sites) {
      const hexes = this.siteHexes(site);
      const model = this.models.get(site.key);
      if (!model) {
        if (hexes.length > 0) this.load(site);
        continue;
      }
      const previous = model.getCount();
      hexes.forEach((hex, index) => {
        model.setMatrixAt(index, this.placement(hex, site.scale));
        if (site.idle && model instanceof FrontierModel) model.setIdleAt(index, site.idle);
        // The Foundation is a hyperstructure's foundation alone: no Aspect builds this one.
        if (model instanceof HyperstructureModel)
          model.setConstructionAt(index, { entityId: hex.entityId, progress: 0, completed: false });
      });
      for (let index = hexes.length; index < previous; index += 1) model.removeInstance(index);
      model.setCount(hexes.length);
      model.needsUpdate();
    }
    publishMapSelection({ drawnSites: this.drawnKinds(), siteHexes: this.kindHexes() });
  }

  private drawnKinds(): Record<string, number> {
    const drawn = (key: string) => this.models.get(key)?.getCount() ?? 0;
    return Object.fromEntries(
      deepSites.map(({ key }) => [`deep:${key}`, drawn(`deep:${key}`) + drawn(`deep-beast:${key}`)]),
    );
  }

  private kindHexes(): Record<string, { col: number; row: number }> {
    const tiles = this.projection.getTiles(activeMapLayer());
    return Object.fromEntries(
      deepSites.flatMap((kind) => {
        const tile = tiles.find(
          (each) => each.occupierType === TileOccupier.DeepSite && this.deepKindOf(each.occupierId) === kind.id,
        );
        return tile ? [[`deep:${kind.key}`, { col: tile.hexCoords.col, row: tile.hexCoords.row }]] : [];
      }),
    );
  }

  private refreshPlates(): void {
    if (this.destroyed) return;
    const sites = this.modelVisible
      ? this.projection
          .getTiles(activeMapLayer())
          .filter((tile) => tile.occupierType === TileOccupier.DeepSite)
          .slice(0, SITE_CAPACITY)
      : [];
    const placed: number[] = [];
    for (const tile of sites) {
      const plate = this.deepPlate(tile);
      if (!plate) continue;
      this.plates.setLabel(plate);
      placed.push(safeInteger(plate.entityId));
    }
    this.plates.retainOnly(placed);
  }

  private deepPlate(tile: TileSpatialRenderable): MapPlateInput {
    const site = this.store.require("DeepSite", {
      game_id: configManager.getActiveGameId(),
      entity_id: tile.occupierId,
    });
    const kind = deepSites.find((candidate) => candidate.id === site.kind);
    if (!kind) throw new Error("Unknown Deep site kind");
    const position = getWorldPositionForHex({
      col: tile.hexCoords.col - FELT_CENTER(),
      row: tile.hexCoords.row - FELT_CENTER(),
    });
    const standing = this.beastGuards(tile.occupierId) ? `deep-beast:${kind.key}` : `deep:${kind.key}`;
    placePositionOnTerrain(position, this.terrain, (this.heights.get(standing) ?? 0) + PLATE_CLEARANCE);
    return {
      entityId: tile.occupierId,
      position,
      plate: {
        kind: "structure",
        relation: "neutral",
        name: kind.name,
        named: false,
        owner: "",
        icon: DEEP_SITE_FACES[kind.key].icon,
        guards: null,
        arrivals: [],
      },
    };
  }

  private load(site: DrawnSite): void {
    if (this.loading.has(site.key)) return;
    const loading = site
      .model()
      .then(({ model, height }) => {
        if (this.destroyed) return model.dispose();
        this.heights.set(site.key, height * site.scale);
        model.group.visible = this.modelVisible;
        this.scene.add(model.group);
        this.models.set(site.key, model);
        this.refresh();
      })
      .catch((error) => console.error(`[MapSiteManager] Failed to load the ${site.name} model`, error))
      .finally(() => this.loading.delete(site.key));
    this.loading.set(site.key, loading);
  }

  private siteHexes(site: DrawnSite): PlacedSite[] {
    return this.projection
      .getTiles(activeMapLayer())
      .filter((tile) => site.stands(tile))
      .slice(0, SITE_CAPACITY)
      .map(({ hexCoords, occupierId }) => ({ col: hexCoords.col, row: hexCoords.row, entityId: occupierId }));
  }

  /** A Deep site's kind, from its DeepSite row; none while that row is on its way. */
  private deepKindOf(entityId: number): number | undefined {
    return this.store.get("DeepSite", { game_id: configManager.getActiveGameId(), entity_id: entityId })?.kind;
  }

  private beastGuards(entityId: number): boolean {
    const troops = readDeepBeastTroops(
      this.store,
      getBlockTimestamp().currentDefaultTick,
      BigInt(entityId),
      configManager.getActiveGameId(),
    );
    return (troops ?? 0n) > 0n;
  }

  private guardsDeepSite(guard: { structure_id: bigint } | undefined): boolean {
    return guard !== undefined && this.deepKindOf(safeInteger(guard.structure_id)) !== undefined;
  }

  private placement(hex: SiteHex, scale: number) {
    const position = getWorldPositionForHex({ col: hex.col - FELT_CENTER(), row: hex.row - FELT_CENTER() });
    this.dummy.position.copy(placePositionOnTerrain(position, this.terrain));
    this.dummy.scale.setScalar(scale);
    this.dummy.updateMatrix();
    return this.dummy.matrix;
  }
}

/** Sites a day's map can hold at once; the draw spaces them far below this. */
const SITE_CAPACITY = 64;

/** A site's model from its file, and how tall it stands, for the plate over it. */
const modelOf = async (path: string, name: string) => {
  const gltf = await gltfLoader.loadAsync(path);
  return {
    model: new InstancedModel(gltf, SITE_CAPACITY, false, name),
    height: new Box3().setFromObject(gltf.scene).max.y,
  };
};

const beastModelOf = async (species: BeastModel) => {
  const gltf = await gltfLoader.loadAsync(FRONTIER_BEASTS[species].path);
  return { model: new FrontierModel(gltf, SITE_CAPACITY, species), height: new Box3().setFromObject(gltf.scene).max.y };
};

/** The Foundation's model: a hyperstructure's own, standing at its foundation, its plate just over that base. */
const foundationModel = () => ({ model: new HyperstructureModel(SITE_CAPACITY), height: HYPERSTRUCTURE_BASE_HEIGHT });

const isMapSite = (occupier: number | undefined): boolean => occupier === TileOccupier.DeepSite;
