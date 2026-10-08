import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentArmiesTick, useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import {
  configManager,
  entityMapPosition,
  expeditionDepth,
  getBalance,
  getBuildingQuantity,
  getGuardsByStructure,
  realmLearned,
  researchTier,
  isCurrentExpeditionArmy,
  liveHomeArmies,
  StaminaManager,
  structureMapPosition,
} from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { FARM, LABOR, TROOPS, WHEAT, WORKSHOP } from "@/ui/design-system/kit/words";
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import {
  BuildingType,
  RESOURCE_PRECISION,
  ResourcesIds,
  StructureType,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";
import { knownBalance } from "@/ui/utils/utils";
import { useMemo } from "react";
import { affordableUpgrades } from "../attributes/attributes";
import { troopsAtHome, type useExpeditionRules } from "../frontier-home";
import { readRealmStore } from "../realm-stores";
import type { GuideFacts } from "./guide-script";

type ExpeditionRules = NonNullable<ReturnType<typeof useExpeditionRules>>;

const GUIDE_MODELS = [
  "Structure",
  "StructureBuildings",
  "ArmySlot",
  "ExplorerTroops",
  "TileOccupancy",
  "Guard",
  "ResourceBalance",
  "ResourceProduction",
  "ArmyProgress",
  "ExpeditionSite",
  "RealmKnowledge",
  "ResearchPrice",
  "BoardRules",
] as const;

/**
 * What the guide answers to, read from the store at chain time; it never listens for events. The losing fight and the
 * season's end are told by the cards that host those lines.
 */
export const useGuideFacts = (rules: ExpeditionRules, realm: NativeRows["Structure"] | null): GuideFacts => {
  const { setup } = useGame();
  const revision = useNativeRevision(GUIDE_MODELS);
  const now = useNowSeconds();
  const tick = useCurrentDefaultTick();
  const armiesTick = useCurrentArmiesTick();
  const { isMapView } = useQuery();
  return useMemo(
    () => readGuideFacts(setup.store, rules, realm, { now, tick, armiesTick, onMap: isMapView }),
    // The revision is the recompute signal for store writes; the clocks for time passing.
    [setup.store, rules, realm, now, tick, armiesTick, isMapView, revision],
  );
};

const readGuideFacts = (
  store: NativeFactStore,
  rules: ExpeditionRules,
  realm: NativeRows["Structure"] | null,
  clock: { now: number; tick: number; armiesTick: number; onMap: boolean },
): GuideFacts => {
  if (!realm) return { ...NO_REALM, onMap: clock.onMap };
  const armies = liveHomeArmies(store, realm.entity_id, realm.game_id);
  const stamina = armies.flatMap((army) => {
    const troops = resolveExplorerTroops(store, army);
    return troops
      ? [
          {
            current: Number(StaminaManager.getStamina(troops, clock.armiesTick).amount),
            max: StaminaManager.getMaxStamina(
              army.troops.category as TroopType,
              army.troops.tier as TroopTier,
              troops.staminaMax,
            ),
          },
        ]
      : [];
  });
  const exploreCost = configManager.getExploreStaminaCost();
  return {
    ...HOSTED,
    realm: true,
    barracks: getBuildingQuantity(realm.entity_id, BuildingType.ResourceKnightT1, store) > 0,
    troopsAtHome: troopsAtHome(store, realm, rules, clock.now, clock.tick),
    armies: armies.length,
    armyActed: stamina.some((bar) => bar.current < bar.max),
    camp: guardedCampToday(store, rules, realm, clock.now),
    castleAffordable: canAffordNextCastleLevel(store, realm, clock.tick),
    onMap: clock.onMap,
    armiesTired:
      stamina.length === armies.length && stamina.length > 0 && stamina.every((bar) => bar.current < exploreCost),
    armyTierAffordable: armies.some((army) => canBuyAttributeTier(store, army)),
    typeTierAffordable: firstTypeTierAffordable(store, realm, clock.tick),
    storeFull: fullStore(store, realm, rules, clock),
    ...readSiteFirsts(store, realm.game_id),
    armyBeyondSpire: armies.some(
      (army) => expeditionDepth(rules, { y: entityMapPosition(store, army.game_id, army.explorer_id).y }) >= 1,
    ),
  };
};

/** An army whose XP buys a tier of an attribute now. */
const canBuyAttributeTier = (store: NativeFactStore, army: NativeRows["ExplorerTroops"]): boolean => {
  const progress = store.get("ArmyProgress", { game_id: army.game_id, explorer_id: army.explorer_id });
  const xpRules = store.get("ArmyProgressionRules", { game_id: army.game_id });
  return progress !== undefined && xpRules !== undefined && affordableUpgrades(progress, xpRules).length > 0;
};

/**
 * The expedition's sites as the guide's firsts read them, a site's kind being its structure's category: a site
 * cleared, a ruin or stragglers standing in view, and a ruin cleared, whose chest has paid.
 */
const readSiteFirsts = (store: NativeFactStore, gameId: number) => {
  const sites = [...store.inGame("ExpeditionSite", gameId)];
  const isKind = (site: NativeRows["ExpeditionSite"], category: StructureType) =>
    store.get("Structure", { game_id: gameId, entity_id: site.entity_id })?.base.category === category;
  return {
    siteCleared: sites.some((site) => site.cleared),
    ruin: sites.some((site) => !site.cleared && isKind(site, StructureType.Ruin)),
    stragglers: sites.some((site) => !site.cleared && isKind(site, StructureType.Stragglers)),
    chestPaid: sites.some((site) => site.cleared && isKind(site, StructureType.Ruin)),
  };
};

/** The Farm's or the Workshop's first tier, when its building stands and the realm holds its Essence and labor. */
const firstTypeTierAffordable = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  tick: number,
): string | null => {
  const learned = realmLearned(store, realm.game_id, realm.entity_id);
  if (learned === undefined) return null;
  const held = (resource: ResourcesIds) => knownBalance(getBalance(realm.entity_id, resource, tick, store).balance);
  for (const { row, category, word } of FIRST_TIERS) {
    // The castle's own workshop is not a building of the type.
    const own =
      getBuildingQuantity(realm.entity_id, category, store) - (category === BuildingType.ResourceLabor ? 1 : 0);
    if (own < 1 || researchTier(learned, row) > 0) continue;
    const price = store.get("ResearchPrice", { game_id: realm.game_id, row, tier: 1 });
    const essence = held(ResourcesIds.Essence);
    const labor = held(ResourcesIds.Labor);
    if (
      price &&
      essence !== undefined &&
      labor !== undefined &&
      essence >= whole(price.essence) &&
      labor >= whole(price.labor)
    )
      return word;
  }
  return null;
};

const FIRST_TIERS = [
  { row: research.ROW_FARM, category: BuildingType.ResourceWheat, word: FARM.toLowerCase() },
  { row: research.ROW_WORKSHOP, category: BuildingType.ResourceLabor, word: WORKSHOP.toLowerCase() },
] as const;

const whole = (amount: bigint): number => Number(amount / BigInt(RESOURCE_PRECISION));

/** The first of wheat, labor and troops whose store is at its limit, by its word; none while every one has room. */
const fullStore = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  rules: ExpeditionRules,
  clock: { now: number; tick: number },
): string | null => {
  const full = FULL_STORES.find(({ store: kind }) => readRealmStore(store, realm, rules, kind, clock).tone === "ember");
  return full?.word ?? null;
};

const FULL_STORES = [
  { store: ResourcesIds.Wheat, word: WHEAT.toLowerCase() },
  { store: ResourcesIds.Labor, word: LABOR.toLowerCase() },
  { store: "troops" as const, word: TROOPS.toLowerCase() },
];

/** What the hosting cards tell: the fight on the open site card, the season's end on its card. */
const HOSTED = { losingFight: false, seasonOver: false } as const;

const NO_REALM: GuideFacts = {
  ...HOSTED,
  stragglers: false,
  typeTierAffordable: null,
  chestPaid: false,
  storeFull: null,
  realm: false,
  armyTierAffordable: false,
  barracks: false,
  troopsAtHome: undefined,
  armies: 0,
  armyActed: false,
  camp: null,
  castleAffordable: false,
  onMap: false,
  armiesTired: false,
  siteCleared: false,
  ruin: false,
  armyBeyondSpire: false,
};

const guardedCampToday = (
  store: NativeFactStore,
  rules: ExpeditionRules,
  realm: NativeRows["Structure"],
  now: number,
): GuideFacts["camp"] => {
  for (const structure of store.inGame("Structure", realm.game_id)) {
    if (structure.base.category !== StructureType.Camp || structure.owner === realm.owner) continue;
    const position = structureMapPosition(store, structure);
    if (!position) continue;
    if (isCurrentExpeditionArmy(rules, position, now) && isGuarded(structure, store)) return position;
  }
  return null;
};

/** A camp with troops in a guard slot; one whose guards are not yet known is not claimed. */
const isGuarded = (structure: NativeRows["Structure"], store: NativeFactStore): boolean =>
  getGuardsByStructure(structure, store)?.some((guard) => guard.troops.count > 0n) ?? false;

/** Whether every cost of the next castle level is already in the realm; never at the top level or with a cost unknown. */
const canAffordNextCastleLevel = (store: NativeFactStore, realm: NativeRows["Structure"], tick: number): boolean => {
  const next = realm.base.level + 1;
  if (next > configManager.getMaxLevel(StructureType.Realm)) return false;
  const costs = configManager.getRealmUpgradeCosts(next);
  if (!costs?.length) return false;
  return costs.every((cost) => {
    // Recipe costs are in display units, as the castle panel shows them.
    const balance = knownBalance(getBalance(realm.entity_id, cost.resource, tick, store).balance);
    return balance !== undefined && balance >= cost.amount;
  });
};
