/**
 * Chunk Integration
 *
 * High-level integration module that wires up the chunk lifecycle system
 * with existing managers. This provides a simple facade for WorldmapScene
 * to use without needing to understand the internal complexity.
 *
 * Key responsibilities:
 * - Create and configure all chunk system components
 * - Wire up existing managers via adapters
 * - Connect data fetch functions to Torii
 * - Expose simple API for scene integration
 */

import { HexPosition, ID } from "@bibliothecadao/types";
import { ToriiClient } from "@dojoengine/torii-client";
import { Component, Metadata, Schema } from "@dojoengine/recs";
import { ArmyManager } from "../managers/army-manager";
import { StructureManager } from "../managers/structure-manager";
import { ChestManager } from "../managers/chest-manager";
import { QuestManager } from "../managers/quest-manager";
import {
  ChunkLifecycleController,
  createChunkLifecycleController,
  ChunkLifecycleControllerConfig,
} from "./chunk-lifecycle-controller";
import { EntityType, ChunkPriority, ChunkBounds } from "./types";
import { createStructureManagerAdapter, createArmyManagerAdapter } from "./adapters";

/**
 * Configuration for chunk integration.
 */
export interface ChunkIntegrationConfig {
  /** Torii client for data fetching */
  toriiClient: ToriiClient;

  /** Dojo contract components */
  contractComponents: Component<Schema, Metadata, undefined>[];

  /** Known structure positions for data fetching */
  structurePositions: Map<ID, HexPosition>;

  /** Chunk size in hex units */
  chunkSize?: number;

  /** Render chunk size */
  renderChunkSize?: {
    width: number;
    height: number;
  };

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Chunk integration result with all wired components.
 */
export interface ChunkIntegration {
  /** The main chunk lifecycle controller */
  controller: ChunkLifecycleController;

  /**
   * Switch to a new chunk.
   * This is the primary API for chunk transitions.
   *
   * @param chunkKey - The chunk to switch to (format: "row,col")
   * @returns Promise that resolves when the chunk is fully loaded and rendered
   */
  switchToChunk(chunkKey: string): Promise<void>;

  /**
   * Notify that an entity has been hydrated.
   * Call this from WorldUpdateListener callbacks.
   *
   * @param entityId - The hydrated entity ID
   * @param entityType - The type of entity
   * @param chunkKey - Optional chunk key (auto-detected if not provided)
   */
  notifyEntityHydrated(entityId: ID, entityType: EntityType, chunkKey?: string): void;

  /**
   * Notify that an entity has been removed.
   *
   * @param entityId - The removed entity ID
   * @param entityType - The type of entity
   */
  notifyEntityRemoved(entityId: ID, entityType: EntityType): void;

  /**
   * Update structure positions for data fetching.
   *
   * @param positions - Map of entity IDs to hex positions
   */
  updateStructurePositions(positions: Map<ID, HexPosition>): void;

  /**
   * Get statistics about the chunk system.
   */
  getStats(): {
    activeChunk: string | null;
    totalChunks: number;
    spatialEntities: number;
    hydrationPending: boolean;
  };

  /**
   * Clean up and destroy all resources.
   */
  destroy(): void;
}

/**
 * Create a chunk integration instance.
 *
 * This wires up all the chunk system components and provides
 * a simple API for WorldmapScene to use.
 *
 * @example
 * ```typescript
 * const integration = createChunkIntegration({
 *   toriiClient,
 *   contractComponents,
 *   structurePositions,
 *   debug: true,
 * });
 *
 * // Register managers
 * integration.registerManagers({
 *   structureManager,
 *   armyManager,
 * });
 *
 * // Switch to a chunk (awaited!)
 * await integration.switchToChunk("170,190");
 *
 * // Notify when entities are hydrated
 * integration.notifyEntityHydrated(entityId, EntityType.Structure);
 * ```
 */
export function createChunkIntegration(
  config: ChunkIntegrationConfig,
  managers: {
    structureManager: StructureManager;
    armyManager: ArmyManager;
    questManager?: QuestManager;
    chestManager?: ChestManager;
  },
): ChunkIntegration {
  const debug = config.debug ?? false;

  // Create the controller with configuration
  const controllerConfig: Partial<ChunkLifecycleControllerConfig> = {
    chunkSize: config.chunkSize ?? 30,
    renderChunkSize: config.renderChunkSize ?? { width: 60, height: 44 },
    debug,
  };

  const controller = createChunkLifecycleController(controllerConfig);

  // Create and register manager adapters
  const structureAdapter = createStructureManagerAdapter(managers.structureManager, { debug });
  const armyAdapter = createArmyManagerAdapter(managers.armyManager, { debug });

  controller.orchestrator.registerManager(structureAdapter, { renderOrder: 10 });
  controller.orchestrator.registerManager(armyAdapter, { renderOrder: 20 });

  // Store structure positions for data fetching
  controller.fetchCoordinator.setStructurePositions(config.structurePositions);

  // Wire up the fetch function
  //
  // HYBRID APPROACH: The actual Torii fetching is still done by existing code
  // (refreshStructuresForChunks, computeTileEntities) in WorldmapScene.
  // This fetch function registers expectations for hydration tracking.
  //
  // The flow is:
  // 1. WorldmapScene calls refreshStructuresForChunks (triggers Torii fetch)
  // 2. Torii data arrives and WorldUpdateListener callbacks fire
  // 3. Callbacks call notifyEntityHydrated which increments hydration count
  // 4. When all expected entities arrive, hydration completes
  // 5. Rendering proceeds
  //
  controller.fetchCoordinator.setFetchFunction(async (bounds: ChunkBounds, structurePositions: Map<ID, HexPosition>) => {
    if (debug) {
      console.log(`[ChunkIntegration] Fetch coordination for bounds:`, bounds);
      console.log(`[ChunkIntegration] Expected structures in bounds:`, structurePositions.size);
    }

    // Count expected entities based on known positions
    const expectedStructureCount = structurePositions.size;

    // Register expectations so hydration tracking knows what to wait for
    // This enables the waitForHydration to know when we're "done"
    if (expectedStructureCount > 0) {
      controller.hydrationRegistry.expectEntities(
        `${bounds.minRow},${bounds.minCol}`,
        EntityType.Structure,
        expectedStructureCount,
      );
    }

    // Return empty data - actual fetching is triggered separately by WorldmapScene
    // The data will flow through WorldUpdateListener -> notifyEntityHydrated
    return {
      tiles: [],
      structures: [],
      armies: [],
      quests: [],
      chests: [],
    };
  });

  // Create the integration API
  const integration: ChunkIntegration = {
    controller,

    async switchToChunk(chunkKey: string): Promise<void> {
      if (debug) {
        console.log(`[ChunkIntegration] Switching to chunk ${chunkKey}`);
      }

      // Use the controller's switchToChunk which handles:
      // 1. State transition (IDLE -> FETCHING -> HYDRATING -> RENDERING -> ACTIVE)
      // 2. Waiting for hydration
      // 3. Rendering after hydration completes
      await controller.switchToChunk(chunkKey);

      if (debug) {
        console.log(`[ChunkIntegration] Chunk ${chunkKey} is now active`);
      }
    },

    notifyEntityHydrated(entityId: ID, entityType: EntityType, chunkKey?: string): void {
      if (debug) {
        console.log(`[ChunkIntegration] Entity hydrated: ${entityId} (${entityType})`);
      }

      controller.notifyEntityHydrated(entityId, entityType, chunkKey);
    },

    notifyEntityRemoved(entityId: ID, entityType: EntityType): void {
      if (debug) {
        console.log(`[ChunkIntegration] Entity removed: ${entityId} (${entityType})`);
      }

      controller.notifyEntityRemoved(entityId, entityType);
    },

    updateStructurePositions(positions: Map<ID, HexPosition>): void {
      controller.fetchCoordinator.setStructurePositions(positions);
    },

    getStats() {
      const stateStats = controller.stateManager.getStats();
      const spatialStats = controller.spatialIndex.getStats();

      return {
        activeChunk: stateStats.activeChunk,
        totalChunks: stateStats.totalChunks,
        spatialEntities: spatialStats.totalEntities,
        hydrationPending: controller.hydrationRegistry.hasPendingChunks(),
      };
    },

    destroy(): void {
      if (debug) {
        console.log(`[ChunkIntegration] Destroying integration`);
      }

      controller.destroy();
    },
  };

  return integration;
}

/**
 * Helper to determine entity type from update source.
 */
export function getEntityTypeFromSource(source: string): EntityType | null {
  switch (source) {
    case "tile":
    case "structure":
      return EntityType.Structure;
    case "army":
    case "explorerTroops":
      return EntityType.Army;
    case "quest":
      return EntityType.Quest;
    case "chest":
      return EntityType.Chest;
    default:
      return null;
  }
}

/**
 * Create a callback wrapper that notifies the chunk system of hydration.
 *
 * Use this to wrap WorldUpdateListener callbacks.
 *
 * @example
 * ```typescript
 * worldUpdateListener.Structure.onTileUpdate(
 *   withHydrationNotification(integration, EntityType.Structure, async (update) => {
 *     await structureManager.onUpdate(update);
 *   })
 * );
 * ```
 */
export function withHydrationNotification<T extends { entityId: ID }>(
  integration: ChunkIntegration,
  entityType: EntityType,
  callback: (update: T) => void | Promise<void>,
): (update: T) => Promise<void> {
  return async (update: T) => {
    // Call the original callback
    await callback(update);

    // Notify the chunk system that this entity was hydrated
    integration.notifyEntityHydrated(update.entityId, entityType);
  };
}
