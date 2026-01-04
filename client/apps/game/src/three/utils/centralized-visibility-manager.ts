/**
 * CentralizedVisibilityManager
 *
 * Consolidates all frustum-based visibility computations into a single per-frame pass.
 * This eliminates redundant frustum checks across managers (biomes, armies, structures, chunks)
 * by caching visibility results and sharing them across the frame.
 *
 * Key benefits:
 * - Single frustum computation per frame instead of multiple
 * - Cached visibility results for chunks and bounding volumes
 * - Frame-based invalidation to ensure freshness
 * - Distance-based visibility for animation throttling
 */

import { Box3, Frustum, Matrix4, PerspectiveCamera, Sphere, Vector3 } from "three";
import type { MapControls } from "three/examples/jsm/controls/MapControls.js";

/**
 * Visibility state for a single frame
 */
export interface FrameVisibilityState {
  /** Frame ID when this state was computed */
  frameId: number;
  /** Timestamp of computation */
  timestamp: number;
  /** Set of visible chunk keys */
  visibleChunks: Set<string>;
}

/**
 * Configuration for the visibility manager
 */
export interface VisibilityManagerConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Maximum distance for animation visibility (world units) */
  animationMaxDistance?: number;
  /** Maximum number of registered chunks to retain (oldest evicted when exceeded) */
  maxRegisteredChunks?: number;
}

/**
 * Chunk bounds registration data
 */
export interface ChunkBoundsData {
  box: Box3;
  sphere: Sphere;
}

/**
 * CentralizedVisibilityManager
 *
 * Provides a single source of truth for visibility computations per frame.
 * All managers should query this instead of computing frustum checks themselves.
 */
export class CentralizedVisibilityManager {
  // Core state
  private frustum = new Frustum();
  private matrix = new Matrix4();
  private camera: PerspectiveCamera | null = null;
  private controls: MapControls | null = null;
  private cameraPosition = new Vector3();
  private boxVisibilityCache = new WeakMap<
    Box3,
    {
      frameId: number;
      visible: boolean;
      minX: number;
      minY: number;
      minZ: number;
      maxX: number;
      maxY: number;
      maxZ: number;
    }
  >();
  private sphereVisibilityCache = new WeakMap<
    Sphere,
    {
      frameId: number;
      visible: boolean;
      centerX: number;
      centerY: number;
      centerZ: number;
      radius: number;
    }
  >();
  private pointVisibilityCache = new WeakMap<
    Vector3,
    {
      frameId: number;
      visible: boolean;
      x: number;
      y: number;
      z: number;
    }
  >();
  private cachedBoxChecks = 0;
  private cachedSphereChecks = 0;
  private cachedPointChecks = 0;

  // Frame state
  private currentFrameId = 0;
  private frameState: FrameVisibilityState;
  private isDirty = true;

  // Registered chunks
  private chunkBounds: Map<string, ChunkBoundsData> = new Map();
  private chunkRegistrationOrder: string[] = [];

  // Configuration
  private config: VisibilityManagerConfig;

  // Listeners
  private controlsChangeHandler: (() => void) | null = null;
  private disposeControlsListener: (() => void) | null = null;
  private onChangeListeners: Set<() => void> = new Set();

  constructor(config: VisibilityManagerConfig = {}) {
    this.config = {
      debug: false,
      animationMaxDistance: 140,
      // Reduced from 256 to 50 (Phase 1 optimization)
      // Only ~25 chunks (5x5 neighborhood) are visible at once
      maxRegisteredChunks: 50,
      ...config,
    };

    this.frameState = this.createEmptyFrameState();
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize with camera and controls.
   * Must be called before using visibility queries.
   */
  initialize(camera: PerspectiveCamera, controls: MapControls): void {
    this.camera = camera;
    this.controls = controls;

    // Listen to control changes to mark dirty
    this.controlsChangeHandler = () => {
      this.isDirty = true;
    };

    this.controls.addEventListener("change", this.controlsChangeHandler);
    this.disposeControlsListener = () => {
      if (this.controls && this.controlsChangeHandler) {
        this.controls.removeEventListener("change", this.controlsChangeHandler);
      }
    };

    // Initial update
    this.isDirty = true;

    if (this.config.debug) {
      console.log("[CentralizedVisibilityManager] Initialized");
    }
  }

  // ===========================================================================
  // Frame Management
  // ===========================================================================

  /**
   * Begin a new frame. Call this at the start of each render loop.
   * Returns the current frame ID for tracking.
   */
  beginFrame(): number {
    this.currentFrameId++;

    // Only recompute if camera moved or first frame
    if (this.isDirty || this.frameState.frameId !== this.currentFrameId) {
      this.updateFrustum();
      this.computeChunkVisibility();
      this.frameState.frameId = this.currentFrameId;
      this.frameState.timestamp = performance.now();
      this.cachedBoxChecks = 0;
      this.cachedSphereChecks = 0;
      this.cachedPointChecks = 0;

      this.isDirty = false;

      // Notify listeners
      this.notifyListeners();
    }

    return this.currentFrameId;
  }

  /**
   * Force a visibility update (e.g., after chunk registration changes)
   */
  forceUpdate(): void {
    this.isDirty = true;
    this.beginFrame();
  }

  /**
   * Mark visibility as dirty (will recompute on next beginFrame)
   */
  markDirty(): void {
    this.isDirty = true;
  }

  // ===========================================================================
  // Chunk Registration
  // ===========================================================================

  /**
   * Register a chunk's bounds for visibility tracking.
   */
  registerChunk(chunkKey: string, bounds: ChunkBoundsData): void {
    if (!this.chunkBounds.has(chunkKey)) {
      this.chunkRegistrationOrder.push(chunkKey);
    }

    this.chunkBounds.set(chunkKey, {
      box: bounds.box.clone(),
      sphere: bounds.sphere.clone(),
    });
    this.enforceChunkLimit();
    this.isDirty = true;

    if (this.config.debug) {
      console.log(`[CentralizedVisibilityManager] Registered chunk: ${chunkKey}`);
    }
  }

  /**
   * Unregister a chunk's bounds.
   */
  unregisterChunk(chunkKey: string): void {
    this.chunkBounds.delete(chunkKey);
    this.frameState.visibleChunks.delete(chunkKey);
    const idx = this.chunkRegistrationOrder.indexOf(chunkKey);
    if (idx !== -1) {
      this.chunkRegistrationOrder.splice(idx, 1);
    }
    this.isDirty = true;

    if (this.config.debug) {
      console.log(`[CentralizedVisibilityManager] Unregistered chunk: ${chunkKey}`);
    }
  }

  /**
   * Check if a chunk key has registered bounds.
   */
  hasChunk(chunkKey: string): boolean {
    return this.chunkBounds.has(chunkKey);
  }

  /**
   * Get all registered chunk keys.
   */
  getRegisteredChunks(): string[] {
    return Array.from(this.chunkBounds.keys());
  }

  // ===========================================================================
  // Visibility Queries
  // ===========================================================================

  /**
   * Check if a chunk is visible in the current frame.
   * Returns cached result if available.
   */
  isChunkVisible(chunkKey: string): boolean {
    return this.frameState.visibleChunks.has(chunkKey);
  }

  /**
   * Get all visible chunk keys for the current frame.
   */
  getVisibleChunks(): ReadonlySet<string> {
    return this.frameState.visibleChunks;
  }

  /**
   * Check if a Box3 is visible. Caches result for the frame.
   */
  isBoxVisible(box: Box3 | null | undefined): boolean {
    if (!box) return true;
    const cached = this.boxVisibilityCache.get(box);
    if (
      cached &&
      cached.frameId === this.currentFrameId &&
      cached.minX === box.min.x &&
      cached.minY === box.min.y &&
      cached.minZ === box.min.z &&
      cached.maxX === box.max.x &&
      cached.maxY === box.max.y &&
      cached.maxZ === box.max.z
    ) {
      return cached.visible;
    }

    const visible = this.frustum.intersectsBox(box);
    this.boxVisibilityCache.set(box, {
      frameId: this.currentFrameId,
      visible,
      minX: box.min.x,
      minY: box.min.y,
      minZ: box.min.z,
      maxX: box.max.x,
      maxY: box.max.y,
      maxZ: box.max.z,
    });
    this.cachedBoxChecks++;
    return visible;
  }

  /**
   * Check if a Sphere is visible. Caches result for the frame.
   */
  isSphereVisible(sphere: Sphere | null | undefined): boolean {
    if (!sphere) return true;
    const cached = this.sphereVisibilityCache.get(sphere);
    if (
      cached &&
      cached.frameId === this.currentFrameId &&
      cached.centerX === sphere.center.x &&
      cached.centerY === sphere.center.y &&
      cached.centerZ === sphere.center.z &&
      cached.radius === sphere.radius
    ) {
      return cached.visible;
    }

    const visible = this.frustum.intersectsSphere(sphere);
    this.sphereVisibilityCache.set(sphere, {
      frameId: this.currentFrameId,
      visible,
      centerX: sphere.center.x,
      centerY: sphere.center.y,
      centerZ: sphere.center.z,
      radius: sphere.radius,
    });
    this.cachedSphereChecks++;
    return visible;
  }

  /**
   * Check if a point is visible. Caches result for the frame.
   */
  isPointVisible(point: Vector3): boolean {
    const cached = this.pointVisibilityCache.get(point);
    if (
      cached &&
      cached.frameId === this.currentFrameId &&
      cached.x === point.x &&
      cached.y === point.y &&
      cached.z === point.z
    ) {
      return cached.visible;
    }

    const visible = this.frustum.containsPoint(point);
    this.pointVisibilityCache.set(point, {
      frameId: this.currentFrameId,
      visible,
      x: point.x,
      y: point.y,
      z: point.z,
    });
    this.cachedPointChecks++;
    return visible;
  }

  // ===========================================================================
  // Animation Visibility
  // ===========================================================================

  /**
   * Check if an object should animate based on frustum and distance.
   * This is a combined check for animation culling.
   *
   * @param box - Bounding box of the object
   * @param sphereCenter - Center of bounding sphere for distance check
   * @param sphereRadius - Radius of bounding sphere
   * @returns true if animations should run
   */
  shouldAnimate(
    box: Box3 | null | undefined,
    sphereCenter: Vector3 | null | undefined,
    sphereRadius: number = 0,
  ): boolean {
    // Check frustum visibility
    if (box && !this.isBoxVisible(box)) {
      return false;
    }

    // Check distance
    if (sphereCenter && this.config.animationMaxDistance !== undefined) {
      const distance = this.cameraPosition.distanceTo(sphereCenter);
      if (distance > this.config.animationMaxDistance + sphereRadius) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the current camera position (cached for the frame).
   */
  getCameraPosition(): Vector3 {
    return this.cameraPosition;
  }

  /**
   * Get the animation max distance configuration.
   */
  getAnimationMaxDistance(): number {
    return this.config.animationMaxDistance ?? 140;
  }

  /**
   * Set the animation max distance.
   */
  setAnimationMaxDistance(distance: number): void {
    this.config.animationMaxDistance = distance;
  }

  // ===========================================================================
  // Change Listeners
  // ===========================================================================

  /**
   * Subscribe to visibility updates.
   * Returns an unsubscribe function.
   */
  onChange(listener: () => void): () => void {
    this.onChangeListeners.add(listener);
    return () => {
      this.onChangeListeners.delete(listener);
    };
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get visibility statistics for debugging/monitoring.
   */
  getStats(): {
    frameId: number;
    registeredChunks: number;
    visibleChunks: number;
    cachedBoxChecks: number;
    cachedSphereChecks: number;
    cachedPointChecks: number;
    chunkCapacity: number | null;
  } {
    return {
      frameId: this.currentFrameId,
      registeredChunks: this.chunkBounds.size,
      visibleChunks: this.frameState.visibleChunks.size,
      cachedBoxChecks: this.cachedBoxChecks,
      cachedSphereChecks: this.cachedSphereChecks,
      cachedPointChecks: this.cachedPointChecks,
      chunkCapacity: this.config.maxRegisteredChunks ?? null,
    };
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Dispose of the visibility manager.
   */
  dispose(): void {
    if (this.disposeControlsListener) {
      this.disposeControlsListener();
      this.disposeControlsListener = null;
    }

    this.chunkBounds.clear();
    this.onChangeListeners.clear();
    this.frameState = this.createEmptyFrameState();
    this.camera = null;
    this.controls = null;

    if (this.config.debug) {
      console.log("[CentralizedVisibilityManager] Disposed");
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private createEmptyFrameState(): FrameVisibilityState {
    return {
      frameId: 0,
      timestamp: 0,
      visibleChunks: new Set(),
    };
  }

  private updateFrustum(): void {
    if (!this.camera) return;

    this.camera.updateMatrixWorld(true);
    this.matrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);

    // Cache camera position
    this.camera.getWorldPosition(this.cameraPosition);
  }

  private computeChunkVisibility(): void {
    this.frameState.visibleChunks.clear();

    this.chunkBounds.forEach((bounds, chunkKey) => {
      if (this.frustum.intersectsBox(bounds.box)) {
        this.frameState.visibleChunks.add(chunkKey);
      }
    });

    if (this.config.debug && this.currentFrameId % 60 === 0) {
      console.log(
        `[CentralizedVisibilityManager] Frame ${this.currentFrameId}: ${this.frameState.visibleChunks.size}/${this.chunkBounds.size} chunks visible`,
      );
    }
  }

  private notifyListeners(): void {
    this.onChangeListeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("[CentralizedVisibilityManager] Listener error:", error);
      }
    });
  }

  private enforceChunkLimit(): void {
    if (!this.config.maxRegisteredChunks || this.config.maxRegisteredChunks <= 0) {
      return;
    }

    while (this.chunkRegistrationOrder.length > this.config.maxRegisteredChunks) {
      const oldest = this.chunkRegistrationOrder.shift();
      if (!oldest) {
        break;
      }
      this.chunkBounds.delete(oldest);
      this.frameState.visibleChunks.delete(oldest);
      if (this.config.debug) {
        console.warn(
          `[CentralizedVisibilityManager] Evicted chunk ${oldest} to maintain cap of ${this.config.maxRegisteredChunks}`,
        );
      }
    }
  }
}

// ===========================================================================
// Singleton Instance
// ===========================================================================

let visibilityManagerInstance: CentralizedVisibilityManager | null = null;

/**
 * Get or create the singleton visibility manager instance.
 */
export function getVisibilityManager(config?: VisibilityManagerConfig): CentralizedVisibilityManager {
  if (!visibilityManagerInstance) {
    visibilityManagerInstance = new CentralizedVisibilityManager(config);
  }
  return visibilityManagerInstance;
}

/**
 * Reset the singleton instance (useful for testing or hot reload).
 */
export function resetVisibilityManager(): void {
  if (visibilityManagerInstance) {
    visibilityManagerInstance.dispose();
    visibilityManagerInstance = null;
  }
}
