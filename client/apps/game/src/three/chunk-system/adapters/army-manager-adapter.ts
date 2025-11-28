/**
 * Army Manager Adapter
 *
 * Adapts the existing ArmyManager to implement the EntityManager interface,
 * enabling integration with the new chunk lifecycle system.
 */

import { ID } from "@bibliothecadao/types";
import { ArmyManager } from "../../managers/army-manager";
import { EntityManager } from "../entity-manager.interface";
import { ChunkBounds, EntityType } from "../types";

/**
 * Adapter that wraps ArmyManager to implement EntityManager interface.
 *
 * This adapter bridges the existing ArmyManager implementation with
 * the new chunk lifecycle system without requiring major refactoring.
 *
 * @example
 * ```typescript
 * const adapter = new ArmyManagerAdapter(armyManager);
 * orchestrator.registerManager(adapter, { renderOrder: 20 });
 * ```
 */
export class ArmyManagerAdapter implements EntityManager {
  readonly entityType = EntityType.Army;

  /** Reference to the wrapped ArmyManager */
  private manager: ArmyManager;

  /** Track which chunks have been prepared */
  private preparedChunks: Set<string> = new Set();

  /** Track entity IDs by chunk for cleanup */
  private chunkEntities: Map<string, Set<ID>> = new Map();

  /** Enable debug logging */
  private debug: boolean;

  constructor(manager: ArmyManager, options: { debug?: boolean } = {}) {
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
      console.log(`[ArmyManagerAdapter] Preparing for chunk ${chunkKey}`);
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
   * Called after hydration is complete. We trigger the ArmyManager
   * to update its visible armies for this chunk.
   */
  async renderChunk(chunkKey: string): Promise<void> {
    if (this.debug) {
      console.log(`[ArmyManagerAdapter] Rendering chunk ${chunkKey}`);
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
      console.log(`[ArmyManagerAdapter] Unloading chunk ${chunkKey}`);
    }

    this.preparedChunks.delete(chunkKey);
    this.chunkEntities.delete(chunkKey);

    // The ArmyManager handles its own cleanup when chunks change
  }

  /**
   * Handle entity hydration notification.
   *
   * Called when an entity has been hydrated (data received from Torii).
   */
  onEntityHydrated(entityId: ID, _data: unknown): void {
    if (this.debug) {
      console.log(`[ArmyManagerAdapter] Entity ${entityId} hydrated`);
    }

    // Find which prepared chunk this entity belongs to
    for (const [chunkKey, entities] of this.chunkEntities) {
      if (this.preparedChunks.has(chunkKey)) {
        entities.add(entityId);
      }
    }

    // The actual army data is handled by WorldUpdateListener
    // which calls armyManager.onTileUpdate() directly
  }

  /**
   * Handle entity removal notification.
   */
  onEntityRemoved(entityId: ID): void {
    if (this.debug) {
      console.log(`[ArmyManagerAdapter] Entity ${entityId} removed`);
    }

    // Remove from all chunk tracking
    for (const entities of this.chunkEntities.values()) {
      entities.delete(entityId);
    }
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
    return this.manager.hasArmy(entityId);
  }

  /**
   * Get total entity count.
   */
  getEntityCount(): number {
    return this.manager.getArmies().length;
  }

  /**
   * Update method called every frame.
   *
   * Armies need per-frame updates for movement and animations,
   * but this is handled by the ArmyManager directly.
   */
  update(_deltaTime: number): void {
    // No-op - ArmyManager handles its own updates
  }

  /**
   * Destroy the adapter.
   */
  destroy(): void {
    this.preparedChunks.clear();
    this.chunkEntities.clear();
  }

  // ===========================================================================
  // Additional Methods
  // ===========================================================================

  /**
   * Get the underlying ArmyManager.
   */
  getManager(): ArmyManager {
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
 * Create a new ArmyManagerAdapter.
 */
export function createArmyManagerAdapter(
  manager: ArmyManager,
  options: { debug?: boolean } = {},
): ArmyManagerAdapter {
  return new ArmyManagerAdapter(manager, options);
}
