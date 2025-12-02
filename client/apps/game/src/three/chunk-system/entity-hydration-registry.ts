/**
 * Entity Hydration Registry
 *
 * Tracks when entities are expected vs when they actually arrive via
 * WorldUpdateListener callbacks. This is the key mechanism that allows
 * the chunk system to know when a chunk is fully loaded and ready to render.
 *
 * The registry provides Promise-based waiting, so chunk loading can await
 * hydration completion before proceeding to render.
 */

import { ID } from "@bibliothecadao/types";
import {
  EntityType,
  HydrationExpectation,
  HydrationProgress,
  HydrationResult,
  EntityTypeProgress,
  createEmptyHydrationProgress,
} from "./types";

/**
 * Internal state for a chunk's hydration tracking.
 */
interface ChunkHydrationState {
  /** Chunk identifier */
  chunkKey: string;

  /** Expected entities by type */
  expectations: Map<EntityType, HydrationExpectation>;

  /** Hydrated entity IDs by type */
  hydrated: Map<EntityType, Set<ID>>;

  /** When tracking started */
  startTime: number;

  /** Promise resolve function (if waiting) */
  resolve?: (result: HydrationResult) => void;

  /** Timeout handle for cleanup */
  timeoutHandle?: ReturnType<typeof setTimeout>;

  /** Whether this chunk's hydration is complete */
  isComplete: boolean;
}

/**
 * Callback type for progress updates.
 */
export type HydrationProgressCallback = (chunkKey: string, progress: HydrationProgress) => void;

/**
 * Entity Hydration Registry
 *
 * Tracks entity hydration to determine when chunks are fully loaded.
 *
 * Usage flow:
 * 1. Before fetching data, call `expectEntities()` to register expectations
 * 2. As WorldUpdateListener callbacks fire, managers call `notifyEntityHydrated()`
 * 3. Use `waitForHydration()` to get a Promise that resolves when complete
 *
 * @example
 * ```typescript
 * const registry = new EntityHydrationRegistry();
 *
 * // Register expectations
 * registry.expectEntities("0,0", EntityType.Structure, 5);
 * registry.expectEntities("0,0", EntityType.Army, 3);
 *
 * // Start waiting (in parallel with data fetch)
 * const hydrationPromise = registry.waitForHydration("0,0", 5000);
 *
 * // As data arrives, managers notify
 * registry.notifyEntityHydrated(123, EntityType.Structure);
 * registry.notifyEntityHydrated(124, EntityType.Structure);
 * // ... etc
 *
 * // Wait completes when all expected entities are hydrated
 * const result = await hydrationPromise;
 * ```
 */
export class EntityHydrationRegistry {
  /** Hydration state per chunk */
  private chunks: Map<string, ChunkHydrationState> = new Map();

  /** Reverse lookup: entity ID -> chunk key */
  private entityToChunk: Map<ID, string> = new Map();

  /** Progress callback subscribers */
  private progressCallbacks: Set<HydrationProgressCallback> = new Set();

  /** Default timeout for hydration waits */
  private defaultTimeoutMs: number;

  /** Enable debug logging */
  private debug: boolean;

  constructor(options: { defaultTimeoutMs?: number; debug?: boolean } = {}) {
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 5000;
    this.debug = options.debug ?? false;
  }

  // ===========================================================================
  // Expectation Registration
  // ===========================================================================

  /**
   * Register expected entities for a chunk.
   *
   * Call this before fetching data to set up expectations.
   * Can be called multiple times for different entity types.
   *
   * @param chunkKey - Chunk identifier
   * @param entityType - Type of entities expected
   * @param count - Number of entities expected
   */
  expectEntities(chunkKey: string, entityType: EntityType, count: number): void {
    if (count <= 0) return;

    const state = this.getOrCreateState(chunkKey);

    const expectation: HydrationExpectation = {
      chunkKey,
      entityType,
      count,
      registeredAt: Date.now(),
    };

    state.expectations.set(entityType, expectation);

    // Ensure hydrated set exists for this type
    if (!state.hydrated.has(entityType)) {
      state.hydrated.set(entityType, new Set());
    }

    if (this.debug) {
      console.log(`[HydrationRegistry] Expecting ${count} ${entityType} for chunk ${chunkKey}`);
    }
  }

  /**
   * Register a specific entity as expected.
   *
   * Use this when you know the exact entity IDs that will arrive.
   *
   * @param chunkKey - Chunk identifier
   * @param entityId - Specific entity ID expected
   * @param entityType - Type of entity
   */
  expectEntity(chunkKey: string, entityId: ID, entityType: EntityType): void {
    const state = this.getOrCreateState(chunkKey);

    // Get or create expectation
    let expectation = state.expectations.get(entityType);
    if (!expectation) {
      expectation = {
        chunkKey,
        entityType,
        count: 0,
        entityIds: new Set(),
        registeredAt: Date.now(),
      };
      state.expectations.set(entityType, expectation);
    }

    // Initialize entity IDs set if needed
    if (!expectation.entityIds) {
      expectation.entityIds = new Set();
    }

    // Add specific entity
    expectation.entityIds.add(entityId);
    expectation.count = expectation.entityIds.size;

    // Track entity -> chunk mapping
    this.entityToChunk.set(entityId, chunkKey);

    // Ensure hydrated set exists
    if (!state.hydrated.has(entityType)) {
      state.hydrated.set(entityType, new Set());
    }
  }

  /**
   * Clear all expectations for a chunk.
   *
   * Call this when a chunk is being unloaded or reset.
   *
   * @param chunkKey - Chunk to clear
   */
  clearExpectations(chunkKey: string): void {
    const state = this.chunks.get(chunkKey);
    if (!state) return;

    // Clean up timeout
    if (state.timeoutHandle) {
      clearTimeout(state.timeoutHandle);
    }

    // Resolve any pending wait with failure
    if (state.resolve) {
      state.resolve({
        success: false,
        timedOut: false,
        progress: this.getProgress(chunkKey),
        duration: Date.now() - state.startTime,
        chunkKey,
      });
    }

    // Remove entity -> chunk mappings
    for (const expectation of state.expectations.values()) {
      if (expectation.entityIds) {
        for (const entityId of expectation.entityIds) {
          this.entityToChunk.delete(entityId);
        }
      }
    }

    // Remove chunk state
    this.chunks.delete(chunkKey);

    if (this.debug) {
      console.log(`[HydrationRegistry] Cleared expectations for chunk ${chunkKey}`);
    }
  }

  // ===========================================================================
  // Hydration Notification
  // ===========================================================================

  /**
   * Notify that an entity has been hydrated.
   *
   * Managers should call this when they receive entity data via
   * WorldUpdateListener callbacks.
   *
   * @param entityId - Entity that was hydrated
   * @param entityType - Type of the entity
   * @param chunkKey - Optional chunk key (will be looked up if not provided)
   */
  notifyEntityHydrated(entityId: ID, entityType: EntityType, chunkKey?: string): void {
    // Determine chunk key
    const resolvedChunkKey = chunkKey ?? this.entityToChunk.get(entityId);

    if (!resolvedChunkKey) {
      // Entity wasn't expected, might be a live update outside chunk loading
      if (this.debug) {
        console.log(`[HydrationRegistry] Received unexpected entity ${entityId} (${entityType})`);
      }
      return;
    }

    const state = this.chunks.get(resolvedChunkKey);
    if (!state) {
      if (this.debug) {
        console.log(`[HydrationRegistry] No state for chunk ${resolvedChunkKey}`);
      }
      return;
    }

    // Add to hydrated set
    let hydratedSet = state.hydrated.get(entityType);
    if (!hydratedSet) {
      hydratedSet = new Set();
      state.hydrated.set(entityType, hydratedSet);
    }
    hydratedSet.add(entityId);

    // Track entity -> chunk mapping
    this.entityToChunk.set(entityId, resolvedChunkKey);

    if (this.debug) {
      const progress = this.getProgress(resolvedChunkKey);
      console.log(
        `[HydrationRegistry] Entity ${entityId} (${entityType}) hydrated for ${resolvedChunkKey}. ` +
          `Progress: ${progress.hydrated}/${progress.total} (${progress.percentage.toFixed(0)}%)`,
      );
    }

    // Notify progress subscribers
    this.emitProgress(resolvedChunkKey);

    // Check if hydration is complete
    this.checkCompletion(resolvedChunkKey);
  }

  /**
   * Notify that an entity has been removed.
   *
   * @param entityId - Entity that was removed
   */
  notifyEntityRemoved(entityId: ID): void {
    const chunkKey = this.entityToChunk.get(entityId);
    if (!chunkKey) return;

    const state = this.chunks.get(chunkKey);
    if (!state) return;

    // Remove from hydrated sets
    for (const hydratedSet of state.hydrated.values()) {
      hydratedSet.delete(entityId);
    }

    // Remove mapping
    this.entityToChunk.delete(entityId);

    if (this.debug) {
      console.log(`[HydrationRegistry] Entity ${entityId} removed from ${chunkKey}`);
    }
  }

  // ===========================================================================
  // Waiting
  // ===========================================================================

  /**
   * Wait for a chunk's hydration to complete.
   *
   * Returns a Promise that resolves when all expected entities have been
   * hydrated, or when the timeout expires.
   *
   * @param chunkKey - Chunk to wait for
   * @param timeoutMs - Timeout in milliseconds (default: 5000)
   * @returns Promise that resolves with hydration result
   */
  waitForHydration(chunkKey: string, timeoutMs?: number): Promise<HydrationResult> {
    const timeout = timeoutMs ?? this.defaultTimeoutMs;
    const state = this.chunks.get(chunkKey);

    // No state means no expectations - consider it complete
    if (!state) {
      return Promise.resolve({
        success: true,
        timedOut: false,
        progress: createEmptyHydrationProgress(),
        duration: 0,
        chunkKey,
      });
    }

    // Already complete?
    if (this.isFullyHydrated(chunkKey)) {
      return Promise.resolve({
        success: true,
        timedOut: false,
        progress: this.getProgress(chunkKey),
        duration: Date.now() - state.startTime,
        chunkKey,
      });
    }

    // Create promise for waiting
    return new Promise((resolve) => {
      state.resolve = resolve;

      // Set up timeout
      state.timeoutHandle = setTimeout(() => {
        const progress = this.getProgress(chunkKey);
        const duration = Date.now() - state.startTime;

        if (this.debug) {
          console.warn(
            `[HydrationRegistry] Chunk ${chunkKey} hydration timed out after ${timeout}ms. ` +
              `Progress: ${progress.hydrated}/${progress.total}`,
          );
        }

        resolve({
          success: false,
          timedOut: true,
          progress,
          duration,
          chunkKey,
        });

        // Clean up
        state.resolve = undefined;
        state.timeoutHandle = undefined;
      }, timeout);
    });
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Check if a chunk is fully hydrated.
   *
   * @param chunkKey - Chunk to check
   */
  isFullyHydrated(chunkKey: string): boolean {
    const state = this.chunks.get(chunkKey);
    if (!state) return true; // No expectations = complete

    for (const [entityType, expectation] of state.expectations) {
      const hydratedSet = state.hydrated.get(entityType);
      const hydratedCount = hydratedSet?.size ?? 0;

      if (hydratedCount < expectation.count) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get hydration progress for a chunk.
   *
   * @param chunkKey - Chunk to query
   */
  getProgress(chunkKey: string): HydrationProgress {
    const state = this.chunks.get(chunkKey);
    if (!state) return createEmptyHydrationProgress();

    let totalExpected = 0;
    let totalHydrated = 0;
    const byType = new Map<EntityType, EntityTypeProgress>();

    for (const [entityType, expectation] of state.expectations) {
      const hydratedSet = state.hydrated.get(entityType);
      const hydratedCount = hydratedSet?.size ?? 0;

      totalExpected += expectation.count;
      totalHydrated += Math.min(hydratedCount, expectation.count);

      byType.set(entityType, {
        expected: expectation.count,
        received: hydratedCount,
        percentage: expectation.count > 0 ? (hydratedCount / expectation.count) * 100 : 100,
      });
    }

    return {
      total: totalExpected,
      hydrated: totalHydrated,
      percentage: totalExpected > 0 ? (totalHydrated / totalExpected) * 100 : 100,
      byType,
    };
  }

  /**
   * Check if a chunk has any pending expectations.
   *
   * @param chunkKey - Chunk to check
   */
  hasPendingExpectations(chunkKey: string): boolean {
    return this.chunks.has(chunkKey);
  }

  /**
   * Check if any chunks have pending hydrations.
   *
   * @returns True if any chunks are still waiting for hydration
   */
  hasPendingChunks(): boolean {
    for (const [chunkKey] of this.chunks) {
      if (!this.isFullyHydrated(chunkKey)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the chunk key for an entity.
   *
   * @param entityId - Entity to look up
   */
  getEntityChunk(entityId: ID): string | undefined {
    return this.entityToChunk.get(entityId);
  }

  // ===========================================================================
  // Progress Subscription
  // ===========================================================================

  /**
   * Subscribe to progress updates.
   *
   * @param callback - Function to call on progress updates
   * @returns Unsubscribe function
   */
  onProgress(callback: HydrationProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get statistics about the registry.
   */
  getStats(): {
    activeChunks: number;
    trackedEntities: number;
    pendingHydrations: number;
  } {
    let pendingHydrations = 0;

    for (const [chunkKey] of this.chunks) {
      if (!this.isFullyHydrated(chunkKey)) {
        pendingHydrations++;
      }
    }

    return {
      activeChunks: this.chunks.size,
      trackedEntities: this.entityToChunk.size,
      pendingHydrations,
    };
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Clear all state.
   */
  clear(): void {
    // Cancel all pending timeouts and resolve promises
    for (const state of this.chunks.values()) {
      if (state.timeoutHandle) {
        clearTimeout(state.timeoutHandle);
      }
      if (state.resolve) {
        state.resolve({
          success: false,
          timedOut: false,
          progress: createEmptyHydrationProgress(),
          duration: Date.now() - state.startTime,
          chunkKey: state.chunkKey,
        });
      }
    }

    this.chunks.clear();
    this.entityToChunk.clear();
    this.progressCallbacks.clear();

    if (this.debug) {
      console.log("[HydrationRegistry] Cleared all state");
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Get or create state for a chunk.
   */
  private getOrCreateState(chunkKey: string): ChunkHydrationState {
    let state = this.chunks.get(chunkKey);

    if (!state) {
      state = {
        chunkKey,
        expectations: new Map(),
        hydrated: new Map(),
        startTime: Date.now(),
        isComplete: false,
      };
      this.chunks.set(chunkKey, state);
    }

    return state;
  }

  /**
   * Check if hydration is complete and resolve waiting promise.
   */
  private checkCompletion(chunkKey: string): void {
    const state = this.chunks.get(chunkKey);
    if (!state || state.isComplete) return;

    if (this.isFullyHydrated(chunkKey)) {
      state.isComplete = true;

      if (this.debug) {
        const duration = Date.now() - state.startTime;
        console.log(`[HydrationRegistry] Chunk ${chunkKey} hydration complete in ${duration}ms`);
      }

      // Clear timeout
      if (state.timeoutHandle) {
        clearTimeout(state.timeoutHandle);
        state.timeoutHandle = undefined;
      }

      // Resolve promise
      if (state.resolve) {
        state.resolve({
          success: true,
          timedOut: false,
          progress: this.getProgress(chunkKey),
          duration: Date.now() - state.startTime,
          chunkKey,
        });
        state.resolve = undefined;
      }
    }
  }

  /**
   * Emit progress update to subscribers.
   */
  private emitProgress(chunkKey: string): void {
    if (this.progressCallbacks.size === 0) return;

    const progress = this.getProgress(chunkKey);
    for (const callback of this.progressCallbacks) {
      try {
        callback(chunkKey, progress);
      } catch (error) {
        console.error("[HydrationRegistry] Progress callback error:", error);
      }
    }
  }
}

/**
 * Create a new EntityHydrationRegistry with default options.
 */
export function createHydrationRegistry(debug: boolean = false): EntityHydrationRegistry {
  return new EntityHydrationRegistry({ debug });
}
