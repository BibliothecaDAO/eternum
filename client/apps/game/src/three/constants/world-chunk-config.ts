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
    /**
     * Sparse explorer troop snapshots can safely use the larger live subscription
     * area without multiplying dense terrain hydration payloads.
     */
    explorerTroopsSuperAreaStrides: number;
    /**
     * Structures are sparse enough to hydrate over the larger live subscription
     * area while keeping dense terrain hydration on the smaller fetch area.
     */
    structuresSuperAreaStrides: number;
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
  /** Visual terrain presentation tuning */
  visualPresentation: {
    /** Max chunk-sized terrain presentations composed into the visible biome meshes */
    maxCompositeChunks: number;
    /** Whether camera panning keeps a rolling visual terrain page window warm */
    rollingWindowEnabled: boolean;
    /** Visual-only terrain page size, independent from authoritative chunk topology */
    visualPageSize: { width: number; height: number };
    /** Number of visual pages retained around the current camera render window */
    viewportMarginPages: number;
    /** Max visual pages composed into biome meshes */
    maxCompositePages: number;
    /** Missing critical pages to build synchronously per camera window update */
    criticalPageImmediateBudget: number;
    /** Target frame budget for non-critical visual page builds */
    pageBuildFrameBudgetMs: number;
    /** How long visual pages outside the active window remain available */
    retainedPageMs: number;
    /** Camera sampling throttle for rolling terrain updates */
    cameraSampleThrottleMs: number;
    /** Whether cold target chunks may show local provisional terrain before exact hydration */
    provisionalShellEnabled: boolean;
    /** How long to retain the previous exact presentation after exact target commit */
    previousExactRetainMs: number;
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
    // Match the live subscription area to reduce sparse army snapshot churn.
    explorerTroopsSuperAreaStrides: 48,
    // Match the live subscription area to reduce sparse structure snapshot churn.
    structuresSuperAreaStrides: 48,
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
  visualPresentation: {
    maxCompositeChunks: 3,
    rollingWindowEnabled: true,
    visualPageSize: {
      width: 24,
      height: 24,
    },
    viewportMarginPages: 1,
    maxCompositePages: 16,
    criticalPageImmediateBudget: 1,
    pageBuildFrameBudgetMs: 4,
    retainedPageMs: 500,
    cameraSampleThrottleMs: 33,
    provisionalShellEnabled: true,
    previousExactRetainMs: 250,
  },
};
