import type { GameRef } from "@bibliothecadao/eternum/game-client";

import { recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";
import { readGameEntry } from "./shard-directory";
import { saveGameProfile } from "./store";
import type { GameProfile } from "./types";

/** A game's preset and name come from its own shard's directory, so a stale local copy never boots it. */
export const buildGameProfile = async (game: GameRef): Promise<GameProfile> => {
  const startedAt = performance.now();
  const entry = await readGameEntry(game, null);
  recordGameEntryDuration("game-profile-directory-fetch", performance.now() - startedAt);
  const profile: GameProfile = {
    chainId: game.chainId,
    gameId: entry.game_id,
    presetId: entry.preset_id,
    name: entry.name,
    fetchedAt: Date.now(),
  };
  saveGameProfile(profile);
  return profile;
};
