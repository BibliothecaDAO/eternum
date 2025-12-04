/**
 * Chunk System Types
 *
 * Core type definitions for the chunk lifecycle management system.
 * This module defines all interfaces, enums, and types used across
 * the chunk loading architecture.
 */

import { ID, HexPosition } from "@bibliothecadao/types";

// ============================================================================
// Enums
// ============================================================================

/**
 * Lifecycle phases for a chunk.
 * Chunks transition through these phases in a deterministic order.
 */
export enum ChunkLifecyclePhase {
  /** Chunk is not loaded and has no pending operations */
  IDLE = "idle",

  /** Chunk is being prefetched (low priority, speculative load) */
  PREFETCHING = "prefetching",

  /** Chunk data is being fetched from Torii */
  FETCHING = "fetching",

  /** Waiting for entity data to hydrate into managers */
  HYDRATING = "hydrating",

  /** Managers are rendering the chunk's entities */
  RENDERING = "rendering",

  /** Chunk is fully loaded and visible */
  ACTIVE = "active",

  /** Chunk is being unloaded */
  UNLOADING = "unloading",

  /** Chunk encountered an error during loading */
  ERROR = "error",
}

/**
 * Entity types managed by the chunk system.
 * Each type has its own manager and rendering pipeline.
 */
export enum EntityType {
  Biome = "biome",
  Structure = "structure",
  Army = "army",
  Quest = "quest",
  Chest = "chest",
}

/**
 * Priority levels for chunk operations.
 */
export enum ChunkPriority {
  /** Critical - current camera chunk */
  CRITICAL = 0,

  /** High - adjacent chunks */
  HIGH = 1,

  /** Normal - nearby chunks */
  NORMAL = 2,

  /** Low - prefetch candidates */
  LOW = 3,
}

// ============================================================================
// Chunk Types
// ============================================================================

/**
 * Bounds defining a rectangular chunk region in hex coordinates.
 */
export interface ChunkBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

/**
 * Complete state of a chunk in the lifecycle system.
 */
export interface ChunkState {
  /** Unique identifier for this chunk (format: "row,col") */
  chunkKey: string;

  /** Current lifecycle phase */
  phase: ChunkLifecyclePhase;

  /** Geographic bounds of this chunk */
  bounds: ChunkBounds;

  /** Timestamp when chunk entered current phase */
  phaseStartTime: number;

  /** Timestamp of the most recent phase transition */
  lastTransitionTime: number;

  /** Priority level for this chunk */
  priority: ChunkPriority;

  /** Error if chunk is in ERROR phase */
  error?: Error;

  /** Expected entity counts by type (set during FETCHING) */
  expectedEntities: Map<EntityType, number>;

  /** Entity IDs that have been hydrated, by type */
  hydratedEntities: Map<EntityType, Set<ID>>;

  /** Whether rendering has completed */
  isRendered: boolean;

  /** Time taken to render (set after RENDERING completes) */
  renderDuration?: number;

  /** Total time from FETCHING start to ACTIVE */
  totalLoadDuration?: number;
}

/**
 * Metrics for a chunk's loading performance.
 */
export interface ChunkMetrics {
  chunkKey: string;
  fetchStartTime: number;
  fetchEndTime?: number;
  hydrationStartTime?: number;
  hydrationEndTime?: number;
  renderStartTime?: number;
  renderEndTime?: number;
  totalDuration?: number;
  entityCounts: Map<EntityType, number>;
}

// ============================================================================
// Hydration Types
// ============================================================================

/**
 * Result of waiting for chunk hydration.
 */
export interface HydrationResult {
  /** Whether all expected entities were hydrated */
  success: boolean;

  /** Whether the wait timed out */
  timedOut: boolean;

  /** Current progress at completion/timeout */
  progress: HydrationProgress;

  /** Total time spent waiting */
  duration: number;

  /** Chunk key this result is for */
  chunkKey: string;
}

/**
 * Progress information for chunk hydration.
 */
export interface HydrationProgress {
  /** Total expected entities across all types */
  total: number;

  /** Total hydrated entities across all types */
  hydrated: number;

  /** Completion percentage (0-100) */
  percentage: number;

  /** Breakdown by entity type */
  byType: Map<EntityType, EntityTypeProgress>;
}

/**
 * Progress for a single entity type.
 */
export interface EntityTypeProgress {
  expected: number;
  received: number;
  percentage: number;
}

/**
 * Expectation registration for hydration tracking.
 */
export interface HydrationExpectation {
  chunkKey: string;
  entityType: EntityType;
  entityIds?: Set<ID>;
  count: number;
  registeredAt: number;
}

// ============================================================================
// Spatial Index Types
// ============================================================================

/**
 * Entry in the spatial index.
 */
export interface SpatialEntry {
  entityId: ID;
  entityType: EntityType;
  col: number;
  row: number;
  chunkKey: string;
}

/**
 * Statistics about the spatial index.
 */
export interface SpatialIndexStats {
  /** Total entities in the index */
  totalEntities: number;

  /** Number of spatial buckets */
  bucketCount: number;

  /** Average entities per bucket */
  avgEntitiesPerBucket: number;

  /** Max entities in any single bucket */
  maxEntitiesPerBucket: number;

  /** Entity counts by type */
  byType: Map<EntityType, number>;

  /** Memory estimate in bytes */
  estimatedMemoryBytes: number;
}

/**
 * Configuration for the spatial index.
 */
export interface SpatialIndexConfig {
  /** Size of each spatial bucket (in hex units) */
  bucketSize: number;

  /** Initial capacity hint for entity maps */
  initialCapacity?: number;
}

// ============================================================================
// Data Types
// ============================================================================

/**
 * Raw chunk data returned from fetch operations.
 */
export interface ChunkData {
  chunkKey: string;
  bounds: ChunkBounds;
  fetchTime: number;

  /** Tile data for biomes */
  tiles: TileData[];

  /** Structure data */
  structures: StructureData[];

  /** Army data */
  armies: ArmyData[];

  /** Quest data */
  quests: QuestData[];

  /** Chest data */
  chests: ChestData[];
}

/**
 * Tile/biome data.
 */
export interface TileData {
  col: number;
  row: number;
  biome: number;
  explored: boolean;
}

/**
 * Structure data from fetch.
 */
export interface StructureData {
  entityId: ID;
  hexCoords: HexPosition;
  structureType: number;
  owner?: bigint;
  ownerName?: string;
  level?: number;
  stage?: number;
}

/**
 * Army data from fetch.
 */
export interface ArmyData {
  entityId: ID;
  hexCoords: HexPosition;
  ownerAddress?: bigint;
  ownerName?: string;
  troopType?: number;
  troopTier?: number;
  troopCount?: number;
}

/**
 * Quest data from fetch.
 */
export interface QuestData {
  entityId: ID;
  hexCoords: HexPosition;
  questType?: number;
}

/**
 * Chest data from fetch.
 */
export interface ChestData {
  entityId: ID;
  hexCoords: HexPosition;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Events emitted by the chunk lifecycle system.
 */
export interface ChunkLifecycleEvents {
  /** Chunk transitioned to a new phase */
  "chunk:phase-change": {
    chunkKey: string;
    from: ChunkLifecyclePhase;
    to: ChunkLifecyclePhase;
    duration: number;
  };

  /** Chunk became active and visible */
  "chunk:activated": {
    chunkKey: string;
    totalDuration: number;
    entityCounts: Map<EntityType, number>;
  };

  /** Chunk was deactivated/unloaded */
  "chunk:deactivated": {
    chunkKey: string;
  };

  /** Chunk loading failed */
  "chunk:error": {
    chunkKey: string;
    error: Error;
    phase: ChunkLifecyclePhase;
  };

  /** Hydration progress update */
  "chunk:hydration-progress": {
    chunkKey: string;
    progress: HydrationProgress;
  };

  /** Prefetch operation started */
  "prefetch:started": {
    chunkKeys: string[];
  };

  /** Prefetch operation completed */
  "prefetch:completed": {
    chunkKeys: string[];
    duration: number;
    successCount: number;
  };
}

/**
 * Event handler type for chunk lifecycle events.
 */
export type ChunkEventHandler<K extends keyof ChunkLifecycleEvents> = (
  event: ChunkLifecycleEvents[K],
) => void;

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for the chunk lifecycle controller.
 */
export interface ChunkLifecycleConfig {
  /** Size of data chunks (hex units) */
  chunkSize: number;

  /** Size of render chunks (hex units) */
  renderChunkSize: {
    width: number;
    height: number;
  };

  /** Default timeout for hydration (ms) */
  hydrationTimeoutMs: number;

  /** Default timeout for fetch operations (ms) */
  fetchTimeoutMs: number;

  /** Maximum chunks to keep in cache */
  maxCachedChunks: number;

  /** Maximum concurrent prefetch operations */
  maxConcurrentPrefetch: number;

  /** Enable debug logging */
  debug: boolean;

  /** Spatial index bucket size */
  spatialBucketSize: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_CHUNK_CONFIG: ChunkLifecycleConfig = {
  chunkSize: 30,
  renderChunkSize: { width: 60, height: 44 },
  hydrationTimeoutMs: 5000,
  fetchTimeoutMs: 10000,
  maxCachedChunks: 16,
  maxConcurrentPrefetch: 3,
  debug: false,
  spatialBucketSize: 15,
};

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Valid phase transitions.
 * Maps each phase to the phases it can transition to.
 */
export const VALID_PHASE_TRANSITIONS: Record<ChunkLifecyclePhase, ChunkLifecyclePhase[]> = {
  [ChunkLifecyclePhase.IDLE]: [ChunkLifecyclePhase.PREFETCHING, ChunkLifecyclePhase.FETCHING],
  [ChunkLifecyclePhase.PREFETCHING]: [
    ChunkLifecyclePhase.FETCHING,
    ChunkLifecyclePhase.IDLE,
    ChunkLifecyclePhase.ERROR,
  ],
  [ChunkLifecyclePhase.FETCHING]: [
    ChunkLifecyclePhase.HYDRATING,
    ChunkLifecyclePhase.ERROR,
    ChunkLifecyclePhase.IDLE,
  ],
  [ChunkLifecyclePhase.HYDRATING]: [
    ChunkLifecyclePhase.RENDERING,
    ChunkLifecyclePhase.ERROR,
    ChunkLifecyclePhase.IDLE,
  ],
  [ChunkLifecyclePhase.RENDERING]: [
    ChunkLifecyclePhase.ACTIVE,
    ChunkLifecyclePhase.ERROR,
    ChunkLifecyclePhase.IDLE,
  ],
  [ChunkLifecyclePhase.ACTIVE]: [ChunkLifecyclePhase.UNLOADING, ChunkLifecyclePhase.RENDERING],
  [ChunkLifecyclePhase.UNLOADING]: [ChunkLifecyclePhase.IDLE],
  [ChunkLifecyclePhase.ERROR]: [ChunkLifecyclePhase.IDLE, ChunkLifecyclePhase.FETCHING],
};

/**
 * Check if a phase transition is valid.
 */
export function isValidTransition(from: ChunkLifecyclePhase, to: ChunkLifecyclePhase): boolean {
  return VALID_PHASE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Create a chunk key from row and column.
 */
export function createChunkKey(startRow: number, startCol: number): string {
  return `${startRow},${startCol}`;
}

/**
 * Parse a chunk key into row and column.
 */
export function parseChunkKey(chunkKey: string): { startRow: number; startCol: number } {
  const [startRow, startCol] = chunkKey.split(",").map(Number);
  return { startRow, startCol };
}

/**
 * Calculate bounds for a chunk.
 */
export function calculateChunkBounds(
  startRow: number,
  startCol: number,
  width: number,
  height: number,
): ChunkBounds {
  return {
    minCol: startCol,
    maxCol: startCol + width,
    minRow: startRow,
    maxRow: startRow + height,
  };
}

/**
 * Check if a position is within bounds.
 */
export function isInBounds(col: number, row: number, bounds: ChunkBounds): boolean {
  return col >= bounds.minCol && col < bounds.maxCol && row >= bounds.minRow && row < bounds.maxRow;
}

/**
 * Create an empty chunk state.
 */
export function createEmptyChunkState(chunkKey: string, bounds: ChunkBounds): ChunkState {
  const now = Date.now();
  return {
    chunkKey,
    phase: ChunkLifecyclePhase.IDLE,
    bounds,
    phaseStartTime: now,
    lastTransitionTime: now,
    priority: ChunkPriority.NORMAL,
    expectedEntities: new Map(),
    hydratedEntities: new Map(),
    isRendered: false,
  };
}

/**
 * Create empty hydration progress.
 */
export function createEmptyHydrationProgress(): HydrationProgress {
  return {
    total: 0,
    hydrated: 0,
    percentage: 100,
    byType: new Map(),
  };
}
