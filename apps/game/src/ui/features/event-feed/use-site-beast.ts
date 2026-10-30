import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { getActiveGame } from "@/runtime/world";
import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { siteClearXp } from "@/ui/features/frontier/sites/site-card-plan";
import { configManager, siteFrontierBeast } from "@bibliothecadao/eternum";
import { fetchHeraldExpeditionSite, type NativeRows, requireShard } from "@bibliothecadao/eternum/game-client";
import { useQuery } from "@tanstack/react-query";

const SITES = ["ExpeditionSite"] as const;

/** What a site always is: its kind, its place and its starting guard. */
type SiteFacts = Pick<NativeRows["ExpeditionSite"], "category" | "row" | "initial_guard_count">;

/**
 * A site's lasting facts: from its row when the player's map holds it, else from Herald's row for that site, for a
 * story far from the player's armies. Undefined while that row is on its way, or where no one holds it.
 */
const useSiteFacts = (siteId: number): SiteFacts | undefined => {
  const {
    setup: { store },
  } = useGame();
  useNativeRevision(SITES);
  const gameId = configManager.getActiveGameId();
  const held = store.get("ExpeditionSite", { game_id: gameId, entity_id: siteId });
  const shard = requireShard(getActiveGame()?.chainId);
  // A site's kind, place and starting guard never change, so its row is read once.
  const far = useQuery({
    queryKey: ["herald-site", shard.url, gameId, siteId],
    queryFn: () => fetchHeraldExpeditionSite(shard, gameId, siteId),
    enabled: held === undefined,
    staleTime: Infinity,
  });
  if (held) return held;
  return far.data
    ? {
        category: Number(far.data.category),
        row: Number(far.data.row),
        initial_guard_count: BigInt(String(far.data.initial_guard_count)),
      }
    : undefined;
};

/** A site's guard painting, as the map and the site's card draw it (siteFrontierBeast → beastMeaning). */
export const useSiteBeastMeaning = (siteId: number): IconMeaning | undefined => {
  const {
    setup: { store },
  } = useGame();
  const site = useSiteFacts(siteId);
  const beast = site && siteFrontierBeast(store, configManager.getActiveGameId(), siteId, site);
  return beast && beastMeaning(beast.beast);
};

/** The XP a site's clear paid, as its receipt on the map says it (siteClearXp). */
export const useSiteClearXp = (siteId: number): number | undefined => {
  const site = useSiteFacts(siteId);
  return site && siteClearXp(site);
};
