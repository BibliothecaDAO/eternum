interface WorldChunkConfig {
  /** Stride in hexes for world chunk keys */
  stride: number;
  /** Render window size (hexes) centered on a stride chunk */
  renderSize: { width: number; height: number };
  /** Pin radius in stride chunks (2 => 5x5 neighborhood) */
  pinRadius: number;
  /** Boundary padding for delaying chunk switches */
  switchPadding: number;
  /** Exact Torii SQL fetch coalescing */
  toriiFetch: {
    /**
     * Number of stride chunks per side in a hydration "super-area".
     * Larger values reduce repeated SQL hydration across neighboring render windows.
     */
    superAreaStrides: number;
  };
  /** Live Torii subscription bounds coalescing */
  toriiSubscription: {
    /**
     * Number of stride chunks per side in a subscription "super-area".
     * This can be larger than hydration fetch areas to reduce live stream churn.
     */
    superAreaStrides: number;
  };
  /** Directional prefetch tuning */
  prefetch: {
    /** How many stride steps ahead to prefetch (inclusive) */
    forwardDepthStrides: number;
    /** How many stride steps to each side to prefetch */
    sideRadiusStrides: number;
    /** How close to a hydration super-area edge before warming the next area */
    areaBoundaryLookaheadStrides: number;
    /** Max remembered prefetched chunk keys */
    maxAhead: number;
    /** Max concurrent background prefetches */
    maxConcurrent: number;
  };
  /** Recently hydrated areas to keep warm after leaving the pinned neighborhood */
  recentHydrationCache: {
    maxAreas: number;
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
    width: 48,
    height: 48,
  },
  pinRadius: 2, // 5x5 pinned neighborhood
  switchPadding: 0.05,
  toriiFetch: {
    // Coalesce overlapping render windows into larger stable fetch areas.
    superAreaStrides: 16,
  },
  toriiSubscription: {
    // Keep live spatial stream bounds stable across multiple fetch areas.
    superAreaStrides: 48,
  },
  prefetch: {
    forwardDepthStrides: 2,
    sideRadiusStrides: 1,
    areaBoundaryLookaheadStrides: 3,
    maxAhead: 8,
    maxConcurrent: 1,
  },
  recentHydrationCache: {
    maxAreas: 48,
  },
};
