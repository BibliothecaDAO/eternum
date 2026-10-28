import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { getActiveGame } from "@/runtime/world";
import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { configManager, readFrontierBeast, siteFrontierBeast } from "@bibliothecadao/eternum";
import { fetchHeraldExpeditionSite, requireShard } from "@bibliothecadao/eternum/game-client";
import { useQuery } from "@tanstack/react-query";

const SITES = ["ExpeditionSite"] as const;

/**
 * A site's guard painting, as the map and the site's card draw it (siteFrontierBeast → beastMeaning): from the site's
 * row when the player's map holds it, else from Herald's row for that site, for a story far from the player's armies.
 * Undefined while that row is on its way, or where no one holds it.
 */
export const useSiteBeastMeaning = (siteId: number): IconMeaning | undefined => {
  const {
    setup: { store },
  } = useGame();
  useNativeRevision(SITES);
  const gameId = configManager.getActiveGameId();
  const held = readFrontierBeast(store, gameId, siteId);
  const shard = requireShard(getActiveGame()?.chainId);
  // A site's kind, place and starting guard never change, so its row is read once.
  const far = useQuery({
    queryKey: ["herald-site", shard.url, gameId, siteId],
    queryFn: () => fetchHeraldExpeditionSite(shard, gameId, siteId),
    enabled: held === undefined,
    staleTime: Infinity,
  });
  const beast =
    held ??
    (far.data
      ? siteFrontierBeast(store, gameId, siteId, {
          category: Number(far.data.category),
          row: Number(far.data.row),
          initial_guard_count: BigInt(String(far.data.initial_guard_count)),
        })
      : undefined);
  return beast && beastMeaning(beast.beast);
};
