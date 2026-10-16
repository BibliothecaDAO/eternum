import { useGame } from "@/hooks/context/game-context";
import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { isAddressEqualToAccount } from "@/three/utils/utils";
import { activeCombatRules, configManager } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { guardHits, resolveStructureAttention, type CombatHistory } from "./attention-policy";

/** How much of the player's own combat each read keeps: battles and raids naming them, newest first. */
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

/** The battles and raids naming the player, once both are read; null while either is loading or has failed. */
const usePlayerCombatHistory = (): CombatHistory | null => {
  const player = useAccountStore((state) => state.account?.address);
  const battles = useStoryEvents(COMBAT_HISTORY, "BattleEvent", player);
  const raids = useStoryEvents(COMBAT_HISTORY, "RaidEvent", player);
  const known = Boolean(player) && battles.isSuccess && raids.isSuccess;
  return useMemo(
    () =>
      known
        ? {
            hits: guardHits([...battles.data, ...raids.data]),
            cooldownSeconds: activeCombatRules().cooldownSeconds,
            isPlayer: (address) => address !== null && isAddressEqualToAccount(address),
          }
        : null,
    [known, battles.data, raids.data],
  );
};
