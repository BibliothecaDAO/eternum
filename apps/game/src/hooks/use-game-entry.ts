import type { GameRef } from "@bibliothecadao/eternum/game-client";
import type { HeraldGameDirectory } from "@bibliothecadao/eternum/game-sync";
import { useQuery } from "@tanstack/react-query";

import { shardDirectoryQuery } from "@/runtime/world/shard-directory";

/**
 * A chosen game's row in its shard's directory, with the connected player's standing; null when the shard does not list
 * the game. It shares the shard directory's one cache entry with every other reader of that shard.
 */
export const useGameEntry = (
  game: GameRef,
  { enabled, player, refetchIntervalMs }: { enabled: boolean; player: string | null; refetchIntervalMs: number },
) =>
  useQuery({
    ...shardDirectoryQuery(game.chainId, player),
    select: (directory: HeraldGameDirectory) => directory.games.find((entry) => entry.game_id === game.gameId) ?? null,
    enabled,
    refetchInterval: refetchIntervalMs,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  });
