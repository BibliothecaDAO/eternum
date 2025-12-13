export interface WorldChunkConfig {
  /** Stride in hexes for world chunk keys */
  stride: number;
  /** Render window size (hexes) centered on a stride chunk */
  renderSize: { width: number; height: number };
  /** Pin radius in stride chunks (2 => 5x5 neighborhood) */
  pinRadius: number;
  /** Boundary padding for delaying chunk switches */
  switchPadding: number;
  /** Torii tile fetch coalescing */
  toriiFetch: {
    /**
     * Number of stride chunks per side in a Torii "super-area".
     * A value of 4 means one fetch covers a 4x4 stride-chunk block.
     */
    superAreaStrides: number;
  };
  /** Directional prefetch tuning */
  prefetch: {
    /** How many stride steps ahead to prefetch (inclusive) */
    forwardDepthStrides: number;
    /** How many stride steps to each side to prefetch */
    sideRadiusStrides: number;
    /** Max remembered prefetched chunk keys */
    maxAhead: number;
    /** Max concurrent background prefetches */
    maxConcurrent: number;
  };
}

/**
 * World map chunking configuration.
 *
 * Keep these values in sync across fetch/visibility/render managers.
 */
export const WORLD_CHUNK_CONFIG: WorldChunkConfig = {
  stride: 24,
  renderSize: {
    width: 64,
    height: 64,
  },
  pinRadius: 2, // 5x5 pinned neighborhood
  switchPadding: 0.05,
  toriiFetch: {
    // Coalesce overlapping 64x64 render windows into larger stable fetch areas.
    superAreaStrides: 4,
  },
  prefetch: {
    forwardDepthStrides: 2,
    sideRadiusStrides: 1,
    maxAhead: 8,
    maxConcurrent: 3,
  },
};
