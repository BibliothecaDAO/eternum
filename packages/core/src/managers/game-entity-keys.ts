import { hash } from "starknet";

const ENTITY_ID_CACHE_LIMIT = 100_000;
const entityIdCache = new Map<string, string>();

/** Memoized entity identity: repeated hashing dominated map update profiles. */
export const getEntityIdFromKeys = (keys: bigint[]): string => {
  const cacheKey = keys.join(",");
  const cached = entityIdCache.get(cacheKey);
  if (cached !== undefined) return cached;
  if (entityIdCache.size >= ENTITY_ID_CACHE_LIMIT) entityIdCache.clear();
  const entityId = hash.computePoseidonHashOnElements(keys);
  entityIdCache.set(cacheKey, entityId);
  return entityId;
};
