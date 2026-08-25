/**
 * Phase 5.1: process-wide cache of parsed biome GLTFs keyed by asset path.
 *
 * Both the world map and the hexception scene load the full biome model set at
 * bootstrap and keep it resident for the whole session. Without a cache each GLB
 * was fetched, parsed, and uploaded to the GPU twice. Caching the parsed result
 * lets both scenes' InstancedBiome wrappers reference one shared set of
 * geometries/materials/textures (only the per-scene InstancedMesh instance buffers
 * and morph textures differ), roughly halving the largest fixed asset cost.
 *
 * Mirrors the dedup pattern in cosmetics/asset-cache.ts.
 */

const cache = new Map<string, Promise<unknown>>();

/**
 * Load a biome GLTF for `path`, parsing it at most once. Concurrent and later
 * callers share the same promise/result. A failed load is evicted so a subsequent
 * call can retry.
 */
export function loadBiomeGltf<T>(path: string, load: (path: string) => Promise<T>): Promise<T> {
  const existing = cache.get(path) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  const promise = load(path).catch((error) => {
    cache.delete(path);
    throw error;
  });
  cache.set(path, promise);
  return promise;
}

/** Clear all cached biome GLTFs (call at full renderer teardown / in tests). */
export function clearBiomeGltfCache(): void {
  cache.clear();
}

/** Number of cached (in-flight or settled) biome paths. */
export function getBiomeGltfCacheSize(): number {
  return cache.size;
}
