interface WorldChunkConfig {
  /** Stride in hexes for world chunk keys */
  stride: number;
  /** Render window size (hexes) centered on a stride chunk */
  renderSize: { width: number; height: number };
  /** Pin radius in stride chunks (2 => 5x5 neighborhood) */
  pinRadius: number;
  /** Boundary padding for delaying chunk switches */
  switchPadding: number;
  /** Local projection-to-terrain sync coalescing */
  projectionSync: {
    /** Number of stride chunks per side in a projection sync area. */
    superAreaStrides: number;
  };
  /** Directional prefetch tuning */
  prefetch: {
    /** How many stride steps ahead to prefetch (inclusive) */
    forwardDepthStrides: number;
    /** How many stride steps to each side to prefetch */
    sideRadiusStrides: number;
    /** How close to a projection sync area edge before warming the next area */
    areaBoundaryLookaheadStrides: number;
    /** Max remembered prefetched chunk keys */
    maxAhead: number;
    /** Max concurrent background prefetches */
    maxConcurrent: number;
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
    /** How long visual pages outside the active window remain available */
    retainedPageMs: number;
    /** Camera sampling throttle for rolling terrain updates */
    cameraSampleThrottleMs: number;
    /** Whether cold target chunks may show local provisional terrain before exact preparation */
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
  projectionSync: {
    // Coalesce overlapping render windows into larger stable projection areas.
    superAreaStrides: 16,
  },
  prefetch: {
    forwardDepthStrides: 2,
    sideRadiusStrides: 1,
    areaBoundaryLookaheadStrides: 3,
    maxAhead: 6,
    maxConcurrent: 1,
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
    retainedPageMs: 350,
    cameraSampleThrottleMs: 66,
    provisionalShellEnabled: true,
    previousExactRetainMs: 250,
  },
};
