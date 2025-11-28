/**
 * Chunk System
 *
 * A deterministic chunk lifecycle management system for the Three.js world.
 *
 * This module provides:
 * - ChunkLifecyclePhase enum and state management types
 * - EntityManager interface for chunk-aware managers
 * - UnifiedSpatialIndex for efficient spatial queries
 * - EntityHydrationRegistry for tracking data loading
 *
 * @example
 * ```typescript
 * import {
 *   UnifiedSpatialIndex,
 *   EntityHydrationRegistry,
 *   EntityType,
 *   ChunkLifecyclePhase,
 * } from "@/three/chunk-system";
 *
 * // Create spatial index
 * const spatialIndex = new UnifiedSpatialIndex({ bucketSize: 15 });
 *
 * // Create hydration registry
 * const hydrationRegistry = new EntityHydrationRegistry({ debug: true });
 *
 * // Register expectations before fetching
 * hydrationRegistry.expectEntities("0,0", EntityType.Structure, 5);
 *
 * // Wait for hydration
 * const result = await hydrationRegistry.waitForHydration("0,0", 5000);
 * ```
 */

// Types
export {
  // Enums
  ChunkLifecyclePhase,
  EntityType,
  ChunkPriority,
  // Chunk types
  type ChunkBounds,
  type ChunkState,
  type ChunkMetrics,
  type ChunkData,
  // Hydration types
  type HydrationResult,
  type HydrationProgress,
  type EntityTypeProgress,
  type HydrationExpectation,
  // Spatial types
  type SpatialEntry,
  type SpatialIndexStats,
  type SpatialIndexConfig,
  // Data types
  type TileData,
  type StructureData,
  type ArmyData,
  type QuestData,
  type ChestData,
  // Event types
  type ChunkLifecycleEvents,
  type ChunkEventHandler,
  // Config types
  type ChunkLifecycleConfig,
  DEFAULT_CHUNK_CONFIG,
  // Utilities
  VALID_PHASE_TRANSITIONS,
  isValidTransition,
  createChunkKey,
  parseChunkKey,
  calculateChunkBounds,
  isInBounds,
  createEmptyChunkState,
  createEmptyHydrationProgress,
} from "./types";

// Entity Manager Interface
export {
  type EntityManager,
  type IncrementalRenderManager,
  type PrefetchableManager,
  type SpatiallyIndexedManager,
  type ManagerRegistration,
  isIncrementalRenderManager,
  isPrefetchableManager,
  isSpatiallyIndexedManager,
  DEFAULT_RENDER_ORDER,
} from "./entity-manager.interface";

// Unified Spatial Index
export { UnifiedSpatialIndex, createSpatialIndex } from "./unified-spatial-index";

// Entity Hydration Registry
export {
  EntityHydrationRegistry,
  createHydrationRegistry,
  type HydrationProgressCallback,
} from "./entity-hydration-registry";

// Chunk State Manager
export {
  ChunkStateManager,
  createChunkStateManager,
  type ChunkStateManagerConfig,
} from "./chunk-state-manager";

// Data Fetch Coordinator
export {
  DataFetchCoordinator,
  createDataFetchCoordinator,
  type DataFetchCoordinatorConfig,
  type ChunkFetchFunction,
  type ToriiClientLike,
} from "./data-fetch-coordinator";

// Manager Orchestrator
export {
  ManagerOrchestrator,
  createManagerOrchestrator,
  type ManagerOrchestratorConfig,
} from "./manager-orchestrator";

// Chunk Lifecycle Controller (Main Entry Point)
export {
  ChunkLifecycleController,
  createChunkLifecycleController,
  type ChunkLifecycleControllerConfig,
} from "./chunk-lifecycle-controller";

// Manager Adapters
export {
  StructureManagerAdapter,
  createStructureManagerAdapter,
  ArmyManagerAdapter,
  createArmyManagerAdapter,
} from "./adapters";

// Chunk Integration (High-Level API)
export {
  createChunkIntegration,
  getEntityTypeFromSource,
  withHydrationNotification,
  type ChunkIntegration,
  type ChunkIntegrationConfig,
} from "./chunk-integration";
