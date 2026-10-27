import { createInstancedMesh } from "../utils/create-instanced-mesh";
import { HEX_SIZE } from "@/three/constants";
import { Aura } from "@/three/managers/aura";
import { HoverHexManager, type HoverVisualMode } from "@/three/managers/hover-hex-manager";
import { interactiveHexMaterial } from "@/three/shaders/border-hex-material";
import { hexGeometryDebugger } from "@/three/utils/hex-geometry-debug";
import { HexGeometryPool } from "@/three/utils/hex-geometry-pool";
import { PerformanceMonitor } from "@/three/utils/performance-monitor";
import * as THREE from "three";
import { WORLD_HEX_SPACE, type HexSpace } from "../utils/utils";
import { type HoverVisualPalette } from "./worldmap-interaction-palette";

import { FLAT_TERRAIN_SURFACE, type TerrainSurface } from "@/three/terrain/terrain-surface";

/** The band floats just above the sampled ground so relief cannot swallow it. */
const INTERACTIVE_HEX_SURFACE_OFFSET = 0.03;
const INTERACTIVE_PICK_Y = 0;
// Where the ground is read under a hex's band: its six corners and six edge middles.
const BAND_EDGE_SAMPLES = Array.from({ length: 12 }, (_, index) => {
  const angle = (Math.PI / 6) * index;
  const radius = HEX_SIZE * 0.95 * (index % 2 === 0 ? Math.cos(Math.PI / 6) : 1);
  return [radius * Math.cos(angle), radius * Math.sin(angle)] as const;
});
const RAY_PARALLEL_EPSILON = 1e-6;

type InteractiveHexHoverVisualMode = HoverVisualMode;

export class InteractiveHexManager {
  private scene: THREE.Scene;
  // Store all interactive hexes
  private allHexes: Set<string> = new Set();
  private hexBuckets: Map<string, Set<string>> = new Map();
  // Store only currently visible hexes for the current chunk
  private visibleHexes: Set<string> = new Set();
  private instanceMesh: THREE.InstancedMesh | null = null;
  private hoverAura: Aura;
  private hoverHexManager: HoverHexManager;
  private readonly instanceMaterial: THREE.MeshBasicMaterial;
  private position = new THREE.Vector3();
  private pickIntersection = new THREE.Vector3();
  private dummy = new THREE.Object3D();
  private showAura: boolean = true;
  private useRimLighting: boolean = true; // New feature flag
  private hexGeometryPool: HexGeometryPool;
  private readonly bucketSize = 16;
  private instanceCapacity = 0;
  private isRenderingAllHexes = false;
  private raycastHits: THREE.Intersection[] = [];

  // Phase 1 optimization: Typed array cache to avoid string parsing
  // Stores [col, row] pairs for all hexes in insertion order
  private hexCoordsCache: Int32Array = new Int32Array(0);
  private hexCoordsCount: number = 0;
  private hexCoordsCapacity: number = 0;
  // Map from hex string key to index in the coords cache
  private hexKeyToIndex: Map<string, number> = new Map();

  // Visible hex cache to avoid per-frame string parsing in renderHexes
  private visibleHexCoordsCache: Int32Array = new Int32Array(0);
  private visibleHexCoordsCount: number = 0;
  private visibleHexCoordsCapacity: number = 0;
  private surfaceVisible = true;

  constructor(
    scene: THREE.Scene,
    private readonly terrain: TerrainSurface = FLAT_TERRAIN_SURFACE,
    /** The owning scene's hex space: the world map's floating origin, or the local realm scene's own lattice. */
    private readonly space: HexSpace = WORLD_HEX_SPACE,
  ) {
    this.scene = scene;
    this.hoverAura = new Aura();
    this.hoverHexManager = new HoverHexManager(scene, terrain);
    this.instanceMaterial = interactiveHexMaterial.clone();
    this.hexGeometryPool = HexGeometryPool.getInstance();
    this.applyInstanceMeshSurfaceVisibility();
  }

  public setAuraVisibility(visible: boolean) {
    this.showAura = visible;
    if (!visible) {
      this.clearHover();
    }
  }

  public toggleAura() {
    this.setAuraVisibility(!this.showAura);
  }

  public isAuraVisible(): boolean {
    return this.showAura;
  }

  /**
   * Toggle between rim lighting and classic aura hover effects
   */
  public setRimLighting(enabled: boolean) {
    this.useRimLighting = enabled;
    this.clearHover();
  }

  public clearHover(): void {
    if (this.hoverAura.isInScene(this.scene)) {
      this.hoverAura.removeFromScene(this.scene);
    }
    this.hoverHexManager.hideHover();
  }

  public toggleRimLighting() {
    this.setRimLighting(!this.useRimLighting);
  }

  public isRimLightingEnabled(): boolean {
    return this.useRimLighting;
  }

  /**
   * Set hover effect colors (for rim lighting mode)
   */
  public setHoverColors(baseColor: THREE.Color, rimColor: THREE.Color) {
    this.hoverHexManager.setHoverColor(baseColor, rimColor);
  }

  /**
   * Set hover effect intensity (0.0 to 1.0)
   */
  public setHoverIntensity(intensity: number) {
    this.hoverHexManager.setHoverIntensity(intensity);
  }

  public setSurfaceVisibility(visible: boolean) {
    this.surfaceVisible = visible;
    this.applyInstanceMeshSurfaceVisibility();
  }

  public setHoverVisualMode(mode: InteractiveHexHoverVisualMode) {
    this.hoverHexManager.setVisualMode(mode);
  }

  public applyHoverPalette(palette: HoverVisualPalette) {
    this.hoverHexManager.applyHoverPalette(palette);
  }

  public isHexInteractive(hexCoords: { col: number; row: number }): boolean {
    const key = `${hexCoords.col},${hexCoords.row}`;
    return this.isRenderingAllHexes ? this.allHexes.has(key) : this.visibleHexes.has(key);
  }

  /** Where something stands on a hex: its centre, on the terrain's surface. */
  public surfacePosition(hexCoords: { col: number; row: number }): THREE.Vector3 {
    const position = this.space.positionForHex(hexCoords);
    position.y = this.surfaceY(position.x, position.z);
    return position;
  }

  public setCameraView(cameraView: number) {
    this.hoverHexManager.setCameraView(cameraView);
  }

  /** Lights the hovered tile's band, or none. */
  public showHover(hexCoords: { col: number; row: number } | null): void {
    if (!hexCoords || !this.showAura) {
      this.clearHover();
      return;
    }
    const { x, z } = this.surfacePosition(hexCoords);
    if (this.useRimLighting) {
      this.hoverHexManager.showHover(x, z);
      if (this.hoverAura.isInScene(this.scene)) {
        this.hoverAura.removeFromScene(this.scene);
      }
      return;
    }
    this.hoverAura.setPosition(x, 0.3, z);
    if (!this.hoverAura.isInScene(this.scene)) {
      this.hoverAura.addToScene(this.scene);
    }
    this.hoverHexManager.hideHover();
  }

  /** The interactive tile whose ground the pointer's ray meets, or null where it meets none. */
  public pick(raycaster: THREE.Raycaster): { hexCoords: { col: number; row: number }; position: THREE.Vector3 } | null {
    const picked = this.pickHexFromRaycaster(raycaster);
    return picked && { hexCoords: picked.hexCoords, position: picked.position.clone() };
  }

  private getBucketKey(col: number, row: number): string {
    const bucketCol = Math.floor(col / this.bucketSize);
    const bucketRow = Math.floor(row / this.bucketSize);
    return `${bucketCol},${bucketRow}`;
  }

  private ensureInstanceMeshCapacity(minCapacity: number) {
    const requiredCapacity = Math.max(1, Math.floor(minCapacity));

    if (this.instanceMesh && requiredCapacity <= this.instanceCapacity) {
      return;
    }

    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);

      if (this.instanceMesh.geometry) {
        this.hexGeometryPool.releaseGeometry("interactive");
      }

      this.instanceMesh = null;
      this.instanceCapacity = 0;
    }

    const hexagonGeometry = this.hexGeometryPool.getGeometry("interactive");
    hexGeometryDebugger.trackSharedGeometryUsage();

    const mesh = createInstancedMesh(hexagonGeometry, this.instanceMaterial, requiredCapacity);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = 0;

    this.instanceMesh = mesh;
    this.instanceCapacity = requiredCapacity;
    this.applyInstanceMeshSurfaceVisibility();
    this.scene.add(mesh);
  }

  // Add hex to the global collection of all interactive hexes
  addHex(hex: { col: number; row: number }) {
    const key = `${hex.col},${hex.row}`;
    if (this.allHexes.has(key)) {
      return;
    }

    this.allHexes.add(key);

    // Phase 1 optimization: Store in typed array cache
    this.addToHexCoordsCache(key, hex.col, hex.row);

    const bucketKey = this.getBucketKey(hex.col, hex.row);
    const bucket = this.hexBuckets.get(bucketKey) ?? new Set<string>();
    bucket.add(key);
    this.hexBuckets.set(bucketKey, bucket);
  }

  /**
   * Phase 1 optimization: Add hex coordinates to typed array cache
   */
  private addToHexCoordsCache(key: string, col: number, row: number): void {
    // Grow cache if needed
    if (this.hexCoordsCount >= this.hexCoordsCapacity) {
      const newCapacity = Math.max(1024, this.hexCoordsCapacity * 2);
      const newCache = new Int32Array(newCapacity * 2); // 2 ints per hex (col, row)
      if (this.hexCoordsCache.length > 0) {
        newCache.set(this.hexCoordsCache);
      }
      this.hexCoordsCache = newCache;
      this.hexCoordsCapacity = newCapacity;
    }

    // Store coordinates
    const idx = this.hexCoordsCount;
    this.hexCoordsCache[idx * 2] = col;
    this.hexCoordsCache[idx * 2 + 1] = row;
    this.hexKeyToIndex.set(key, idx);
    this.hexCoordsCount++;
  }

  /**
   * Cache visible hex coordinates for fast render iteration.
   */
  private addToVisibleHexCoordsCache(col: number, row: number): void {
    if (this.visibleHexCoordsCount >= this.visibleHexCoordsCapacity) {
      const newCapacity = Math.max(1024, this.visibleHexCoordsCapacity * 2);
      const newCache = new Int32Array(newCapacity * 2);
      if (this.visibleHexCoordsCache.length > 0) {
        newCache.set(this.visibleHexCoordsCache);
      }
      this.visibleHexCoordsCache = newCache;
      this.visibleHexCoordsCapacity = newCapacity;
    }

    const idx = this.visibleHexCoordsCount;
    this.visibleHexCoordsCache[idx * 2] = col;
    this.visibleHexCoordsCache[idx * 2 + 1] = row;
    this.visibleHexCoordsCount++;
  }

  // Filter visible hexes for the current chunk
  updateVisibleHexes(startRow: number, startCol: number, width: number, height: number) {
    this.visibleHexes.clear();
    this.visibleHexCoordsCount = 0;

    // Calculate chunk boundaries
    const halfWidth = Math.max(0, width) / 2;
    const halfHeight = Math.max(0, height) / 2;
    const minCol = startCol - halfWidth;
    const maxCol = startCol + halfWidth;
    const minRow = startRow - halfHeight;
    const maxRow = startRow + halfHeight;

    const minBucketCol = Math.floor(minCol / this.bucketSize);
    const maxBucketCol = Math.floor(maxCol / this.bucketSize);
    const minBucketRow = Math.floor(minRow / this.bucketSize);
    const maxBucketRow = Math.floor(maxRow / this.bucketSize);

    for (let bucketCol = minBucketCol; bucketCol <= maxBucketCol; bucketCol++) {
      for (let bucketRow = minBucketRow; bucketRow <= maxBucketRow; bucketRow++) {
        const bucketKey = `${bucketCol},${bucketRow}`;
        const bucket = this.hexBuckets.get(bucketKey);
        if (!bucket) continue;

        bucket.forEach((hexString) => {
          let col: number;
          let row: number;
          const cachedIndex = this.hexKeyToIndex.get(hexString);
          if (cachedIndex !== undefined) {
            col = this.hexCoordsCache[cachedIndex * 2];
            row = this.hexCoordsCache[cachedIndex * 2 + 1];
          } else {
            const parsed = hexString.split(",").map(Number);
            col = parsed[0];
            row = parsed[1];
          }
          if (col >= minCol && col <= maxCol && row >= minRow && row <= maxRow) {
            if (!this.visibleHexes.has(hexString)) {
              this.visibleHexes.add(hexString);
              this.addToVisibleHexCoordsCache(col, row);
            }
          }
        });
      }
    }

    const capacityHint = Math.max(1, Math.ceil(width) * Math.ceil(height));
    this.ensureInstanceMeshCapacity(Math.max(capacityHint, this.visibleHexCoordsCount));

    // Render only the visible hexes
    this.renderHexes();
  }

  // Clear all interactive hexes (e.g., when resetting the world)
  clearHexes() {
    this.allHexes.clear();
    this.visibleHexes.clear();
    this.visibleHexCoordsCount = 0;
    this.hexBuckets.clear();
    this.isRenderingAllHexes = false;

    // Clear typed array cache
    this.hexCoordsCount = 0;
    this.hexKeyToIndex.clear();

    if (this.instanceMesh) {
      this.instanceMesh.count = 0;
      this.instanceMesh.instanceMatrix.needsUpdate = true;
    }
  }

  // For backward compatibility with Hexception scene
  // Renders all hexes in the allHexes collection
  renderAllHexes() {
    this.isRenderingAllHexes = true;
    PerformanceMonitor.begin("renderAllHexes");
    const instanceCount = this.allHexes.size;
    this.ensureInstanceMeshCapacity(Math.max(instanceCount, 1));

    if (!this.instanceMesh) {
      PerformanceMonitor.end("renderAllHexes");
      return;
    }

    const mesh = this.instanceMesh;
    const previousCount = mesh.count;
    mesh.count = instanceCount;

    if (instanceCount === 0) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.boundingBox = null;
      mesh.boundingSphere = null;
      PerformanceMonitor.end("renderAllHexes");
      return;
    }

    PerformanceMonitor.begin("renderAllHexes.setMatrices");

    // Phase 1 optimization: Use typed array cache instead of string parsing
    // This avoids O(n) string splits and Number() conversions
    if (this.hexCoordsCount > 0 && this.hexCoordsCount === instanceCount) {
      // Fast path: use typed array cache
      for (let i = 0; i < this.hexCoordsCount; i++) {
        const col = this.hexCoordsCache[i * 2];
        const row = this.hexCoordsCache[i * 2 + 1];
        this.space.positionForHexInto(col, row, this.position);
        this.dummy.position.set(this.position.x, this.bandY(this.position.x, this.position.z), this.position.z);
        this.dummy.rotation.x = -Math.PI / 2;
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
      }
    } else {
      // Fallback: use string parsing (when cache is out of sync)
      let index = 0;
      this.allHexes.forEach((hexString) => {
        const [col, row] = hexString.split(",").map(Number);
        const position = this.space.positionForHex({ col, row });
        this.dummy.position.set(position.x, this.bandY(position.x, position.z), position.z);
        this.dummy.rotation.x = -Math.PI / 2;
        this.dummy.updateMatrix();
        mesh.setMatrixAt(index, this.dummy.matrix);
        index++;
      });
    }
    PerformanceMonitor.end("renderAllHexes.setMatrices");

    mesh.instanceMatrix.needsUpdate = true;

    // Only recompute bounds if count changed (Phase 1 optimization)
    if (previousCount !== instanceCount) {
      PerformanceMonitor.begin("renderAllHexes.computeBounds");
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      PerformanceMonitor.end("renderAllHexes.computeBounds");
    }
    PerformanceMonitor.end("renderAllHexes");
  }

  renderHexes() {
    this.isRenderingAllHexes = false;
    PerformanceMonitor.begin("renderHexes");
    if (!this.instanceMesh) {
      PerformanceMonitor.end("renderHexes");
      return;
    }

    const instanceCount = this.visibleHexCoordsCount;
    const mesh = this.instanceMesh;
    const previousCount = mesh.count;
    mesh.count = instanceCount;

    if (instanceCount === 0) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.boundingBox = null;
      mesh.boundingSphere = null;
      PerformanceMonitor.end("renderHexes");
      return;
    }

    PerformanceMonitor.begin("renderHexes.setMatrices");
    for (let i = 0; i < instanceCount; i++) {
      const col = this.visibleHexCoordsCache[i * 2];
      const row = this.visibleHexCoordsCache[i * 2 + 1];
      this.space.positionForHexInto(col, row, this.position);
      this.dummy.position.set(this.position.x, this.bandY(this.position.x, this.position.z), this.position.z);
      this.dummy.rotation.x = -Math.PI / 2;
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
    }
    PerformanceMonitor.end("renderHexes.setMatrices");

    mesh.instanceMatrix.needsUpdate = true;

    // Only recompute bounds if count changed (Phase 1 optimization)
    if (previousCount !== instanceCount) {
      PerformanceMonitor.begin("renderHexes.computeBounds");
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      PerformanceMonitor.end("renderHexes.computeBounds");
    }
    PerformanceMonitor.end("renderHexes");
  }

  update(deltaTime: number = 0) {
    this.hoverAura.rotate();
    this.hoverHexManager.update(deltaTime);
  }

  private pickHexFromRaycaster(
    raycaster: THREE.Raycaster,
  ): { hexCoords: { col: number; row: number }; position: THREE.Vector3 } | null {
    const ray = raycaster.ray;
    if (Math.abs(ray.direction.y) < RAY_PARALLEL_EPSILON) {
      return this.pickHexFromRaycast(raycaster);
    }

    const t = (INTERACTIVE_PICK_Y - ray.origin.y) / ray.direction.y;
    if (!Number.isFinite(t) || t < 0) {
      return this.pickHexFromRaycast(raycaster);
    }

    this.pickIntersection.copy(ray.direction).multiplyScalar(t).add(ray.origin);
    return this.resolveHexFromPoint(this.pickIntersection);
  }

  private pickHexFromRaycast(raycaster: THREE.Raycaster) {
    if (!this.instanceMesh) {
      return null;
    }

    this.raycastHits.length = 0;
    raycaster.intersectObject(this.instanceMesh, false, this.raycastHits);
    const hit = this.raycastHits[0];
    if (!hit) {
      return null;
    }

    return this.resolveHexFromPoint(hit.point);
  }

  private surfaceY(x: number, z: number): number {
    return this.terrain.sampleSurface(x, z).height + INTERACTIVE_HEX_SURFACE_OFFSET;
  }

  /**
   * The height a hex's band lies at: clear of the highest ground under its edge, so relief never buries part of the
   * line. A band that is not drawn (the world map's) only needs its centre.
   */
  private bandY(x: number, z: number): number {
    if (!this.surfaceVisible) return this.surfaceY(x, z);
    let highest = this.terrain.sampleSurface(x, z).height;
    for (const [dx, dz] of BAND_EDGE_SAMPLES) {
      highest = Math.max(highest, this.terrain.sampleSurface(x + dx, z + dz).height);
    }
    return highest + INTERACTIVE_HEX_SURFACE_OFFSET;
  }

  private resolveHexFromPoint(point: THREE.Vector3) {
    const hexCoords = this.space.hexForPosition(point);
    if (!this.isHexInteractive(hexCoords)) {
      return null;
    }

    this.space.positionForHexInto(hexCoords.col, hexCoords.row, this.position);
    this.position.y = this.surfaceY(this.position.x, this.position.z);

    return { hexCoords, position: this.position };
  }

  public destroy(): void {
    // Clean up instance mesh
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);

      // Release shared geometry reference instead of disposing
      if (this.instanceMesh.geometry) {
        this.hexGeometryPool.releaseGeometry("interactive");
      }

      this.instanceMesh = null;
      this.instanceCapacity = 0;
    }

    // Clean up hover effects
    if (this.hoverAura.isInScene(this.scene)) {
      this.hoverAura.removeFromScene(this.scene);
    }
    this.hoverHexManager.dispose();
    this.instanceMaterial.dispose();

    // Clear hex collections
    this.allHexes.clear();
    this.visibleHexes.clear();
    this.hexBuckets.clear();

    // Clear typed array cache
    this.hexCoordsCache = new Int32Array(0);
    this.hexCoordsCount = 0;
    this.hexCoordsCapacity = 0;
    this.hexKeyToIndex.clear();
    this.visibleHexCoordsCache = new Int32Array(0);
    this.visibleHexCoordsCount = 0;
    this.visibleHexCoordsCapacity = 0;
  }

  private applyInstanceMeshSurfaceVisibility(): void {
    const material = this.instanceMaterial;
    material.transparent = true;
    // Opacity is a uniform — changing it never requires a rebuild. Only a
    // real colorWrite/depthWrite flip needs needsUpdate: bumping it
    // unconditionally forced a full shader+pipeline rebuild on every
    // capacity growth (a multi-frame stall at zoom boundaries).
    material.opacity = this.surfaceVisible ? interactiveHexMaterial.opacity : 0;
    if (material.colorWrite !== this.surfaceVisible || material.depthWrite !== this.surfaceVisible) {
      material.colorWrite = this.surfaceVisible;
      material.depthWrite = this.surfaceVisible;
      material.needsUpdate = true;
    }
  }
}
