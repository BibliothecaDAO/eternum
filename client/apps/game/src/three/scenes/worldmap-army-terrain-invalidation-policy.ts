interface ArmyTileUpdateTerrainInvalidationInput {
  /**
   * True when the army tile update wrote a provisional biome into an unexplored
   * spawn hex (i.e. it actually mutated terrain). Army movement alone does not
   * set this.
   */
  wroteProvisionalBiome: boolean;
}

/**
 * Decide whether an army tile update should invalidate cached terrain.
 *
 * The terrain matrix cache is derived from biome tiles and structures only
 * (see `cacheMatricesForChunk` / `getTerrainFingerprintForChunk`); it does not
 * depend on army positions. Invalidating cached chunks every time an army moved
 * destroyed up to ~8 overlapping cached chunks per move. The only terrain-
 * relevant side effect of an army tile update is the provisional-biome write
 * that reveals an unexplored spawn hex, so invalidation is gated to that.
 */
export function shouldInvalidateTerrainForArmyTileUpdate(input: ArmyTileUpdateTerrainInvalidationInput): boolean {
  return input.wroteProvisionalBiome;
}
