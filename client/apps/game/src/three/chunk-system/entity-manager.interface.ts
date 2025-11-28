/**
 * Entity Manager Interface
 *
 * Defines the contract that all entity managers must implement
 * to participate in the chunk lifecycle system.
 */

import { ID } from "@bibliothecadao/types";
import { ChunkBounds, EntityType } from "./types";

/**
 * Base interface for all entity managers.
 *
 * Entity managers are responsible for:
 * - Storing entity data
 * - Rendering entities in the Three.js scene
 * - Responding to chunk lifecycle events
 * - Notifying the hydration registry when entities are loaded
 *
 * @example
 * ```typescript
 * class StructureManager implements EntityManager {
 *   readonly entityType = EntityType.Structure;
 *
 *   async prepareForChunk(chunkKey: string, bounds: ChunkBounds) {
 *     // Pre-allocate resources
 *   }
 *
 *   async renderChunk(chunkKey: string) {
 *     // Render all structures in this chunk
 *   }
 *   // ...
 * }
 * ```
 */
export interface EntityManager {
  /**
   * The type of entities this manager handles.
   * Used for routing hydration notifications and coordinating render order.
   */
  readonly entityType: EntityType;

  // ===========================================================================
  // Lifecycle Methods
  // ===========================================================================

  /**
   * Prepare the manager for a chunk that is about to be loaded.
   *
   * Called during the FETCHING phase, before data arrives.
   * Use this to pre-allocate buffers, clear stale state, etc.
   *
   * @param chunkKey - The chunk identifier (format: "row,col")
   * @param bounds - Geographic bounds of the chunk
   */
  prepareForChunk(chunkKey: string, bounds: ChunkBounds): Promise<void>;

  /**
   * Render all entities for a chunk.
   *
   * Called during the RENDERING phase, after hydration is complete.
   * All entity data should be available in the manager at this point.
   *
   * @param chunkKey - The chunk identifier
   */
  renderChunk(chunkKey: string): Promise<void>;

  /**
   * Unload a chunk and clean up its resources.
   *
   * Called during the UNLOADING phase when a chunk is being removed.
   * Should remove entities from the scene and free memory.
   *
   * @param chunkKey - The chunk identifier
   */
  unloadChunk(chunkKey: string): Promise<void>;

  // ===========================================================================
  // Data Hydration Methods
  // ===========================================================================

  /**
   * Called when an entity's data has been received from Torii.
   *
   * This is invoked by the WorldUpdateListener callbacks.
   * The manager should:
   * 1. Store the entity data
   * 2. Update spatial indexes
   * 3. Call hydrationRegistry.notifyEntityHydrated()
   *
   * @param entityId - The entity's unique identifier
   * @param data - The entity data (type depends on manager)
   */
  onEntityHydrated(entityId: ID, data: unknown): void;

  /**
   * Called when an entity has been removed or destroyed.
   *
   * @param entityId - The entity's unique identifier
   */
  onEntityRemoved(entityId: ID): void;

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Get all entity IDs in a specific chunk.
   *
   * @param chunkKey - The chunk identifier
   * @returns Array of entity IDs in the chunk
   */
  getEntitiesInChunk(chunkKey: string): ID[];

  /**
   * Check if the manager has data for an entity.
   *
   * @param entityId - The entity's unique identifier
   * @returns True if the entity exists in this manager
   */
  hasEntity(entityId: ID): boolean;

  /**
   * Get the total number of entities managed.
   */
  getEntityCount(): number;

  // ===========================================================================
  // Update Methods
  // ===========================================================================

  /**
   * Called every frame to update animations, effects, etc.
   *
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void;

  // ===========================================================================
  // Cleanup Methods
  // ===========================================================================

  /**
   * Destroy the manager and release all resources.
   *
   * Called when the scene is being destroyed.
   */
  destroy(): void;
}

/**
 * Optional interface for managers that support incremental rendering.
 *
 * Incremental rendering allows spreading render work across multiple frames
 * to avoid frame drops during chunk transitions.
 */
export interface IncrementalRenderManager extends EntityManager {
  /**
   * Check if there's pending render work.
   */
  hasPendingRenderWork(): boolean;

  /**
   * Perform a portion of render work within a time budget.
   *
   * @param budgetMs - Maximum time to spend (in milliseconds)
   * @returns True if more work remains
   */
  renderIncremental(budgetMs: number): boolean;
}

/**
 * Optional interface for managers that support prefetching.
 *
 * Prefetching allows managers to prepare resources before a chunk
 * becomes the active chunk.
 */
export interface PrefetchableManager extends EntityManager {
  /**
   * Prefetch resources for a chunk that may become active soon.
   *
   * This is called with lower priority than regular chunk loading.
   * Should not block or cause frame drops.
   *
   * @param chunkKey - The chunk identifier
   * @param bounds - Geographic bounds of the chunk
   */
  prefetch(chunkKey: string, bounds: ChunkBounds): Promise<void>;

  /**
   * Cancel a pending prefetch operation.
   *
   * @param chunkKey - The chunk identifier
   */
  cancelPrefetch(chunkKey: string): void;
}

/**
 * Optional interface for managers that maintain a spatial index.
 *
 * Managers implementing this can share their spatial data with
 * the unified spatial index.
 */
export interface SpatiallyIndexedManager extends EntityManager {
  /**
   * Get the position of an entity.
   *
   * @param entityId - The entity's unique identifier
   * @returns Position or undefined if entity not found
   */
  getEntityPosition(entityId: ID): { col: number; row: number } | undefined;

  /**
   * Get all entities within bounds.
   *
   * @param bounds - The area to query
   * @returns Array of entity IDs within bounds
   */
  getEntitiesInBounds(bounds: ChunkBounds): ID[];
}

/**
 * Type guard to check if a manager supports incremental rendering.
 */
export function isIncrementalRenderManager(manager: EntityManager): manager is IncrementalRenderManager {
  return "hasPendingRenderWork" in manager && "renderIncremental" in manager;
}

/**
 * Type guard to check if a manager supports prefetching.
 */
export function isPrefetchableManager(manager: EntityManager): manager is PrefetchableManager {
  return "prefetch" in manager && "cancelPrefetch" in manager;
}

/**
 * Type guard to check if a manager is spatially indexed.
 */
export function isSpatiallyIndexedManager(manager: EntityManager): manager is SpatiallyIndexedManager {
  return "getEntityPosition" in manager && "getEntitiesInBounds" in manager;
}

/**
 * Configuration for manager registration.
 */
export interface ManagerRegistration {
  /** The manager instance */
  manager: EntityManager;

  /** Render order priority (lower = rendered first) */
  renderOrder: number;

  /** Whether this manager is required for chunk activation */
  required: boolean;

  /** Dependencies on other entity types (must be rendered first) */
  dependencies?: EntityType[];
}

/**
 * Default render order for entity types.
 * Lower numbers are rendered first.
 */
export const DEFAULT_RENDER_ORDER: Record<EntityType, number> = {
  [EntityType.Biome]: 0, // Terrain first
  [EntityType.Structure]: 10, // Buildings
  [EntityType.Army]: 20, // Units
  [EntityType.Quest]: 30, // Quest markers
  [EntityType.Chest]: 40, // Chests
};
