import { configManager, getBlockTimestamp, readDeepSites } from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { aspectName, deepSites, MineKinds, skillPointGain, TileOccupier } from "@bibliothecadao/types";
import { DEEP_WORDS } from "@/ui/design-system/kit/words";
import { HyperstructureModel } from "../structures/hyperstructure-model";
import { HYPERSTRUCTURE_BASE_HEIGHT } from "../structures/hyperstructure-design";
import { DEEP_SITE_FACES } from "@/ui/features/frontier/deep/deep-site-faces";
import { mapSite } from "@/ui/features/frontier/sites/map-site-plan";
import type { MapPlateInput, MapPlateScope } from "../map-plates/map-plate-layer";
import { PLATE_CLEARANCE } from "./structure-visible-presentation";
import { presentResult } from "@/three/presented-results";
import { activeMapLayer } from "@/three/map-layer";
import { getGameModeConfig } from "@/config/game-modes";
import { frontierPaintedPath } from "../structures/frontier-painted-buildings";
import InstancedModel from "@/three/managers/instanced-model";
import { FELT_CENTER } from "@/ui/config";
import { MAP_SITES, type MapSiteKind, mapSiteOf } from "@/config/map-sites";
import {
  projectionChangesForLayer,
  type WorldSpatialProjection,
  type TileSpatialRenderable,
} from "@bibliothecadao/eternum/game-sync";
import { Box3, Object3D, Scene } from "three";
import { FLAT_TERRAIN_SURFACE, placePositionOnTerrain, type TerrainSurface } from "../terrain/terrain-surface";
import { getWorldPositionForHex } from "../utils";
import { gltfLoader } from "../utils/utils";

/** Each site of the map's catalog (MAP_SITES), as the renderer draws it outside Frontier (Frontier's own are painted). */
const SITE_MODELS: Record<MapSiteKind, string> = {
  Shrine: "/models/outposts/shrine.glb",
  Well: "/models/outposts/well.glb",
};

/** How a Deep site stands on the map: the hyperstructure's own foundation, or a model's file. */
type DeepSiteLook = { kind: "hyperstructure-foundation" } | { kind: "model"; path: () => string };

/**
 * Each of the Deep's sites as the map draws it (the owner's pick eternum/s1-sites, 13 November 2026): the Foundation a
 * hyperstructure's foundation, the Quarry a fragment mine, the Altar a Shrine until its own model comes. A new model is
 * this table's one entry.
 */
const DEEP_SITE_LOOKS = {
  foundation: { kind: "hyperstructure-foundation" },
  quarry: { kind: "model", path: () => MineKinds[2].model },
  altar: { kind: "model", path: () => frontierPaintedPath("shrine") },
} as const satisfies Record<(typeof deepSites)[number]["position"], DeepSiteLook>;

/** A site the manager draws: which tiles it stands on, and the model it loads once one is seen. */
type DrawnSite = {
  key: string;
  name: string;
  stands: (tile: TileSpatialRenderable) => boolean;
  model: () => Promise<{ model: InstancedModel; height: number }>;
};
type SiteHex = { col: number; row: number };
type PlacedSite = SiteHex & { entityId: number };

/**
 * Draws each Shrine and Well where its tile says it stands, and lets it go the moment its occupancy is consumed; and
 * each of the Deep's sites, by its kind, with a plate saying who holds it and what holding it pays. A kind's model loads
 * only once a tile of it is seen, so a game without them never requests the assets.
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
    ...MAP_SITES.map((site) => ({
      key: site.kind,
      name: site.kind,
      stands: (tile: TileSpatialRenderable) => tile.occupierType === site.occupier,
      model: () =>
        modelOf(
          getGameModeConfig().id === "frontier" ? frontierPaintedPath(site.kind.toLowerCase()) : SITE_MODELS[site.kind],
          site.kind,
        ),
    })),
    ...deepSites.map((kind) => {
      const look: DeepSiteLook = DEEP_SITE_LOOKS[kind.position];
      return {
        key: `deep:${kind.position}`,
        name: kind.name,
        stands: (tile: TileSpatialRenderable) =>
          tile.occupierType === TileOccupier.DeepSite && this.deepKindOf(tile.occupierId) === kind.id,
        model: () => (look.kind === "model" ? modelOf(look.path(), kind.name) : Promise.resolve(foundationModel())),
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
      if (changes.some(({ model }) => model === "DeepSite")) this.refresh();
      else if (changes.some(({ model }) => PLATE_MODELS.has(model))) this.refreshPlates();
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
            (mapSiteOf(row.occupierType)?.kind === "Shrine" || row.occupierType === TileOccupier.DeepSite),
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
        model.setMatrixAt(index, this.placement(hex));
        // The Foundation is a hyperstructure's foundation alone: no Aspect builds this one.
        if (model instanceof HyperstructureModel)
          model.setConstructionAt(index, { entityId: hex.entityId, progress: 0, completed: false });
      });
      for (let index = hexes.length; index < previous; index += 1) model.removeInstance(index);
      model.setCount(hexes.length);
      model.needsUpdate();
    }
  }

  private refreshPlates(): void {
    if (this.destroyed) return;
    const sites = this.modelVisible
      ? this.projection
          .getTiles(activeMapLayer())
          .filter((tile) => mapSiteOf(tile.occupierType)?.kind === "Shrine")
          .slice(0, SITE_CAPACITY)
      : [];
    const placed: number[] = [];
    for (const plate of [...sites.map((tile) => this.shrinePlate(tile)), ...this.deepPlates()]) {
      if (!plate) continue;
      this.plates.setLabel(plate);
      placed.push(safeInteger(plate.entityId));
    }
    this.plates.retainOnly(placed);
  }

  private shrinePlate(tile: TileSpatialRenderable): MapPlateInput | undefined {
    const reward = this.store.get("ShrineReward", {
      game_id: configManager.getActiveGameId(),
      entity_id: tile.occupierId,
    });
    const height = this.heights.get("Shrine");
    if (!reward || height === undefined) return undefined;
    const position = getWorldPositionForHex({
      col: tile.hexCoords.col - FELT_CENTER(),
      row: tile.hexCoords.row - FELT_CENTER(),
    });
    placePositionOnTerrain(position, this.terrain, height + PLATE_CLEARANCE);
    const face = mapSite("Shrine");
    return {
      entityId: tile.occupierId,
      position,
      plate: {
        kind: "structure",
        relation: "neutral",
        name: face.name,
        named: false,
        owner: "",
        icon: face.icon,
        guards: null,
        arrivals: [],
        reward: skillPointGain(reward.rank),
      },
    };
  }

  private load(site: DrawnSite): void {
    if (this.loading.has(site.key)) return;
    const loading = site
      .model()
      .then(({ model, height }) => {
        if (this.destroyed) return model.dispose();
        this.heights.set(site.key, height);
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

  /**
   * Each Deep site's plate: its name, who holds it (or that every Aspect fights for it while nobody does) and what a
   * tick held pays. The Foundation's says it raises the holder's hyperstructure, so it is never read as an Aspect's own.
   */
  private deepPlates(): (MapPlateInput | undefined)[] {
    const onLayer = this.projection
      .getTiles(activeMapLayer())
      .some(({ occupierType }) => occupierType === TileOccupier.DeepSite);
    if (!this.modelVisible || !onLayer || !this.store.subscriptionScope().known) return [];
    const gameId = configManager.getActiveGameId();
    const race = this.store.get("RaceRules", { game_id: gameId });
    const deep = this.store.get("DeepRules", { game_id: gameId });
    if (!deep) return [];
    return readDeepSites(this.store, getBlockTimestamp().currentBlockTimestamp).map((site) => {
      const position = deepSites.find(({ id }) => id === site.kind)!.position;
      const height = this.heights.get(`deep:${position}`);
      if (height === undefined) return undefined;
      const at = getWorldPositionForHex({ col: site.position.x - FELT_CENTER(), row: site.position.y - FELT_CENTER() });
      placePositionOnTerrain(at, this.terrain, height + PLATE_CLEARANCE);
      const holder = site.guards[0]?.army.owner;
      const aspect =
        holder === undefined ? undefined : this.store.get("HomeAspect", { game_id: gameId, home: holder })?.aspect;
      const pays = {
        foundation: DEEP_WORDS.foundationPlate(race?.height_per_tick ?? 0),
        quarry: DEEP_WORDS.quarryPlate,
        altar: DEEP_WORDS.altarPlate,
      }[position];
      return {
        entityId: Number(site.id),
        position: at,
        plate: {
          kind: "structure" as const,
          relation: "neutral" as const,
          icon: DEEP_SITE_FACES[position].icon,
          name: site.name,
          named: false,
          owner: aspect === undefined ? DEEP_WORDS.shared : DEEP_WORDS.heldBy(aspectName(aspect)),
          guards: null,
          arrivals: [],
          reward: pays,
        },
      };
    });
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

const isMapSite = (occupier: number | undefined): boolean =>
  mapSiteOf(occupier) !== null || occupier === TileOccupier.DeepSite;

/** The facts a plate says: a Shrine's point, a Deep site's holder and what it pays. */
const PLATE_MODELS = new Set(["ShrineReward", "DeepGuard", "HomeAspect", "RaceRules", "DeepRules"]);

/** A site's model from its file, and how tall it stands, for the plate over it. */
const modelOf = async (path: string, name: string) => {
  const gltf = await gltfLoader.loadAsync(path);
  return {
    model: new InstancedModel(gltf, SITE_CAPACITY, false, name),
    height: new Box3().setFromObject(gltf.scene).max.y,
  };
};

/** The Foundation's model: a hyperstructure's own, standing at its foundation, its plate just over that base. */
const foundationModel = () => ({ model: new HyperstructureModel(SITE_CAPACITY), height: HYPERSTRUCTURE_BASE_HEIGHT });
