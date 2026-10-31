import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  configManager,
  entityMapPosition,
  getBalance,
  getBuildingQuantity,
  getGuardsByStructure,
  realmLearned,
  researchTier,
  ruinDisappeared,
  isCurrentExpeditionArmy,
  liveHomeArmies,
  StaminaManager,
  structureMapPosition,
} from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { FARM, WORKSHOP } from "@/ui/design-system/kit/words";
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { BuildingType, getNeighborHexes, RESOURCE_PRECISION, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { knownAmount } from "@/ui/utils/utils";
import { useMemo } from "react";
import { availableRankUps } from "../attributes/attributes";
import { troopsAtHome, type useExpeditionRules } from "../frontier-home";
import { dayClock } from "../hud/day-clock";
import { readRealmStore } from "../realm-stores";
import { MADE_STORES, type MadeStore } from "../stores";

type ExpeditionRules = NonNullable<ReturnType<typeof useExpeditionRules>>;

/** What Frontier's Next up answers to: the player's realm and today's armies, read from the store at chain time. */
export interface NextUpFacts {
  /** The player's Frontier realm exists. */
  realm: boolean;
  /** The realm has a barracks. */
  barracks: boolean;
  /** Whole troops waiting at home; undefined while unknown. */
  troopsAtHome: number | undefined;
  /** Today's armies. */
  armies: number;
  /** One of the player's armies is selected. */
  armySelected: boolean;
  /** Every army of today lacks the stamina to explore. */
  armiesTired: boolean;
  /** An army of today stands beside a site whose guard still holds. */
  guardInReach: boolean;
  /** A guarded camp of today's region on the board, where Next up's button takes the map; null when there is none. */
  camp: { x: number; y: number } | null;
  /** An army holds a point that can raise an attribute. */
  armyTierAffordable: boolean;
  /** The realm can pay for its next castle level. */
  castleAffordable: boolean;
  /** The building whose first tier the realm can afford (Farm or Workshop), by its word; null for none. */
  typeTierAffordable: string | null;
  /** Today is in its last hour with an army still out. */
  lastHour: boolean;
  /** The store at its limit, where a payout or reveal no longer fits; null for none. */
  storeFull: MadeStore | null;
  /** No population is free: the next building that takes any is refused until a Hut stands. */
  populationFull: boolean;
}

const NEXT_UP_MODELS = [
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
  "ExpeditionDiscovery",
  "RealmKnowledge",
  "ResearchPrice",
  "BoardRules",
] as const;

/** Next up's facts for the player's realm, recomputed as the store changes and the clock moves. */
export const useNextUpFacts = (rules: ExpeditionRules, realm: NativeRows["Structure"] | null): NextUpFacts => {
  const facts = useNativeFacts(NEXT_UP_MODELS);
  const now = useNowSeconds();
  const tick = useCurrentDefaultTick();
  const selected = useUIStore((state) => state.entityActions.selectedEntityId);
  return useMemo(
    () => readNextUpFacts(facts.store, rules, realm, { now, tick, selected }),
    // The revision is the recompute signal for facts.store writes; the clocks for time passing.
    [rules, realm, now, tick, selected, facts],
  );
};

const readNextUpFacts = (
  store: NativeFactStore,
  rules: ExpeditionRules,
  realm: NativeRows["Structure"] | null,
  clock: { now: number; tick: number; selected: number | null },
): NextUpFacts => {
  if (!realm) return NO_REALM;
  const armies = liveHomeArmies(store, safeInteger(realm.entity_id), realm.game_id);
  const stamina = armies.flatMap((army) => {
    const troops = resolveExplorerTroops(store, army);
    return troops ? [Number(StaminaManager.getStamina(troops, clock.tick).amount)] : [];
  });
  const exploreCost = configManager.getExploreStaminaCost();
  const population = store.get("StructureBuildings", {
    game_id: realm.game_id,
    entity_id: realm.entity_id,
  })?.population;
  return {
    realm: true,
    barracks: getBuildingQuantity(safeInteger(realm.entity_id), BuildingType.ResourceKnightT1, store) > 0,
    troopsAtHome: troopsAtHome(store, realm, rules, clock.now, clock.tick),
    armies: armies.length,
    armySelected: armies.some((army) => safeInteger(army.explorer_id) === clock.selected),
    armiesTired: stamina.length === armies.length && stamina.length > 0 && stamina.every((left) => left < exploreCost),
    guardInReach: guardBesideAnArmy(store, realm.game_id, armies),
    camp: guardedCampToday(store, rules, realm, clock.now),
    armyTierAffordable: armies.some((army) => canRaiseAttribute(store, army)),
    castleAffordable: canAffordNextCastleLevel(store, realm, clock.tick),
    typeTierAffordable: firstTypeTierAffordable(store, realm, clock.tick),
    lastHour: armies.length > 0 && dayClock(rules, clock.now).tone === "ember",
    storeFull: fullStore(store, realm, rules, clock),
    populationFull:
      population !== undefined && population.current >= population.max + configManager.getBasePopulationCapacity(),
  };
};

const NO_REALM: NextUpFacts = {
  realm: false,
  barracks: false,
  troopsAtHome: undefined,
  armies: 0,
  armySelected: false,
  armiesTired: false,
  guardInReach: false,
  camp: null,
  armyTierAffordable: false,
  castleAffordable: false,
  typeTierAffordable: null,
  lastHour: false,
  storeFull: null,
  populationFull: false,
};

/** Whether an army of today stands on a tile beside a site whose guard still holds. */
const guardBesideAnArmy = (
  store: NativeFactStore,
  gameId: number,
  armies: readonly NativeRows["ExplorerTroops"][],
): boolean => {
  const beside = new Set(
    armies.flatMap((army) => {
      const at = entityMapPosition(store, gameId, army.explorer_id);
      return getNeighborHexes(at.x, at.y).map(({ col, row }) => `${col},${row}`);
    }),
  );
  for (const site of store.inGame("ExpeditionSite", gameId)) {
    if (site.clear || ruinDisappeared(store, site)) continue;
    const structure = store.get("Structure", { game_id: gameId, entity_id: site.entity_id });
    const position = structure && isGuarded(structure, store) ? structureMapPosition(store, structure) : null;
    if (position && beside.has(`${position.x},${position.y}`)) return true;
  }
  return false;
};

/** An army with a point that can raise an attribute. */
const canRaiseAttribute = (store: NativeFactStore, army: NativeRows["ExplorerTroops"]): boolean => {
  const progress = store.get("ArmyProgress", { game_id: army.game_id, explorer_id: army.explorer_id });
  return progress !== undefined && availableRankUps(progress).length > 0;
};

/** The Farm's or the Workshop's first tier, when its building stands and the realm holds its Essence and labor. */
const firstTypeTierAffordable = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  tick: number,
): string | null => {
  const learned = realmLearned(store, realm.game_id, realm.entity_id);
  if (learned === undefined) return null;
  const held = (resource: ResourcesIds) =>
    knownAmount(getBalance(safeInteger(realm.entity_id), resource, tick, store).balance);
  for (const { row, category, word } of FIRST_TIERS) {
    // The castle's own workshop is not a building of the type.
    const own =
      getBuildingQuantity(safeInteger(realm.entity_id), category, store) -
      (category === BuildingType.ResourceLabor ? 1 : 0);
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

/** The first of wheat, labor and troops whose store is at its limit; none while every one has room. */
const fullStore = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  rules: ExpeditionRules,
  clock: { now: number; tick: number },
): MadeStore | null =>
  MADE_STORES.find((kind) => readRealmStore(store, realm, rules, kind, clock).tone === "ember") ?? null;

const guardedCampToday = (
  store: NativeFactStore,
  rules: ExpeditionRules,
  realm: NativeRows["Structure"],
  now: number,
): NextUpFacts["camp"] => {
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
    const balance = knownAmount(getBalance(safeInteger(realm.entity_id), cost.resource, tick, store).balance);
    return balance !== undefined && balance >= cost.amount;
  });
};
