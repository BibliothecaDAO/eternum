import { BufferGeometry, Color, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Scene, Vector3 } from "three";
import {
  incrementWorldmapRenderCounter,
  recordWorldmapRenderDuration,
  setWorldmapRenderGauge,
} from "../perf/worldmap-render-diagnostics";
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
import { getVisibilityManager } from "../utils/centralized-visibility-manager";

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
  private readonly pathObjects: Map<number, LineSegments> = new Map();
  private config: PathRenderConfig;

  // Active paths indexed by entity ID
  private activePaths: Map<number, ArmyPath> = new Map();

  // Currently selected/highlighted path
  private selectedEntityId: number | null = null;

  // Frustum culling tracking
  private culledPaths: Set<number> = new Set();
  private lastCullFrame = 0;
  private cullCheckInterval = 3; // Check every N frames for performance

  private isDisposed = false;

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

    const line = this.createPathObject(path);

    this.activePaths.set(entityId, path);
    this.pathObjects.set(entityId, line);
    this.culledPaths.delete(entityId);

    if (this.mesh) {
      this.mesh.add(line);
      this.mesh.visible = true;
    }

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

    const line = this.pathObjects.get(entityId);
    if (line) {
      const material = line.material as LineBasicMaterial;
      material.opacity = resolvePathReadabilityPolicy({
        displayState: state,
        view: "medium",
      }).opacity;
      material.needsUpdate = true;
    }
  }

  /**
   * Remove a path
   */
  public removePath(entityId: number): void {
    const path = this.activePaths.get(entityId);
    if (!path) return;

    const line = this.pathObjects.get(entityId);
    if (line) {
      line.parent?.remove(line);
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
      this.pathObjects.delete(entityId);
    }

    this.activePaths.delete(entityId);
    this.culledPaths.delete(entityId);

    if (this.selectedEntityId === entityId) {
      this.selectedEntityId = null;
    }

    if (this.mesh) {
      this.mesh.visible = this.pathObjects.size > 0;
    }

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

    for (const [entityId, path] of this.activePaths) {
      const isVisible = visibilityManager.isBoxVisible(path.boundingBox);
      const wasCulled = this.culledPaths.has(entityId);
      const line = this.pathObjects.get(entityId);

      if (!isVisible && !wasCulled) {
        this.culledPaths.add(entityId);
        if (line) {
          line.visible = false;
        }
      } else if (isVisible && wasCulled) {
        this.culledPaths.delete(entityId);
        if (line) {
          line.visible = true;
        }
      }
    }
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

    this.clearAll();

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

  private createPathObject(path: ArmyPath): LineSegments {
    const positions = new Float32Array(path.segments.length * 2 * 3);

    for (let i = 0; i < path.segments.length; i++) {
      const segment = path.segments[i];
      const index = i * 6;

      positions[index] = segment.start.x;
      positions[index + 1] = segment.start.y + 0.3;
      positions[index + 2] = segment.start.z;
      positions[index + 3] = segment.end.x;
      positions[index + 4] = segment.end.y + 0.3;
      positions[index + 5] = segment.end.z;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));

    const material = new LineBasicMaterial({
      color: path.color,
      transparent: true,
      opacity: resolvePathReadabilityPolicy({
        displayState: path.displayState,
        view: "medium",
      }).opacity,
      depthWrite: false,
    });

    const line = new LineSegments(geometry, material);
    line.frustumCulled = false;
    line.renderOrder = 10;

    return line;
  }
}
