import type { GameRef } from "@bibliothecadao/eternum/game-client";

import { recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";
import { readGameEntry } from "./shard-directory";
import type { GameProfile } from "./types";

export const buildGameProfile = async (game: GameRef): Promise<GameProfile> => {
  const startedAt = performance.now();
  const entry = await readGameEntry(game, null, Infinity);
  recordGameEntryDuration("game-profile-directory-fetch", performance.now() - startedAt);
  return {
    chainId: game.chainId,
    gameId: entry.game_id,
    name: entry.name,
  };
};
