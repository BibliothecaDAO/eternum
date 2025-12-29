import { HEX_SIZE } from "@/three/constants";
import { createHexagonShape } from "@/three/geometry/hexagon-geometry";
import { Aura } from "@/three/managers/aura";
import { HoverHexManager } from "@/three/managers/hover-hex-manager";
import { interactiveHexMaterial } from "@/three/shaders/border-hex-material";
import { hexGeometryDebugger } from "@/three/utils/hex-geometry-debug";
import { HexGeometryPool } from "@/three/utils/hex-geometry-pool";
import { PerformanceMonitor } from "@/three/utils/performance-monitor";
import * as THREE from "three";
import { getHexForWorldPosition, getWorldPositionForHex, getWorldPositionForHexCoordsInto } from "../utils";

const INTERACTIVE_HEX_Y = 0.1;
const RAY_PARALLEL_EPSILON = 1e-6;

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

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.hoverAura = new Aura();
    this.hoverHexManager = new HoverHexManager(scene);
    this.hexGeometryPool = HexGeometryPool.getInstance();
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  public setAuraVisibility(visible: boolean) {
    this.showAura = visible;
    if (!visible) {
      if (this.hoverAura.isInScene(this.scene)) {
        this.hoverAura.removeFromScene(this.scene);
      }
      this.hoverHexManager.hideHover();
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
    // Hide current effects when switching
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

  public onMouseMove(raycaster: THREE.Raycaster) {
    if (!this.instanceMesh) return;
    const hoveredHex = this.pickHexFromRaycaster(raycaster);
    if (hoveredHex) {
      if (this.showAura) {
        if (this.useRimLighting) {
          // Use new rim lighting hover effect
          this.hoverHexManager.showHover(hoveredHex.position.x, hoveredHex.position.z);
          // Hide old aura if it's visible
          if (this.hoverAura.isInScene(this.scene)) {
            this.hoverAura.removeFromScene(this.scene);
          }
        } else {
          // Use original aura system
          this.hoverAura.setPosition(hoveredHex.position.x, 0.3, hoveredHex.position.z);
          if (!this.hoverAura.isInScene(this.scene)) {
            this.hoverAura.addToScene(this.scene);
          }
          // Hide rim lighting if it's visible
          this.hoverHexManager.hideHover();
        }
      }
      return { hexCoords: hoveredHex.hexCoords, position: hoveredHex.position.clone() };
    }

    // Hide both hover effects when not hovering
    if (this.hoverAura.isInScene(this.scene)) {
      this.hoverAura.removeFromScene(this.scene);
    }
    this.hoverHexManager.hideHover();
    return null;
  }

  public onClick(raycaster: THREE.Raycaster) {
    if (!this.instanceMesh) return;
    const hoveredHex = this.pickHexFromRaycaster(raycaster);
    if (hoveredHex) {
      return { hexCoords: hoveredHex.hexCoords, position: hoveredHex.position.clone() };
    }
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
    hexGeometryDebugger.trackSharedGeometryUsage("interactive", "InteractiveHexManager.ensureInstanceMeshCapacity");

    const mesh = new THREE.InstancedMesh(hexagonGeometry, interactiveHexMaterial, requiredCapacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;

    this.instanceMesh = mesh;
    this.instanceCapacity = requiredCapacity;
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

  // Filter visible hexes for the current chunk
  updateVisibleHexes(startRow: number, startCol: number, width: number, height: number) {
    this.visibleHexes.clear();

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
          const [col, row] = hexString.split(",").map(Number);
          if (col >= minCol && col <= maxCol && row >= minRow && row <= maxRow) {
            this.visibleHexes.add(hexString);
          }
        });
      }
    }

    const capacityHint = Math.max(1, Math.ceil(width) * Math.ceil(height));
    this.ensureInstanceMeshCapacity(Math.max(capacityHint, this.visibleHexes.size));

    // Render only the visible hexes
    this.renderHexes();
  }

  // Clear all interactive hexes (e.g., when resetting the world)
  clearHexes() {
    this.allHexes.clear();
    this.visibleHexes.clear();
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
        getWorldPositionForHexCoordsInto(col, row, this.position);
        this.dummy.position.set(this.position.x, INTERACTIVE_HEX_Y, this.position.z);
        this.dummy.rotation.x = -Math.PI / 2;
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
      }
    } else {
      // Fallback: use string parsing (when cache is out of sync)
      let index = 0;
      this.allHexes.forEach((hexString) => {
        const [col, row] = hexString.split(",").map(Number);
        const position = getWorldPositionForHex({ col, row });
        this.dummy.position.set(position.x, INTERACTIVE_HEX_Y, position.z);
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

    const instanceCount = this.visibleHexes.size;
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
    let index = 0;
    this.visibleHexes.forEach((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      const position = getWorldPositionForHex({ col, row });
      this.dummy.position.set(position.x, INTERACTIVE_HEX_Y, position.z);
      this.dummy.rotation.x = -Math.PI / 2;
      this.dummy.updateMatrix();
      mesh.setMatrixAt(index, this.dummy.matrix);
      index++;
    });
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

  update() {
    this.hoverAura.rotate();
  }

  private pickHexFromRaycaster(
    raycaster: THREE.Raycaster,
  ): { hexCoords: { col: number; row: number }; position: THREE.Vector3 } | null {
    if (!this.instanceMesh) {
      return null;
    }

    const ray = raycaster.ray;
    if (Math.abs(ray.direction.y) < RAY_PARALLEL_EPSILON) {
      return this.pickHexFromRaycast(raycaster);
    }

    const t = (INTERACTIVE_HEX_Y - ray.origin.y) / ray.direction.y;
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

  private resolveHexFromPoint(point: THREE.Vector3) {
    const hexCoords = getHexForWorldPosition(point);
    const key = `${hexCoords.col},${hexCoords.row}`;
    const isInteractive = this.isRenderingAllHexes ? this.allHexes.has(key) : this.visibleHexes.has(key);
    if (!isInteractive) {
      return null;
    }

    getWorldPositionForHexCoordsInto(hexCoords.col, hexCoords.row, this.position);
    this.position.y = INTERACTIVE_HEX_Y;

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

    // Clear hex collections
    this.allHexes.clear();
    this.visibleHexes.clear();
    this.hexBuckets.clear();

    // Clear typed array cache
    this.hexCoordsCache = new Int32Array(0);
    this.hexCoordsCount = 0;
    this.hexCoordsCapacity = 0;
    this.hexKeyToIndex.clear();

    console.log("InteractiveHexManager: Destroyed and cleaned up");
  }
}
