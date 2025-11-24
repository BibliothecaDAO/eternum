/**
 * Unified Spatial Index
 *
 * A single spatial index shared across all entity managers.
 * Uses bucket-based spatial hashing for O(1) lookups of entities
 * within a given region.
 *
 * This replaces the individual spatial indexes that each manager
 * previously maintained, reducing memory usage and ensuring consistency.
 */

import { ID } from "@bibliothecadao/types";
import {
  ChunkBounds,
  EntityType,
  SpatialEntry,
  SpatialIndexConfig,
  SpatialIndexStats,
  createChunkKey,
} from "./types";

/**
 * Internal bucket structure.
 * Each bucket contains entities grouped by type.
 */
interface Bucket {
  /** Entities by type in this bucket */
  byType: Map<EntityType, Set<ID>>;
  /** Total entity count in bucket */
  count: number;
}

/**
 * Unified spatial index for all entity types.
 *
 * Provides efficient spatial queries for entities based on their
 * hex coordinates. Uses a bucket-based approach where the world
 * is divided into fixed-size buckets for O(1) region queries.
 *
 * @example
 * ```typescript
 * const index = new UnifiedSpatialIndex({ bucketSize: 15 });
 *
 * // Add entities
 * index.addEntity(123, EntityType.Structure, 10, 20);
 * index.addEntity(456, EntityType.Army, 12, 22);
 *
 * // Query entities in bounds
 * const structures = index.getEntitiesInBounds(bounds, EntityType.Structure);
 *
 * // Query all entities in a chunk
 * const allInChunk = index.getEntitiesInChunk("0,0");
 * ```
 */
export class UnifiedSpatialIndex {
  /** Spatial buckets keyed by "bucketX,bucketY" */
  private buckets: Map<string, Bucket> = new Map();

  /** Entity positions and metadata */
  private entities: Map<ID, SpatialEntry> = new Map();

  /** Entity counts by type */
  private typeCounts: Map<EntityType, number> = new Map();

  /** Size of each bucket in hex units */
  private readonly bucketSize: number;

  /** Chunk size for chunk key calculations */
  private chunkWidth: number = 60;
  private chunkHeight: number = 44;

  constructor(config: SpatialIndexConfig) {
    this.bucketSize = config.bucketSize;

    // Initialize type counts
    for (const type of Object.values(EntityType)) {
      this.typeCounts.set(type as EntityType, 0);
    }
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Set the chunk dimensions for chunk key calculations.
   */
  setChunkDimensions(width: number, height: number): void {
    this.chunkWidth = width;
    this.chunkHeight = height;
  }

  // ===========================================================================
  // Indexing Operations
  // ===========================================================================

  /**
   * Add an entity to the spatial index.
   *
   * @param entityId - Unique entity identifier
   * @param type - Entity type
   * @param col - Hex column coordinate
   * @param row - Hex row coordinate
   */
  addEntity(entityId: ID, type: EntityType, col: number, row: number): void {
    // Remove existing entry if present (handles moves)
    if (this.entities.has(entityId)) {
      this.removeEntity(entityId);
    }

    // Calculate bucket key
    const bucketKey = this.getBucketKey(col, row);

    // Calculate chunk key
    const chunkKey = this.getChunkKeyForPosition(col, row);

    // Create entry
    const entry: SpatialEntry = {
      entityId,
      entityType: type,
      col,
      row,
      chunkKey,
    };

    // Store in entity map
    this.entities.set(entityId, entry);

    // Add to bucket
    let bucket = this.buckets.get(bucketKey);
    if (!bucket) {
      bucket = { byType: new Map(), count: 0 };
      this.buckets.set(bucketKey, bucket);
    }

    let typeSet = bucket.byType.get(type);
    if (!typeSet) {
      typeSet = new Set();
      bucket.byType.set(type, typeSet);
    }

    typeSet.add(entityId);
    bucket.count++;

    // Update type count
    this.typeCounts.set(type, (this.typeCounts.get(type) || 0) + 1);
  }

  /**
   * Update an entity's position in the index.
   *
   * @param entityId - Entity to update
   * @param col - New hex column
   * @param row - New hex row
   */
  updateEntity(entityId: ID, col: number, row: number): void {
    const entry = this.entities.get(entityId);
    if (!entry) {
      console.warn(`[SpatialIndex] Cannot update unknown entity: ${entityId}`);
      return;
    }

    // Check if bucket changed
    const oldBucketKey = this.getBucketKey(entry.col, entry.row);
    const newBucketKey = this.getBucketKey(col, row);

    if (oldBucketKey !== newBucketKey) {
      // Remove from old bucket
      const oldBucket = this.buckets.get(oldBucketKey);
      if (oldBucket) {
        const typeSet = oldBucket.byType.get(entry.entityType);
        if (typeSet) {
          typeSet.delete(entityId);
          if (typeSet.size === 0) {
            oldBucket.byType.delete(entry.entityType);
          }
        }
        oldBucket.count--;

        // Clean up empty bucket
        if (oldBucket.count === 0) {
          this.buckets.delete(oldBucketKey);
        }
      }

      // Add to new bucket
      let newBucket = this.buckets.get(newBucketKey);
      if (!newBucket) {
        newBucket = { byType: new Map(), count: 0 };
        this.buckets.set(newBucketKey, newBucket);
      }

      let typeSet = newBucket.byType.get(entry.entityType);
      if (!typeSet) {
        typeSet = new Set();
        newBucket.byType.set(entry.entityType, typeSet);
      }

      typeSet.add(entityId);
      newBucket.count++;
    }

    // Update entry
    entry.col = col;
    entry.row = row;
    entry.chunkKey = this.getChunkKeyForPosition(col, row);
  }

  /**
   * Remove an entity from the spatial index.
   *
   * @param entityId - Entity to remove
   */
  removeEntity(entityId: ID): void {
    const entry = this.entities.get(entityId);
    if (!entry) {
      return;
    }

    // Remove from bucket
    const bucketKey = this.getBucketKey(entry.col, entry.row);
    const bucket = this.buckets.get(bucketKey);

    if (bucket) {
      const typeSet = bucket.byType.get(entry.entityType);
      if (typeSet) {
        typeSet.delete(entityId);
        if (typeSet.size === 0) {
          bucket.byType.delete(entry.entityType);
        }
      }
      bucket.count--;

      // Clean up empty bucket
      if (bucket.count === 0) {
        this.buckets.delete(bucketKey);
      }
    }

    // Update type count
    const currentCount = this.typeCounts.get(entry.entityType) || 0;
    this.typeCounts.set(entry.entityType, Math.max(0, currentCount - 1));

    // Remove from entity map
    this.entities.delete(entityId);
  }

  // ===========================================================================
  // Query Operations
  // ===========================================================================

  /**
   * Get all entities within the specified bounds.
   *
   * @param bounds - Area to query
   * @param type - Optional entity type filter
   * @returns Array of entity IDs within bounds
   */
  getEntitiesInBounds(bounds: ChunkBounds, type?: EntityType): ID[] {
    const result: ID[] = [];
    const seen = new Set<ID>();

    // Calculate bucket range
    const minBucketX = Math.floor(bounds.minCol / this.bucketSize);
    const maxBucketX = Math.floor(bounds.maxCol / this.bucketSize);
    const minBucketY = Math.floor(bounds.minRow / this.bucketSize);
    const maxBucketY = Math.floor(bounds.maxRow / this.bucketSize);

    // Iterate over all buckets that might contain entities in bounds
    for (let bx = minBucketX; bx <= maxBucketX; bx++) {
      for (let by = minBucketY; by <= maxBucketY; by++) {
        const bucketKey = `${bx},${by}`;
        const bucket = this.buckets.get(bucketKey);

        if (!bucket) continue;

        if (type !== undefined) {
          // Filter by type
          const typeSet = bucket.byType.get(type);
          if (typeSet) {
            for (const entityId of typeSet) {
              if (seen.has(entityId)) continue;

              const entry = this.entities.get(entityId);
              if (entry && this.isInBounds(entry.col, entry.row, bounds)) {
                result.push(entityId);
                seen.add(entityId);
              }
            }
          }
        } else {
          // All types
          for (const typeSet of bucket.byType.values()) {
            for (const entityId of typeSet) {
              if (seen.has(entityId)) continue;

              const entry = this.entities.get(entityId);
              if (entry && this.isInBounds(entry.col, entry.row, bounds)) {
                result.push(entityId);
                seen.add(entityId);
              }
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Get all entities in a specific chunk.
   *
   * @param chunkKey - Chunk identifier
   * @param type - Optional entity type filter
   * @returns Array of entity IDs in the chunk
   */
  getEntitiesInChunk(chunkKey: string, type?: EntityType): ID[] {
    const result: ID[] = [];

    // Iterate through all entities (could be optimized with chunk->entity index)
    for (const [entityId, entry] of this.entities) {
      if (entry.chunkKey === chunkKey) {
        if (type === undefined || entry.entityType === type) {
          result.push(entityId);
        }
      }
    }

    return result;
  }

  /**
   * Get the position of an entity.
   *
   * @param entityId - Entity to look up
   * @returns Position or undefined
   */
  getEntityPosition(entityId: ID): { col: number; row: number } | undefined {
    const entry = this.entities.get(entityId);
    if (!entry) return undefined;
    return { col: entry.col, row: entry.row };
  }

  /**
   * Get full entry data for an entity.
   *
   * @param entityId - Entity to look up
   * @returns Full spatial entry or undefined
   */
  getEntity(entityId: ID): SpatialEntry | undefined {
    return this.entities.get(entityId);
  }

  /**
   * Check if an entity exists in the index.
   *
   * @param entityId - Entity to check
   */
  hasEntity(entityId: ID): boolean {
    return this.entities.has(entityId);
  }

  /**
   * Get the chunk key for a position.
   *
   * @param col - Hex column
   * @param row - Hex row
   */
  getChunkKeyForPosition(col: number, row: number): string {
    const chunkCol = Math.floor(col / this.chunkWidth) * this.chunkWidth;
    const chunkRow = Math.floor(row / this.chunkHeight) * this.chunkHeight;
    return createChunkKey(chunkRow, chunkCol);
  }

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  /**
   * Remove all entities of a specific type.
   *
   * @param type - Entity type to remove
   */
  removeAllOfType(type: EntityType): void {
    const toRemove: ID[] = [];

    for (const [entityId, entry] of this.entities) {
      if (entry.entityType === type) {
        toRemove.push(entityId);
      }
    }

    for (const entityId of toRemove) {
      this.removeEntity(entityId);
    }
  }

  /**
   * Remove all entities in a chunk.
   *
   * @param chunkKey - Chunk to clear
   */
  removeChunk(chunkKey: string): void {
    const toRemove: ID[] = [];

    for (const [entityId, entry] of this.entities) {
      if (entry.chunkKey === chunkKey) {
        toRemove.push(entityId);
      }
    }

    for (const entityId of toRemove) {
      this.removeEntity(entityId);
    }
  }

  /**
   * Clear all entities from the index.
   */
  clear(): void {
    this.buckets.clear();
    this.entities.clear();

    for (const type of Object.values(EntityType)) {
      this.typeCounts.set(type as EntityType, 0);
    }
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get statistics about the spatial index.
   */
  getStats(): SpatialIndexStats {
    let maxEntitiesPerBucket = 0;
    let totalBucketEntities = 0;

    for (const bucket of this.buckets.values()) {
      totalBucketEntities += bucket.count;
      if (bucket.count > maxEntitiesPerBucket) {
        maxEntitiesPerBucket = bucket.count;
      }
    }

    const bucketCount = this.buckets.size;
    const avgEntitiesPerBucket = bucketCount > 0 ? totalBucketEntities / bucketCount : 0;

    // Estimate memory usage
    // Each entity: ~100 bytes (ID, type, coords, chunk key, bucket membership)
    // Each bucket: ~50 bytes base + entries
    const estimatedMemoryBytes = this.entities.size * 100 + this.buckets.size * 50;

    return {
      totalEntities: this.entities.size,
      bucketCount,
      avgEntitiesPerBucket,
      maxEntitiesPerBucket,
      byType: new Map(this.typeCounts),
      estimatedMemoryBytes,
    };
  }

  /**
   * Get the total entity count.
   */
  getTotalCount(): number {
    return this.entities.size;
  }

  /**
   * Get entity count for a specific type.
   */
  getCountByType(type: EntityType): number {
    return this.typeCounts.get(type) || 0;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Get the bucket key for a position.
   */
  private getBucketKey(col: number, row: number): string {
    const bucketX = Math.floor(col / this.bucketSize);
    const bucketY = Math.floor(row / this.bucketSize);
    return `${bucketX},${bucketY}`;
  }

  /**
   * Check if a position is within bounds.
   */
  private isInBounds(col: number, row: number, bounds: ChunkBounds): boolean {
    return col >= bounds.minCol && col < bounds.maxCol && row >= bounds.minRow && row < bounds.maxRow;
  }
}

/**
 * Create a new UnifiedSpatialIndex with default configuration.
 */
export function createSpatialIndex(bucketSize: number = 15): UnifiedSpatialIndex {
  return new UnifiedSpatialIndex({ bucketSize });
}
