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
  isCurrentExpeditionArmy,
  liveHomeArmies,
  StaminaManager,
  structureMapPosition,
} from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType, StructureType, type TroopTier, type TroopType } from "@bibliothecadao/types";
import { knownBalance } from "@/ui/utils/utils";
import { useMemo } from "react";
import { troopsOnHand, type useExpeditionRules } from "../frontier-home";
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
  "ExpeditionSite",
] as const;

/**
 * What the guide answers to, read from the store at chain time; it never listens for events. The facts the contracts'
 * schema brings (attribute and type tiers, stragglers, ruin chests, store limits) read as unknown until then, and the
 * losing fight and the season's end are told by the cards that host those lines.
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
    ...NOT_YET_READ,
    realm: true,
    barracks: getBuildingQuantity(realm.entity_id, BuildingType.ResourceKnightT1, store) > 0,
    troopsAtHome: troopsOnHand(store, realm.entity_id, clock.tick),
    armies: armies.length,
    armyActed: stamina.some((bar) => bar.current < bar.max),
    camp: guardedCampToday(store, rules, realm, clock.now),
    castleAffordable: canAffordNextCastleLevel(store, realm, clock.tick),
    onMap: clock.onMap,
    armiesTired:
      stamina.length === armies.length && stamina.length > 0 && stamina.every((bar) => bar.current < exploreCost),
    ...readSiteFirsts(store, realm.game_id),
    armyBeyondSpire: armies.some(
      (army) => expeditionDepth(rules, { y: entityMapPosition(store, army.game_id, army.explorer_id).y }) >= 1,
    ),
  };
};

/** The expedition's sites as the guide's firsts read them. */
const readSiteFirsts = (store: NativeFactStore, gameId: number) => {
  const sites = [...store.inGame("ExpeditionSite", gameId)];
  return {
    siteCleared: sites.some((site) => site.cleared),
    ruin: sites.some((site) => site.kind === "FallenRealm" && !site.cleared),
  };
};

/** What waits for the contracts' schema, and what the hosting cards tell. */
const NOT_YET_READ = {
  armyTierAffordable: undefined,
  stragglers: undefined,
  typeTierAffordable: undefined,
  chestPaid: undefined,
  storeFull: undefined,
  losingFight: false,
  seasonOver: false,
} as const;

const NO_REALM: GuideFacts = {
  ...NOT_YET_READ,
  realm: false,
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
