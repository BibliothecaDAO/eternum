import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import {
  configManager,
  getGuardsByStructure,
  isCurrentExpeditionRegion,
  liveHomeArmies,
  StaminaManager,
  structureMapPosition,
} from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { StructureType } from "@bibliothecadao/types";
import { useMemo } from "react";
import type { useExpeditionRules } from "../frontier-home";

type ExpeditionRules = NonNullable<ReturnType<typeof useExpeditionRules>>;

/** What today's map still holds for the player that its end takes: a camp to clear, an army that can still explore. */
export interface DayEndFacts {
  /** A guarded camp in today's region, where its Show takes the map; null when there is none. */
  camp: { x: number; y: number } | null;
  /** An army of today holds the stamina to explore. */
  armyCanExplore: boolean;
}

const DAY_END_MODELS = ["Structure", "ArmySlot", "ExplorerTroops", "TileOccupancy", "Guard"] as const;

/** The player's day-end facts, recomputed as the store changes and the clock moves. */
export const useDayEndFacts = (rules: ExpeditionRules, realm: NativeRows["Structure"] | null): DayEndFacts => {
  const facts = useNativeFacts(DAY_END_MODELS);
  const now = useNowSeconds();
  const tick = useCurrentDefaultTick();
  return useMemo(
    () => (realm ? readDayEndFacts(facts.store, rules, realm, { now, tick }) : NOTHING_LEFT),
    // The revision is the recompute signal for facts.store writes; the clocks for time passing.
    [rules, realm, now, tick, facts],
  );
};

const NOTHING_LEFT: DayEndFacts = { camp: null, armyCanExplore: false };

const readDayEndFacts = (
  store: NativeFactStore,
  rules: ExpeditionRules,
  realm: NativeRows["Structure"],
  clock: { now: number; tick: number },
): DayEndFacts => ({
  camp: guardedCampToday(store, rules, realm, clock.now),
  armyCanExplore: anArmyCanExplore(store, realm, clock.tick),
});

const anArmyCanExplore = (store: NativeFactStore, realm: NativeRows["Structure"], tick: number): boolean => {
  const cost = configManager.getExploreStaminaCost();
  return liveHomeArmies(store, safeInteger(realm.entity_id), realm.game_id).some((army) => {
    const troops = resolveExplorerTroops(store, army);
    return troops !== undefined && Number(StaminaManager.getStamina(troops, tick).amount) >= cost;
  });
};

const guardedCampToday = (
  store: NativeFactStore,
  rules: ExpeditionRules,
  realm: NativeRows["Structure"],
  now: number,
): DayEndFacts["camp"] => {
  for (const structure of store.inGame("Structure", realm.game_id)) {
    if (structure.base.category !== StructureType.Camp || structure.owner === realm.owner) continue;
    const position = structureMapPosition(store, structure);
    if (!position) continue;
    if (isCurrentExpeditionRegion(rules, position, now) && isGuarded(structure, store)) return position;
  }
  return null;
};

/** A camp with troops in a guard slot; one whose guards are not yet known is not claimed. */
const isGuarded = (structure: NativeRows["Structure"], store: NativeFactStore): boolean =>
  getGuardsByStructure(structure, store)?.some((guard) => guard.troops.count > 0n) ?? false;
