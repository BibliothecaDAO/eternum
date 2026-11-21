import { layerName } from "@bibliothecadao/types";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { getActiveGame } from "@/runtime/world";
import { configManager } from "@bibliothecadao/eternum";
import { fetchHeraldGameHistory, RACE_MODELS, requireShard } from "@bibliothecadao/eternum/game-client";
import { useQuery } from "@tanstack/react-query";
import { type AspectFight, aspectFights, readDeepFightWindow } from "./aspect-feed";

const FEED_LENGTH = 50;
const PAGE_SIZE = 100;
const FEED_REFRESH_MS = 30_000;

/** The feed as the page draws it: being read, failed (with a retry), or the fights read. */
export type AspectFeedReading =
  | { status: "loading" }
  | { status: "failed"; retry: () => void }
  | { status: "ready"; fights: AspectFight[] };

/**
 * The fights in the Deep that the members' armies were in, from Herald's immutable battle history: pages are read until
 * the feed holds its window of Deep fights or the history ends. It recovers from the history alone, never from live events.
 */
export function useAspectFights(owners: readonly bigint[]): AspectFeedReading {
  const { setup } = useGame();
  useNativeRevision(RACE_MODELS);
  const chainId = getActiveGame()?.chainId;
  const game = configManager.getActiveGameId();
  const members = owners.map((owner) => `0x${owner.toString(16)}`).sort();
  const battles = useQuery({
    queryKey: ["aspectFights", chainId, game, members],
    queryFn: async () => {
      try {
        const shard = requireShard();
        const { spacing } = setup.store.require("SettlementRules", { game_id: game });
        return await readDeepFightWindow(
          (offset) =>
            fetchHeraldGameHistory(shard, game, { model: "BattleEvent", owner: members, limit: PAGE_SIZE, offset }),
          spacing,
          FEED_LENGTH,
          PAGE_SIZE,
        );
      } catch (error) {
        console.error("[aspect feed] the battle history could not be read", error);
        throw error;
      }
    },
    enabled: members.length > 0 && chainId !== undefined,
    refetchInterval: FEED_REFRESH_MS,
  });
  if (battles.isError) return { status: "failed", retry: () => void battles.refetch() };
  if (!battles.data) return { status: "loading" };
  const { fights, unnamed } = aspectFights(setup.store, game, battles.data);
  if (unnamed > 0) {
    // A fight with a side whose Aspect is not read yet is not an empty feed: the feed keeps loading until HomeAspect arrives.
    console.error(`[aspect feed] ${unnamed} ${layerName(3)} fights have a home with no Aspect row`);
    return { status: "loading" };
  }
  return { status: "ready", fights: fights.slice(0, FEED_LENGTH) };
}
