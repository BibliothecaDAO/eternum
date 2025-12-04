/**
 * Manager Orchestrator
 *
 * Coordinates all entity managers to ensure proper render order
 * and synchronized chunk operations. Acts as the bridge between
 * the chunk lifecycle controller and individual managers.
 */

import { ID } from "@bibliothecadao/types";
import {
  EntityManager,
  ManagerRegistration,
  DEFAULT_RENDER_ORDER,
  isIncrementalRenderManager,
  isPrefetchableManager,
} from "./entity-manager.interface";
import { ChunkBounds, EntityType } from "./types";

/**
 * Configuration for the ManagerOrchestrator.
 */
export interface ManagerOrchestratorConfig {
  /** Time budget per frame for incremental rendering (ms) */
  incrementalRenderBudgetMs: number;

  /** Enable debug logging */
  debug: boolean;
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: ManagerOrchestratorConfig = {
  incrementalRenderBudgetMs: 8,
  debug: false,
};

/**
 * Manager Orchestrator
 *
 * Coordinates all entity managers for chunk operations.
 *
 * Key responsibilities:
 * - Register and track managers by entity type
 * - Ensure correct render order
 * - Coordinate chunk prepare/render/unload operations
 * - Handle incremental rendering for smooth performance
 *
 * @example
 * ```typescript
 * const orchestrator = new ManagerOrchestrator();
 *
 * // Register managers
 * orchestrator.registerManager(structureManager, { renderOrder: 10 });
 * orchestrator.registerManager(armyManager, { renderOrder: 20 });
 *
 * // Prepare and render a chunk
 * await orchestrator.prepareChunk("0,0", bounds);
 * await orchestrator.renderChunk("0,0");
 * ```
 */
export class ManagerOrchestrator {
  /** Registered managers */
  private managers: Map<EntityType, ManagerRegistration> = new Map();

  /** Managers sorted by render order */
  private renderOrder: EntityType[] = [];

  /** Configuration */
  private config: ManagerOrchestratorConfig;

  /** Chunks currently being processed */
  private processingChunks: Set<string> = new Set();

  constructor(config: Partial<ManagerOrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Manager Registration
  // ===========================================================================

  /**
   * Register an entity manager.
   *
   * @param manager - The manager to register
   * @param options - Registration options
   */
  registerManager(
    manager: EntityManager,
    options: Partial<Omit<ManagerRegistration, "manager">> = {},
  ): void {
    const registration: ManagerRegistration = {
      manager,
      renderOrder: options.renderOrder ?? DEFAULT_RENDER_ORDER[manager.entityType] ?? 50,
      required: options.required ?? true,
      dependencies: options.dependencies,
    };

    this.managers.set(manager.entityType, registration);
    this.updateRenderOrder();

    if (this.config.debug) {
      console.log(
        `[ManagerOrchestrator] Registered ${manager.entityType} manager (order: ${registration.renderOrder})`,
      );
    }
  }

  /**
   * Unregister a manager.
   *
   * @param entityType - Type of manager to unregister
   */
  unregisterManager(entityType: EntityType): void {
    this.managers.delete(entityType);
    this.updateRenderOrder();

    if (this.config.debug) {
      console.log(`[ManagerOrchestrator] Unregistered ${entityType} manager`);
    }
  }

  /**
   * Get a registered manager.
   *
   * @param entityType - Type of manager to get
   */
  getManager(entityType: EntityType): EntityManager | undefined {
    return this.managers.get(entityType)?.manager;
  }

  /**
   * Check if a manager is registered.
   *
   * @param entityType - Type to check
   */
  hasManager(entityType: EntityType): boolean {
    return this.managers.has(entityType);
  }

  /**
   * Update the render order array.
   */
  private updateRenderOrder(): void {
    // Sort managers by render order, respecting dependencies
    const sorted: EntityType[] = [];
    const visited = new Set<EntityType>();
    const visiting = new Set<EntityType>();

    const visit = (type: EntityType) => {
      if (visited.has(type)) return;
      if (visiting.has(type)) {
        console.warn(`[ManagerOrchestrator] Circular dependency detected for ${type}`);
        return;
      }

      visiting.add(type);

      const registration = this.managers.get(type);
      if (registration?.dependencies) {
        for (const dep of registration.dependencies) {
          if (this.managers.has(dep)) {
            visit(dep);
          }
        }
      }

      visiting.delete(type);
      visited.add(type);
      sorted.push(type);
    };

    // Get all types sorted by render order
    const allTypes = Array.from(this.managers.entries())
      .sort((a, b) => a[1].renderOrder - b[1].renderOrder)
      .map(([type]) => type);

    // Visit each type to build dependency-respecting order
    for (const type of allTypes) {
      visit(type);
    }

    this.renderOrder = sorted;

    if (this.config.debug) {
      console.log(`[ManagerOrchestrator] Render order:`, this.renderOrder);
    }
  }

  // ===========================================================================
  // Chunk Operations
  // ===========================================================================

  /**
   * Prepare all managers for a chunk.
   *
   * Called before data starts arriving. Managers should pre-allocate
   * resources and clear any stale state.
   *
   * @param chunkKey - Chunk identifier
   * @param bounds - Geographic bounds
   */
  async prepareChunk(chunkKey: string, bounds: ChunkBounds): Promise<void> {
    if (this.processingChunks.has(chunkKey)) {
      console.warn(`[ManagerOrchestrator] Chunk ${chunkKey} is already being processed`);
      return;
    }

    this.processingChunks.add(chunkKey);

    if (this.config.debug) {
      console.log(`[ManagerOrchestrator] Preparing chunk ${chunkKey}`);
    }

    try {
      // Prepare managers in render order
      for (const entityType of this.renderOrder) {
        const registration = this.managers.get(entityType);
        if (!registration) continue;

        try {
          await registration.manager.prepareForChunk(chunkKey, bounds);
        } catch (error) {
          console.error(
            `[ManagerOrchestrator] Failed to prepare ${entityType} for chunk ${chunkKey}:`,
            error,
          );

          // If required manager fails, propagate error
          if (registration.required) {
            throw error;
          }
        }
      }
    } finally {
      this.processingChunks.delete(chunkKey);
    }
  }

  /**
   * Render all managers for a chunk.
   *
   * Called after hydration is complete. Managers should render
   * all entities in the chunk.
   *
   * @param chunkKey - Chunk identifier
   */
  async renderChunk(chunkKey: string): Promise<void> {
    if (this.config.debug) {
      console.log(`[ManagerOrchestrator] Rendering chunk ${chunkKey}`);
    }

    const startTime = Date.now();

    // Render managers in order
    for (const entityType of this.renderOrder) {
      const registration = this.managers.get(entityType);
      if (!registration) continue;

      try {
        const managerStart = Date.now();
        await registration.manager.renderChunk(chunkKey);

        if (this.config.debug) {
          console.log(
            `[ManagerOrchestrator] ${entityType} rendered in ${Date.now() - managerStart}ms`,
          );
        }
      } catch (error) {
        console.error(
          `[ManagerOrchestrator] Failed to render ${entityType} for chunk ${chunkKey}:`,
          error,
        );

        if (registration.required) {
          throw error;
        }
      }
    }

    if (this.config.debug) {
      console.log(`[ManagerOrchestrator] Total render time: ${Date.now() - startTime}ms`);
    }
  }

  /**
   * Unload all managers for a chunk.
   *
   * @param chunkKey - Chunk identifier
   */
  async unloadChunk(chunkKey: string): Promise<void> {
    if (this.config.debug) {
      console.log(`[ManagerOrchestrator] Unloading chunk ${chunkKey}`);
    }

    // Unload in reverse render order
    const reverseOrder = [...this.renderOrder].reverse();

    for (const entityType of reverseOrder) {
      const registration = this.managers.get(entityType);
      if (!registration) continue;

      try {
        await registration.manager.unloadChunk(chunkKey);
      } catch (error) {
        console.error(
          `[ManagerOrchestrator] Failed to unload ${entityType} for chunk ${chunkKey}:`,
          error,
        );
        // Continue unloading other managers even if one fails
      }
    }
  }

  // ===========================================================================
  // Prefetch Support
  // ===========================================================================

  /**
   * Prefetch a chunk in all managers that support it.
   *
   * @param chunkKey - Chunk identifier
   * @param bounds - Geographic bounds
   */
  async prefetchChunk(chunkKey: string, bounds: ChunkBounds): Promise<void> {
    const prefetchPromises: Promise<void>[] = [];

    for (const [entityType, registration] of this.managers) {
      if (isPrefetchableManager(registration.manager)) {
        prefetchPromises.push(
          registration.manager.prefetch(chunkKey, bounds).catch((error) => {
            if (this.config.debug) {
              console.warn(
                `[ManagerOrchestrator] Prefetch failed for ${entityType}/${chunkKey}:`,
                error,
              );
            }
          }),
        );
      }
    }

    await Promise.all(prefetchPromises);
  }

  /**
   * Cancel prefetch for a chunk.
   *
   * @param chunkKey - Chunk identifier
   */
  cancelPrefetch(chunkKey: string): void {
    for (const registration of this.managers.values()) {
      if (isPrefetchableManager(registration.manager)) {
        registration.manager.cancelPrefetch(chunkKey);
      }
    }
  }

  // ===========================================================================
  // Incremental Rendering
  // ===========================================================================

  /**
   * Check if any manager has pending incremental render work.
   */
  hasPendingRenderWork(): boolean {
    for (const registration of this.managers.values()) {
      if (
        isIncrementalRenderManager(registration.manager) &&
        registration.manager.hasPendingRenderWork()
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Perform incremental render work within time budget.
   *
   * @param budgetMs - Time budget in milliseconds
   * @returns True if more work remains
   */
  renderIncremental(budgetMs?: number): boolean {
    const budget = budgetMs ?? this.config.incrementalRenderBudgetMs;
    const startTime = performance.now();

    for (const registration of this.managers.values()) {
      if (!isIncrementalRenderManager(registration.manager)) continue;
      if (!registration.manager.hasPendingRenderWork()) continue;

      const elapsed = performance.now() - startTime;
      const remaining = budget - elapsed;

      if (remaining <= 0) {
        return true; // More work remains
      }

      const hasMore = registration.manager.renderIncremental(remaining);
      if (hasMore) {
        return true;
      }
    }

    return false;
  }

  // ===========================================================================
  // Entity Operations
  // ===========================================================================

  /**
   * Notify appropriate manager of entity hydration.
   *
   * @param entityId - Entity identifier
   * @param entityType - Type of entity
   * @param data - Entity data
   */
  notifyEntityHydrated(entityId: ID, entityType: EntityType, data: unknown): void {
    const registration = this.managers.get(entityType);
    if (registration) {
      registration.manager.onEntityHydrated(entityId, data);
    }
  }

  /**
   * Notify appropriate manager of entity removal.
   *
   * @param entityId - Entity identifier
   * @param entityType - Type of entity
   */
  notifyEntityRemoved(entityId: ID, entityType: EntityType): void {
    const registration = this.managers.get(entityType);
    if (registration) {
      registration.manager.onEntityRemoved(entityId);
    }
  }

  // ===========================================================================
  // Update Loop
  // ===========================================================================

  /**
   * Update all managers.
   *
   * Called every frame.
   *
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    for (const registration of this.managers.values()) {
      try {
        registration.manager.update(deltaTime);
      } catch (error) {
        console.error(
          `[ManagerOrchestrator] Update failed for ${registration.manager.entityType}:`,
          error,
        );
      }
    }
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get statistics about managed entities.
   */
  getStats(): {
    managerCount: number;
    renderOrder: EntityType[];
    entityCounts: Map<EntityType, number>;
    processingChunks: string[];
  } {
    const entityCounts = new Map<EntityType, number>();

    for (const [entityType, registration] of this.managers) {
      entityCounts.set(entityType, registration.manager.getEntityCount());
    }

    return {
      managerCount: this.managers.size,
      renderOrder: [...this.renderOrder],
      entityCounts,
      processingChunks: Array.from(this.processingChunks),
    };
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Destroy all managers.
   */
  destroy(): void {
    for (const registration of this.managers.values()) {
      try {
        registration.manager.destroy();
      } catch (error) {
        console.error(
          `[ManagerOrchestrator] Destroy failed for ${registration.manager.entityType}:`,
          error,
        );
      }
    }

    this.managers.clear();
    this.renderOrder = [];
    this.processingChunks.clear();

    if (this.config.debug) {
      console.log("[ManagerOrchestrator] Destroyed");
    }
  }
}

/**
 * Create a new ManagerOrchestrator with default configuration.
 */
export function createManagerOrchestrator(
  config: Partial<ManagerOrchestratorConfig> = {},
): ManagerOrchestrator {
  return new ManagerOrchestrator(config);
}
