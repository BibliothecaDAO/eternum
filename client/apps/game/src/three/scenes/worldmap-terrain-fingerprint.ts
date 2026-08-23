interface TerrainFingerprintEntry {
  hexKey: string;
  biomeKey: string;
  occupied?: boolean;
}

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * 32-bit FNV-1a hash of a string, returned as an unsigned int.
 */
function fnv1a(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * Order-independent, bounded-length digest of a terrain window's (hex, biome)
 * pairs. Used to detect whether a cached chunk's terrain still matches the
 * authoritative state on the cache-hit fast path.
 *
 * Earlier implementations sorted and joined every entry into one ~60KB string
 * per cached chunk and rebuilt + compared it on every cache hit during panning.
 * This digest folds each entry's FNV-1a hash into commutative accumulators
 * (sum + xor) alongside the entry count, so it is:
 * - order-independent (sum/xor/count do not depend on iteration order),
 * - sensitive to any (hexKey, biomeKey) change, to per-hex biome swaps, and to
 *   added/removed cells (count guards equal-multiset edge cases),
 * - constant size (~<=24 chars) regardless of window size, so storing and
 *   comparing it is O(1).
 */
export function createWorldmapTerrainFingerprint(entries: Iterable<TerrainFingerprintEntry>): string {
  let count = 0;
  let sum = 0;
  let xor = 0;

  for (const entry of entries) {
    const entryHash = fnv1a(`${entry.hexKey}:${entry.biomeKey}:${entry.occupied ? 1 : 0}`);
    count += 1;
    sum = (sum + entryHash) >>> 0;
    xor = (xor ^ entryHash) >>> 0;
  }

  // Preserve the prior empty-window sentinel: `shouldRejectCachedTerrainFingerprintMismatch`
  // treats an empty fingerprint as "cannot compare, do not reject", and other guards
  // (generation/coverage) own the empty-terrain case.
  if (count === 0) {
    return "";
  }

  return `${count.toString(36)}_${sum.toString(36)}_${xor.toString(36)}`;
}
