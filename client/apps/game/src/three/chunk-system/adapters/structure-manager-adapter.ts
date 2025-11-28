/**
 * Structure Manager Adapter
 *
 * Adapts the existing StructureManager to implement the EntityManager interface,
 * enabling integration with the new chunk lifecycle system.
 */

import { ID } from "@bibliothecadao/types";
import { StructureManager } from "../../managers/structure-manager";
import { EntityManager } from "../entity-manager.interface";
import { ChunkBounds, EntityType } from "../types";

/**
 * Adapter that wraps StructureManager to implement EntityManager interface.
 *
 * This adapter bridges the existing StructureManager implementation with
 * the new chunk lifecycle system without requiring major refactoring.
 *
 * @example
 * ```typescript
 * const adapter = new StructureManagerAdapter(structureManager);
 * orchestrator.registerManager(adapter, { renderOrder: 10 });
 * ```
 */
export class StructureManagerAdapter implements EntityManager {
  readonly entityType = EntityType.Structure;

  /** Reference to the wrapped StructureManager */
  private manager: StructureManager;

  /** Track which chunks have been prepared */
  private preparedChunks: Set<string> = new Set();

  /** Track entity IDs by chunk for cleanup */
  private chunkEntities: Map<string, Set<ID>> = new Map();

  /** Enable debug logging */
  private debug: boolean;

  constructor(manager: StructureManager, options: { debug?: boolean } = {}) {
    this.manager = manager;
    this.debug = options.debug ?? false;
  }

  // ===========================================================================
  // EntityManager Interface Implementation
  // ===========================================================================

  /**
   * Prepare for a new chunk.
   *
   * This is called before data starts arriving. We clear any stale state
   * and prepare to receive new entities.
   */
  async prepareForChunk(chunkKey: string, _bounds: ChunkBounds): Promise<void> {
    if (this.debug) {
      console.log(`[StructureManagerAdapter] Preparing for chunk ${chunkKey}`);
    }

    this.preparedChunks.add(chunkKey);

    // Initialize entity tracking for this chunk
    if (!this.chunkEntities.has(chunkKey)) {
      this.chunkEntities.set(chunkKey, new Set());
    }
  }

  /**
   * Render the chunk.
   *
   * Called after hydration is complete. We trigger the StructureManager
   * to update its visible structures for this chunk.
   */
  async renderChunk(chunkKey: string): Promise<void> {
    if (this.debug) {
      console.log(`[StructureManagerAdapter] Rendering chunk ${chunkKey}`);
    }

    // Delegate to the existing updateChunk method which handles rendering
    await this.manager.updateChunk(chunkKey, { force: true });
  }

  /**
   * Unload a chunk.
   *
   * Clean up any resources associated with this chunk.
   */
  async unloadChunk(chunkKey: string): Promise<void> {
    if (this.debug) {
      console.log(`[StructureManagerAdapter] Unloading chunk ${chunkKey}`);
    }

    this.preparedChunks.delete(chunkKey);
    this.chunkEntities.delete(chunkKey);

    // The StructureManager handles its own cleanup when chunks change
    // We don't need to explicitly remove structures as they're managed
    // by the chunk visibility system
  }

  /**
   * Handle entity hydration notification.
   *
   * Called when an entity has been hydrated (data received from Torii).
   * We track the entity for the current chunk.
   */
  onEntityHydrated(entityId: ID, data: unknown): void {
    if (this.debug) {
      console.log(`[StructureManagerAdapter] Entity ${entityId} hydrated`);
    }

    // Find which prepared chunk this entity belongs to
    // For now, we'll track it in all prepared chunks (the manager handles visibility)
    for (const [chunkKey, entities] of this.chunkEntities) {
      if (this.preparedChunks.has(chunkKey)) {
        entities.add(entityId);
      }
    }

    // The actual structure data is handled by WorldUpdateListener
    // which calls structureManager.onUpdate() directly
    // This is just for tracking purposes
  }

  /**
   * Handle entity removal notification.
   *
   * Called when an entity is removed from the system.
   */
  onEntityRemoved(entityId: ID): void {
    if (this.debug) {
      console.log(`[StructureManagerAdapter] Entity ${entityId} removed`);
    }

    // Remove from all chunk tracking
    for (const entities of this.chunkEntities.values()) {
      entities.delete(entityId);
    }

    // The actual removal is handled by the StructureManager directly
  }

  /**
   * Get entities in a specific chunk.
   */
  getEntitiesInChunk(chunkKey: string): ID[] {
    const entities = this.chunkEntities.get(chunkKey);
    return entities ? Array.from(entities) : [];
  }

  /**
   * Check if an entity exists in the manager.
   */
  hasEntity(entityId: ID): boolean {
    // Check if structure exists in any chunk
    for (const entities of this.chunkEntities.values()) {
      if (entities.has(entityId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get total entity count.
   */
  getEntityCount(): number {
    return this.manager.getTotalStructures();
  }

  /**
   * Update method called every frame.
   *
   * Structures don't need per-frame updates from the adapter -
   * the StructureManager handles its own animation updates.
   */
  update(_deltaTime: number): void {
    // No-op - StructureManager handles its own updates
  }

  /**
   * Destroy the adapter.
   *
   * Clean up any resources. The underlying StructureManager
   * should be destroyed separately by its owner.
   */
  destroy(): void {
    this.preparedChunks.clear();
    this.chunkEntities.clear();
  }

  // ===========================================================================
  // Additional Methods
  // ===========================================================================

  /**
   * Get the underlying StructureManager.
   *
   * This allows direct access when needed for operations
   * not covered by the EntityManager interface.
   */
  getManager(): StructureManager {
    return this.manager;
  }

  /**
   * Check if a chunk is currently prepared.
   */
  isChunkPrepared(chunkKey: string): boolean {
    return this.preparedChunks.has(chunkKey);
  }
}

/**
 * Create a new StructureManagerAdapter.
 */
export function createStructureManagerAdapter(
  manager: StructureManager,
  options: { debug?: boolean } = {},
): StructureManagerAdapter {
  return new StructureManagerAdapter(manager, options);
}
