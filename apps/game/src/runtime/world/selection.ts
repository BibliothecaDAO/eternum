import type { GameRef } from "@bibliothecadao/eternum/game-client";

import { markGameEntryMilestone, recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";
import { buildGameProfile } from "./profile-builder";
import { setActiveGame } from "./store";
import type { GameProfile } from "./types";

export const applyGameSelection = async (game: GameRef): Promise<GameProfile> => {
  const selectionStartedAt = performance.now();
  markGameEntryMilestone("world-profile-build-started");
  const profile = await buildGameProfile(game);
  markGameEntryMilestone("world-profile-resolved");
  setActiveGame(profile);
  markGameEntryMilestone("world-selection-state-persisted");
  recordGameEntryDuration("world-selection-total", performance.now() - selectionStartedAt);
  return profile;
};
