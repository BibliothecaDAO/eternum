import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getAddressName, getGuildFromPlayerAddress } from "@bibliothecadao/eternum";
import { installRecsStoreBridge } from "@/sync/recs-store-bridge";
import { requireActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { useGame, useNativeRevision } from "@bibliothecadao/react";
import { useEffect } from "react";

/** Mounts the one native fact → view bridge for the lifetime of the world layout. */
export const RecsStoreBridge = () => {
  const {
    setup: { store },
  } = useGame();

  useEffect(() => installRecsStoreBridge({ store, runtime: requireActiveGameSyncRuntime() }), [store]);

  const { data: ended } = useStoryEvents(1, "SeasonEnded");
  const revision = useNativeRevision(["AddressName", "Guild", "GuildMember"]);
  const winner = ended[0]?.owner;
  useEffect(() => {
    const address = winner ? BigInt(winner) : null;
    useUIStore.setState({
      gameWinner:
        address === null
          ? null
          : {
              address,
              name: getAddressName(address, store) ?? "Unknown",
              guildName: getGuildFromPlayerAddress(address, store)?.name ?? "Unknown",
            },
    });
  }, [store, winner, revision]);

  return null;
};
