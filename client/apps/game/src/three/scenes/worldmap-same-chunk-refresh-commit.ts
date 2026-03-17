export interface SameChunkRefreshCommitInput {
  refreshToken: number;
  currentRefreshToken: number;
  currentChunk: string;
  targetChunk: string;
  preparedTerrain: unknown;
}

export interface SameChunkRefreshCommitDecision {
  shouldCommit: boolean;
  shouldDropAsStale: boolean;
}

/**
 * Determine whether a same-chunk refresh should commit its prepared terrain.
 * Prevents stale refresh work from mutating visible terrain.
 *
 * The commit is rejected (dropped as stale) when:
 * - refreshToken !== currentRefreshToken (a newer refresh superseded this one)
 * - currentChunk !== targetChunk (chunk changed while refresh was in flight)
 * - preparedTerrain is null/undefined
 */
export function resolveSameChunkRefreshCommit(input: SameChunkRefreshCommitInput): SameChunkRefreshCommitDecision {
  if (input.refreshToken !== input.currentRefreshToken) {
    return { shouldCommit: false, shouldDropAsStale: true };
  }

  if (input.currentChunk !== input.targetChunk) {
    return { shouldCommit: false, shouldDropAsStale: true };
  }

  if (input.preparedTerrain == null) {
    return { shouldCommit: false, shouldDropAsStale: true };
  }

  return { shouldCommit: true, shouldDropAsStale: false };
}
