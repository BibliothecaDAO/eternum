import { SIDE_HEX, type Side } from "@/tokens";
import { DEEP_SITE_FACES } from "@/ui/features/frontier/deep/deep-site-faces";
import { DEEP_WORDS, ownerAndAspect } from "@/ui/design-system/kit/words";
import type { IconMeaning } from "@/ui/design-system/icon";
import {
  DEEP_DEPTH,
  configManager,
  dayOf,
  isViewerOwner,
  readDefaultTick,
  readExpeditionRules,
} from "@bibliothecadao/eternum";
import {
  deepGateTiles,
  nativeRuleConstants,
  readDeepBeastTroops,
  readDeepRingOpening,
  readSyncedDeepSites,
  safeInteger,
  viewerAspects,
  type DeepSiteView,
  type NativeFactStore,
} from "@bibliothecadao/eternum/game-client";
import { accountAddress } from "@/hooks/store/use-account-store";
import { onSidesChanged, sideOf, watchedSide } from "@/utils/entity-ownership";
import {
  DEEP_BEASTS,
  aspectName,
  aspects,
  beastModel,
  ordersOfAspect,
  type AspectId,
  deepSites,
  TileOccupier,
  RESOURCE_PRECISION,
  type BeastModel,
} from "@bibliothecadao/types";
import type { MapPlateInput, MapPlateScope } from "../map-plates/map-plate-layer";
import { plateTroopType, plateWatched, type MapPlate, type PlateWatched } from "../map-plates/map-plate-model";
import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import { getPlayerDisplayName } from "@/services/identity/player-profiles";
import { watchPlayerNames } from "@/hooks/use-player-profile";
import { PLATE_CLEARANCE } from "./structure-visible-presentation";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { presentResult } from "@/three/presented-results";
import { activeMapLayer } from "@/three/map-layer";
import { DeepLandmarkModel, loadDeepLandmark } from "../structures/deep-landmarks";
import { OrderStandard } from "../structures/order-standard";
import { DEEP_GATEWAY_HEIGHT } from "./deep-arena-manager";
import { FRONTIER_BEASTS } from "../structures/frontier-beast";
import { FrontierModel } from "../structures/frontier-model";
import InstancedModel from "@/three/managers/instanced-model";
import { MAP_SITES, type MapSiteKind, mapSiteOf } from "@/config/map-sites";
import { frontierPaintedPath } from "../structures/frontier-painted-buildings";
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
  private readonly unsubscribeChainTime: () => void;
  private readonly unsubscribeSides: () => void;
  private readonly unsubscribeNames: () => void;
  private drawnDay: number | undefined;
  private drawnTick: number | undefined;
  private garrisoned = false;
  private standards?: OrderStandard;
  private readonly heights = new Map<DrawnSite["key"], number>();
  private modelVisible = true;
  private destroyed = false;
  private readonly sites: DrawnSite[] = [
    ...MAP_SITES.map((site) => ({
      key: site.kind,
      name: site.kind,
      stands: (tile: TileSpatialRenderable) => tile.occupierType === site.occupier,
      model: () => paintedSiteModel(site.kind),
      scale: 1,
    })),
    ...deepSites.map((kind) => ({
      key: `deep:${kind.key}`,
      name: kind.name,
      stands: (tile: TileSpatialRenderable) =>
        this.isDeepSiteOf(tile, kind.id) &&
        this.closedRing(tile.occupierId) === undefined &&
        this.beastTroops(tile.occupierId) === 0n,
      model: () => landmarkModel(kind.key, kind.name, ACTIVE),
      scale: 1,
    })),
    ...deepSites.map((kind) => ({
      key: `deep-dormant:${kind.key}`,
      name: kind.name,
      stands: (tile: TileSpatialRenderable) =>
        this.isDeepSiteOf(tile, kind.id) && this.closedRing(tile.occupierId) !== undefined,
      model: () => landmarkModel(kind.key, kind.name, DORMANT),
      scale: 1,
    })),
    ...deepSites.map((kind) => {
      const beast = DEEP_BEASTS[kind.key];
      return {
        key: `deep-beast:${kind.key}`,
        name: beast.name,
        stands: (tile: TileSpatialRenderable) => this.isDeepSiteOf(tile, kind.id) && this.beastStands(tile.occupierId),
        model: () => beastModelOf(beastModel(beast)),
        scale: beast.scale,
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
          change.model === "GarrisonSlot" ||
          change.model === "DeepTick" ||
          change.model === "DeepEntries" ||
          change.model === "DeepRules" ||
          change.model === "HomeAspect" ||
          change.model === "SliceRules" ||
          (change.model === "Guard" && this.guardsDeepSite(change.current ?? change.previous)) ||
          (change.model === "Structure" && (this.garrisoned || this.isDeepSite(change.current ?? change.previous))),
      );
      if (touched) this.refresh();
    });
    this.unsubscribeChainTime = useChainTimeStore.subscribe(() => {
      if (this.deepDay() !== this.drawnDay || (this.garrisoned && this.deepTick() !== this.drawnTick)) {
        this.refresh();
      }
    });
    this.unsubscribeSides = onSidesChanged(() => this.refresh());
    this.unsubscribeNames = watchPlayerNames(() => this.refresh());
    try {
      this.refresh();
    } catch (error) {
      this.destroy();
      throw error;
    }
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
    if (this.standards) this.standards.group.visible = visible;
    this.refreshPlates();
  }

  public resetLayer(): void {
    this.refresh();
  }

  public destroy(): void {
    this.destroyed = true;
    this.unsubscribe();
    this.unsubscribeRewards();
    this.unsubscribeChainTime();
    this.unsubscribeSides();
    this.unsubscribeNames();
    this.plates.dispose();
    this.gates.dispose();
    this.models.forEach((model) => model.dispose());
    this.models.clear();
    this.standards?.dispose();
    this.standards = undefined;
  }

  private refresh(): void {
    if (this.destroyed) return;
    this.drawnDay = this.deepDay();
    this.drawnTick = this.deepTick();
    const sitesById = this.readSitesById();
    this.garrisoned = [...sitesById.values()].some((view) => view.garrisons.length > 0);
    this.refreshPlates();
    const heldSites: Array<{ hex: PlacedSite; site: DeepSiteView }> = [];
    for (const site of this.sites) {
      const hexes = this.siteHexes(site);
      if (site.key.startsWith("deep:")) {
        for (const hex of hexes) {
          const view = sitesById.get(hex.entityId);
          if (view && view.garrisons.length > 0) heldSites.push({ hex, site: view });
        }
      }
      const model = this.models.get(site.key);
      if (!model) {
        if (hexes.length > 0) this.load(site);
        continue;
      }
      const previous = model.getCount();
      hexes.forEach((hex, index) => {
        model.setMatrixAt(index, this.placement(hex, site.scale));
        if (model instanceof FrontierModel) {
          model.setLayerAt(index, DEEP_DEPTH);
        }
        if (model instanceof DeepLandmarkModel) {
          model.setHolderColorAt(index, this.holderColor(sitesById.get(hex.entityId)));
        }
      });
      for (let index = hexes.length; index < previous; index += 1) model.removeInstance(index);
      model.setCount(hexes.length);
      model.needsUpdate();
    }
    this.refreshStandards(heldSites);
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

  private kindHexes(): Record<string, { col: number; row: number; entity: number }> {
    const tiles = this.projection.getTiles(activeMapLayer());
    return Object.fromEntries(
      deepSites.flatMap((kind) => {
        const tile = tiles.find(
          (each) => each.occupierType === TileOccupier.DeepSite && this.deepKindOf(each.occupierId) === kind.id,
        );
        return tile
          ? [[`deep:${kind.key}`, { col: tile.hexCoords.col, row: tile.hexCoords.row, entity: tile.occupierId }]]
          : [];
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
    const views = sites.length > 0 ? this.readSitesById() : new Map<number, DeepSiteView>();
    for (const tile of sites) {
      const plate = this.deepPlate(tile, views.get(tile.occupierId));
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

  private deepPlate(tile: TileSpatialRenderable, view: DeepSiteView | undefined): MapPlateInput {
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
    return { entityId: tile.occupierId, position, plate: this.sitePlate(tile.occupierId, kind, view) };
  }

  private sitePlate(entityId: number, kind: DeepKind, view: DeepSiteView | undefined): MapPlate {
    const closed = this.closedRing(entityId);
    if (closed) return plainPlate(kind, "lock", DEEP_WORDS.opensAt(closed.realms));
    if (view && view.holder !== 0n) return this.claimedPlate(kind, view);
    const beast = this.beastTroops(entityId);
    if (beast > 0n) return beastPlate(kind, beast, view, this.ownerSide(0n, 0, ""));
    return plainPlate(kind, DEEP_SITE_FACES[kind.key].icon);
  }

  private claimedPlate(kind: DeepKind, site: DeepSiteView): MapPlate {
    const game_id = configManager.getActiveGameId();
    const owner = site.holder;
    const realm = [...this.store.structuresOwnedBy(game_id, owner)].find(
      (structure) => this.store.get("HomeAspect", { game_id, home: structure.entity_id })?.aspect === site.aspect,
    );
    const name = getPlayerDisplayName(owner);
    return {
      kind: "structure",
      ...this.ownerSide(owner, site.aspect, name),
      name: kind.name,
      named: true,
      owner: site.aspect ? ownerAndAspect(name, aspectName(site.aspect)) : name,
      icon: DEEP_SITE_FACES[kind.key].icon,
      crest: realm?.metadata.order,
      guards: site.garrisons
        .toSorted((left, right) => left.slot - right.slot)
        .map(({ troops }) => ({ type: plateTroopType(troops.category), tier: null, count: troopsOf(troops) })),
      arrivals: [],
    };
  }

  private ownerSide(owner: bigint, aspect: number, name: string): { relation: Side; watched?: PlateWatched } {
    const watched = plateWatched(watchedSide(owner), name);
    const viewer = accountAddress() ?? null;
    if (watched.watched || viewer === null) return { relation: "neutral", ...watched };
    return {
      relation: sideOf({
        isMine: isViewerOwner(owner, viewer),
        isAlly: aspect !== 0 && viewerAspects(this.store, configManager.getActiveGameId(), viewer).has(aspect),
        owner: { address: owner },
      }),
    };
  }

  private isDeepSite(row: { entity_id: bigint } | undefined): boolean {
    return row !== undefined && this.deepKindOf(safeInteger(row.entity_id)) !== undefined;
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
    if (this.beastStands(entityId)) return this.heights.get(`deep-beast:${key}`) ?? 0;
    return this.heights.get(this.closedRing(entityId) ? `deep-dormant:${key}` : `deep:${key}`) ?? 0;
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

  private beastTroops(entityId: number): bigint {
    const now = readDefaultTick();
    if (now === undefined) return 0n;
    return readDeepBeastTroops(this.store, now, BigInt(entityId), configManager.getActiveGameId()) ?? 0n;
  }

  private beastStands(entityId: number): boolean {
    return this.beastTroops(entityId) > 0n && this.closedRing(entityId) === undefined;
  }

  private closedRing(entityId: number): { realms: number } | undefined {
    const now = readDefaultTick();
    const opening =
      now === undefined
        ? undefined
        : readDeepRingOpening(this.store, now, BigInt(entityId), configManager.getActiveGameId());
    return opening && "known" in opening && !opening.known.open ? opening.known : undefined;
  }

  private deepTick(): number | undefined {
    const now = readDefaultTick();
    if (now === undefined) return undefined;
    const rules = this.store.get("SliceRules", { game_id: configManager.getActiveGameId() });
    const interval = rules ? Number(rules.tick_config.armies_tick_in_seconds) : 0;
    return interval > 0 ? Math.floor(now / interval) : undefined;
  }

  private readSitesById(): Map<number, DeepSiteView> {
    const sites = readSyncedDeepSites(this.store, readDefaultTick(), configManager.getActiveGameId());
    return new Map(sites.map((site) => [safeInteger(site.id), site]));
  }

  private guardsDeepSite(guard: { structure_id: bigint } | undefined): boolean {
    return guard !== undefined && this.deepKindOf(safeInteger(guard.structure_id)) !== undefined;
  }

  private holderColor(site: DeepSiteView | undefined): string | null {
    if (!site || site.holder === 0n) return null;
    const side = this.ownerSide(site.holder, site.aspect, "");
    return side.watched?.colour ?? SIDE_HEX[side.relation];
  }

  private refreshStandards(heldSites: readonly { hex: PlacedSite; site: DeepSiteView }[]): void {
    if (heldSites.length === 0) {
      if (this.standards) {
        this.standards.setCount(0);
        this.standards.needsUpdate();
      }
      return;
    }
    if (!this.standards) {
      this.standards = OrderStandard.standalone(SITE_CAPACITY * nativeRuleConstants.DEEP_GUARD_SLOTS);
      this.standards.group.visible = this.modelVisible;
      this.scene.add(this.standards.group);
      void this.standards
        .prepare()
        .catch((error) => console.error("[MapSiteManager] Failed to load guard signum art", error));
    }
    let slot = 0;
    const limit = SITE_CAPACITY * nativeRuleConstants.DEEP_GUARD_SLOTS;
    for (const { hex, site } of heldSites) {
      const count = site.garrisons.length;
      for (let index = 0; index < count && slot < limit; index += 1) {
        const garrison = site.garrisons[index]!;
        const home = this.store.get("Structure", {
          game_id: configManager.getActiveGameId(),
          entity_id: garrison.home,
        });
        const orderId = home?.metadata.order;
        this.standards.setMatrixAt(slot, this.standardPlacement(hex, index, count));
        this.standards.setOrderAt(slot, orderId);
        slot += 1;
      }
    }
    this.standards.setCount(slot);
    this.standards.needsUpdate();
  }

  private standardPlacement(hex: SiteHex, index: number, total: number) {
    const spread = total > 1 ? (index / (total - 1) - 0.5) * 1.15 : 0;
    const position = getWorldPositionForHex({ col: hex.col - FELT_CENTER(), row: hex.row - FELT_CENTER() });
    position.x += Math.sin(spread) * 0.78;
    position.z += Math.cos(spread) * 0.78;
    this.dummy.position.copy(placePositionOnTerrain(position, this.terrain));
    this.dummy.scale.setScalar(0.9);
    this.dummy.updateMatrix();
    return this.dummy.matrix;
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

const ACTIVE = 1;
const DORMANT = 0;

const landmarkModel = async (key: (typeof deepSites)[number]["key"], name: string, activation: number) => {
  const landmark = await loadDeepLandmark(key, activation);
  const model = new DeepLandmarkModel(landmark, SITE_CAPACITY, name, activation);
  return { model, height: model.landmarkHeight };
};

const beastModelOf = async (species: BeastModel) => {
  const gltf = await gltfLoader.loadAsync(FRONTIER_BEASTS[species].path);
  return { model: new FrontierModel(gltf, SITE_CAPACITY, species), height: new Box3().setFromObject(gltf.scene).max.y };
};

const paintedSiteModel = async (kind: MapSiteKind) => {
  const gltf = await gltfLoader.loadAsync(frontierPaintedPath(kind.toLowerCase()));
  return {
    model: new InstancedModel(gltf, SITE_CAPACITY, false, kind),
    height: new Box3().setFromObject(gltf.scene).max.y,
  };
};

const isMapSite = (occupier: number | undefined): boolean =>
  mapSiteOf(occupier) !== null || occupier === TileOccupier.DeepSite;

type DeepKind = (typeof deepSites)[number];

const troopsOf = (troops: { count: bigint }): number => Math.floor(Number(troops.count) / RESOURCE_PRECISION);

const plainPlate = (kind: DeepKind, icon: IconMeaning, reward?: string): MapPlate => ({
  kind: "structure",
  relation: "neutral",
  name: kind.name,
  named: false,
  owner: "",
  guards: null,
  arrivals: [],
  icon,
  ...(reward ? { reward } : {}),
});

const beastPlate = (
  kind: DeepKind,
  troops: bigint,
  view: DeepSiteView | undefined,
  side: { relation: Side; watched?: PlateWatched },
): MapPlate => {
  const beast = DEEP_BEASTS[kind.key];
  const species = beastModel(beast);
  return {
    kind: "structure",
    ...side,
    name: kind.name,
    named: false,
    owner: "",
    place: kind.name,
    icon: beastMeaning(species),
    guards: [
      {
        type: plateTroopType(view?.guard?.troops.category),
        tier: null,
        count: troopsOf({ count: troops }),
        beast: species,
      },
    ],
    ...(view ? { reward: DEEP_SITE_FACES[kind.key].pays(view.buildingPay) } : {}),
    arrivals: [],
  };
};

const gatePlate = (aspect: AspectId, own: boolean): MapPlate => ({
  kind: "structure",
  relation: own ? "own" : "neutral",
  name: aspectName(aspect),
  named: true,
  owner: DEEP_WORDS.gate,
  icon: "portal",
  crest: ordersOfAspect(aspect)[0]!.orderId,
  guards: null,
  arrivals: [],
});
