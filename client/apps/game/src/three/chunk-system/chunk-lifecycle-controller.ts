/**
 * Chunk Lifecycle Controller
 *
 * The main orchestrator for the chunk loading system.
 * Coordinates all components to provide a deterministic chunk lifecycle.
 *
 * This is the primary interface that WorldmapScene will use to manage
 * chunk loading, replacing the ad-hoc async calls with a proper state machine.
 */

import { ID, HexPosition } from "@bibliothecadao/types";
import { Vector3 } from "three";

import {
  ChunkBounds,
  ChunkLifecyclePhase,
  ChunkLifecycleConfig,
  ChunkLifecycleEvents,
  ChunkEventHandler,
  ChunkPriority,
  ChunkState,
  EntityType,
  DEFAULT_CHUNK_CONFIG,
  createChunkKey,
  parseChunkKey,
  calculateChunkBounds,
  HydrationProgress,
} from "./types";

import { ChunkStateManager, createChunkStateManager } from "./chunk-state-manager";
import { DataFetchCoordinator, createDataFetchCoordinator, ChunkFetchFunction } from "./data-fetch-coordinator";
import { EntityHydrationRegistry, createHydrationRegistry } from "./entity-hydration-registry";
import { ManagerOrchestrator, createManagerOrchestrator } from "./manager-orchestrator";
import { UnifiedSpatialIndex, createSpatialIndex } from "./unified-spatial-index";
import { EntityManager } from "./entity-manager.interface";

/**
 * Configuration for the ChunkLifecycleController.
 */
export interface ChunkLifecycleControllerConfig extends ChunkLifecycleConfig {
  /** Callback to get structure positions */
  getStructurePositions?: () => Map<ID, HexPosition>;
}

/**
 * Chunk Lifecycle Controller
 *
 * Main entry point for the chunk system. Provides a clean API for:
 * - Loading chunks when the camera moves
 * - Tracking chunk state
 * - Coordinating managers
 * - Handling errors gracefully
 *
 * @example
 * ```typescript
 * const controller = new ChunkLifecycleController({
 *   chunkSize: 30,
 *   renderChunkSize: { width: 60, height: 44 },
 *   debug: true,
 * });
 *
 * // Register managers
 * controller.registerManager(structureManager);
 * controller.registerManager(armyManager);
 *
 * // Set up fetch function
 * controller.setFetchFunction(async (bounds) => {
 *   // Fetch from Torii
 *   return { tiles: [], structures: [] };
 * });
 *
 * // Handle camera movement
 * controller.onCameraMove(cameraPosition);
 * ```
 */
export class ChunkLifecycleController {
  /** State manager for chunk lifecycle */
  readonly stateManager: ChunkStateManager;

  /** Data fetch coordinator */
  readonly fetchCoordinator: DataFetchCoordinator;

  /** Entity hydration registry */
  readonly hydrationRegistry: EntityHydrationRegistry;

  /** Manager orchestrator */
  readonly orchestrator: ManagerOrchestrator;

  /** Unified spatial index */
  readonly spatialIndex: UnifiedSpatialIndex;

  /** Configuration */
  private config: ChunkLifecycleControllerConfig;

  /** Current camera chunk */
  private currentChunkKey: string | null = null;

  /** Chunks being loaded */
  private loadingChunks: Map<string, Promise<void>> = new Map();

  /** Prefetch queue */
  private prefetchQueue: string[] = [];

  /** Is currently processing camera move */
  private isProcessingCameraMove = false;

  /** Pending camera position (for debouncing) */
  private pendingCameraPosition: Vector3 | null = null;

  /** Camera move debounce timeout */
  private cameraMoveTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Camera move debounce delay */
  private readonly cameraMoveDebounceMs = 50;

  /** Event listeners (forwarded from state manager) */
  private eventUnsubscribers: Array<() => void> = [];

  constructor(config: Partial<ChunkLifecycleControllerConfig> = {}) {
    this.config = { ...DEFAULT_CHUNK_CONFIG, ...config };

    // Create sub-components
    this.stateManager = createChunkStateManager({
      maxCachedChunks: this.config.maxCachedChunks,
      renderChunkSize: this.config.renderChunkSize,
      debug: this.config.debug,
    });

    this.fetchCoordinator = createDataFetchCoordinator({
      fetchTimeoutMs: this.config.fetchTimeoutMs,
      debug: this.config.debug,
    });

    this.hydrationRegistry = createHydrationRegistry(this.config.debug);

    this.orchestrator = createManagerOrchestrator({
      debug: this.config.debug,
    });

    this.spatialIndex = createSpatialIndex(this.config.spatialBucketSize);
    this.spatialIndex.setChunkDimensions(this.config.renderChunkSize.width, this.config.renderChunkSize.height);

    // Forward events from state manager
    this.setupEventForwarding();

    if (this.config.debug) {
      console.log("[ChunkLifecycleController] Initialized with config:", this.config);
    }
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Set the fetch function for data retrieval.
   *
   * @param fn - Function that fetches chunk data from Torii
   */
  setFetchFunction(fn: ChunkFetchFunction): void {
    this.fetchCoordinator.setFetchFunction(fn);
  }

  /**
   * Update structure positions.
   *
   * @param positions - Map of entity ID to position
   */
  setStructurePositions(positions: Map<ID, HexPosition>): void {
    this.fetchCoordinator.setStructurePositions(positions);
  }

  // ===========================================================================
  // Manager Registration
  // ===========================================================================

  /**
   * Register an entity manager.
   *
   * @param manager - Manager to register
   * @param options - Registration options
   */
  registerManager(
    manager: EntityManager,
    options?: { renderOrder?: number; required?: boolean; dependencies?: EntityType[] },
  ): void {
    this.orchestrator.registerManager(manager, options);
  }

  /**
   * Unregister a manager.
   *
   * @param entityType - Type of manager to unregister
   */
  unregisterManager(entityType: EntityType): void {
    this.orchestrator.unregisterManager(entityType);
  }

  // ===========================================================================
  // Camera Handling
  // ===========================================================================

  /**
   * Handle camera movement.
   *
   * This is the main entry point called when the camera moves.
   * It determines if a chunk switch is needed and orchestrates the loading.
   *
   * @param position - Current camera position in world coordinates
   */
  onCameraMove(position: Vector3): void {
    this.pendingCameraPosition = position.clone();

    // Debounce rapid movements
    if (this.cameraMoveTimeout) {
      clearTimeout(this.cameraMoveTimeout);
    }

    this.cameraMoveTimeout = setTimeout(() => {
      this.cameraMoveTimeout = null;
      this.processCameraMove();
    }, this.cameraMoveDebounceMs);
  }

  /**
   * Process a camera move (debounced).
   */
  private async processCameraMove(): Promise<void> {
    if (this.isProcessingCameraMove || !this.pendingCameraPosition) {
      return;
    }

    this.isProcessingCameraMove = true;
    const position = this.pendingCameraPosition;
    this.pendingCameraPosition = null;

    try {
      // Convert world position to chunk coordinates
      const chunkKey = this.worldPositionToChunkKey(position);

      // Check if we need to switch chunks
      if (chunkKey !== this.currentChunkKey) {
        await this.switchToChunk(chunkKey);
      }

      // Update prefetch queue
      this.updatePrefetchQueue(chunkKey);

      // Process prefetch queue
      this.processPrefetchQueue();
    } catch (error) {
      console.error("[ChunkLifecycleController] Camera move processing failed:", error);
    } finally {
      this.isProcessingCameraMove = false;

      // Process any pending camera move
      if (this.pendingCameraPosition) {
        this.processCameraMove();
      }
    }
  }

  /**
   * Force switch to a specific chunk.
   *
   * @param chunkKey - Chunk to switch to
   */
  async switchToChunk(chunkKey: string): Promise<void> {
    if (this.config.debug) {
      console.log(`[ChunkLifecycleController] Switching to chunk ${chunkKey}`);
    }

    const previousChunk = this.currentChunkKey;
    this.currentChunkKey = chunkKey;
    this.stateManager.setActiveChunk(chunkKey);

    try {
      // Check if chunk is already ready
      if (this.stateManager.isReady(chunkKey)) {
        if (this.config.debug) {
          console.log(`[ChunkLifecycleController] Chunk ${chunkKey} already ready`);
        }
        return;
      }

      // Check if chunk is already loading
      const existingLoad = this.loadingChunks.get(chunkKey);
      if (existingLoad) {
        if (this.config.debug) {
          console.log(`[ChunkLifecycleController] Waiting for existing load of ${chunkKey}`);
        }
        await existingLoad;
        return;
      }

      // Load the chunk
      await this.loadChunk(chunkKey, ChunkPriority.CRITICAL);
    } catch (error) {
      console.error(`[ChunkLifecycleController] Failed to switch to chunk ${chunkKey}:`, error);

      // Revert to previous chunk if available
      if (previousChunk && this.stateManager.isReady(previousChunk)) {
        this.currentChunkKey = previousChunk;
        this.stateManager.setActiveChunk(previousChunk);
      }

      throw error;
    }
  }

  // ===========================================================================
  // Chunk Loading
  // ===========================================================================

  /**
   * Load a chunk through the full lifecycle.
   *
   * @param chunkKey - Chunk to load
   * @param priority - Load priority
   */
  async loadChunk(chunkKey: string, priority: ChunkPriority = ChunkPriority.NORMAL): Promise<void> {
    // Check if already loading
    const existingLoad = this.loadingChunks.get(chunkKey);
    if (existingLoad) {
      return existingLoad;
    }

    // Create load promise
    const loadPromise = this.doLoadChunk(chunkKey, priority);
    this.loadingChunks.set(chunkKey, loadPromise);

    try {
      await loadPromise;
    } finally {
      this.loadingChunks.delete(chunkKey);
    }
  }

  /**
   * Internal chunk loading implementation.
   */
  private async doLoadChunk(chunkKey: string, priority: ChunkPriority): Promise<void> {
    const { startRow, startCol } = parseChunkKey(chunkKey);
    const bounds = calculateChunkBounds(
      startRow,
      startCol,
      this.config.renderChunkSize.width,
      this.config.renderChunkSize.height,
    );

    // Create chunk state
    const state = this.stateManager.createChunk(chunkKey, bounds);
    this.stateManager.setPriority(chunkKey, priority);

    const startTime = Date.now();

    try {
      // === PHASE: FETCHING ===
      await this.stateManager.transitionTo(chunkKey, ChunkLifecyclePhase.FETCHING);

      // Prepare managers
      await this.orchestrator.prepareChunk(chunkKey, bounds);

      // Fetch data
      const chunkData = await this.fetchCoordinator.fetchChunk(chunkKey, bounds, priority);

      // Register hydration expectations
      if (chunkData.structures.length > 0) {
        this.hydrationRegistry.expectEntities(chunkKey, EntityType.Structure, chunkData.structures.length);
      }
      if (chunkData.armies.length > 0) {
        this.hydrationRegistry.expectEntities(chunkKey, EntityType.Army, chunkData.armies.length);
      }
      if (chunkData.quests.length > 0) {
        this.hydrationRegistry.expectEntities(chunkKey, EntityType.Quest, chunkData.quests.length);
      }
      if (chunkData.chests.length > 0) {
        this.hydrationRegistry.expectEntities(chunkKey, EntityType.Chest, chunkData.chests.length);
      }

      // === PHASE: HYDRATING ===
      await this.stateManager.transitionTo(chunkKey, ChunkLifecyclePhase.HYDRATING);

      // Wait for hydration (with timeout)
      const hydrationResult = await this.hydrationRegistry.waitForHydration(chunkKey, this.config.hydrationTimeoutMs);

      if (!hydrationResult.success && this.config.debug) {
        console.warn(`[ChunkLifecycleController] Hydration incomplete for ${chunkKey}:`, hydrationResult.progress);
      }

      // === PHASE: RENDERING ===
      await this.stateManager.transitionTo(chunkKey, ChunkLifecyclePhase.RENDERING);

      // Render all managers
      await this.orchestrator.renderChunk(chunkKey);

      // Track render time
      state.isRendered = true;
      state.renderDuration = Date.now() - startTime;

      // === PHASE: ACTIVE ===
      await this.stateManager.transitionTo(chunkKey, ChunkLifecyclePhase.ACTIVE);

      if (this.config.debug) {
        console.log(`[ChunkLifecycleController] Chunk ${chunkKey} loaded in ${Date.now() - startTime}ms`);
      }
    } catch (error) {
      // Handle error
      await this.stateManager.transitionToError(chunkKey, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Unload a chunk.
   *
   * @param chunkKey - Chunk to unload
   */
  async unloadChunk(chunkKey: string): Promise<void> {
    // Don't unload active chunk
    if (chunkKey === this.currentChunkKey) {
      console.warn(`[ChunkLifecycleController] Cannot unload active chunk ${chunkKey}`);
      return;
    }

    const state = this.stateManager.getState(chunkKey);
    if (!state) return;

    try {
      await this.stateManager.transitionTo(chunkKey, ChunkLifecyclePhase.UNLOADING);

      // Unload managers
      await this.orchestrator.unloadChunk(chunkKey);

      // Clear from spatial index
      this.spatialIndex.removeChunk(chunkKey);

      // Clear hydration state
      this.hydrationRegistry.clearExpectations(chunkKey);

      // Reset state
      await this.stateManager.resetChunk(chunkKey);

      if (this.config.debug) {
        console.log(`[ChunkLifecycleController] Unloaded chunk ${chunkKey}`);
      }
    } catch (error) {
      console.error(`[ChunkLifecycleController] Failed to unload chunk ${chunkKey}:`, error);
    }
  }

  // ===========================================================================
  // Prefetching
  // ===========================================================================

  /**
   * Update the prefetch queue based on current chunk.
   */
  private updatePrefetchQueue(centerChunkKey: string): void {
    const { startRow, startCol } = parseChunkKey(centerChunkKey);

    // Get surrounding chunks
    const surrounding: string[] = [];
    const rowStep = this.config.renderChunkSize.height;
    const colStep = this.config.renderChunkSize.width;

    // 3x3 grid around center
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue; // Skip center
        const newRow = startRow + dr * rowStep;
        const newCol = startCol + dc * colStep;
        surrounding.push(createChunkKey(newRow, newCol));
      }
    }

    // Filter to chunks not already loaded or loading
    this.prefetchQueue = surrounding.filter((key) => {
      return !this.stateManager.isReady(key) && !this.stateManager.isLoading(key) && !this.loadingChunks.has(key);
    });
  }

  /**
   * Process the prefetch queue.
   */
  private processPrefetchQueue(): void {
    const maxConcurrent = this.config.maxConcurrentPrefetch;
    const currentLoading = this.loadingChunks.size;

    if (currentLoading >= maxConcurrent) return;

    const toStart = Math.min(maxConcurrent - currentLoading, this.prefetchQueue.length);

    for (let i = 0; i < toStart; i++) {
      const chunkKey = this.prefetchQueue.shift();
      if (chunkKey) {
        // Fire-and-forget prefetch
        this.loadChunk(chunkKey, ChunkPriority.LOW).catch((error) => {
          if (this.config.debug) {
            console.warn(`[ChunkLifecycleController] Prefetch failed for ${chunkKey}:`, error);
          }
        });
      }
    }
  }

  // ===========================================================================
  // Entity Hydration Notifications
  // ===========================================================================

  /**
   * Notify that an entity has been hydrated.
   *
   * This should be called by managers when they receive entity data
   * via WorldUpdateListener callbacks.
   *
   * @param entityId - Entity that was hydrated
   * @param entityType - Type of entity
   * @param chunkKey - Chunk the entity belongs to (optional, will be looked up)
   */
  notifyEntityHydrated(entityId: ID, entityType: EntityType, chunkKey?: string): void {
    this.hydrationRegistry.notifyEntityHydrated(entityId, entityType, chunkKey);
  }

  /**
   * Notify that an entity has been removed.
   *
   * @param entityId - Entity that was removed
   * @param entityType - Type of entity
   */
  notifyEntityRemoved(entityId: ID, entityType: EntityType): void {
    this.hydrationRegistry.notifyEntityRemoved(entityId);
    this.spatialIndex.removeEntity(entityId);
    this.orchestrator.notifyEntityRemoved(entityId, entityType);
  }

  // ===========================================================================
  // Coordinate Conversion
  // ===========================================================================

  /**
   * Convert world position to chunk key.
   *
   * @param position - World position
   */
  worldPositionToChunkKey(position: Vector3): string {
    // Constants from the codebase
    const HEX_SIZE = 1;
    const hexWidth = Math.sqrt(3) * HEX_SIZE;
    const hexHeight = 2 * HEX_SIZE;

    // Convert world position to hex coordinates
    const col = Math.floor(position.x / hexWidth);
    const row = Math.floor(position.z / (hexHeight * 0.75));

    // Convert hex coordinates to chunk coordinates
    const chunkCol = Math.floor(col / this.config.renderChunkSize.width) * this.config.renderChunkSize.width;
    const chunkRow = Math.floor(row / this.config.renderChunkSize.height) * this.config.renderChunkSize.height;

    return createChunkKey(chunkRow, chunkCol);
  }

  /**
   * Get chunk bounds for a chunk key.
   *
   * @param chunkKey - Chunk identifier
   */
  getChunkBounds(chunkKey: string): ChunkBounds {
    const { startRow, startCol } = parseChunkKey(chunkKey);
    return calculateChunkBounds(
      startRow,
      startCol,
      this.config.renderChunkSize.width,
      this.config.renderChunkSize.height,
    );
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  /**
   * Set up event forwarding from state manager.
   */
  private setupEventForwarding(): void {
    // Forward hydration progress
    this.eventUnsubscribers.push(
      this.hydrationRegistry.onProgress((chunkKey, progress) => {
        // Could emit events here if needed
      }),
    );
  }

  /**
   * Subscribe to a lifecycle event.
   *
   * @param event - Event name
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  on<K extends keyof ChunkLifecycleEvents>(event: K, handler: ChunkEventHandler<K>): () => void {
    return this.stateManager.on(event, handler);
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Get the current active chunk key.
   */
  getCurrentChunk(): string | null {
    return this.currentChunkKey;
  }

  /**
   * Check if a chunk is ready.
   *
   * @param chunkKey - Chunk to check
   */
  isChunkReady(chunkKey: string): boolean {
    return this.stateManager.isReady(chunkKey);
  }

  /**
   * Check if a chunk is loading.
   *
   * @param chunkKey - Chunk to check
   */
  isChunkLoading(chunkKey: string): boolean {
    return this.stateManager.isLoading(chunkKey) || this.loadingChunks.has(chunkKey);
  }

  /**
   * Get chunk state.
   *
   * @param chunkKey - Chunk to query
   */
  getChunkState(chunkKey: string): ChunkState | undefined {
    return this.stateManager.getState(chunkKey);
  }

  /**
   * Get hydration progress for a chunk.
   *
   * @param chunkKey - Chunk to query
   */
  getHydrationProgress(chunkKey: string): HydrationProgress {
    return this.hydrationRegistry.getProgress(chunkKey);
  }

  // ===========================================================================
  // Update Loop
  // ===========================================================================

  /**
   * Update method called every frame.
   *
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    // Update managers
    this.orchestrator.update(deltaTime);

    // Process incremental rendering if needed
    if (this.orchestrator.hasPendingRenderWork()) {
      this.orchestrator.renderIncremental();
    }

    // Evict old chunks if over limit
    this.stateManager.evictLRU();
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get comprehensive statistics.
   */
  getStats(): {
    currentChunk: string | null;
    stateManager: ReturnType<ChunkStateManager["getStats"]>;
    fetchCoordinator: ReturnType<DataFetchCoordinator["getStats"]>;
    hydrationRegistry: ReturnType<EntityHydrationRegistry["getStats"]>;
    orchestrator: ReturnType<ManagerOrchestrator["getStats"]>;
    spatialIndex: ReturnType<UnifiedSpatialIndex["getStats"]>;
    loadingChunks: string[];
    prefetchQueue: string[];
  } {
    return {
      currentChunk: this.currentChunkKey,
      stateManager: this.stateManager.getStats(),
      fetchCoordinator: this.fetchCoordinator.getStats(),
      hydrationRegistry: this.hydrationRegistry.getStats(),
      orchestrator: this.orchestrator.getStats(),
      spatialIndex: this.spatialIndex.getStats(),
      loadingChunks: Array.from(this.loadingChunks.keys()),
      prefetchQueue: [...this.prefetchQueue],
    };
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Clear all state.
   */
  clear(): void {
    // Cancel pending operations
    if (this.cameraMoveTimeout) {
      clearTimeout(this.cameraMoveTimeout);
      this.cameraMoveTimeout = null;
    }

    this.fetchCoordinator.cancelAll();

    // Clear all components
    this.stateManager.clear();
    this.hydrationRegistry.clear();
    this.spatialIndex.clear();

    // Reset state
    this.currentChunkKey = null;
    this.loadingChunks.clear();
    this.prefetchQueue = [];
    this.pendingCameraPosition = null;
    this.isProcessingCameraMove = false;

    if (this.config.debug) {
      console.log("[ChunkLifecycleController] Cleared all state");
    }
  }

  /**
   * Destroy the controller.
   */
  destroy(): void {
    this.clear();

    // Unsubscribe from events
    for (const unsub of this.eventUnsubscribers) {
      unsub();
    }
    this.eventUnsubscribers = [];

    // Destroy sub-components
    this.stateManager.destroy();
    this.fetchCoordinator.destroy();
    this.orchestrator.destroy();

    if (this.config.debug) {
      console.log("[ChunkLifecycleController] Destroyed");
    }
  }
}

/**
 * Create a new ChunkLifecycleController with default configuration.
 */
export function createChunkLifecycleController(
  config: Partial<ChunkLifecycleControllerConfig> = {},
): ChunkLifecycleController {
  return new ChunkLifecycleController(config);
}
