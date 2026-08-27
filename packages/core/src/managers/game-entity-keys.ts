import { WORLD_CONFIG_ID } from "@bibliothecadao/types";
import { getEntityIdFromKeys as dojoGetEntityIdFromKeys } from "@dojoengine/utils";

const ENTITY_ID_CACHE_LIMIT = 100_000;
const entityIdCache = new Map<string, ReturnType<typeof dojoGetEntityIdFromKeys>>();

/**
 * Memoized drop-in for @dojoengine/utils' getEntityIdFromKeys. The poseidon
 * hash behind it is pure and deterministic, and recomputing it dominated live
 * main-thread profiles (~25% of scripting time). Every consumer imports THIS
 * one — a source test forbids the un-memoized dojo import outside this file.
 */
export const getEntityIdFromKeys = (keys: bigint[]): ReturnType<typeof dojoGetEntityIdFromKeys> => {
  const cacheKey = keys.join(",");
  const cached = entityIdCache.get(cacheKey);
  if (cached !== undefined) return cached;
  if (entityIdCache.size >= ENTITY_ID_CACHE_LIMIT) entityIdCache.clear();
  const entityId = dojoGetEntityIdFromKeys(keys);
  entityIdCache.set(cacheKey, entityId);
  return entityId;
};

// This module must stay a LEAF (no core-internal imports, no module-scope
// property access): the client's game-scope re-exports these helpers via a
// relative path so importing them never evaluates the core package barrel —
// module-scope tables there (e.g. utils' ResourceIdToMiningType) break every
// test that partially mocks a shared package.
//
// The active game id is mirrored here from ClientConfigManager.setActiveGame,
// the single writer of the active game.
let activeKeyGameId = 0;

export const setGameEntityKeyGameId = (gameId: number) => {
  activeKeyGameId = gameId;
};

/**
 * RECS entity key for a per-game model. On the s2 single world every per-game
 * model leads with `game_id` as key[0], so lookups must hash it in or they
 * miss every entity; legacy worlds hash the bare keys. Never use this for
 * chain-global models (AddressName, preset tables, ChainConfig, ...).
 */
export const gameEntityKey = (keys: (bigint | string)[]) => {
  return getEntityIdFromKeys(
    activeKeyGameId > 0 ? [BigInt(activeKeyGameId), ...keys.map((key) => BigInt(key))] : keys.map((key) => BigInt(key)),
  );
};

/**
 * Building is keyed (game_id, alt, outer, outer, inner, inner) on s2 and
 * (outer, outer, inner, inner) on legacy worlds. Structures never sit on the
 * alt plane (Cairo `StructureBase.coord()` pins alt to false), so alt is 0.
 */
export const buildingEntityKey = (outerCol: number, outerRow: number, innerCol: number, innerRow: number) => {
  const coords = [BigInt(outerCol), BigInt(outerRow), BigInt(innerCol), BigInt(innerRow)];
  return getEntityIdFromKeys(activeKeyGameId > 0 ? [BigInt(activeKeyGameId), 0n, ...coords] : coords);
};

/** WorldConfig row key: [gameId] on s2, [WORLD_CONFIG_ID] on legacy worlds. */
export const worldConfigKey = () => {
  return getEntityIdFromKeys([activeKeyGameId > 0 ? BigInt(activeKeyGameId) : WORLD_CONFIG_ID]);
};
