import { useGame } from "@/hooks/context/game-context";
import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { isAddressEqualToAccount } from "@/three/utils/utils";
import { configManager } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { ownBattleStructures, resolveStructureAttention } from "./attention-policy";

const RECENT_BATTLES = 50;

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
  const { data: battles } = useStoryEvents(RECENT_BATTLES, "BattleEvent");
  const ownBattles = useMemo(
    () => ownBattleStructures(battles ?? [], (address) => isAddressEqualToAccount(address as string | bigint)),
    [battles],
  );
  return useMemo(
    () =>
      resolveStructureAttention(
        structures,
        arrivedIds,
        now,
        [...setup.store.inGame("Guard", configManager.getActiveGameId())],
        ownBattles,
      ),
    [structures, arrivedIds, now, setup.store, revision, ownBattles],
  );
};
