import type { WorldSummary } from "@bibliothecadao/types";
import { useEffect } from "react";
import { subscribeHeraldDirectory } from "@bibliothecadao/eternum/game-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { listOpenShards, openKnownShards } from "@/runtime/world/shards";
import { fetchShardWorldsSummary } from "./shard-worlds-summary";
import { WORLD_SUMMARY_QUERY_KEY, invalidateWorldListQueries } from "./world-list-queries";

/**
 * The landing games list: the union of every open shard's GameRegistry summary, one request per shard; React Query
 * deduplicates across components. A shard that cannot be opened or read contributes nothing rather than failing the
 * whole list, and is reported by URL.
 */
async function fetchWorldsSummary(): Promise<WorldSummary[]> {
  for (const failure of await openKnownShards()) {
    console.error(`[worlds-summary] shard ${failure.url} could not be opened`, failure.error);
  }
  const perShard = await Promise.all(
    listOpenShards().map((shard) =>
      fetchShardWorldsSummary(shard).catch((error) => {
        console.error(`[worlds-summary] shard ${shard.url} Herald directory failed`, error);
        return [] as WorldSummary[];
      }),
    ),
  );
  return perShard.flat();
}

export const useWorldsSummary = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: WORLD_SUMMARY_QUERY_KEY,
    queryFn: fetchWorldsSummary,
    staleTime: 25_000,
    retry: 1,
  });
  // Shards open during the list fetch, so directory streams re-subscribe once another shard is open.
  const shardUrls = query.dataUpdatedAt ? openShardUrls() : "";
  useEffect(() => {
    const unsubscribe = listOpenShards().map((shard) =>
      subscribeHeraldDirectory(shard, () => {
        void invalidateWorldListQueries(queryClient);
      }),
    );
    return () => unsubscribe.forEach((stop) => stop());
  }, [queryClient, shardUrls]);
  return query;
};

const openShardUrls = (): string =>
  listOpenShards()
    .map((shard) => shard.url)
    .join(" ");
