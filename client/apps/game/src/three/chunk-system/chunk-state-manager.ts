/**
 * Chunk State Manager
 *
 * Central state machine for managing chunk lifecycle transitions.
 * Ensures chunks move through phases in a deterministic order and
 * provides a single source of truth for chunk state.
 */

import {
  ChunkBounds,
  ChunkLifecyclePhase,
  ChunkPriority,
  ChunkState,
  ChunkLifecycleEvents,
  ChunkEventHandler,
  createEmptyChunkState,
  isValidTransition,
  createChunkKey,
  parseChunkKey,
  calculateChunkBounds,
} from "./types";

/**
 * Event emitter for chunk lifecycle events.
 */
type EventListeners = {
  [K in keyof ChunkLifecycleEvents]?: Set<ChunkEventHandler<K>>;
};

/**
 * Configuration for the ChunkStateManager.
 */
export interface ChunkStateManagerConfig {
  /** Maximum number of chunks to keep in memory */
  maxCachedChunks: number;

  /** Render chunk dimensions */
  renderChunkSize: { width: number; height: number };

  /** Enable debug logging */
  debug: boolean;
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: ChunkStateManagerConfig = {
  maxCachedChunks: 16,
  renderChunkSize: { width: 60, height: 44 },
  debug: false,
};

/**
 * Chunk State Manager
 *
 * Manages the lifecycle state of all chunks in the system.
 * Enforces valid state transitions and emits events for monitoring.
 *
 * @example
 * ```typescript
 * const stateManager = new ChunkStateManager({ debug: true });
 *
 * // Listen for events
 * stateManager.on("chunk:phase-change", ({ chunkKey, from, to }) => {
 *   console.log(`Chunk ${chunkKey}: ${from} -> ${to}`);
 * });
 *
 * // Create and transition a chunk
 * stateManager.createChunk("0,0", bounds);
 * await stateManager.transitionTo("0,0", ChunkLifecyclePhase.FETCHING);
 * ```
 */
export class ChunkStateManager {
  /** All chunk states */
  private chunks: Map<string, ChunkState> = new Map();

  /** Currently active chunk (the one camera is in) */
  private activeChunkKey: string | null = null;

  /** Chunks in priority order for cache eviction */
  private chunkAccessOrder: string[] = [];

  /** Event listeners */
  private listeners: EventListeners = {};

  /** Configuration */
  private config: ChunkStateManagerConfig;

  constructor(config: Partial<ChunkStateManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Chunk Creation & Access
  // ===========================================================================

  /**
   * Create a new chunk or get existing one.
   *
   * @param chunkKey - Chunk identifier
   * @param bounds - Geographic bounds (required for new chunks)
   * @returns The chunk state
   */
  createChunk(chunkKey: string, bounds?: ChunkBounds): ChunkState {
    let state = this.chunks.get(chunkKey);

    if (!state) {
      if (!bounds) {
        // Calculate bounds from chunk key
        const { startRow, startCol } = parseChunkKey(chunkKey);
        bounds = calculateChunkBounds(
          startRow,
          startCol,
          this.config.renderChunkSize.width,
          this.config.renderChunkSize.height,
        );
      }

      state = createEmptyChunkState(chunkKey, bounds);
      this.chunks.set(chunkKey, state);

      if (this.config.debug) {
        console.log(`[ChunkStateManager] Created chunk ${chunkKey}`);
      }
    }

    // Update access order for LRU cache
    this.touchChunk(chunkKey);

    return state;
  }

  /**
   * Get a chunk's state.
   *
   * @param chunkKey - Chunk identifier
   * @returns Chunk state or undefined
   */
  getState(chunkKey: string): ChunkState | undefined {
    return this.chunks.get(chunkKey);
  }

  /**
   * Check if a chunk exists.
   *
   * @param chunkKey - Chunk identifier
   */
  hasChunk(chunkKey: string): boolean {
    return this.chunks.has(chunkKey);
  }

  /**
   * Get the current phase of a chunk.
   *
   * @param chunkKey - Chunk identifier
   * @returns Current phase or IDLE if chunk doesn't exist
   */
  getPhase(chunkKey: string): ChunkLifecyclePhase {
    return this.chunks.get(chunkKey)?.phase ?? ChunkLifecyclePhase.IDLE;
  }

  /**
   * Check if a chunk is in a specific phase.
   *
   * @param chunkKey - Chunk identifier
   * @param phase - Phase to check
   */
  isInPhase(chunkKey: string, phase: ChunkLifecyclePhase): boolean {
    return this.getPhase(chunkKey) === phase;
  }

  /**
   * Check if a chunk is ready (ACTIVE phase).
   *
   * @param chunkKey - Chunk identifier
   */
  isReady(chunkKey: string): boolean {
    return this.isInPhase(chunkKey, ChunkLifecyclePhase.ACTIVE);
  }

  /**
   * Check if a chunk is loading (FETCHING, HYDRATING, or RENDERING).
   *
   * @param chunkKey - Chunk identifier
   */
  isLoading(chunkKey: string): boolean {
    const phase = this.getPhase(chunkKey);
    return (
      phase === ChunkLifecyclePhase.FETCHING ||
      phase === ChunkLifecyclePhase.HYDRATING ||
      phase === ChunkLifecyclePhase.RENDERING
    );
  }

  // ===========================================================================
  // State Transitions
  // ===========================================================================

  /**
   * Transition a chunk to a new phase.
   *
   * @param chunkKey - Chunk identifier
   * @param targetPhase - Phase to transition to
   * @throws Error if transition is invalid
   */
  async transitionTo(chunkKey: string, targetPhase: ChunkLifecyclePhase): Promise<void> {
    const state = this.chunks.get(chunkKey);

    if (!state) {
      throw new Error(`[ChunkStateManager] Cannot transition unknown chunk: ${chunkKey}`);
    }

    const currentPhase = state.phase;

    // Validate transition
    if (!isValidTransition(currentPhase, targetPhase)) {
      throw new Error(
        `[ChunkStateManager] Invalid transition for chunk ${chunkKey}: ${currentPhase} -> ${targetPhase}`,
      );
    }

    const now = Date.now();
    const duration = now - state.phaseStartTime;

    // Update state
    state.phase = targetPhase;
    state.phaseStartTime = now;
    state.lastTransitionTime = now;

    // Clear error on successful transition away from ERROR
    if (currentPhase === ChunkLifecyclePhase.ERROR && targetPhase !== ChunkLifecyclePhase.ERROR) {
      state.error = undefined;
    }

    // Track total load duration when becoming ACTIVE
    if (targetPhase === ChunkLifecyclePhase.ACTIVE) {
      // Find when FETCHING started
      state.totalLoadDuration = now - state.phaseStartTime;
    }

    if (this.config.debug) {
      console.log(`[ChunkStateManager] Chunk ${chunkKey}: ${currentPhase} -> ${targetPhase} (${duration}ms)`);
    }

    // Emit event
    this.emit("chunk:phase-change", {
      chunkKey,
      from: currentPhase,
      to: targetPhase,
      duration,
    });

    // Emit specific events for important transitions
    if (targetPhase === ChunkLifecyclePhase.ACTIVE) {
      this.emit("chunk:activated", {
        chunkKey,
        totalDuration: state.totalLoadDuration ?? duration,
        entityCounts: new Map(state.hydratedEntities).size
          ? new Map(Array.from(state.hydratedEntities.entries()).map(([type, set]) => [type, set.size]))
          : new Map(),
      });
    } else if (currentPhase === ChunkLifecyclePhase.ACTIVE) {
      this.emit("chunk:deactivated", { chunkKey });
    }
  }

  /**
   * Transition a chunk to ERROR phase.
   *
   * @param chunkKey - Chunk identifier
   * @param error - The error that occurred
   */
  async transitionToError(chunkKey: string, error: Error): Promise<void> {
    const state = this.chunks.get(chunkKey);

    if (!state) {
      console.error(`[ChunkStateManager] Cannot set error on unknown chunk: ${chunkKey}`);
      return;
    }

    const currentPhase = state.phase;
    state.error = error;
    state.phase = ChunkLifecyclePhase.ERROR;
    state.lastTransitionTime = Date.now();

    if (this.config.debug) {
      console.error(`[ChunkStateManager] Chunk ${chunkKey} error in ${currentPhase}:`, error);
    }

    this.emit("chunk:error", {
      chunkKey,
      error,
      phase: currentPhase,
    });
  }

  /**
   * Reset a chunk back to IDLE state.
   *
   * @param chunkKey - Chunk identifier
   */
  async resetChunk(chunkKey: string): Promise<void> {
    const state = this.chunks.get(chunkKey);
    if (!state) return;

    const currentPhase = state.phase;

    // Can always go back to IDLE
    state.phase = ChunkLifecyclePhase.IDLE;
    state.phaseStartTime = Date.now();
    state.lastTransitionTime = Date.now();
    state.error = undefined;
    state.isRendered = false;
    state.renderDuration = undefined;
    state.totalLoadDuration = undefined;
    state.expectedEntities.clear();
    state.hydratedEntities.clear();

    if (this.config.debug) {
      console.log(`[ChunkStateManager] Chunk ${chunkKey} reset from ${currentPhase}`);
    }

    this.emit("chunk:phase-change", {
      chunkKey,
      from: currentPhase,
      to: ChunkLifecyclePhase.IDLE,
      duration: 0,
    });
  }

  // ===========================================================================
  // Active Chunk Management
  // ===========================================================================

  /**
   * Get the currently active chunk key.
   */
  getActiveChunk(): string | null {
    return this.activeChunkKey;
  }

  /**
   * Set the active chunk.
   *
   * @param chunkKey - Chunk to make active
   */
  setActiveChunk(chunkKey: string | null): void {
    if (this.activeChunkKey === chunkKey) return;

    const previousActive = this.activeChunkKey;
    this.activeChunkKey = chunkKey;

    // Update priorities
    if (previousActive) {
      const prevState = this.chunks.get(previousActive);
      if (prevState) {
        prevState.priority = ChunkPriority.NORMAL;
      }
    }

    if (chunkKey) {
      const state = this.chunks.get(chunkKey);
      if (state) {
        state.priority = ChunkPriority.CRITICAL;
      }
      this.touchChunk(chunkKey);
    }

    if (this.config.debug) {
      console.log(`[ChunkStateManager] Active chunk: ${previousActive} -> ${chunkKey}`);
    }
  }

  /**
   * Set priority for a chunk.
   *
   * @param chunkKey - Chunk identifier
   * @param priority - New priority
   */
  setPriority(chunkKey: string, priority: ChunkPriority): void {
    const state = this.chunks.get(chunkKey);
    if (state) {
      state.priority = priority;
    }
  }

  // ===========================================================================
  // Cache Management
  // ===========================================================================

  /**
   * Remove a chunk from the manager.
   *
   * @param chunkKey - Chunk to remove
   */
  removeChunk(chunkKey: string): void {
    const state = this.chunks.get(chunkKey);
    if (!state) return;

    // Don't remove active chunk
    if (chunkKey === this.activeChunkKey) {
      console.warn(`[ChunkStateManager] Cannot remove active chunk: ${chunkKey}`);
      return;
    }

    this.chunks.delete(chunkKey);

    // Remove from access order
    const idx = this.chunkAccessOrder.indexOf(chunkKey);
    if (idx !== -1) {
      this.chunkAccessOrder.splice(idx, 1);
    }

    if (this.config.debug) {
      console.log(`[ChunkStateManager] Removed chunk ${chunkKey}`);
    }
  }

  /**
   * Evict least recently used chunks to stay under cache limit.
   *
   * @returns Array of evicted chunk keys
   */
  evictLRU(): string[] {
    const evicted: string[] = [];

    while (this.chunks.size > this.config.maxCachedChunks && this.chunkAccessOrder.length > 0) {
      // Find oldest chunk that isn't active or loading
      for (let i = 0; i < this.chunkAccessOrder.length; i++) {
        const chunkKey = this.chunkAccessOrder[i];

        if (chunkKey === this.activeChunkKey) continue;

        const state = this.chunks.get(chunkKey);
        if (!state) continue;

        // Don't evict loading chunks
        if (this.isLoading(chunkKey)) continue;

        // Don't evict high priority chunks
        if (state.priority <= ChunkPriority.HIGH) continue;

        // Evict this chunk
        this.removeChunk(chunkKey);
        evicted.push(chunkKey);
        break;
      }

      // Safety: if we couldn't evict anything, break to avoid infinite loop
      if (evicted.length === 0) break;
    }

    return evicted;
  }

  /**
   * Update access order for a chunk (mark as recently used).
   *
   * @param chunkKey - Chunk that was accessed
   */
  private touchChunk(chunkKey: string): void {
    const idx = this.chunkAccessOrder.indexOf(chunkKey);
    if (idx !== -1) {
      this.chunkAccessOrder.splice(idx, 1);
    }
    this.chunkAccessOrder.push(chunkKey);
  }

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  /**
   * Get all chunks in a specific phase.
   *
   * @param phase - Phase to filter by
   */
  getChunksInPhase(phase: ChunkLifecyclePhase): string[] {
    const result: string[] = [];
    for (const [chunkKey, state] of this.chunks) {
      if (state.phase === phase) {
        result.push(chunkKey);
      }
    }
    return result;
  }

  /**
   * Get all chunk keys.
   */
  getAllChunkKeys(): string[] {
    return Array.from(this.chunks.keys());
  }

  /**
   * Get all active or ready chunks.
   */
  getReadyChunks(): string[] {
    return this.getChunksInPhase(ChunkLifecyclePhase.ACTIVE);
  }

  /**
   * Get all loading chunks.
   */
  getLoadingChunks(): string[] {
    const result: string[] = [];
    for (const [chunkKey, state] of this.chunks) {
      if (
        state.phase === ChunkLifecyclePhase.FETCHING ||
        state.phase === ChunkLifecyclePhase.HYDRATING ||
        state.phase === ChunkLifecyclePhase.RENDERING
      ) {
        result.push(chunkKey);
      }
    }
    return result;
  }

  // ===========================================================================
  // Event System
  // ===========================================================================

  /**
   * Subscribe to a lifecycle event.
   *
   * @param event - Event name
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  on<K extends keyof ChunkLifecycleEvents>(event: K, handler: ChunkEventHandler<K>): () => void {
    if (!this.listeners[event]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.listeners[event] = new Set() as any;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.listeners[event] as Set<any>).add(handler);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.listeners[event] as Set<any>).delete(handler);
    };
  }

  /**
   * Emit an event.
   *
   * @param event - Event name
   * @param data - Event data
   */
  private emit<K extends keyof ChunkLifecycleEvents>(event: K, data: ChunkLifecycleEvents[K]): void {
    const handlers = this.listeners[event] as Set<ChunkEventHandler<K>> | undefined;
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`[ChunkStateManager] Event handler error for ${event}:`, error);
      }
    }
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get statistics about the state manager.
   */
  getStats(): {
    totalChunks: number;
    activeChunk: string | null;
    byPhase: Map<ChunkLifecyclePhase, number>;
    cacheUtilization: number;
  } {
    const byPhase = new Map<ChunkLifecyclePhase, number>();

    for (const phase of Object.values(ChunkLifecyclePhase)) {
      byPhase.set(phase as ChunkLifecyclePhase, 0);
    }

    for (const state of this.chunks.values()) {
      byPhase.set(state.phase, (byPhase.get(state.phase) || 0) + 1);
    }

    return {
      totalChunks: this.chunks.size,
      activeChunk: this.activeChunkKey,
      byPhase,
      cacheUtilization: this.chunks.size / this.config.maxCachedChunks,
    };
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Clear all state.
   */
  clear(): void {
    this.chunks.clear();
    this.chunkAccessOrder = [];
    this.activeChunkKey = null;

    if (this.config.debug) {
      console.log("[ChunkStateManager] Cleared all state");
    }
  }

  /**
   * Destroy the manager.
   */
  destroy(): void {
    this.clear();
    this.listeners = {};
  }
}

/**
 * Create a new ChunkStateManager with default configuration.
 */
export function createChunkStateManager(config: Partial<ChunkStateManagerConfig> = {}): ChunkStateManager {
  return new ChunkStateManager(config);
}
