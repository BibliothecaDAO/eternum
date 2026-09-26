import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentArmiesTick, useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import {
  configManager,
  entityMapPosition,
  expeditionDepth,
  learnedResearchNodes,
  getBalance,
  getBuildingQuantity,
  getGuardsByStructure,
  isCurrentExpeditionArmy,
  liveHomeArmies,
  StaminaManager,
  structureMapPosition,
} from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import {
  BuildingType,
  RESOURCE_PRECISION,
  ResourcesIds,
  StructureType,
  TileOccupier,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
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
  "ArmyProgress",
  "ExpeditionSite",
  "RealmKnowledge",
  "ResearchNode",
] as const;

/**
 * What the guide answers to, read from the store at chain time, and from the player's chest history for the one first
 * no current fact keeps; it never listens for events.
 */
export const useGuideFacts = (rules: ExpeditionRules, realm: NativeRows["Structure"] | null): GuideFacts => {
  const { setup } = useGame();
  const player = useAccountStore((state) => state.account?.address ?? null);
  // A LORDS roll the day could not pay leaves only its story; no row keeps it.
  const { data: chests } = useStoryEvents(100, "ChestReward", player ?? ZERO_ADDRESS);
  const lordsSpent = player !== null && chests.some(({ storyPayload }) => storyPayload?.lords_exhausted === true);
  const revision = useNativeRevision(GUIDE_MODELS);
  const now = useNowSeconds();
  const tick = useCurrentDefaultTick();
  const armiesTick = useCurrentArmiesTick();
  const { isMapView } = useQuery();
  return useMemo(
    () => ({ ...readGuideFacts(setup.store, rules, realm, { now, tick, armiesTick, onMap: isMapView }), lordsSpent }),
    // The revision is the recompute signal for store writes; the clocks for time passing.
    [setup.store, rules, realm, now, tick, armiesTick, isMapView, revision, lordsSpent],
  );
};

const readGuideFacts = (
  store: NativeFactStore,
  rules: ExpeditionRules,
  realm: NativeRows["Structure"] | null,
  clock: { now: number; tick: number; armiesTick: number; onMap: boolean },
): Omit<GuideFacts, "lordsSpent"> => {
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
    pickWaiting: armies.some(
      (army) => store.get("ArmyProgress", { game_id: army.game_id, explorer_id: army.explorer_id })?.pending,
    ),
    ...readSiteFirsts(store, realm.game_id),
    firstResearchAffordable: canAffordFirstResearch(store, realm, clock.tick),
    armyBelowSurface: armies.some(
      (army) => expeditionDepth(rules, { y: entityMapPosition(store, army.game_id, army.explorer_id).y }) >= 1,
    ),
  };
};

/** Nothing learned yet, and the realm's Essence covers the cheapest node on the table. */
const canAffordFirstResearch = (store: NativeFactStore, realm: NativeRows["Structure"], tick: number): boolean => {
  const learned = learnedResearchNodes(store, realm.game_id, realm.entity_id);
  if (learned === undefined || learned.length > 0) return false;
  const prices = [...store.inGame("ResearchNode", realm.game_id)].map(
    ({ essence_cost }) => Number(essence_cost) / RESOURCE_PRECISION,
  );
  const essence = knownBalance(getBalance(realm.entity_id, ResourcesIds.Essence, tick, store).balance);
  return prices.length > 0 && essence !== undefined && essence >= Math.min(...prices);
};

/** The expedition's sites and chests as the guide's firsts read them. */
const readSiteFirsts = (store: NativeFactStore, gameId: number) => {
  const sites = [...store.inGame("ExpeditionSite", gameId)];
  return {
    siteCleared: sites.some((site) => site.cleared),
    fallenRealm: sites.some((site) => site.kind === "FallenRealm" && !site.cleared),
    closedChest: [...store.inGame("TileOccupancy", gameId)].some((tile) => tile.category === TileOccupier.Chest),
  };
};

const ZERO_ADDRESS = "0x0";

const NO_REALM: Omit<GuideFacts, "lordsSpent"> = {
  realm: false,
  barracks: false,
  troopsAtHome: undefined,
  armies: 0,
  armyActed: false,
  camp: null,
  castleAffordable: false,
  onMap: false,
  armiesTired: false,
  pickWaiting: false,
  siteCleared: false,
  closedChest: false,
  fallenRealm: false,
  firstResearchAffordable: false,
  armyBelowSurface: false,
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
