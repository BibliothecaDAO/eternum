import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

interface AcquireResult {
  label: CSS2DObject;
  isNew: boolean;
}

/**
 * Configuration for the enhanced label pool
 */
interface LabelPoolConfig {
  /** Initial pool size for pre-allocation */
  initialSize?: number;
  /** Maximum pool size to prevent unbounded growth */
  maxSize?: number;
  /** Enable batched DOM operations (call flushBatch() after render) */
  enableBatching?: boolean;
}

const DEFAULT_CONFIG: Required<LabelPoolConfig> = {
  initialSize: 100,
  maxSize: 500,
  enableBatching: true,
};

/**
 * Enhanced pool for CSS2DObject labels with batched DOM operations and pre-allocation.
 *
 * Key optimizations:
 * 1. Pre-allocates labels to reduce GC during gameplay
 * 2. Batches DOM removal operations to minimize layout thrashing
 * 3. Reuses DOM elements by hiding them instead of removing from DOM immediately
 * 4. Defers actual DOM cleanup to flushBatch() call after render
 *
 * Usage:
 * - Call acquire() to get a label
 * - Call release() to return a label (deferred cleanup)
 * - Call flushBatch() once per frame after rendering to process pending DOM operations
 */
export class LabelPool {
  private pool: CSS2DObject[] = [];
  private pooled = new Set<CSS2DObject>();
  private config: Required<LabelPoolConfig>;

  // Batched operations
  private pendingReleases: CSS2DObject[] = [];
  private pendingParentRemovals: Array<{ label: CSS2DObject; parent: THREE.Object3D }> = [];

  // Pre-allocated but not yet configured labels
  private preAllocated: CSS2DObject[] = [];

  // Statistics for debugging
  private stats = {
    totalAcquires: 0,
    poolHits: 0,
    preAllocHits: 0,
    newCreations: 0,
    totalReleases: 0,
    batchedReleases: 0,
  };

  constructor(config: LabelPoolConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Pre-allocate labels with a factory function.
   * Call this during initialization to avoid allocations during gameplay.
   */
  preAllocate(factory: () => CSS2DObject, count?: number): void {
    const targetCount = count ?? this.config.initialSize;
    const toCreate = Math.min(targetCount, this.config.maxSize) - this.pool.length - this.preAllocated.length;

    for (let i = 0; i < toCreate; i++) {
      const label = factory();
      label.visible = false;
      // Hide the element but keep it light-weight
      label.element.style.display = "none";
      this.preAllocated.push(label);
    }
  }

  /**
   * Acquire a label from the pool.
   * Priority: 1) Recycled pool, 2) Pre-allocated, 3) New creation
   */
  acquire(factory: () => CSS2DObject): AcquireResult {
    this.stats.totalAcquires++;

    // First, try to get from recycled pool (already configured labels)
    const existing = this.pool.pop();
    if (existing) {
      this.pooled.delete(existing);
      existing.visible = true;
      existing.element.style.display = "";
      this.stats.poolHits++;
      return { label: existing, isNew: false };
    }

    // Second, try pre-allocated pool
    const preAlloc = this.preAllocated.pop();
    if (preAlloc) {
      // Pre-allocated labels need to be configured by the factory
      // But we can reuse the CSS2DObject shell
      preAlloc.visible = true;
      preAlloc.element.style.display = "";
      this.stats.preAllocHits++;
      // Note: The caller's factory won't be used for pre-allocated labels
      // This is intentional - the element will be reconfigured on acquire
      return { label: preAlloc, isNew: true };
    }

    // Finally, create new
    const created = factory();
    created.visible = true;
    this.stats.newCreations++;
    return { label: created, isNew: true };
  }

  /**
   * Release a label back to the pool.
   * With batching enabled, DOM operations are deferred to flushBatch().
   */
  release(label: CSS2DObject): void {
    if (this.pooled.has(label)) {
      return; // already pooled
    }

    this.stats.totalReleases++;

    // Immediately hide the label to prevent visual artifacts
    label.visible = false;
    label.element.style.display = "none";

    if (this.config.enableBatching) {
      // Defer DOM operations
      this.stats.batchedReleases++;

      // Track parent for deferred removal
      if (label.parent) {
        this.pendingParentRemovals.push({ label, parent: label.parent });
      }

      this.pendingReleases.push(label);
    } else {
      // Immediate cleanup (legacy behavior)
      this.performImmediateRelease(label);
    }

    // Check pool size limit
    if (this.pool.length + this.pendingReleases.length < this.config.maxSize) {
      if (!this.config.enableBatching) {
        this.pool.push(label);
        this.pooled.add(label);
      }
    }
  }

  /**
   * Flush all pending batched operations.
   * Call this once per frame, after rendering, to minimize layout thrashing.
   */
  flushBatch(): void {
    if (!this.config.enableBatching || this.pendingReleases.length === 0) {
      return;
    }

    // Batch all Three.js parent removals
    for (const { label, parent } of this.pendingParentRemovals) {
      if (label.parent === parent) {
        parent.remove(label);
      }
    }
    this.pendingParentRemovals.length = 0;

    // Batch all DOM element removals and pool additions
    // Using requestAnimationFrame would be ideal but we're called after render
    // so we do it synchronously but all at once
    for (const label of this.pendingReleases) {
      const element = label.element;
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }

      // Add to pool if under limit
      if (this.pool.length < this.config.maxSize) {
        this.pool.push(label);
        this.pooled.add(label);
      }
    }

    this.pendingReleases.length = 0;
  }

  /**
   * Release multiple labels at once (more efficient than individual releases).
   */
  releaseMany(labels: CSS2DObject[]): void {
    for (const label of labels) {
      this.release(label);
    }
  }

  /**
   * Immediate release without batching (legacy behavior).
   */
  private performImmediateRelease(label: CSS2DObject): void {
    if (label.parent) {
      label.parent.remove(label);
    }

    const element = label.element;
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  /**
   * Clear all labels from the pool.
   */
  clear(): void {
    // Flush any pending operations first
    this.flushBatch();

    // Clear pooled labels
    this.pool.forEach((label) => {
      if (label.parent) {
        label.parent.remove(label);
      }
      const element = label.element;
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    this.pool.length = 0;
    this.pooled.clear();

    // Clear pre-allocated labels
    this.preAllocated.forEach((label) => {
      const element = label.element;
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    this.preAllocated.length = 0;
  }

  /**
   * Get current pool size.
   */
  size(): number {
    return this.pool.length;
  }

  /**
   * Get total available labels (pool + pre-allocated).
   */
  availableCount(): number {
    return this.pool.length + this.preAllocated.length;
  }

  /**
   * Get pending release count (for debugging).
   */
  pendingCount(): number {
    return this.pendingReleases.length;
  }

  /**
   * Get pool statistics for debugging/monitoring.
   */
  getStats(): typeof this.stats & { poolSize: number; preAllocSize: number; pendingSize: number } {
    return {
      ...this.stats,
      poolSize: this.pool.length,
      preAllocSize: this.preAllocated.length,
      pendingSize: this.pendingReleases.length,
    };
  }

  /**
   * Reset statistics.
   */
  resetStats(): void {
    this.stats = {
      totalAcquires: 0,
      poolHits: 0,
      preAllocHits: 0,
      newCreations: 0,
      totalReleases: 0,
      batchedReleases: 0,
    };
  }
}
