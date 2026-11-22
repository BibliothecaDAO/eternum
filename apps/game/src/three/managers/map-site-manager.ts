import { DEEP_SITE_FACES } from "@/ui/features/frontier/deep/deep-site-faces";
import { DEEP_WORDS } from "@/ui/design-system/kit/words";
import type { IconMeaning } from "@/ui/design-system/icon";
import { configManager, dayOf, readDefaultTick, readExpeditionRules } from "@bibliothecadao/eternum";
import {
  deepGateTiles,
  readDeepBeastTroops,
  readDeepRingOpening,
  safeInteger,
  viewerAspects,
  type NativeFactStore,
} from "@bibliothecadao/eternum/game-client";
import { accountAddress } from "@/hooks/store/use-account-store";
import {
  DEEP_BEASTS,
  aspectName,
  aspects,
  beastModel,
  ordersOfAspect,
  type AspectId,
  deepSites,
  TileOccupier,
  type BeastIdle,
  type BeastModel,
} from "@bibliothecadao/types";
import type { MapPlateInput, MapPlateScope } from "../map-plates/map-plate-layer";
import type { MapPlate } from "../map-plates/map-plate-model";
import { PLATE_CLEARANCE } from "./structure-visible-presentation";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { presentResult } from "@/three/presented-results";
import { activeMapLayer } from "@/three/map-layer";
import { deepLandmark } from "../structures/deep-landmarks";
import { DEEP_GATEWAY_HEIGHT } from "./deep-arena-manager";
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

/** A site the manager draws: which tiles it stands on, and the model it loads once a tile of it is seen. */
type DrawnSite = {
  key: string;
  name: string;
  stands: (tile: TileSpatialRenderable) => boolean;
  model: () => Promise<{ model: InstancedModel; height: number }>;
  scale: number;
  front: number;
  idle?: BeastIdle;
};
type SiteHex = { col: number; row: number };

const LANDMARK_UNDER_BEAST = false;
const BEAST_FRONT = LANDMARK_UNDER_BEAST ? 0.55 : 0;
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
  private readonly unsubscribeChainTime: () => void;
  private drawnDay: number | undefined;
  private readonly heights = new Map<DrawnSite["key"], number>();
  private modelVisible = true;
  private destroyed = false;
  private readonly sites: DrawnSite[] = [
    ...deepSites.map((kind) => ({
      key: `deep:${kind.key}`,
      name: kind.name,
      stands: (tile: TileSpatialRenderable) =>
        this.isDeepSiteOf(tile, kind.id) &&
        this.closedRing(tile.occupierId) === undefined &&
        (LANDMARK_UNDER_BEAST || !this.beastGuards(tile.occupierId)),
      model: () => Promise.resolve(landmarkModel(kind.key, kind.name, ACTIVE)),
      scale: 1,
      front: 0,
    })),
    ...deepSites.map((kind) => ({
      key: `deep-dormant:${kind.key}`,
      name: kind.name,
      stands: (tile: TileSpatialRenderable) =>
        this.isDeepSiteOf(tile, kind.id) && this.closedRing(tile.occupierId) !== undefined,
      model: () => Promise.resolve(landmarkModel(kind.key, kind.name, DORMANT)),
      scale: 1,
      front: 0,
    })),
    ...deepSites.map((kind) => {
      const beast = DEEP_BEASTS[kind.key];
      return {
        key: `deep-beast:${kind.key}`,
        name: beast.name,
        stands: (tile: TileSpatialRenderable) => this.isDeepSiteOf(tile, kind.id) && this.beastStands(tile.occupierId),
        model: () => beastModelOf(beastModel(beast)),
        scale: beast.scale,
        front: BEAST_FRONT,
        idle: beast.idle,
      };
    }),
  ];

  constructor(
    private readonly scene: Scene,
    private readonly projection: WorldSpatialProjection,
    private readonly store: NativeFactStore,
    private readonly plates: MapPlateScope,
    private readonly gates: MapPlateScope,
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
          change.model === "DeepEntries" ||
          change.model === "DeepRules" ||
          change.model === "HomeAspect" ||
          (change.model === "Guard" && this.guardsDeepSite(change.current ?? change.previous)),
      );
      if (touched) this.refresh();
    });
    this.unsubscribeChainTime = useChainTimeStore.subscribe(() => {
      if (this.deepDay() !== this.drawnDay) this.refresh();
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
    const gate = tile && this.gateTiles().find(({ col, row }) => col === tile.col && row === tile.row);
    if (gate) this.gates.setHover(gate.aspect);
    else this.gates.clearHover();
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
    this.unsubscribeChainTime();
    this.plates.dispose();
    this.gates.dispose();
    this.models.forEach((model) => model.dispose());
    this.models.clear();
  }

  private refresh(): void {
    if (this.destroyed) return;
    this.drawnDay = this.deepDay();
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
        model.setMatrixAt(index, this.placement(hex, site.scale, site.front));
        if (site.idle && model instanceof FrontierModel) model.setIdleAt(index, site.idle);
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
      deepSites.map(({ key }) => [
        `deep:${key}`,
        drawn(`deep:${key}`) + drawn(`deep-beast:${key}`) + drawn(`deep-dormant:${key}`),
      ]),
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
    this.refreshGates();
  }

  private refreshGates(): void {
    const gates = this.modelVisible ? this.gateTiles() : [];
    if (gates.length === 0) return this.gates.retainOnly([]);
    const own = viewerAspects(this.store, configManager.getActiveGameId(), accountAddress() ?? null);
    for (const gate of gates) {
      const position = getWorldPositionForHex({ col: gate.col - FELT_CENTER(), row: gate.row - FELT_CENTER() });
      placePositionOnTerrain(position, this.terrain, DEEP_GATEWAY_HEIGHT + PLATE_CLEARANCE);
      this.gates.setLabel({ entityId: gate.aspect, position, plate: gatePlate(gate.aspect, own.has(gate.aspect)) });
    }
    this.gates.retainOnly(aspects.map(({ id }) => id));
  }

  private gateTiles(): ReturnType<typeof deepGateTiles> {
    const game_id = configManager.getActiveGameId();
    const rules = this.store.get("DeepRules", { game_id });
    if (!rules || activeMapLayer()) return [];
    return deepGateTiles(rules.gate_distance, this.store.require("SettlementRules", { game_id }).spacing);
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
    placePositionOnTerrain(position, this.terrain, this.plateHeight(tile.occupierId, kind.key) + PLATE_CLEARANCE);
    return {
      entityId: tile.occupierId,
      position,
      plate: {
        kind: "structure",
        relation: "neutral",
        name: kind.name,
        named: false,
        owner: "",
        guards: null,
        arrivals: [],
        ...this.closedOrOpenLook(tile.occupierId, DEEP_SITE_FACES[kind.key].icon),
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

  private plateHeight(entityId: number, key: (typeof deepSites)[number]["key"]): number {
    const landmark = this.heights.get(this.closedRing(entityId) ? `deep-dormant:${key}` : `deep:${key}`) ?? 0;
    if (!this.beastStands(entityId)) return landmark;
    const beast = this.heights.get(`deep-beast:${key}`) ?? 0;
    return LANDMARK_UNDER_BEAST ? Math.max(landmark, beast) : beast;
  }

  private isDeepSiteOf(tile: TileSpatialRenderable, kind: number): boolean {
    return tile.occupierType === TileOccupier.DeepSite && this.deepKindOf(tile.occupierId) === kind;
  }

  /** A Deep site's kind, from its DeepSite row; none while that row is on its way. */
  private deepKindOf(entityId: number): number | undefined {
    return this.store.get("DeepSite", { game_id: configManager.getActiveGameId(), entity_id: entityId })?.kind;
  }

  private deepDay(): number | undefined {
    const now = readDefaultTick();
    const calendar = now === undefined ? null : readExpeditionRules(this.store, configManager.getActiveGameId());
    return calendar && now !== undefined ? dayOf(calendar, now)?.index : undefined;
  }

  private beastGuards(entityId: number): boolean {
    const now = readDefaultTick();
    if (now === undefined) return false;
    const troops = readDeepBeastTroops(this.store, now, BigInt(entityId), configManager.getActiveGameId());
    return (troops ?? 0n) > 0n;
  }

  private beastStands(entityId: number): boolean {
    return this.beastGuards(entityId) && this.closedRing(entityId) === undefined;
  }

  private closedOrOpenLook(entityId: number, icon: IconMeaning): { icon: IconMeaning; reward?: string } {
    const closed = this.closedRing(entityId);
    return closed ? { icon: "lock", reward: DEEP_WORDS.opensAt(closed.realms) } : { icon };
  }

  private closedRing(entityId: number): { realms: number } | undefined {
    const now = readDefaultTick();
    const opening =
      now === undefined
        ? undefined
        : readDeepRingOpening(this.store, now, BigInt(entityId), configManager.getActiveGameId());
    return opening && "known" in opening && !opening.known.open ? opening.known : undefined;
  }

  private guardsDeepSite(guard: { structure_id: bigint } | undefined): boolean {
    return guard !== undefined && this.deepKindOf(safeInteger(guard.structure_id)) !== undefined;
  }

  private placement(hex: SiteHex, scale: number, front: number) {
    const position = getWorldPositionForHex({ col: hex.col - FELT_CENTER(), row: hex.row - FELT_CENTER() });
    this.dummy.position.copy(placePositionOnTerrain(position, this.terrain));
    this.dummy.position.z += front;
    this.dummy.scale.setScalar(scale);
    this.dummy.updateMatrix();
    return this.dummy.matrix;
  }
}

/** Sites a day's map can hold at once; the draw spaces them far below this. */
const SITE_CAPACITY = 64;

const ACTIVE = 1;
const DORMANT = 0;

const landmarkModel = (key: (typeof deepSites)[number]["key"], name: string, activation: number) => {
  const landmark = deepLandmark(key, activation);
  return {
    model: new InstancedModel(landmark, SITE_CAPACITY, false, name),
    height: new Box3().setFromObject(landmark.scene).max.y,
  };
};

const beastModelOf = async (species: BeastModel) => {
  const gltf = await gltfLoader.loadAsync(FRONTIER_BEASTS[species].path);
  return { model: new FrontierModel(gltf, SITE_CAPACITY, species), height: new Box3().setFromObject(gltf.scene).max.y };
};

const isMapSite = (occupier: number | undefined): boolean => occupier === TileOccupier.DeepSite;

const gatePlate = (aspect: AspectId, own: boolean): MapPlate => ({
  kind: "structure",
  relation: own ? "own" : "neutral",
  name: aspectName(aspect),
  named: true,
  owner: "",
  icon: "portal",
  crest: ordersOfAspect(aspect)[0]!.orderId,
  guards: null,
  arrivals: [],
});
