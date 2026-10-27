import { nextSkillPoint, heldSkillPoints } from "@bibliothecadao/eternum";
import type { IconMeaning } from "@/ui/design-system/icon";
import { troopMeaning } from "@/ui/design-system/domain-icon-meaning";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { buildStaminaDisplayModel } from "@/lib/army-stamina/presentation";
import { exploreStaminaOf } from "@/lib/army-stamina/explore-stamina";
import type { StaminaBar } from "@/ui/design-system/kit/hud-elements";
import { getExplorerStaminaSnapshot } from "@/utils/explorer-stamina";
import { configManager, getArmyName, homecomingReturn, liveHomeArmies } from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { armyNumber, resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useMemo } from "react";

import { ARMY } from "@/ui/design-system/kit/words";

import { availableRankUps, attributeTiers } from "../attributes/attributes";

const ARMY_MODELS = ["ArmySlot", "ArmyProgress", "ExplorerTroops", "TileOccupancy", "EntityName"] as const;

/** One army as the dock and the action bar read it. Unknown is undefined, never zero. */
export type DockArmy = {
  explorerId: number;
  /** Its number among the realm's armies, as its map plate shows it. */
  number: number;
  troopsFact: NativeRows["ExplorerTroops"]["troops"];
  label: string;
  art: IconMeaning;
  xp: number | undefined;
  /** The attribute tier its XP buys next: its XP price and the tier it reaches; none at legendary or while unknown. */
  xpGoal: ReturnType<typeof nextSkillPoint> | undefined;
  /** Its four attribute tiers (Battle, Logistics, Scouting, Homecoming), 1 to 5; unknown while its progress is. */
  tiers: readonly [number, number, number, number] | undefined;
  stamina: StaminaBar | undefined;
  secondsToFull: number | undefined;
  troops: number;
  /** Its XP buys a tier of an attribute now: the card fan on its token. */
  canSpendSkillPoint: boolean;
  /** The whole troops its Homecoming returns when its day ends; unknown while its progress is. */
  returnsHome: number | undefined;
};

/** The realm's armies out today, in the order the castle granted their slots; none without a realm. */
export const useDockArmies = (realm: NativeRows["Structure"] | null): DockArmy[] => {
  const { setup } = useGame();
  const facts = useNativeFacts(ARMY_MODELS);
  const timestamp = useCurrentDefaultTick();
  const realmId = realm ? safeInteger(realm.entity_id) : null;
  const armies = useMemo(
    () => (realmId === null ? [] : liveHomeArmies(facts.store, realmId, configManager.getActiveGameId(), timestamp)),
    [realmId, facts, timestamp],
  );
  return armies.map((army, index) => {
    const explorerId = safeInteger(army.explorer_id);
    const snapshot = getExplorerStaminaSnapshot({
      timestamp,
      liveTroops: resolveExplorerTroops(setup.store, army),
    });
    const stamina = snapshot
      ? buildStaminaDisplayModel({
          committedCurrent: snapshot.current,
          committedMax: snapshot.max,
          timestamp,
          troops: snapshot.troops,
        })
      : null;
    const progress = setup.store.get("ArmyProgress", { game_id: army.game_id, explorer_id: army.explorer_id });
    const xpRules = setup.store.get("ArmyProgressionRules", { game_id: army.game_id });
    const number = armyNumber(army) ?? index + 1;
    return {
      explorerId,
      number,
      troopsFact: army.troops,
      label: armyName(setup.store, explorerId, number),
      art: armyArt(army.troops),
      xp: progress?.xp,
      xpGoal: progress && xpRules && nextSkillPoint(progress.xp, xpRules),
      tiers: progress && attributeTiers(progress),
      stamina: stamina
        ? {
            current: stamina.committedCurrent,
            max: stamina.committedMax,
            perExplore: exploreStaminaOf(setup.store, army.game_id),
          }
        : undefined,
      secondsToFull: stamina?.secondsUntilFull,
      troops: Number(army.troops.count / BigInt(RESOURCE_PRECISION)),
      canSpendSkillPoint:
        progress !== undefined &&
        (availableRankUps(progress).length > 0 ||
          (heldSkillPoints(progress).some((count) => count > 0) &&
            stamina !== null &&
            stamina.committedCurrent < stamina.committedMax)),
      returnsHome:
        progress && homecomingReturn(Number(army.troops.count / BigInt(RESOURCE_PRECISION)), progress.homecoming),
    };
  });
};

export const armyArt = troopMeaning;

/**
 * An army as every line outside the dock names it (the day log): by the same name as its card. An army no longer on
 * the map has no number left to read, and is "Army".
 */
export const armyLabel = (store: NativeFactStore, explorerId: number): string => {
  const army = store.get("ExplorerTroops", { game_id: configManager.getActiveGameId(), explorer_id: explorerId });
  return armyName(store, explorerId, army && armyNumber(army));
};

/** The army's own name when it has one; otherwise its number, never its entity id. */
const armyName = (store: NativeFactStore, explorerId: number, number: number | undefined): string => {
  const named = store.get("EntityName", { game_id: configManager.getActiveGameId(), entity_id: explorerId });
  if (named && named.name !== 0n) return getArmyName(explorerId, store);
  return number === undefined ? ARMY : `${ARMY} ${number}`;
};
