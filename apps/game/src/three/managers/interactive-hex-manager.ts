import { Aura } from "@/three/managers/aura";
import { HoverHexManager, type HoverVisualMode } from "@/three/managers/hover-hex-manager";
import { interactiveHexMaterial } from "@/three/shaders/border-hex-material";
import { PerformanceMonitor } from "@/three/utils/performance-monitor";
import * as THREE from "three";
import type { MeshBasicNodeMaterial } from "three/webgpu";
import { WORLD_HEX_SPACE, type HexSpace } from "../utils/utils";
import { drapeOnGround } from "./hex-ring";
import { plotLookOn, type HoverVisualPalette, type PlotLook } from "./worldmap-interaction-palette";
import { BiomeType } from "@bibliothecadao/types";
import { HEX_SIZE } from "@/three/constants";
import { createFilledHexagonOverlayGeometry } from "@/three/geometry/hexagon-geometry";

import { FLAT_TERRAIN_SURFACE, type TerrainSurface } from "@/three/terrain/terrain-surface";

/** The band floats just above the sampled ground so relief cannot swallow it. */
const INTERACTIVE_HEX_SURFACE_OFFSET = 0.03;
const INTERACTIVE_PICK_Y = 0;
const RAY_PARALLEL_EPSILON = 1e-6;

type InteractiveHexHoverVisualMode = HoverVisualMode;

const plotBandShape = (look: PlotLook): THREE.BufferGeometry =>
  createFilledHexagonOverlayGeometry(HEX_SIZE * 0.965, HEX_SIZE * 0.905, look);

export class InteractiveHexManager {
  private scene: THREE.Scene;
  // Store all interactive hexes
  private allHexes: Set<string> = new Set();
  private hexBuckets: Map<string, Set<string>> = new Map();
  // Store only currently visible hexes for the current chunk
  private visibleHexes: Set<string> = new Set();
  private readonly band: THREE.Mesh;
  private bandShape = plotBandShape(plotLookOn(BiomeType.Grassland));
  private hoverAura: Aura;
  private hoverHexManager: HoverHexManager;
  private readonly instanceMaterial: MeshBasicNodeMaterial;
  private position = new THREE.Vector3();
  private pickIntersection = new THREE.Vector3();
  private showAura: boolean = true;
  private useRimLighting: boolean = true; // New feature flag
  private readonly bucketSize = 16;
  private isRenderingAllHexes = false;

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
  private bareHexes: Set<string> = new Set();

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
    this.band = new THREE.Mesh(new THREE.BufferGeometry(), this.instanceMaterial);
    this.band.visible = false;
    this.band.frustumCulled = false;
    this.band.raycast = () => {};
    scene.add(this.band);
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
    if (!visible) this.drawBands([]);
  }

  public setHoverVisualMode(mode: InteractiveHexHoverVisualMode) {
    this.hoverHexManager.setVisualMode(mode);
  }

  public applyHoverPalette(palette: HoverVisualPalette) {
    this.hoverHexManager.applyHoverPalette(palette);
  }

  public applyPlotLook(look: PlotLook): void {
    this.bandShape.dispose();
    this.bandShape = plotBandShape(look);
    this.applyHoverPalette(look.hover);
  }

  public setBandBare(hexCoords: { col: number; row: number }, bare: boolean): void {
    const key = `${hexCoords.col},${hexCoords.row}`;
    if (bare) this.bareHexes.add(key);
    else this.bareHexes.delete(key);
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

    // Render only the visible hexes
    this.renderHexes();
  }

  // Clear all interactive hexes (e.g., when resetting the world)
  clearHexes() {
    this.allHexes.clear();
    this.visibleHexes.clear();
    this.visibleHexCoordsCount = 0;
    this.hexBuckets.clear();
    this.bareHexes.clear();
    this.isRenderingAllHexes = false;

    // Clear typed array cache
    this.hexCoordsCount = 0;
    this.hexKeyToIndex.clear();
    this.drawBands([]);
  }

  // For backward compatibility with Hexception scene
  // Renders all hexes in the allHexes collection
  renderAllHexes() {
    this.isRenderingAllHexes = true;
    PerformanceMonitor.begin("renderAllHexes");
    this.drawBands(
      Array.from(this.allHexes, (hexString) => {
        const index = this.hexKeyToIndex.get(hexString);
        if (index === undefined) throw new Error(`Interactive hex ${hexString} is missing from the coordinate cache`);
        return { col: this.hexCoordsCache[index * 2], row: this.hexCoordsCache[index * 2 + 1] };
      }),
    );
    PerformanceMonitor.end("renderAllHexes");
  }

  renderHexes() {
    this.isRenderingAllHexes = false;
    PerformanceMonitor.begin("renderHexes");
    this.drawBands(
      this.surfaceVisible
        ? Array.from({ length: this.visibleHexCoordsCount }, (_, index) => ({
            col: this.visibleHexCoordsCache[index * 2],
            row: this.visibleHexCoordsCache[index * 2 + 1],
          }))
        : [],
    );
    PerformanceMonitor.end("renderHexes");
  }

  private drawBands(hexes: readonly { col: number; row: number }[]): void {
    const open = this.surfaceVisible
      ? hexes
          .filter(({ col, row }) => !this.bareHexes.has(`${col},${row}`))
          .map(({ col, row }) => this.space.positionForHex({ col, row }))
      : [];
    this.band.visible = open.length > 0;
    this.band.geometry.dispose();
    if (open.length === 0) {
      this.band.geometry = new THREE.BufferGeometry();
      return;
    }
    this.band.geometry = drapeOnGround(this.bandShape, open, this.terrain, INTERACTIVE_HEX_SURFACE_OFFSET);
  }

  update(deltaTime: number = 0) {
    this.hoverAura.rotate();
    this.hoverHexManager.update(deltaTime);
  }

  private pickHexFromRaycaster(
    raycaster: THREE.Raycaster,
  ): { hexCoords: { col: number; row: number }; position: THREE.Vector3 } | null {
    const ray = raycaster.ray;
    if (Math.abs(ray.direction.y) < RAY_PARALLEL_EPSILON) return null;
    const t = (INTERACTIVE_PICK_Y - ray.origin.y) / ray.direction.y;
    if (!Number.isFinite(t) || t < 0) return null;
    this.pickIntersection.copy(ray.direction).multiplyScalar(t).add(ray.origin);
    return this.resolveHexFromPoint(this.pickIntersection);
  }

  private surfaceY(x: number, z: number): number {
    return this.terrain.sampleSurface(x, z).height + INTERACTIVE_HEX_SURFACE_OFFSET;
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
    this.scene.remove(this.band);
    this.band.geometry.dispose();
    this.bandShape.dispose();

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
}
