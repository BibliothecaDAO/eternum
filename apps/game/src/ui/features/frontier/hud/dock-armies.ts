import { useGame } from "@/hooks/context/game-context";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { buildStaminaDisplayModel } from "@/lib/army-stamina/presentation";
import { getExplorerStaminaSnapshot } from "@/utils/explorer-stamina";
import { configManager, getArmyName, liveHomeArmies } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useMemo } from "react";

import { ARMY } from "@/ui/design-system/kit/words";

const ARMY_MODELS = ["ArmySlot", "ArmyProgress", "ExplorerTroops", "TileOccupancy", "EntityName"] as const;

/** One army as the dock and the action bar read it. Unknown is undefined, never zero. */
export type DockArmy = {
  explorerId: number;
  troopsFact: NativeRows["ExplorerTroops"]["troops"];
  label: string;
  art: string;
  xp: number | undefined;
  stamina: { current: number; max: number } | undefined;
  secondsToFull: number | undefined;
  troops: number;
};

/** The realm's armies out today, in the order the castle granted their slots; none without a realm. */
export const useDockArmies = (realm: NativeRows["Structure"] | null): DockArmy[] => {
  const { setup } = useGame();
  const revision = useNativeRevision(ARMY_MODELS);
  const { currentArmiesTick, armiesTickTimeRemaining } = useBlockTimestamp();
  const armies = useMemo(
    () => (realm ? liveHomeArmies(setup.store, realm.entity_id, configManager.getActiveGameId()) : []),
    [realm?.entity_id, revision, setup.store, currentArmiesTick],
  );
  return armies.map((army, index) => {
    const snapshot = getExplorerStaminaSnapshot({
      entityId: army.explorer_id,
      currentArmiesTick,
      liveTroops: resolveExplorerTroops(setup.store, army),
    });
    const stamina = snapshot
      ? buildStaminaDisplayModel({
          committedCurrent: snapshot.current,
          committedMax: snapshot.max,
          armiesTickTimeRemaining,
          currentArmiesTick,
          troops: snapshot.troops,
        })
      : null;
    const progress = setup.store.get("ArmyProgress", { game_id: army.game_id, explorer_id: army.explorer_id });
    return {
      explorerId: army.explorer_id,
      troopsFact: army.troops,
      label: armyName(setup.store, army.explorer_id, index + 1),
      art: armyArt(army.troops),
      xp: progress?.xp,
      stamina: stamina ? { current: stamina.committedCurrent, max: stamina.committedMax } : undefined,
      secondsToFull: stamina?.secondsUntilFull,
      troops: Number(army.troops.count / BigInt(RESOURCE_PRECISION)),
    };
  });
};

/** An army's diorama: its troops on their hex base. */
export const armyArt = (troops: { category: string; tier: string }) =>
  `/images/armies/${troops.category.toLowerCase()}${troops.tier}.png`;

/** The army's own name when it has one; otherwise its place in the dock, never its entity id. */
const armyName = (store: NativeFactStore, explorerId: number, position: number): string => {
  const named = store.get("EntityName", { game_id: configManager.getActiveGameId(), entity_id: explorerId });
  return named && named.name !== 0n ? getArmyName(explorerId, store) : `${ARMY} ${position}`;
};
