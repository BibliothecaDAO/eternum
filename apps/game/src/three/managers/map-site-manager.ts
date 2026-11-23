import { SIDE_HEX } from "@/tokens";
import { DEEP_SITE_FACES } from "@/ui/features/frontier/deep/deep-site-faces";
import { DEEP_WORDS } from "@/ui/design-system/kit/words";
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
  IncompleteDeepSyncError,
  deepGateTiles,
  isAspectAlly,
  nativeRuleConstants,
  readDeepBeastTroops,
  readDeepRingOpening,
  readDeepSites,
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
  type BeastIdle,
  type BeastModel,
} from "@bibliothecadao/types";
import type { MapPlateInput, MapPlateScope } from "../map-plates/map-plate-layer";
import type { MapPlate } from "../map-plates/map-plate-model";
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
  private readonly unsubscribeChainTime: () => void;
  private readonly unsubscribeSides: () => void;
  private drawnDay: number | undefined;
  private drawnTick: number | undefined;
  private readonly guardingExplorers = new Set<bigint>();
  private standards?: OrderStandard;
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
        !this.beastGuards(tile.occupierId),
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
          change.model === "DeepGuard" ||
          change.model === "DeepEntries" ||
          change.model === "DeepRules" ||
          change.model === "HomeAspect" ||
          change.model === "SliceRules" ||
          (change.model === "Guard" && this.guardsDeepSite(change.current ?? change.previous)) ||
          this.touchesGuardingArmy(change),
      );
      if (touched) this.refresh();
    });
    this.unsubscribeChainTime = useChainTimeStore.subscribe(() => {
      if (this.deepDay() !== this.drawnDay || (this.guardingExplorers.size > 0 && this.deepTick() !== this.drawnTick)) {
        this.refresh();
      }
    });
    this.unsubscribeSides = onSidesChanged(() => this.refresh());
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

  /** Terrain pages can arrive after the sites are placed; re-place them on the surface they now stand on. */
  public refreshTerrainPlacement(): void {
    this.refresh();
  }

  public destroy(): void {
    this.destroyed = true;
    this.unsubscribe();
    this.unsubscribeRewards();
    this.unsubscribeChainTime();
    this.unsubscribeSides();
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
    this.guardingExplorers.clear();
    for (const view of sitesById.values()) {
      for (const guard of view.guards) this.guardingExplorers.add(guard.army.explorer_id);
    }
    this.refreshPlates();
    const heldSites: Array<{ hex: PlacedSite; site: DeepSiteView }> = [];
    for (const site of this.sites) {
      const hexes = this.siteHexes(site);
      if (site.key.startsWith("deep:")) {
        for (const hex of hexes) {
          const view = sitesById.get(hex.entityId);
          if (view && view.guards.length > 0) heldSites.push({ hex, site: view });
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
        if (site.idle && model instanceof FrontierModel) {
          model.setIdleAt(index, site.idle);
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

  private deepTick(): number | undefined {
    const now = readDefaultTick();
    if (now === undefined) return undefined;
    const rules = this.store.get("SliceRules", { game_id: configManager.getActiveGameId() });
    const interval = rules ? Number(rules.tick_config.armies_tick_in_seconds) : 0;
    return interval > 0 ? Math.floor(now / interval) : undefined;
  }

  private readSitesById(): Map<number, DeepSiteView> {
    const now = readDefaultTick();
    if (now === undefined) return new Map();
    try {
      const sites = readDeepSites(this.store, now, configManager.getActiveGameId());
      return new Map(sites.map((site) => [safeInteger(site.id), site]));
    } catch (error) {
      if (error instanceof IncompleteDeepSyncError) return new Map();
      throw error;
    }
  }

  private touchesGuardingArmy(change: { model: string; current?: unknown; previous?: unknown }): boolean {
    if (this.guardingExplorers.size === 0) return false;
    if (change.model === "Structure") return true;
    if (
      change.model !== "ExplorerTroops" &&
      change.model !== "DeepArmy" &&
      change.model !== "ArmyDay" &&
      change.model !== "ArmyProgress"
    ) {
      return false;
    }
    const row = (change.current ?? change.previous) as { explorer_id?: bigint } | undefined;
    return row?.explorer_id !== undefined && this.guardingExplorers.has(row.explorer_id);
  }

  private guardsDeepSite(guard: { structure_id: bigint } | undefined): boolean {
    return guard !== undefined && this.deepKindOf(safeInteger(guard.structure_id)) !== undefined;
  }

  private holderColor(site: DeepSiteView | undefined): string | null {
    const holder = site?.guards[0]?.army;
    if (!holder) return null;
    const home = this.store.get("Structure", { game_id: holder.game_id, entity_id: holder.owner });
    const owner = home?.owner ?? 0n;
    const watched = watchedSide(owner);
    if (watched) return watched.colour;
    const viewer = accountAddress() ?? null;
    return SIDE_HEX[
      sideOf({
        isMine: isViewerOwner(owner, viewer),
        isAlly: isAspectAlly(this.store, holder.game_id, viewer, holder.owner),
        owner: { address: owner },
      })
    ];
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
      const count = site.guards.length;
      for (let index = 0; index < count && slot < limit; index += 1) {
        const guard = site.guards[index]!;
        const home = this.store.get("Structure", { game_id: guard.army.game_id, entity_id: guard.army.owner });
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
