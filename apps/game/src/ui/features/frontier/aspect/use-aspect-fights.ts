import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { getActiveGame } from "@/runtime/world";
import { configManager } from "@bibliothecadao/eternum";
import { fetchHeraldGameHistory, RACE_MODELS, requireShard } from "@bibliothecadao/eternum/game-client";
import { useQuery } from "@tanstack/react-query";
import { type AspectFight, aspectFights } from "./aspect-feed";

const FEED_LENGTH = 50;
const FEED_REFRESH_MS = 30_000;

/**
 * The fights in the Deep that the members' armies were in, from Herald's immutable battle history in one read. Undefined
 * while it is read; it recovers from the history alone, never from live events.
 */
export function useAspectFights(owners: readonly bigint[]): AspectFight[] | undefined {
  const { setup } = useGame();
  useNativeRevision(RACE_MODELS);
  const chainId = getActiveGame()?.chainId;
  const game = configManager.getActiveGameId();
  const members = owners.map((owner) => `0x${owner.toString(16)}`).sort();
  const battles = useQuery({
    queryKey: ["aspectFights", chainId, game, members],
    queryFn: () =>
      fetchHeraldGameHistory(requireShard(chainId), game, { model: "BattleEvent", owner: members, limit: FEED_LENGTH }),
    enabled: members.length > 0 && chainId !== undefined,
    refetchInterval: FEED_REFRESH_MS,
  });
  return battles.data && aspectFights(setup.store, game, battles.data.items);
}
