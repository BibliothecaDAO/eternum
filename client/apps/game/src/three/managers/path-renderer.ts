import { Box3, Color, InstancedBufferGeometry, Mesh, Scene, Vector3 } from "three";
import { createPathInstancedGeometry, PathInstanceBuffers } from "../geometry/path-geometry";
import {
  getPathLineMaterial,
  updatePathLineMaterial,
  updatePathLineResolution,
  disposePathLineMaterial,
  updatePathLineProgress,
} from "../shaders/path-line-material";
import {
  ArmyPath,
  calculatePathLength,
  computePathBounds,
  createPathSegments,
  DEFAULT_PATH_CONFIG,
  PATH_OPACITY,
  PathDisplayState,
  PathRenderConfig,
} from "../types/path";
import { getVisibilityManager } from "../utils/centralized-visibility-manager";

/**
 * PathRenderer - Singleton manager for rendering army movement paths
 *
 * Uses instanced rendering to draw all paths with a single draw call.
 * Paths are visualized as animated dashed lines showing movement direction.
 */
export class PathRenderer {
  private static instance: PathRenderer | null = null;

  private scene: Scene | null = null;
  private mesh: Mesh | null = null;
  private buffers: PathInstanceBuffers;
  private config: PathRenderConfig;

  // Active paths indexed by entity ID
  private activePaths: Map<number, ArmyPath> = new Map();

  // Segment allocation tracking
  private nextSegmentIndex = 0;
  private freeSegmentRanges: Array<{ start: number; count: number }> = [];

  // Currently selected/highlighted path
  private selectedEntityId: number | null = null;

  // Reusable vectors to avoid allocations
  private readonly _tempVec3 = new Vector3();
  private readonly _tempColor = new Color();

  // Resize handler reference for cleanup
  private resizeHandler: (() => void) | null = null;

  // Frustum culling tracking
  private culledPaths: Set<number> = new Set();
  private lastCullFrame = 0;
  private cullCheckInterval = 3; // Check every N frames for performance

  // Compaction tracking
  private fragmentationThreshold = 0.3; // Compact when 30%+ of buffer is fragmented
  private lastCompactTime = 0;
  private compactCooldown = 5000; // Min ms between compactions

  private constructor(config: Partial<PathRenderConfig> = {}) {
    this.config = { ...DEFAULT_PATH_CONFIG, ...config };
    this.buffers = new PathInstanceBuffers(this.config.maxSegments);
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): PathRenderer {
    if (!PathRenderer.instance) {
      PathRenderer.instance = new PathRenderer();
    }
    return PathRenderer.instance;
  }

  /**
   * Initialize the renderer with a scene
   */
  public initialize(scene: Scene): void {
    if (this.scene === scene) return;

    this.scene = scene;

    // Create the instanced mesh
    const geometry = createPathInstancedGeometry(this.buffers);
    const material = getPathLineMaterial();

    // Set initial instance count to 0 to avoid drawing until we have data
    geometry.instanceCount = 0;

    this.mesh = new Mesh(geometry, material);
    this.mesh.frustumCulled = false; // We handle culling ourselves
    this.mesh.renderOrder = 10; // Render after terrain but before UI
    this.mesh.visible = false; // Hidden until we have paths

    // Don't add to scene yet - will be added when first path is created
    // this.scene.add(this.mesh);

    // Set initial resolution and add resize listener
    if (typeof window !== "undefined") {
      updatePathLineResolution(window.innerWidth, window.innerHeight);

      // Add resize listener
      this.resizeHandler = () => {
        updatePathLineResolution(window.innerWidth, window.innerHeight);
      };
      window.addEventListener("resize", this.resizeHandler);
    }
  }

  /**
   * Create a path for an army
   * @param entityId - Unique entity ID
   * @param positions - World positions along the path
   * @param color - Color for the path (from playerColorManager)
   * @param displayState - Display state affecting opacity
   */
  public createPath(
    entityId: number,
    positions: Vector3[],
    color: Color,
    displayState: PathDisplayState = "selected",
  ): void {
    // Remove existing path for this entity
    if (this.activePaths.has(entityId)) {
      this.removePath(entityId);
    }

    // Create segments from positions
    const segments = createPathSegments(positions);
    if (segments.length === 0) {
      return;
    }

    // Allocate segment slots
    const startIndex = this.allocateSegments(segments.length);
    if (startIndex === -1) {
      console.warn("[PathRenderer] No space for path segments");
      return;
    }

    // Use provided color
    const opacity = PATH_OPACITY[displayState];

    // Calculate path metrics
    const totalLength = calculatePathLength(segments);
    const boundingBox = computePathBounds(segments);

    // Create path data
    const path: ArmyPath = {
      entityId,
      segments,
      totalLength,
      displayState,
      progress: 0,
      color: color.clone(), // Clone to avoid reference issues
      boundingBox,
      startIndex,
      segmentCount: segments.length,
    };

    // Write segment data to buffers
    this.writeSegmentsToBuffers(path);

    // Store path
    this.activePaths.set(entityId, path);

    // Update instance count
    this.updateInstanceCount();
  }

  /**
   * Update path progress (for showing army position along path)
   */
  public updateProgress(entityId: number, progress: number): void {
    const path = this.activePaths.get(entityId);
    if (!path) return;

    path.progress = Math.max(0, Math.min(1, progress));

    // Update the global progress uniform for the selected path
    if (entityId === this.selectedEntityId) {
      updatePathLineProgress(path.progress);
    }
  }

  /**
   * Set the selected/highlighted path
   */
  public setSelectedPath(entityId: number | null): void {
    // Hide previous selection
    if (this.selectedEntityId !== null && this.selectedEntityId !== entityId) {
      const prevPath = this.activePaths.get(this.selectedEntityId);
      if (prevPath && prevPath.displayState === "selected") {
        this.setPathDisplayState(this.selectedEntityId, "moving");
      }
    }

    this.selectedEntityId = entityId;

    // Show new selection
    if (entityId !== null) {
      const path = this.activePaths.get(entityId);
      if (path) {
        this.setPathDisplayState(entityId, "selected");
        updatePathLineProgress(path.progress);
      }
    } else {
      updatePathLineProgress(0);
    }
  }

  /**
   * Change display state of a path (affects opacity)
   */
  public setPathDisplayState(entityId: number, state: PathDisplayState): void {
    const path = this.activePaths.get(entityId);
    if (!path) return;

    path.displayState = state;
    const opacity = PATH_OPACITY[state];

    // Update opacity in buffer
    this.buffers.setOpacityRange(path.startIndex, path.segmentCount, opacity);
    this.buffers.markOpacityNeedsUpdate();
  }

  /**
   * Remove a path
   */
  public removePath(entityId: number): void {
    const path = this.activePaths.get(entityId);
    if (!path) return;

    // Clear segment data (set opacity to 0)
    for (let i = 0; i < path.segmentCount; i++) {
      this.buffers.clearSegment(path.startIndex + i);
    }
    this.buffers.markOpacityNeedsUpdate();

    // Return segments to free pool
    this.freeSegments(path.startIndex, path.segmentCount);

    // Remove from active paths and culled set
    this.activePaths.delete(entityId);
    this.culledPaths.delete(entityId);

    // Clear selection if this was selected
    if (this.selectedEntityId === entityId) {
      this.selectedEntityId = null;
    }

    this.updateInstanceCount();

    // Auto-compact if fragmentation is high
    if (this.shouldCompact()) {
      this.compact();
    }
  }

  /**
   * Check if a path exists for an entity
   */
  public hasPath(entityId: number): boolean {
    return this.activePaths.has(entityId);
  }

  /**
   * Get path data for an entity
   */
  public getPath(entityId: number): ArmyPath | undefined {
    return this.activePaths.get(entityId);
  }

  /**
   * Update animation and frustum culling (call each frame)
   */
  public update(deltaTime: number): void {
    updatePathLineMaterial(deltaTime);

    // Perform frustum culling periodically
    this.lastCullFrame++;
    if (this.lastCullFrame >= this.cullCheckInterval) {
      this.lastCullFrame = 0;
      this.updateFrustumCulling();
    }
  }

  /**
   * Update frustum culling for all paths
   */
  private updateFrustumCulling(): void {
    if (this.activePaths.size === 0) return;

    const visibilityManager = getVisibilityManager();
    let needsUpdate = false;

    for (const [entityId, path] of this.activePaths) {
      const isVisible = visibilityManager.isBoxVisible(path.boundingBox);
      const wasCulled = this.culledPaths.has(entityId);

      if (!isVisible && !wasCulled) {
        // Path just became culled - set opacity to 0
        this.culledPaths.add(entityId);
        this.buffers.setOpacityRange(path.startIndex, path.segmentCount, 0);
        needsUpdate = true;
      } else if (isVisible && wasCulled) {
        // Path just became visible - restore opacity
        this.culledPaths.delete(entityId);
        const opacity = PATH_OPACITY[path.displayState];
        this.buffers.setOpacityRange(path.startIndex, path.segmentCount, opacity);
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      this.buffers.markOpacityNeedsUpdate();
    }
  }

  /**
   * Handle window resize
   */
  public onResize(width: number, height: number): void {
    updatePathLineResolution(width, height);
  }

  /**
   * Clear all paths
   */
  public clearAll(): void {
    for (const entityId of this.activePaths.keys()) {
      this.removePath(entityId);
    }
    this.nextSegmentIndex = 0;
    this.freeSegmentRanges = [];
    this.culledPaths.clear();
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.clearAll();

    // Remove resize listener
    if (this.resizeHandler && typeof window !== "undefined") {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }

    if (this.mesh) {
      if (this.mesh.parent) {
        this.mesh.parent.remove(this.mesh);
      }
      this.mesh.geometry.dispose();
      this.mesh = null;
    }

    disposePathLineMaterial();
    this.buffers.dispose();
    this.scene = null;

    PathRenderer.instance = null;
  }

  // === Private Methods ===

  /**
   * Allocate segment slots, returns start index or -1 if no space
   */
  private allocateSegments(count: number): number {
    // First, try to find a free range that fits
    for (let i = 0; i < this.freeSegmentRanges.length; i++) {
      const range = this.freeSegmentRanges[i];
      if (range.count >= count) {
        const startIndex = range.start;

        if (range.count === count) {
          // Exact fit, remove range
          this.freeSegmentRanges.splice(i, 1);
        } else {
          // Partial fit, shrink range
          range.start += count;
          range.count -= count;
        }

        return startIndex;
      }
    }

    // No free range found, allocate from end
    if (this.nextSegmentIndex + count <= this.config.maxSegments) {
      const startIndex = this.nextSegmentIndex;
      this.nextSegmentIndex += count;
      return startIndex;
    }

    // No space available
    return -1;
  }

  /**
   * Return segment slots to free pool with adjacent range merging
   */
  private freeSegments(startIndex: number, count: number): void {
    const newRange = { start: startIndex, count };

    // Try to merge with existing ranges
    let merged = false;
    for (let i = 0; i < this.freeSegmentRanges.length; i++) {
      const range = this.freeSegmentRanges[i];

      // Check if new range is immediately before this range
      if (newRange.start + newRange.count === range.start) {
        range.start = newRange.start;
        range.count += newRange.count;
        merged = true;
        this.tryMergeRanges(i);
        break;
      }

      // Check if new range is immediately after this range
      if (range.start + range.count === newRange.start) {
        range.count += newRange.count;
        merged = true;
        this.tryMergeRanges(i);
        break;
      }
    }

    if (!merged) {
      this.freeSegmentRanges.push(newRange);
    }

    // Sort ranges by start index for better allocation
    this.freeSegmentRanges.sort((a, b) => a.start - b.start);
  }

  /**
   * Try to merge a range with its neighbors
   */
  private tryMergeRanges(index: number): void {
    if (index >= this.freeSegmentRanges.length) return;

    const range = this.freeSegmentRanges[index];

    // Try merge with next range
    if (index + 1 < this.freeSegmentRanges.length) {
      const next = this.freeSegmentRanges[index + 1];
      if (range.start + range.count === next.start) {
        range.count += next.count;
        this.freeSegmentRanges.splice(index + 1, 1);
      }
    }

    // Try merge with previous range
    if (index > 0) {
      const prev = this.freeSegmentRanges[index - 1];
      if (prev.start + prev.count === range.start) {
        prev.count += range.count;
        this.freeSegmentRanges.splice(index, 1);
      }
    }
  }

  /**
   * Compact the buffer by moving all paths to eliminate fragmentation
   */
  public compact(): void {
    const now = performance.now();
    if (now - this.lastCompactTime < this.compactCooldown) {
      return; // Respect cooldown
    }

    if (this.activePaths.size === 0) {
      this.nextSegmentIndex = 0;
      this.freeSegmentRanges = [];
      return;
    }

    // Collect all paths and sort by current start index
    const paths = Array.from(this.activePaths.values()).sort((a, b) => a.startIndex - b.startIndex);

    // Rewrite all paths contiguously
    let newIndex = 0;
    for (const path of paths) {
      if (path.startIndex !== newIndex) {
        // Move this path's data
        path.startIndex = newIndex;
        this.writeSegmentsToBuffers(path);
      }
      newIndex += path.segmentCount;
    }

    // Reset allocation tracking
    this.nextSegmentIndex = newIndex;
    this.freeSegmentRanges = [];
    this.lastCompactTime = now;

    // Update instance count
    this.updateInstanceCount();
  }

  /**
   * Check if compaction is needed based on fragmentation
   */
  public shouldCompact(): boolean {
    if (this.activePaths.size === 0) return false;

    const totalFreeSegments = this.freeSegmentRanges.reduce((sum, r) => sum + r.count, 0);
    const usedSegments = this.nextSegmentIndex - totalFreeSegments;

    if (usedSegments === 0) return false;

    const fragmentation = totalFreeSegments / this.nextSegmentIndex;
    return fragmentation > this.fragmentationThreshold;
  }

  /**
   * Write path segment data to instance buffers
   */
  private writeSegmentsToBuffers(path: ArmyPath): void {
    const { segments, startIndex, color, displayState, totalLength } = path;
    const opacity = PATH_OPACITY[displayState];

    let cumulativeLength = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const bufferIndex = startIndex + i;

      // Calculate cumulative progress (0-1 along full path)
      const progressStart = cumulativeLength / totalLength;
      cumulativeLength += segment.length;

      this.buffers.setSegment(
        bufferIndex,
        segment.start.x,
        segment.start.y + 0.3, // Slight Y offset to render above terrain
        segment.start.z,
        segment.end.x,
        segment.end.y + 0.3,
        segment.end.z,
        segment.length,
        progressStart,
        color.r,
        color.g,
        color.b,
        opacity,
      );
    }

    this.buffers.markNeedsUpdate();
  }

  /**
   * Update the instance count on the geometry
   */
  private updateInstanceCount(): void {
    if (!this.mesh) return;

    // Count active segments (use highest index + 1, not sum)
    let maxIndex = 0;
    for (const path of this.activePaths.values()) {
      const pathEnd = path.startIndex + path.segmentCount;
      if (pathEnd > maxIndex) {
        maxIndex = pathEnd;
      }
    }

    // Update buffer count
    this.buffers.setCount(maxIndex);

    // Set instance count on geometry - this is critical for rendering!
    const geometry = this.mesh.geometry as InstancedBufferGeometry;
    geometry.instanceCount = maxIndex;

    // Add to scene when we have paths, remove when empty
    if (maxIndex > 0) {
      this.mesh.visible = true;
      if (this.scene && !this.mesh.parent) {
        this.scene.add(this.mesh);
      }
    } else {
      this.mesh.visible = false;
      if (this.mesh.parent) {
        this.mesh.parent.remove(this.mesh);
      }
    }
  }

  /**
   * Debug: Get stats about path rendering
   */
  public getStats(): {
    activePaths: number;
    visiblePaths: number;
    culledPaths: number;
    totalSegments: number;
    allocatedSegments: number;
    freeSegments: number;
    maxSegments: number;
    fragmentation: number;
    freeRanges: number;
    selectedEntityId: number | null;
    memoryUsageKB: number;
  } {
    let totalSegments = 0;
    for (const path of this.activePaths.values()) {
      totalSegments += path.segmentCount;
    }

    const freeSegments = this.freeSegmentRanges.reduce((sum, r) => sum + r.count, 0);
    const allocatedSegments = this.nextSegmentIndex;
    const fragmentation = allocatedSegments > 0 ? freeSegments / allocatedSegments : 0;

    // Estimate memory usage (128 bytes per segment as per design)
    const memoryUsageKB = (allocatedSegments * 128) / 1024;

    return {
      activePaths: this.activePaths.size,
      visiblePaths: this.activePaths.size - this.culledPaths.size,
      culledPaths: this.culledPaths.size,
      totalSegments,
      allocatedSegments,
      freeSegments,
      maxSegments: this.config.maxSegments,
      fragmentation: Math.round(fragmentation * 100) / 100,
      freeRanges: this.freeSegmentRanges.length,
      selectedEntityId: this.selectedEntityId,
      memoryUsageKB: Math.round(memoryUsageKB),
    };
  }
}

// Export singleton accessor
export const pathRenderer = PathRenderer.getInstance();
