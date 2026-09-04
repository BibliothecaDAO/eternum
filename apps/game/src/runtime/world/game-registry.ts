import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";

import { fetchHeraldGameDirectory } from "./herald-http";
import { getDefaultWorld, getWorldById, getWorldDirectory } from "./world-directory";
import type { WorldDeployment } from "./world-directory";

/**
 * Game identity on the appchain worlds. A world's `GameRegistry` rows — not
 * per-world transport instances or factory tables — are what name a game: one row
 * per game (or eternum season), keyed by `game_id`, carrying the launch name.
 * Everything on the landing side that used to treat "a world" as the unit of
 * identity resolves a `(world, game_id)` pair here instead.
 */

interface S2GameRow {
  gameId: number;
  presetId: number;
}

const fetchS2GameEntry = async (world: WorldDeployment, name: string): Promise<HeraldGameDirectoryEntry | null> => {
  const directory = await fetchHeraldGameDirectory(world);
  return directory.games.find((game) => game.name === name) ?? null;
};

const fetchS2GameRow = async (world: WorldDeployment, name: string): Promise<S2GameRow | null> => {
  const game = await fetchS2GameEntry(world, name);
  return game ? { gameId: game.game_id, presetId: game.preset_id } : null;
};

const gameIds = new Map<string, number>();
const gameWorlds = new Map<string, string>();

/**
 * Resolve WHICH directory world holds a game name. Routes and entry contexts
 * carry only `(chain, worldName)`, so world identity is recovered by asking
 * each world's GameRegistry (first hit wins — launch names are unique per
 * world, and the directory is checked in order: blitz, then eternum). Hits
 * are cached for the session; misses are not.
 */
export const resolveWorldIdForGame = async (worldName: string): Promise<string | null> => {
  if (!worldName) return null;

  const cached = gameWorlds.get(worldName);
  if (cached !== undefined) return cached;

  for (const world of getWorldDirectory()) {
    const row = await fetchS2GameRow(world, worldName);
    if (row) {
      gameWorlds.set(worldName, world.id);
      gameIds.set(`${world.id}:${worldName}`, row.gameId);
      return world.id;
    }
  }
  return null;
};

/**
 * Cached name -> game id lookup against a directory world, for landing-side
 * callers that target a CHOSEN game (availability checks, registration,
 * settlement snapshots) before any bootstrap scope exists. A game's id never
 * changes, so hits are cached for the session; failures are not (a transient
 * Herald restart must not pin a miss).
 */
export const resolveGameId = async (worldName: string, worldId?: string): Promise<number | null> => {
  if (!worldName) return null;

  const resolvedWorldId = worldId ?? (await resolveWorldIdForGame(worldName));
  const world = getWorldById(resolvedWorldId) ?? getDefaultWorld();
  const cacheKey = `${world.id}:${worldName}`;
  const cached = gameIds.get(cacheKey);
  if (cached !== undefined) return cached;

  const row = await fetchS2GameRow(world, worldName);
  if (row) gameIds.set(cacheKey, row.gameId);
  return row?.gameId ?? null;
};
