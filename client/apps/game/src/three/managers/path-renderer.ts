import {
  Box3,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Scene,
  Vector3,
} from "three";
import {
  incrementWorldmapRenderCounter,
  recordWorldmapRenderDuration,
  setWorldmapRenderGauge,
} from "../perf/worldmap-render-diagnostics";
import type { CentralizedVisibilityManager } from "../utils/centralized-visibility-manager";
import {
  ArmyPath,
  calculatePathLength,
  computePathBounds,
  createPathSegments,
  DEFAULT_PATH_CONFIG,
  PathDisplayState,
  PathRenderConfig,
} from "../types/path";
import { resolvePathReadabilityPolicy } from "../scenes/path-readability-policy";
import { resolvePathBatches } from "./path-batching-policy";

interface PathBatchObject {
  boundingBox: Box3;
  entityIds: Set<number>;
  line: LineSegments;
}

/**
 * PathRenderer - scene-owned manager for rendering army movement paths
 *
 * Phase 3 simplification: use stock line materials so experimental WebGPU
 * scenes no longer depend on custom path shaders while the higher-fidelity
 * material rewrite is still pending.
 */
export class PathRenderer {
  private scene: Scene | null = null;
  private mesh: Group | null = null;
  private readonly batchObjects: PathBatchObject[] = [];
  private config: PathRenderConfig;

  // Active paths indexed by entity ID
  private activePaths: Map<number, ArmyPath> = new Map();

  // Currently selected/highlighted path
  private selectedEntityId: number | null = null;

  // Frustum culling tracking
  private culledPaths: Set<number> = new Set();
  private lastCullFrame = 0;
  private cullCheckInterval = 3; // Check every N frames for performance
  private visibilityManager?: Pick<CentralizedVisibilityManager, "isBoxVisible">;

  private isDisposed = false;

  // Dirty-flag deferred rebuild: coalesce multiple state changes into a single
  // rebuildPathBatches call on the next animation frame.
  private _batchesDirty = false;
  private _rebuildFrameHandle: number | null = null;

  constructor(config: Partial<PathRenderConfig> = {}) {
    this.config = { ...DEFAULT_PATH_CONFIG, ...config };
  }

  /**
   * Initialize the renderer with a scene
   */
  public initialize(scene: Scene): void {
    if (this.scene === scene && this.mesh) return;

    if (this.scene && this.scene !== scene) {
      throw new Error("[PathRenderer] Each instance can only be bound to one scene");
    }

    this.scene = scene;

    if (!this.mesh) {
      this.mesh = new Group();
      this.mesh.visible = false;
    }

    if (!this.mesh.parent) {
      this.scene.add(this.mesh);
    }
  }

  public setVisibilityManager(visibilityManager?: Pick<CentralizedVisibilityManager, "isBoxVisible">): void {
    this.visibilityManager = visibilityManager;
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
    const createStartedAt = performance.now();

    if (this.activePaths.has(entityId)) {
      this.removePath(entityId);
    }

    const segments = createPathSegments(positions);
    if (segments.length === 0) {
      return;
    }

    const path: ArmyPath = {
      entityId,
      segments,
      totalLength: calculatePathLength(segments),
      displayState,
      progress: 0,
      color: color.clone(),
      boundingBox: computePathBounds(segments),
      startIndex: 0,
      segmentCount: segments.length,
    };

    this.activePaths.set(entityId, path);
    this.culledPaths.delete(entityId);
    this.markBatchesDirty();

    incrementWorldmapRenderCounter("pathCreateCalls");
    recordWorldmapRenderDuration("createPath", performance.now() - createStartedAt);
    setWorldmapRenderGauge("activePaths", this.activePaths.size);
  }

  /**
   * Update path progress (for showing army position along path)
   */
  public updateProgress(entityId: number, progress: number): void {
    const path = this.activePaths.get(entityId);
    if (!path) return;

    path.progress = Math.max(0, Math.min(1, progress));
  }

  /**
   * Set the selected/highlighted path
   */
  public setSelectedPath(entityId: number | null): void {
    if (this.selectedEntityId !== null && this.selectedEntityId !== entityId) {
      const prevPath = this.activePaths.get(this.selectedEntityId);
      if (prevPath && prevPath.displayState === "selected") {
        this.setPathDisplayState(this.selectedEntityId, "moving");
      }
    }

    this.selectedEntityId = entityId;

    if (entityId !== null) {
      const path = this.activePaths.get(entityId);
      if (path) {
        this.setPathDisplayState(entityId, "selected");
      }
    }
  }

  /**
   * Change display state of a path (affects opacity)
   */
  public setPathDisplayState(entityId: number, state: PathDisplayState): void {
    const path = this.activePaths.get(entityId);
    if (!path) return;

    path.displayState = state;

    this.markBatchesDirty();
  }

  /**
   * Remove a path
   */
  public removePath(entityId: number): void {
    const path = this.activePaths.get(entityId);
    if (!path) return;

    this.activePaths.delete(entityId);
    this.culledPaths.delete(entityId);

    if (this.selectedEntityId === entityId) {
      this.selectedEntityId = null;
    }

    this.markBatchesDirty();

    setWorldmapRenderGauge("activePaths", this.activePaths.size);
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
  public update(_deltaTime: number): void {
    this.flushDirtyBatches();

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

    if (!this.visibilityManager) {
      this.culledPaths.clear();
      this.batchObjects.forEach((batch) => {
        batch.line.visible = true;
      });
      return;
    }

    this.culledPaths.clear();
    this.batchObjects.forEach((batch) => {
      const isVisible = this.visibilityManager!.isBoxVisible(batch.boundingBox);
      batch.line.visible = isVisible;
      if (!isVisible) {
        batch.entityIds.forEach((entityId) => this.culledPaths.add(entityId));
      }
    });
  }

  /**
   * Handle window resize
   */
  public onResize(_width: number, _height: number): void {}

  /**
   * Clear all paths
   */
  public clearAll(): void {
    for (const entityId of Array.from(this.activePaths.keys())) {
      this.removePath(entityId);
    }
    this.selectedEntityId = null;
    this.culledPaths.clear();
    setWorldmapRenderGauge("activePaths", 0);
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    if (this.isDisposed) {
      console.warn("PathRenderer already disposed, skipping cleanup");
      return;
    }
    this.isDisposed = true;

    // Cancel any pending deferred rebuild before clearAll re-marks dirty.
    if (this._rebuildFrameHandle !== null) {
      cancelAnimationFrame(this._rebuildFrameHandle);
      this._rebuildFrameHandle = null;
    }

    this.clearAll();

    // clearAll -> removePath -> markBatchesDirty sets the flag again.
    // Flush synchronously so geometry/materials are disposed immediately.
    this.flushDirtyBatches();

    if (this.mesh) {
      this.mesh.parent?.remove(this.mesh);
      this.mesh = null;
    }

    this.scene = null;
  }

  public compact(): void {}

  public shouldCompact(): boolean {
    return false;
  }

  /**
   * Debug: Get stats about path rendering
   */
  public getStats(): {
    activePaths: number;
    batches: number;
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

    const memoryUsageKB = Math.round((totalSegments * 24) / 1024);

    return {
      activePaths: this.activePaths.size,
      batches: this.batchObjects.length,
      visiblePaths: this.activePaths.size - this.culledPaths.size,
      culledPaths: this.culledPaths.size,
      totalSegments,
      allocatedSegments: totalSegments,
      freeSegments: 0,
      maxSegments: this.config.maxSegments,
      fragmentation: 0,
      freeRanges: 0,
      selectedEntityId: this.selectedEntityId,
      memoryUsageKB,
    };
  }

  /**
   * Mark batches as dirty and schedule a deferred rebuild via rAF.
   * Multiple calls within the same frame are coalesced into a single rebuild.
   */
  private markBatchesDirty(): void {
    this._batchesDirty = true;

    if (this._rebuildFrameHandle === null && typeof requestAnimationFrame !== "undefined") {
      this._rebuildFrameHandle = requestAnimationFrame(() => {
        this._rebuildFrameHandle = null;
        this.flushDirtyBatches();
      });
    }
  }

  /**
   * If batches are dirty, perform the rebuild and reset the flag.
   * Called from update() and from the rAF callback.
   */
  private flushDirtyBatches(): void {
    if (!this._batchesDirty) return;
    this._batchesDirty = false;

    // Cancel any pending rAF since we are rebuilding now
    if (this._rebuildFrameHandle !== null) {
      cancelAnimationFrame(this._rebuildFrameHandle);
      this._rebuildFrameHandle = null;
    }

    this.rebuildPathBatches();
  }

  private rebuildPathBatches(): void {
    this.disposeBatchObjects();
    this.culledPaths.clear();

    if (!this.mesh) {
      return;
    }

    const batchPlans = resolvePathBatches(Array.from(this.activePaths.values()), this.config.maxSegments);

    batchPlans.forEach((batchPlan) => {
      const batchPaths = batchPlan.entityIds
        .map((entityId) => this.activePaths.get(entityId))
        .filter((path): path is ArmyPath => Boolean(path));
      const batch = this.createBatchObject(batchPaths, batchPlan.displayState);
      this.batchObjects.push(batch);
      this.mesh!.add(batch.line);
    });

    this.mesh.visible = this.batchObjects.length > 0;
  }

  private disposeBatchObjects(): void {
    this.batchObjects.forEach((batch) => {
      batch.line.parent?.remove(batch.line);
      batch.line.geometry.dispose();
      (batch.line.material as LineBasicMaterial).dispose();
    });
    this.batchObjects.length = 0;
  }

  private createBatchObject(paths: ArmyPath[], displayState: PathDisplayState): PathBatchObject {
    const totalSegments = paths.reduce((sum, path) => sum + path.segmentCount, 0);
    const positions = new Float32Array(totalSegments * 2 * 3);
    const colors = new Float32Array(totalSegments * 2 * 3);
    const boundingBox = new Box3();

    let segmentOffset = 0;
    paths.forEach((path) => {
      boundingBox.union(path.boundingBox);
      path.segments.forEach((segment) => {
        const index = segmentOffset * 6;

        positions[index] = segment.start.x;
        positions[index + 1] = segment.start.y + 0.3;
        positions[index + 2] = segment.start.z;
        positions[index + 3] = segment.end.x;
        positions[index + 4] = segment.end.y + 0.3;
        positions[index + 5] = segment.end.z;

        for (let vertex = 0; vertex < 2; vertex += 1) {
          const colorIndex = index + vertex * 3;
          colors[colorIndex] = path.color.r;
          colors[colorIndex + 1] = path.color.g;
          colors[colorIndex + 2] = path.color.b;
        }

        segmentOffset += 1;
      });
    });

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

    const material = new LineBasicMaterial({
      transparent: true,
      opacity: resolvePathReadabilityPolicy({
        displayState,
        view: "medium",
      }).opacity,
      depthWrite: false,
      vertexColors: true,
    });

    const line = new LineSegments(geometry, material);
    line.frustumCulled = false;
    line.renderOrder = 10;

    return {
      boundingBox,
      entityIds: new Set(paths.map((path) => path.entityId)),
      line,
    };
  }
}
