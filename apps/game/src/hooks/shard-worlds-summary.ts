import type { WorldSummary } from "@bibliothecadao/types";

import { fetchHeraldGameDirectory } from "@bibliothecadao/eternum/game-client";
import type { Shard } from "@bibliothecadao/eternum/game-client";

/**
 * Landing-card summaries come from each shard's normalized GameRegistry directory.
 * The directory owns the joins and counts once per shard; the browser only maps
 * its transport shape to the shared landing shape.
 */
export async function fetchShardWorldsSummary(world: Shard): Promise<WorldSummary[]> {
  const directory = await fetchHeraldGameDirectory(world);

  const now = Date.now();
  return directory.games
    .filter((game) => game.name !== "" && game.mode !== null && game.game_id > 0)
    .map((game) => ({
      name: game.name,
      chainId: world.chainId,
      gameId: game.game_id,
      alive: true,
      lastCheckedAt: now,
      mode: game.mode,
      startSettlingAt: game.clock.start_settling_at,
      ready: game.ready,
      startMainAt: game.clock.start_main_at,
      endAt: game.clock.end_at,
      devModeOn: game.dev_mode_on,
      singleRealmMode: game.settlement?.single_realm_mode ?? null,
      twoPlayerMode: game.settlement?.two_player_mode ?? null,
      seasonPassAddress: null,
      villagePassAddress: null,
      worldAddress: world.worldAddress,
      registrationCount: game.registration?.count ?? null,
      registrationCountMax: game.registration?.max ?? null,
      registrationStartAt: game.registration?.start_at ?? null,
      registrationEndAt: game.clock.start_main_at,
      settledPlayersCount: game.player_count,
      settledRealmsCount: game.settled_realms_count,
      settledVillagesCount: game.settled_villages_count,
    }));
}
