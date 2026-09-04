import type { WorldSummary } from "@bibliothecadao/types";

import { fetchHeraldGameDirectory } from "@/runtime/world/herald-http";
import type { WorldDeployment } from "@/runtime/world/world-directory";

/**
 * Landing-card summaries come from Herald's normalized GameRegistry directory.
 * The directory owns the joins and counts once per chain; the browser only maps
 * its transport shape to the shared landing shape.
 */
export async function fetchAppchainWorldsSummary(world: WorldDeployment): Promise<WorldSummary[]> {
  const directory = await fetchHeraldGameDirectory(world);

  const now = Date.now();
  return directory.games
    .filter((game) => game.name !== "" && game.mode !== null && game.game_id > 0)
    .map((game) => ({
      name: game.name,
      chain: world.chain,
      worldId: world.id,
      gameId: game.game_id,
      alive: true,
      lastCheckedAt: now,
      mode: game.mode,
      startSettlingAt: game.clock.start_settling_at,
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
