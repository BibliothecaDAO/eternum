import { DojoResult } from "@bibliothecadao/react";
import { BiomeType, FELT_CENTER } from "@bibliothecadao/types";
import * as THREE from "three";
import { getMapFromTorii } from "../../../../app/dojo/queries";
import { GUIManager } from "../helpers/gui-manager";
import { SystemManager } from "../system/system-manager";
import { ArmySystemUpdate, StructureSystemUpdate, TileSystemUpdate } from "../types";
import { Position } from "../types/position";
import { createHexagonShape } from "./hexagon-geometry";
import { TilePosition, TileRenderer } from "./tile-renderer";
import { getHexagonCoordinates, getWorldPositionForHex, HEX_SIZE } from "./utils";

export class HexagonMap {
  private scene: THREE.Scene;
  private dojo: DojoResult;
  private allHexes: Set<string> = new Set();
  private visibleHexes: Set<string> = new Set();
  private exploredTiles: Map<number, Map<number, BiomeType>> = new Map();

  // Army and structure tracking
  private armyHexes: Map<number, Map<number, { id: number; owner: bigint }>> = new Map();
  private structureHexes: Map<number, Map<number, { id: number; owner: bigint }>> = new Map();
  private armiesPositions: Map<number, { col: number; row: number }> = new Map();

  private instanceMesh: THREE.InstancedMesh | null = null;
  private tileRenderer: TileRenderer;
  private raycaster: THREE.Raycaster;
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private dummy = new THREE.Object3D();
  private systemManager: SystemManager;
  // Reusable objects to avoid creation in loops
  private tempVector3 = new THREE.Vector3();
  private tempColor = new THREE.Color();
  private tempQuaternion = new THREE.Quaternion();
  private tempMatrix = new THREE.Matrix4();

  // Cached geometry and material
  private static hexagonGeometry: THREE.ShapeGeometry | null = null;
  private static hexagonMaterial: THREE.MeshLambertMaterial | null = null;

  // Chunk loading optimization
  private lastChunkX: number = -999;
  private lastChunkZ: number = -999;

  // Map constants - removed MAP_SIZE since map is infinite
  private static readonly CHUNK_LOAD_RADIUS_X = 2; // Load chunks within this radius horizontally
  private static readonly CHUNK_LOAD_RADIUS_Z = 3; // Load chunks within this radius vertically
  private static readonly CHUNK_SIZE = 5; // 5x5 hexagons per chunk

  // Dynamic chunk loading radius (can be adjusted based on screen size)
  private chunkLoadRadiusX = HexagonMap.CHUNK_LOAD_RADIUS_X;
  private chunkLoadRadiusZ = HexagonMap.CHUNK_LOAD_RADIUS_Z;

  // Chunk fetching tracking
  private fetchedChunks: Set<string> = new Set();

  constructor(scene: THREE.Scene, dojo: DojoResult, systemManager: SystemManager) {
    this.scene = scene;
    this.dojo = dojo;
    this.systemManager = systemManager;
    this.raycaster = new THREE.Raycaster();
    this.tileRenderer = new TileRenderer(scene);
    this.initializeStaticAssets();
    this.initializeMap();

    this.systemManager.Tile.onUpdate((value) => this.updateExploredHex(value));

    // TODO: Uncomment these when Army and Structure system managers are implemented
    this.systemManager.Army.onUpdate((update) => this.updateArmyHexes(update));
    this.systemManager.Army.onDeadArmy((entityId) => this.deleteArmy(entityId));
    this.systemManager.Structure.onUpdate((update) => this.updateStructureHexes(update));

    GUIManager.addFolder("HexagonMap");
    GUIManager.add(this, "moveCameraToColRow");
  }

  private initializeStaticAssets(): void {
    // Create shared geometry and material only once
    if (!HexagonMap.hexagonGeometry) {
      const hexagonShape = createHexagonShape(HEX_SIZE);
      HexagonMap.hexagonGeometry = new THREE.ShapeGeometry(hexagonShape);
    }

    if (!HexagonMap.hexagonMaterial) {
      HexagonMap.hexagonMaterial = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
      });
    }
  }

  private initializeMap(): void {
    // No need to pre-populate allHexes since map is infinite
    // Hexes will be generated dynamically as chunks are loaded

    // Load initial chunks (start at center 0,0)
    const centerChunkX = 0;
    const centerChunkZ = 0;

    // Set initial chunk position
    this.lastChunkX = centerChunkX;
    this.lastChunkZ = centerChunkZ;

    this.updateVisibleHexes(centerChunkX, centerChunkZ);
    //this.moveCameraToColRow(-32, -15);
  }

  // Add hex to the global collection of all hexagons (now dynamic)
  private addHex(hex: { col: number; row: number }): void {
    const key = `${hex.col},${hex.row}`;
    this.allHexes.add(key);
  }

  // Filter visible hexes for the current chunk area
  private async updateVisibleHexes(centerChunkX: number, centerChunkZ: number): Promise<void> {
    this.visibleHexes.clear();

    const radiusX = this.chunkLoadRadiusX;
    const radiusZ = this.chunkLoadRadiusZ;
    console.log(
      `\n=== Updating visible hexes for center chunk (${centerChunkX}, ${centerChunkZ}) with radius (${radiusX}, ${radiusZ}) ===`,
    );

    // Compute tile entities for the current chunk
    const chunkKey = `${centerChunkZ * HexagonMap.CHUNK_SIZE},${centerChunkX * HexagonMap.CHUNK_SIZE}`;
    await this.computeTileEntities(chunkKey);

    for (let x = centerChunkX - radiusX; x <= centerChunkX + radiusX; x++) {
      for (let z = centerChunkZ - radiusZ; z <= centerChunkZ + radiusZ; z++) {
        // Check if chunk is within map bounds
        if (this.isChunkInBounds(x, z)) {
          // console.log(`Processing chunk (${x}, ${z})`);
          this.loadChunkHexes(x, z);
        } else {
          console.log(`Skipping chunk (${x}, ${z}) - out of bounds`);
        }
      }
    }

    // Log summary of loaded hexes
    if (this.visibleHexes.size > 0) {
      const hexArray = Array.from(this.visibleHexes).map((hexString) => {
        const [col, row] = hexString.split(",").map(Number);
        return { col, row };
      });

      const minCol = Math.min(...hexArray.map((h) => h.col));
      const maxCol = Math.max(...hexArray.map((h) => h.col));
      const minRow = Math.min(...hexArray.map((h) => h.row));
      const maxRow = Math.max(...hexArray.map((h) => h.row));

      console.log(
        `Total visible hexes: ${this.visibleHexes.size}, range: cols ${minCol}-${maxCol}, rows ${minRow}-${maxRow}`,
      );
    } else {
      console.log("No visible hexes loaded");
    }
    console.log("=== End update ===\n");

    // Render only the visible hexes
    this.renderHexes();
  }

  private isChunkInBounds(chunkX: number, chunkZ: number): boolean {
    // For infinite map, all chunks are always in bounds
    return true;
  }

  private loadChunkHexes(chunkX: number, chunkZ: number): void {
    // Calculate chunk boundaries
    const startCol = chunkX * HexagonMap.CHUNK_SIZE;
    const startRow = chunkZ * HexagonMap.CHUNK_SIZE;
    const endCol = startCol + HexagonMap.CHUNK_SIZE;
    const endRow = startRow + HexagonMap.CHUNK_SIZE;

    // For infinite map, no clamping needed - generate hexes dynamically
    for (let col = startCol; col < endCol; col++) {
      for (let row = startRow; row < endRow; row++) {
        const hexKey = `${col},${row}`;
        // Add hex to allHexes if it doesn't exist (dynamic generation)
        this.allHexes.add(hexKey);
        // Add to visible hexes
        this.visibleHexes.add(hexKey);
      }
    }

    // Debug logging to help understand what's being loaded
    // console.log(
    //   `Loading chunk (${chunkX}, ${chunkZ}): hex range (${startCol}-${endCol - 1}, ${startRow}-${endRow - 1})`,
    // );
  }

  private renderHexes(): void {
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);
      this.instanceMesh.dispose();
    }

    // Process all visible hexes (both explored and unexplored)
    const allVisibleHexes = Array.from(this.visibleHexes).map((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      return { col, row, hexString };
    });

    const instanceCount = allVisibleHexes.length;

    if (instanceCount === 0) {
      this.tileRenderer.clearTiles();
      return;
    }

    // Use cached geometry and material
    this.instanceMesh = new THREE.InstancedMesh(
      HexagonMap.hexagonGeometry!,
      HexagonMap.hexagonMaterial!,
      instanceCount,
    );

    // Set up per-instance colors
    this.instanceMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(instanceCount * 3), 3);

    // Sort by row (higher row = higher render order)
    allVisibleHexes.sort((a, b) => b.row - a.row);

    let index = 0;
    const tilePositions: TilePosition[] = [];

    allVisibleHexes.forEach(({ col, row, hexString }) => {
      // Reuse tempVector3 instead of creating new Vector3
      getWorldPositionForHex({ col, row }, true, this.tempVector3);

      // Position hex shape
      this.dummy.position.copy(this.tempVector3);
      this.dummy.position.y = 0.1;
      this.dummy.rotation.x = -Math.PI / 2;
      this.dummy.updateMatrix();
      this.instanceMesh!.setMatrixAt(index, this.dummy.matrix);

      // Reuse tempColor instead of creating new Color
      this.tempColor.setHex(0x4a90e2);
      this.instanceMesh!.setColorAt(index, this.tempColor);

      // Check if hex is explored and get biome data
      const biome = this.exploredTiles.get(col)?.get(row);
      const isExplored = biome !== undefined;

      // Check for structures and armies at this hex
      const hasStructure = this.hasStructureAtHex(col, row);
      const hasArmy = this.hasArmyAtHex(col, row);

      // Add to tile positions for rendering
      tilePositions.push({ col, row, biome, isExplored, hasStructure, hasArmy });

      index++;
    });

    // Update instance colors
    if (this.instanceMesh!.instanceColor) {
      this.instanceMesh!.instanceColor.needsUpdate = true;
    }

    this.scene.add(this.instanceMesh);

    // Render tiles using the TileRenderer
    this.tileRenderer.renderTilesForHexes(tilePositions);
  }

  public updateChunkLoading(cameraPosition: THREE.Vector3): void {
    // Convert camera position to hex coordinates using the same logic as getHexForWorldPosition
    const hexRadius = HEX_SIZE;
    const hexHeight = hexRadius * 2;
    const hexWidth = hexHeight * 1.6; // width = height * 1.6
    const vertDist = hexHeight * 0.75; // Vertical distance between row centers
    const horizDist = hexWidth; // Horizontal distance between column centers

    // Calculate row first
    const row = Math.round(cameraPosition.z / vertDist);
    // Calculate row offset for hexagon staggering
    const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
    // Calculate column using the offset
    const col = Math.round((cameraPosition.x + rowOffset) / horizDist);

    // Get chunk coordinates
    const chunkX = Math.floor(col / HexagonMap.CHUNK_SIZE);
    const chunkZ = Math.floor(row / HexagonMap.CHUNK_SIZE);

    // Only update if we've moved to a different chunk
    if (chunkX !== this.lastChunkX || chunkZ !== this.lastChunkZ) {
      console.log(`Moving from chunk (${this.lastChunkX}, ${this.lastChunkZ}) to chunk (${chunkX}, ${chunkZ})`);
      console.log(`Camera at (${cameraPosition.x.toFixed(2)}, ${cameraPosition.z.toFixed(2)}) -> Hex (${col}, ${row})`);
      // Don't await here to avoid blocking the render loop
      this.updateVisibleHexes(chunkX, chunkZ).catch((error) => {
        console.error("Error updating visible hexes:", error);
      });
      this.lastChunkX = chunkX;
      this.lastChunkZ = chunkZ;
    }
  }

  public handleClick(mouse: THREE.Vector2, camera: THREE.Camera): void {
    if (!this.instanceMesh) return;

    // Update raycaster
    this.raycaster.setFromCamera(mouse, camera);

    // Check for intersections
    const intersects = this.raycaster.intersectObjects([this.instanceMesh], true);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const intersectedObject = intersect.object;

      if (intersectedObject instanceof THREE.InstancedMesh) {
        const instanceId = intersect.instanceId;
        if (instanceId !== undefined) {
          const hexData = getHexagonCoordinates(intersectedObject, instanceId);
          console.log(`Hexagon clicked: col=${hexData.hexCoords.col}, row=${hexData.hexCoords.row}`);

          // Visual feedback - temporarily change color of the instance
          this.showClickFeedback(instanceId);
        }
      }
    }
  }

  private showClickFeedback(instanceId: number): void {
    if (!this.instanceMesh) return;

    // Reuse tempColor objects instead of creating new ones
    const originalColor = this.tempColor;
    this.instanceMesh.getColorAt(instanceId, originalColor);

    // Create a copy for restoration (we need to store the original value)
    const originalColorCopy = originalColor.clone();

    // Set clicked instance to red using reusable color object
    this.tempColor.setHex(0xff6b6b);
    this.instanceMesh.setColorAt(instanceId, this.tempColor);
    this.instanceMesh.instanceColor!.needsUpdate = true;

    // Restore original color after 200ms
    setTimeout(() => {
      if (this.instanceMesh) {
        this.instanceMesh.setColorAt(instanceId, originalColorCopy);
        this.instanceMesh.instanceColor!.needsUpdate = true;
      }
    }, 200);
  }

  public getMapBounds(): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
    // For infinite map, return current visible bounds
    if (this.visibleHexes.size === 0) {
      return { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 };
    }

    const hexArray = Array.from(this.visibleHexes).map((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      return { col, row };
    });

    const minCol = Math.min(...hexArray.map((h) => h.col));
    const maxCol = Math.max(...hexArray.map((h) => h.col));
    const minRow = Math.min(...hexArray.map((h) => h.row));
    const maxRow = Math.max(...hexArray.map((h) => h.row));

    return { minCol, maxCol, minRow, maxRow };
  }

  // Debug helper method to test chunk calculations
  public debugChunkCalculations(chunkX: number, chunkZ: number): void {
    console.log(`\n=== DEBUG: Chunk (${chunkX}, ${chunkZ}) calculations ===`);

    // Test if chunk is in bounds
    const inBounds = this.isChunkInBounds(chunkX, chunkZ);
    console.log(`Chunk in bounds: ${inBounds}`);

    if (inBounds) {
      // Calculate what hexes would be loaded
      const startCol = chunkX * HexagonMap.CHUNK_SIZE;
      const startRow = chunkZ * HexagonMap.CHUNK_SIZE;
      const endCol = startCol + HexagonMap.CHUNK_SIZE;
      const endRow = startRow + HexagonMap.CHUNK_SIZE;

      console.log(`Chunk bounds: cols ${startCol}-${endCol - 1}, rows ${startRow}-${endRow - 1}`);
      console.log(`Would load ${HexagonMap.CHUNK_SIZE * HexagonMap.CHUNK_SIZE} hexes`);
    }

    console.log("=== END DEBUG ===\n");
  }

  public dispose(): void {
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);
      this.instanceMesh.dispose();
    }

    // Dispose tile renderer
    this.tileRenderer.dispose();

    this.allHexes.clear();
    this.visibleHexes.clear();
    this.armyHexes.clear();
    this.structureHexes.clear();
    this.armiesPositions.clear();

    // Don't dispose static assets here as they might be used by other instances
  }

  // Static method to dispose shared resources when no longer needed
  public static disposeStaticAssets(): void {
    if (HexagonMap.hexagonGeometry) {
      HexagonMap.hexagonGeometry.dispose();
      HexagonMap.hexagonGeometry = null;
    }
    if (HexagonMap.hexagonMaterial) {
      HexagonMap.hexagonMaterial.dispose();
      HexagonMap.hexagonMaterial = null;
    }
  }

  /**
   * Adjust chunk loading radius based on screen dimensions and camera settings
   * @param screenWidth - Screen width in pixels
   * @param screenHeight - Screen height in pixels
   * @param cameraDistance - Distance of camera from the map
   */
  public adjustChunkLoadingRadius(screenWidth: number, screenHeight: number, cameraDistance: number = 10): void {
    // Calculate aspect ratio
    const aspectRatio = screenWidth / screenHeight;

    // Base radius calculation - adjust these multipliers as needed
    const baseRadius = Math.max(1, Math.ceil(cameraDistance / 10));

    if (aspectRatio > 1) {
      // Landscape orientation - load more chunks horizontally
      this.chunkLoadRadiusX = Math.ceil(baseRadius * aspectRatio);
      this.chunkLoadRadiusZ = baseRadius;
    } else {
      // Portrait orientation - load more chunks vertically
      this.chunkLoadRadiusX = baseRadius;
      this.chunkLoadRadiusZ = Math.ceil(baseRadius / aspectRatio);
    }

    console.log(
      `Adjusted chunk loading radius to (${this.chunkLoadRadiusX}, ${this.chunkLoadRadiusZ}) for screen ${screenWidth}x${screenHeight}, aspect ratio: ${aspectRatio.toFixed(2)}`,
    );
  }

  private async computeTileEntities(chunkKey: string) {
    const startCol = parseInt(chunkKey.split(",")[1]) + FELT_CENTER;
    const startRow = parseInt(chunkKey.split(",")[0]) + FELT_CENTER;

    const range = this.chunkLoadRadiusX * HexagonMap.CHUNK_SIZE;

    if (this.fetchedChunks.has(chunkKey)) {
      console.log("Already fetched chunk:", chunkKey);
      return;
    }

    this.fetchedChunks.add(chunkKey);

    const start = performance.now();
    try {
      console.log(
        `[HexagonMap] Fetching tile entities for chunk ${chunkKey} at (${startCol}, ${startRow}) with range ${range}`,
      );

      await getMapFromTorii(
        this.dojo.network.toriiClient,
        this.dojo.network.contractComponents as any,
        startCol,
        startRow,
        range,
      );
    } catch (error) {
      this.fetchedChunks.delete(chunkKey);
      console.error("Error fetching tile entities:", error);
    } finally {
      const end = performance.now();
      console.log("[HexagonMap] Tile entities query completed in", end - start, "ms");
    }
  }

  public clearTileEntityCache() {
    this.fetchedChunks.clear();
  }

  public moveCameraToColRow(col: number, row: number, controls?: any) {
    const worldPosition = getWorldPositionForHex({ col, row }, true, this.tempVector3);

    if (controls) {
      console.log("Moving camera to col", col, "row", row);
      // Set the target position for the controls
      controls.target.copy(worldPosition);
      controls.update();
    }

    return worldPosition;
  }

  private updateExploredHex(update: TileSystemUpdate) {
    const { hexCoords, removeExplored, biome } = update;

    const normalized = new Position({ x: hexCoords.col, y: hexCoords.row }).getNormalized();

    const col = normalized.x;
    const row = normalized.y;

    if (removeExplored) {
      this.exploredTiles.get(col)?.delete(row);
      return;
    }

    if (!this.exploredTiles.has(col)) {
      this.exploredTiles.set(col, new Map());
    }
    if (!this.exploredTiles.get(col)!.has(row)) {
      this.exploredTiles.get(col)!.set(row, biome);
    }
  }

  private isHexExplored(col: number, row: number): boolean {
    return this.exploredTiles.has(col) && this.exploredTiles.get(col)!.has(row);
  }

  // Army tracking methods
  public updateArmyHexes(update: ArmySystemUpdate) {
    const {
      hexCoords: { col, row },
      owner: { address },
      entityId,
    } = update;

    const normalized = new Position({ x: col, y: row }).getNormalized();
    const newPos = { col: normalized.x, row: normalized.y };
    const oldPos = this.armiesPositions.get(entityId);

    this.armiesPositions.set(entityId, newPos);

    if (
      oldPos &&
      (oldPos.col !== newPos.col || oldPos.row !== newPos.row) &&
      this.armyHexes.get(oldPos.col)?.get(oldPos.row)?.id === entityId
    ) {
      this.armyHexes.get(oldPos.col)?.delete(oldPos.row);
    }

    if (!this.armyHexes.has(newPos.col)) {
      this.armyHexes.set(newPos.col, new Map());
    }
    this.armyHexes.get(newPos.col)?.set(newPos.row, { id: entityId, owner: address });
  }

  public updateStructureHexes(update: StructureSystemUpdate) {
    const {
      hexCoords: { col, row },
      owner: { address },
      entityId,
    } = update;

    const normalized = new Position({ x: col, y: row }).getNormalized();

    const newCol = normalized.x;
    const newRow = normalized.y;

    if (!this.structureHexes.has(newCol)) {
      this.structureHexes.set(newCol, new Map());
    }
    this.structureHexes.get(newCol)?.set(newRow, { id: entityId, owner: address });
  }

  public deleteArmy(entityId: number) {
    const oldPos = this.armiesPositions.get(entityId);
    if (oldPos) {
      this.armyHexes.get(oldPos.col)?.delete(oldPos.row);
      this.armiesPositions.delete(entityId);
    }
  }

  // Helper methods to check if hex has army or structure
  public hasArmyAtHex(col: number, row: number): boolean {
    const normalized = new Position({ x: col, y: row }).getNormalized();
    return this.armyHexes.get(normalized.x)?.has(normalized.y) || false;
  }

  public hasStructureAtHex(col: number, row: number): boolean {
    const normalized = new Position({ x: col, y: row }).getNormalized();
    return this.structureHexes.get(normalized.x)?.has(normalized.y) || false;
  }

  public getArmyAtHex(col: number, row: number): { id: number; owner: bigint } | undefined {
    const normalized = new Position({ x: col, y: row }).getNormalized();
    return this.armyHexes.get(normalized.x)?.get(normalized.y);
  }

  public getStructureAtHex(col: number, row: number): { id: number; owner: bigint } | undefined {
    const normalized = new Position({ x: col, y: row }).getNormalized();
    return this.structureHexes.get(normalized.x)?.get(normalized.y);
  }

  public getHexagonEntity(hexCoords: { col: number; row: number }) {
    const hex = new Position({ x: hexCoords.col, y: hexCoords.row }).getNormalized();
    const army = this.armyHexes.get(hex.x)?.get(hex.y);
    const structure = this.structureHexes.get(hex.x)?.get(hex.y);
    return { army, structure };
  }
}
