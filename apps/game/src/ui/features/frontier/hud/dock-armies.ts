import type { IconMeaning } from "@/ui/design-system/icon";
import { troopMeaning } from "@/ui/design-system/domain-icon-meaning";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { buildStaminaDisplayModel } from "@/lib/army-stamina/presentation";
import { exploreStaminaOf } from "@/lib/army-stamina/explore-stamina";
import type { StaminaBar } from "@/ui/design-system/kit/hud-elements";
import { getExplorerStaminaSnapshot } from "@/utils/explorer-stamina";
import {
  armyEtherealLayer,
  armyOaths,
  configManager,
  type EtherealLayer,
  liveHomeArmies,
} from "@bibliothecadao/eternum";
import {
  armyDrain,
  safeInteger,
  type DeepArmyLife,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { armyNumber, resolveExplorerTroops, STAMINA_MODELS } from "@bibliothecadao/eternum/troop-stamina";
import { formatExact, frontierTroopName, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useMemo } from "react";

import { TROOPS } from "@/ui/design-system/kit/words";

const ARMY_MODELS = [
  ...STAMINA_MODELS,
  "DeepArmy",
  "ArmyDay",
  "DeepRules",
  "SliceRules",
  "SettlementRules",
  "GameRegistry",
] as const;

/** One army as the dock and the action bar read it. Unknown is undefined, never zero. */
export type DockArmy = {
  explorerId: number;
  /** Its number among the realm's armies, as its map plate shows it. */
  number: number;
  troopsFact: NativeRows["ExplorerTroops"]["troops"];
  label: string;
  art: IconMeaning;

  /** Its tier in each attribute, 0 to 5, by its field on the progress; unknown while its progress is. */
  stamina: StaminaBar | undefined;
  secondsToFull: number | undefined;
  troops: number;

  /** The Ethereal layer it stands in (armyEtherealLayer); none on the surface. */
  ethereal: EtherealLayer | undefined;
  /** What holding a Deep site costs it: its troops fall each tick. None while it holds no site. */
  drain?: DeepArmyLife;
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
  const names = armyNames(armies);
  return armies.map((army, index) => {
    const explorerId = safeInteger(army.explorer_id);
    const { stamina, secondsToFull } = armyBar(setup.store, army, timestamp);
    const number = armyNumber(army) ?? index + 1;
    return {
      explorerId,
      number,
      troopsFact: army.troops,
      label: names[index],
      art: armyArt(army.troops),
      stamina,
      secondsToFull,
      troops: troopCount(army.troops),
      ethereal: armyEtherealLayer(setup.store, army.game_id, explorerId),
      drain: armyDrain(setup.store, army, timestamp),
    };
  });
};

export const armyBar = (
  store: NativeFactStore,
  army: NativeRows["ExplorerTroops"],
  timestamp: number,
): Pick<DockArmy, "stamina" | "secondsToFull"> => {
  const snapshot = getExplorerStaminaSnapshot({ timestamp, liveTroops: resolveExplorerTroops(store, army, timestamp) });
  const stamina = snapshot
    ? buildStaminaDisplayModel({
        committedCurrent: snapshot.current,
        committedMax: snapshot.max,
        timestamp,
        troops: snapshot.troops,
      })
    : null;
  return {
    stamina: stamina
      ? {
          current: stamina.committedCurrent,
          max: stamina.committedMax,
          perExplore: exploreStaminaOf(store, army.game_id, army.troops.category, armyOaths(store, army)),
        }
      : undefined,
    secondsToFull: stamina?.secondsUntilFull,
  };
};

export const armyArt = troopMeaning;

const armyNames = (armies: readonly NativeRows["ExplorerTroops"][]): string[] => {
  const names = armies.map((army) => armyName(army.troops.category, troopCount(army.troops)));
  return names.map((name, index) =>
    names.indexOf(name) === names.lastIndexOf(name) ? name : `${name} (${armyNumber(armies[index]) ?? index + 1})`,
  );
};

const troopCount = (troops: NativeRows["ExplorerTroops"]["troops"]): number =>
  Number(troops.count / BigInt(RESOURCE_PRECISION));

export const armyName = (category: string, troops: number): string =>
  `${formatExact(troops)} ${frontierTroopName(category, troops) ?? TROOPS}`;
