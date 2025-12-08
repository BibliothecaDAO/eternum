/**
 * Data Fetch Coordinator
 *
 * Coordinates all data fetching from Torii with batching, deduplication,
 * and prioritization. Acts as the single point of contact for chunk data
 * retrieval.
 */

import { ID, HexPosition } from "@bibliothecadao/types";
import {
  ChunkBounds,
  ChunkData,
  ChunkPriority,
  TileData,
  StructureData,
  ArmyData,
  QuestData,
  ChestData,
} from "./types";

/**
 * Pending fetch request.
 */
interface PendingFetch {
  chunkKey: string;
  bounds: ChunkBounds;
  priority: ChunkPriority;
  resolve: (data: ChunkData) => void;
  reject: (error: Error) => void;
  startTime: number;
}

/**
 * Configuration for the DataFetchCoordinator.
 */
export interface DataFetchCoordinatorConfig {
  /** Batch delay in milliseconds */
  batchDelayMs: number;

  /** Maximum batch size */
  maxBatchSize: number;

  /** Fetch timeout in milliseconds */
  fetchTimeoutMs: number;

  /** Enable debug logging */
  debug: boolean;
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: DataFetchCoordinatorConfig = {
  batchDelayMs: 16, // One frame
  maxBatchSize: 5,
  fetchTimeoutMs: 10000,
  debug: false,
};

/**
 * Torii client interface (subset of actual client).
 * This allows the coordinator to work with any Torii-like client.
 */
export interface ToriiClientLike {
  // We'll integrate with the actual Torii client methods
  // For now, this is a placeholder interface
}

/**
 * Fetch function type that the coordinator will use.
 * This allows injection of the actual Torii fetch functions.
 */
export type ChunkFetchFunction = (
  bounds: ChunkBounds,
  structurePositions: Map<ID, HexPosition>,
) => Promise<{
  tiles?: TileData[];
  structures?: StructureData[];
  armies?: ArmyData[];
  quests?: QuestData[];
  chests?: ChestData[];
}>;

/**
 * Data Fetch Coordinator
 *
 * Manages all data fetching for chunks with:
 * - Request deduplication (same chunk won't be fetched twice)
 * - Priority-based ordering
 * - Batching of concurrent requests
 * - Timeout handling
 *
 * @example
 * ```typescript
 * const coordinator = new DataFetchCoordinator({
 *   fetchFunction: async (bounds) => {
 *     // Call actual Torii functions
 *     return { tiles: [], structures: [], armies: [] };
 *   },
 * });
 *
 * // Fetch chunk data
 * const data = await coordinator.fetchChunk("0,0", bounds, ChunkPriority.CRITICAL);
 * ```
 */
export class DataFetchCoordinator {
  /** Pending fetch requests */
  private pendingFetches: Map<string, PendingFetch> = new Map();

  /** In-flight fetch promises (for deduplication) */
  private inFlightFetches: Map<string, Promise<ChunkData>> = new Map();

  /** Batch processing timeout */
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Configuration */
  private config: DataFetchCoordinatorConfig;

  /** The actual fetch function to call */
  private fetchFunction: ChunkFetchFunction | null = null;

  /** Known structure positions (injected from worldmap) */
  private structurePositions: Map<ID, HexPosition> = new Map();

  /** Fetch statistics */
  private stats = {
    totalFetches: 0,
    batchedFetches: 0,
    deduplicatedFetches: 0,
    failedFetches: 0,
    totalFetchTime: 0,
  };

  constructor(config: Partial<DataFetchCoordinatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Set the fetch function to use.
   *
   * @param fn - Function that performs the actual Torii fetch
   */
  setFetchFunction(fn: ChunkFetchFunction): void {
    this.fetchFunction = fn;
  }

  /**
   * Update known structure positions.
   * Called by WorldmapScene when structure positions change.
   *
   * @param positions - Map of entity ID to position
   */
  setStructurePositions(positions: Map<ID, HexPosition>): void {
    this.structurePositions = positions;
  }

  // ===========================================================================
  // Fetch Operations
  // ===========================================================================

  /**
   * Fetch data for a chunk.
   *
   * Returns a promise that resolves when the chunk data is available.
   * Requests are deduplicated - if a fetch for the same chunk is already
   * in progress, the same promise is returned.
   *
   * @param chunkKey - Chunk identifier
   * @param bounds - Geographic bounds
   * @param priority - Fetch priority
   * @returns Promise resolving to chunk data
   */
  async fetchChunk(
    chunkKey: string,
    bounds: ChunkBounds,
    priority: ChunkPriority = ChunkPriority.NORMAL,
  ): Promise<ChunkData> {
    // Check for in-flight fetch (deduplication)
    const inFlight = this.inFlightFetches.get(chunkKey);
    if (inFlight) {
      this.stats.deduplicatedFetches++;
      if (this.config.debug) {
        console.log(`[DataFetchCoordinator] Deduplicating fetch for ${chunkKey}`);
      }
      return inFlight;
    }

    // Create fetch promise
    const fetchPromise = new Promise<ChunkData>((resolve, reject) => {
      const pendingFetch: PendingFetch = {
        chunkKey,
        bounds,
        priority,
        resolve,
        reject,
        startTime: Date.now(),
      };

      // Add to pending
      this.pendingFetches.set(chunkKey, pendingFetch);

      // Schedule batch processing
      this.scheduleBatch();
    });

    // Track in-flight
    this.inFlightFetches.set(chunkKey, fetchPromise);

    // Clean up when done
    fetchPromise.finally(() => {
      this.inFlightFetches.delete(chunkKey);
    });

    return fetchPromise;
  }

  /**
   * Prefetch a chunk with low priority.
   *
   * Fire-and-forget prefetch that won't block on completion.
   *
   * @param chunkKey - Chunk identifier
   * @param bounds - Geographic bounds
   */
  prefetch(chunkKey: string, bounds: ChunkBounds): void {
    // Don't prefetch if already fetched or in-flight
    if (this.inFlightFetches.has(chunkKey)) {
      return;
    }

    // Start low-priority fetch but don't wait for it
    this.fetchChunk(chunkKey, bounds, ChunkPriority.LOW).catch((error) => {
      if (this.config.debug) {
        console.warn(`[DataFetchCoordinator] Prefetch failed for ${chunkKey}:`, error);
      }
    });
  }

  /**
   * Cancel a pending fetch.
   *
   * @param chunkKey - Chunk to cancel
   */
  cancelFetch(chunkKey: string): void {
    const pending = this.pendingFetches.get(chunkKey);
    if (pending) {
      pending.reject(new Error(`Fetch cancelled for ${chunkKey}`));
      this.pendingFetches.delete(chunkKey);
    }
  }

  /**
   * Cancel all pending fetches.
   */
  cancelAll(): void {
    for (const [chunkKey, pending] of this.pendingFetches) {
      pending.reject(new Error(`Fetch cancelled for ${chunkKey}`));
    }
    this.pendingFetches.clear();

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  // ===========================================================================
  // Batch Processing
  // ===========================================================================

  /**
   * Schedule batch processing.
   */
  private scheduleBatch(): void {
    if (this.batchTimeout) return;

    this.batchTimeout = setTimeout(() => {
      this.batchTimeout = null;
      this.processBatch();
    }, this.config.batchDelayMs);
  }

  /**
   * Process a batch of pending fetches.
   */
  private async processBatch(): Promise<void> {
    if (this.pendingFetches.size === 0) return;

    // Sort by priority and take up to maxBatchSize
    const sorted = Array.from(this.pendingFetches.values()).sort((a, b) => a.priority - b.priority);
    const batch = sorted.slice(0, this.config.maxBatchSize);

    if (this.config.debug) {
      console.log(
        `[DataFetchCoordinator] Processing batch of ${batch.length} fetches`,
        batch.map((f) => f.chunkKey),
      );
    }

    // Process each fetch in the batch
    const fetchPromises = batch.map((fetch) => this.executeFetch(fetch));

    // Wait for all to complete
    await Promise.allSettled(fetchPromises);

    // Schedule next batch if there are more pending
    if (this.pendingFetches.size > 0) {
      this.scheduleBatch();
    }
  }

  /**
   * Execute a single fetch.
   */
  private async executeFetch(fetch: PendingFetch): Promise<void> {
    // Remove from pending
    this.pendingFetches.delete(fetch.chunkKey);

    try {
      this.stats.totalFetches++;

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Fetch timeout for ${fetch.chunkKey}`));
        }, this.config.fetchTimeoutMs);
      });

      // Execute fetch with timeout
      const dataPromise = this.doFetch(fetch.chunkKey, fetch.bounds);
      const data = await Promise.race([dataPromise, timeoutPromise]);

      // Track timing
      const duration = Date.now() - fetch.startTime;
      this.stats.totalFetchTime += duration;

      if (this.config.debug) {
        console.log(`[DataFetchCoordinator] Fetched ${fetch.chunkKey} in ${duration}ms`);
      }

      fetch.resolve(data);
    } catch (error) {
      this.stats.failedFetches++;

      if (this.config.debug) {
        console.error(`[DataFetchCoordinator] Fetch failed for ${fetch.chunkKey}:`, error);
      }

      fetch.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Perform the actual data fetch.
   */
  private async doFetch(chunkKey: string, bounds: ChunkBounds): Promise<ChunkData> {
    const startTime = Date.now();

    // If no fetch function is set, return empty data
    if (!this.fetchFunction) {
      console.warn("[DataFetchCoordinator] No fetch function set, returning empty data");
      return {
        chunkKey,
        bounds,
        fetchTime: Date.now() - startTime,
        tiles: [],
        structures: [],
        armies: [],
        quests: [],
        chests: [],
      };
    }

    // Get structure positions within bounds
    const structuresInBounds = new Map<ID, HexPosition>();
    for (const [entityId, pos] of this.structurePositions) {
      if (pos.col >= bounds.minCol && pos.col < bounds.maxCol && pos.row >= bounds.minRow && pos.row < bounds.maxRow) {
        structuresInBounds.set(entityId, pos);
      }
    }

    // Execute fetch
    const result = await this.fetchFunction(bounds, structuresInBounds);

    return {
      chunkKey,
      bounds,
      fetchTime: Date.now() - startTime,
      tiles: result.tiles ?? [],
      structures: result.structures ?? [],
      armies: result.armies ?? [],
      quests: result.quests ?? [],
      chests: result.chests ?? [],
    };
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get fetch statistics.
   */
  getStats(): {
    totalFetches: number;
    batchedFetches: number;
    deduplicatedFetches: number;
    failedFetches: number;
    averageFetchTime: number;
    pendingCount: number;
    inFlightCount: number;
  } {
    return {
      ...this.stats,
      averageFetchTime: this.stats.totalFetches > 0 ? this.stats.totalFetchTime / this.stats.totalFetches : 0,
      pendingCount: this.pendingFetches.size,
      inFlightCount: this.inFlightFetches.size,
    };
  }

  /**
   * Reset statistics.
   */
  resetStats(): void {
    this.stats = {
      totalFetches: 0,
      batchedFetches: 0,
      deduplicatedFetches: 0,
      failedFetches: 0,
      totalFetchTime: 0,
    };
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Clear all state.
   */
  clear(): void {
    this.cancelAll();
    this.inFlightFetches.clear();
  }

  /**
   * Destroy the coordinator.
   */
  destroy(): void {
    this.clear();
    this.fetchFunction = null;
    this.structurePositions.clear();
  }
}

/**
 * Create a new DataFetchCoordinator with default configuration.
 */
export function createDataFetchCoordinator(config: Partial<DataFetchCoordinatorConfig> = {}): DataFetchCoordinator {
  return new DataFetchCoordinator(config);
}
