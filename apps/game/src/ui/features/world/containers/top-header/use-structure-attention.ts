import { useGame } from "@/hooks/context/game-context";
import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { isAddressEqualToAccount } from "@/three/utils/utils";
import { configManager } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { guardActions, resolveStructureAttention, type CombatHistory } from "./attention-policy";

/** How much of the player's own history each read keeps: battles, raids and troop moves naming them, newest first. */
const COMBAT_HISTORY = 100;

/**
 * What needs the player now, read one way for every surface that shows it (Next up, the phone's Attention): their
 * structures under attack, by someone else, and those with arrivals waiting.
 */
export const useStructureAttention = () => {
  const { setup } = useGame();
  const structures = useFactView(playerStructuresView);
  const arrivedIds = useUIStore((state) => state.arrivedArrivalStructureIds);
  const now = Math.floor(useNowMs() / 1000);
  const revision = useNativeRevision(["Guard"]);
  const combat = usePlayerCombatHistory();
  return useMemo(
    () =>
      resolveStructureAttention(
        structures,
        arrivedIds,
        now,
        [...setup.store.inGame("Guard", configManager.getActiveGameId())],
        combat,
      ),
    [structures, arrivedIds, now, setup.store, revision, combat],
  );
};

/**
 * The actions on guards naming the player (battles, raids, troops moved into a guard), once every read is done; null
 * while one is loading or has failed. Complete once each read's history reached the block the facts were read at.
 */
const usePlayerCombatHistory = (): CombatHistory | null => {
  const player = useAccountStore((state) => state.account?.address);
  const streamGeneration = useConnectionStore((state) => state.lastGlobalHandshake);
  const snapshotBlock = useConnectionStore((state) => state.snapshotBlock);
  const battles = useStoryEvents(COMBAT_HISTORY, "BattleEvent", player);
  const raids = useStoryEvents(COMBAT_HISTORY, "RaidEvent", player);
  const transfers = useStoryEvents(COMBAT_HISTORY, "TroopsTransferred", player);
  const reads = [battles, raids, transfers];
  const known = Boolean(player) && reads.every((read) => read.isSuccess);
  const complete =
    snapshotBlock !== null &&
    reads.every((read) => read.completeThroughBlock !== null && read.completeThroughBlock >= snapshotBlock);
  return useMemo(
    () =>
      known
        ? {
            actions: guardActions([...battles.data, ...raids.data, ...transfers.data], streamGeneration),
            isPlayer: (address) => address !== null && isAddressEqualToAccount(address),
            complete,
          }
        : null,
    [known, complete, battles.data, raids.data, transfers.data, streamGeneration],
  );
};
