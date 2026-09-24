import type { GameRef } from "@bibliothecadao/eternum/game-client";
import { fetchHeraldGameDirectory } from "@bibliothecadao/eternum/game-client";

import { recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";
import { requireOpenShard } from "./shards";
import { saveGameProfile } from "./store";
import type { GameProfile } from "./types";

/** A game's preset and name come from its own shard's directory, so a stale local copy never boots it. */
export const buildGameProfile = async (game: GameRef): Promise<GameProfile> => {
  const startedAt = performance.now();
  const shard = await requireOpenShard(game.chainId);
  const directory = await fetchHeraldGameDirectory(shard);
  recordGameEntryDuration("game-profile-directory-fetch", performance.now() - startedAt);
  const entry = directory.games.find((candidate) => candidate.game_id === game.gameId);
  if (!entry) throw new Error(`Game ${game.gameId} is not in the directory of shard ${shard.url}`);
  const profile: GameProfile = {
    chainId: shard.chainId,
    gameId: entry.game_id,
    presetId: entry.preset_id,
    name: entry.name,
    fetchedAt: Date.now(),
  };
  saveGameProfile(profile);
  return profile;
};
