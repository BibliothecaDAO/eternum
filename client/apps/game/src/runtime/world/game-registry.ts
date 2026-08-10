import { getGameManifest } from "@contracts";
import { getContractByName } from "@dojoengine/core";

import { appchainModel, namespaceForChain } from "@/dojo/game-scope";
import { env } from "../../../env";
import { nameToPaddedFelt } from "./normalize";
import { getDefaultWorld, getWorldById } from "./world-directory";

/**
 * Game identity on the appchain worlds. A world's `GameRegistry` rows — not
 * per-world torii instances or factory tables — are what name a game: one row
 * per game (or eternum season), keyed by `game_id`, carrying the launch name.
 * Everything on the landing side that used to treat "a world" as the unit of
 * identity resolves a `(world, game_id)` pair here instead.
 */

export interface S2GameRow {
  gameId: number;
  presetId: number;
}

/**
 * Look up a game's registry row by launch name. Torii stores felt columns
 * 64-hex-char left-padded — unpadded names never match.
 */
export const fetchS2GameRow = async (toriiBaseUrl: string, name: string): Promise<S2GameRow | null> => {
  try {
    const query = `SELECT game_id, preset_id FROM "${appchainModel("GameRegistry")}" WHERE name = "${nameToPaddedFelt(name)}" LIMIT 1;`;
    const response = await fetch(`${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const [row] = (await response.json()) as Record<string, unknown>[];
    if (!row) return null;
    const gameId = Number(row.game_id);
    const presetId = Number(row.preset_id);
    return Number.isInteger(gameId) && gameId > 0 ? { gameId, presetId } : null;
  } catch {
    return null;
  }
};

const appchainGameIds = new Map<string, number>();

/**
 * Cached name -> game id lookup against a directory world, for landing-side
 * callers that target a CHOSEN game (availability checks, registration,
 * settlement snapshots) before any bootstrap scope exists. A game's id never
 * changes, so hits are cached for the session; failures are not (a transient
 * torii restart must not pin a miss).
 */
export const resolveAppchainGameId = async (worldName: string, worldId?: string): Promise<number | null> => {
  if (env.VITE_PUBLIC_CHAIN !== "appchain" || !worldName) return null;

  const world = getWorldById(worldId) ?? getDefaultWorld();
  const cacheKey = `${world.id}:${worldName}`;
  const cached = appchainGameIds.get(cacheKey);
  if (cached !== undefined) return cached;

  const row = await fetchS2GameRow(world.toriiBaseUrl, worldName);
  if (row) appchainGameIds.set(cacheKey, row.gameId);
  return row?.gameId ?? null;
};

/**
 * The appchain worlds' system contracts ship in the committed manifests —
 * there is no per-game deployment to resolve. Returns the address for a
 * system name (e.g. "blitz_realm_systems"), or null when absent.
 */
export const getAppchainSystemAddress = (systemName: string): string | null => {
  try {
    const manifest = getGameManifest("appchain");
    const contract = getContractByName(manifest, namespaceForChain("appchain"), systemName) as { address?: string };
    return contract?.address ?? null;
  } catch {
    return null;
  }
};
