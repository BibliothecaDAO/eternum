import { DojoResult } from "@bibliothecadao/react";
import { BiomeType, FELT_CENTER } from "@bibliothecadao/types";
import * as THREE from "three";
import { getMapFromTorii } from "../../../../app/dojo/queries";
import { GUIManager } from "../helpers/gui-manager";
import { findShortestPath } from "../helpers/pathfinding";
import { SystemManager } from "../system/system-manager";
import { ArmySystemUpdate, StructureSystemUpdate, TileSystemUpdate } from "../types";
import { Position } from "../types/position";
import { createHexagonShape } from "./hexagon-geometry";
import { HighlightRenderer } from "./highlight-renderer";
import { ArmyObject, ArmyRenderer, QuestRenderer, StructureObject, StructureRenderer } from "./object-renderer";
import { SelectionManager } from "./selection-manager";
import { TilePosition, TileRenderer } from "./tile-renderer";
import { getHexagonCoordinates, getWorldPositionForHex, HEX_SIZE } from "./utils";

export class HexagonMap {
  private scene: THREE.Scene;
  private dojo: DojoResult;
  private allHexes: Set<string> = new Set();
  private visibleHexes: Set<string> = new Set();
  private exploredTiles: Map<number, Map<number, BiomeType>> = new Map();

  private hexagonMesh: THREE.InstancedMesh | null = null;
  private tileRenderer: TileRenderer;
  private highlightRenderer: HighlightRenderer;
  private armyRenderer: ArmyRenderer;
  private structureRenderer: StructureRenderer;
  private questRenderer: QuestRenderer;
  private selectionManager: SelectionManager;

  private raycaster: THREE.Raycaster;
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private dummy = new THREE.Object3D();
  private systemManager: SystemManager;

  private tempVector3 = new THREE.Vector3();
  private tempColor = new THREE.Color();
  private tempQuaternion = new THREE.Quaternion();
  private tempMatrix = new THREE.Matrix4();

  private static hexagonGeometry: THREE.ShapeGeometry | null = null;
  private static hexagonMaterial: THREE.MeshLambertMaterial | null = null;

  private lastChunkX: number = -999;
  private lastChunkZ: number = -999;

  private static readonly CHUNK_LOAD_RADIUS_X = 2;
  private static readonly CHUNK_LOAD_RADIUS_Z = 3;
  private static readonly CHUNK_SIZE = 5;

  private chunkLoadRadiusX = HexagonMap.CHUNK_LOAD_RADIUS_X;
  private chunkLoadRadiusZ = HexagonMap.CHUNK_LOAD_RADIUS_Z;

  private fetchedChunks: Set<string> = new Set();

  constructor(scene: THREE.Scene, dojo: DojoResult, systemManager: SystemManager) {
    this.scene = scene;
    this.dojo = dojo;
    this.systemManager = systemManager;
    this.raycaster = new THREE.Raycaster();

    this.tileRenderer = new TileRenderer(scene);
    this.highlightRenderer = new HighlightRenderer(scene);
    this.armyRenderer = new ArmyRenderer(scene);
    this.structureRenderer = new StructureRenderer(scene);
    this.questRenderer = new QuestRenderer(scene);

    this.selectionManager = new SelectionManager(this.highlightRenderer);
    this.selectionManager.registerObjectRenderer("army", this.armyRenderer);
    this.selectionManager.registerObjectRenderer("structure", this.structureRenderer);
    this.selectionManager.registerObjectRenderer("quest", this.questRenderer);

    this.initializeStaticAssets();
    this.initializeMap();

    this.systemManager.Tile.onUpdate((value) => this.updateExploredHex(value));
    this.systemManager.Army.onUpdate((update) => this.updateArmyHexes(update));
    this.systemManager.Army.onDeadArmy((entityId) => this.deleteArmy(entityId));
    this.systemManager.Structure.onUpdate((update) => this.updateStructureHexes(update));

    GUIManager.addFolder("HexagonMap");
    GUIManager.add(this, "moveCameraToColRow");
  }

  private initializeStaticAssets(): void {
    if (!HexagonMap.hexagonGeometry) {
      const hexagonShape = createHexagonShape(HEX_SIZE);
      HexagonMap.hexagonGeometry = new THREE.ShapeGeometry(hexagonShape);
    }

    if (!HexagonMap.hexagonMaterial) {
      HexagonMap.hexagonMaterial = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5,
      });
    }
  }

  private initializeMap(): void {
    const centerChunkX = 0;
    const centerChunkZ = 0;

    this.lastChunkX = centerChunkX;
    this.lastChunkZ = centerChunkZ;

    this.updateVisibleHexes(centerChunkX, centerChunkZ);
  }

  private addHex(hex: { col: number; row: number }): void {
    const key = `${hex.col},${hex.row}`;
    this.allHexes.add(key);
  }

  private async updateVisibleHexes(centerChunkX: number, centerChunkZ: number): Promise<void> {
    this.visibleHexes.clear();

    const radiusX = this.chunkLoadRadiusX;
    const radiusZ = this.chunkLoadRadiusZ;
    console.log(
      `\n=== Updating visible hexes for center chunk (${centerChunkX}, ${centerChunkZ}) with radius (${radiusX}, ${radiusZ}) ===`,
    );

    const chunkKey = `${centerChunkZ * HexagonMap.CHUNK_SIZE},${centerChunkX * HexagonMap.CHUNK_SIZE}`;
    await this.computeTileEntities(chunkKey);

    for (let x = centerChunkX - radiusX; x <= centerChunkX + radiusX; x++) {
      for (let z = centerChunkZ - radiusZ; z <= centerChunkZ + radiusZ; z++) {
        if (this.isChunkInBounds(x, z)) {
          this.loadChunkHexes(x, z);
        } else {
          console.log(`Skipping chunk (${x}, ${z}) - out of bounds`);
        }
      }
    }

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

    this.renderHexes();
  }

  private isChunkInBounds(chunkX: number, chunkZ: number): boolean {
    return true;
  }

  private loadChunkHexes(chunkX: number, chunkZ: number): void {
    const startCol = chunkX * HexagonMap.CHUNK_SIZE;
    const startRow = chunkZ * HexagonMap.CHUNK_SIZE;
    const endCol = startCol + HexagonMap.CHUNK_SIZE;
    const endRow = startRow + HexagonMap.CHUNK_SIZE;

    for (let col = startCol; col < endCol; col++) {
      for (let row = startRow; row < endRow; row++) {
        const hexKey = `${col},${row}`;
        this.allHexes.add(hexKey);
        this.visibleHexes.add(hexKey);
      }
    }
  }

  private renderHexes(): void {
    if (this.hexagonMesh) {
      this.scene.remove(this.hexagonMesh);
      this.hexagonMesh.dispose();
    }

    const allVisibleHexes = Array.from(this.visibleHexes).map((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      return { col, row, hexString };
    });

    const instanceCount = allVisibleHexes.length;

    if (instanceCount === 0) {
      this.tileRenderer.clearTiles();
      return;
    }

    this.hexagonMesh = new THREE.InstancedMesh(HexagonMap.hexagonGeometry!, HexagonMap.hexagonMaterial!, instanceCount);
    this.hexagonMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(instanceCount * 3), 3);

    allVisibleHexes.sort((a, b) => b.row - a.row);

    let index = 0;
    const tilePositions: TilePosition[] = [];

    allVisibleHexes.forEach(({ col, row, hexString }) => {
      getWorldPositionForHex({ col, row }, true, this.tempVector3);

      this.dummy.position.copy(this.tempVector3);
      this.dummy.position.y = 0.1;
      this.dummy.rotation.x = -Math.PI / 2;
      this.dummy.updateMatrix();
      this.hexagonMesh!.setMatrixAt(index, this.dummy.matrix);

      this.tempColor.setHex(0x4a90e2);
      this.hexagonMesh!.setColorAt(index, this.tempColor);

      const biome = this.exploredTiles.get(col)?.get(row);
      const isExplored = biome !== undefined;

      tilePositions.push({ col, row, biome, isExplored });

      index++;
    });

    if (this.hexagonMesh!.instanceColor) {
      this.hexagonMesh!.instanceColor.needsUpdate = true;
    }

    this.scene.add(this.hexagonMesh);
    this.tileRenderer.renderTilesForHexes(tilePositions);
  }

  public updateChunkLoading(cameraPosition: THREE.Vector3): void {
    const hexRadius = HEX_SIZE;
    const hexHeight = hexRadius * 2;
    const hexWidth = hexHeight * 1.6;
    const vertDist = hexHeight * 0.75;
    const horizDist = hexWidth;

    const row = Math.round(cameraPosition.z / vertDist);
    const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
    const col = Math.round((cameraPosition.x + rowOffset) / horizDist);

    const chunkX = Math.floor(col / HexagonMap.CHUNK_SIZE);
    const chunkZ = Math.floor(row / HexagonMap.CHUNK_SIZE);

    if (chunkX !== this.lastChunkX || chunkZ !== this.lastChunkZ) {
      console.log(`Moving from chunk (${this.lastChunkX}, ${this.lastChunkZ}) to chunk (${chunkX}, ${chunkZ})`);
      console.log(`Camera at (${cameraPosition.x.toFixed(2)}, ${cameraPosition.z.toFixed(2)}) -> Hex (${col}, ${row})`);
      this.updateVisibleHexes(chunkX, chunkZ).catch((error) => {
        console.error("Error updating visible hexes:", error);
      });
      this.lastChunkX = chunkX;
      this.lastChunkZ = chunkZ;
    }
  }

  public handleClick(mouse: THREE.Vector2, camera: THREE.Camera): void {
    if (!this.hexagonMesh) return;

    this.raycaster.setFromCamera(mouse, camera);
    const intersects = this.raycaster.intersectObjects([this.hexagonMesh], true);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const intersectedObject = intersect.object;

      if (intersectedObject instanceof THREE.InstancedMesh) {
        const instanceId = intersect.instanceId;
        if (instanceId !== undefined) {
          const hexData = getHexagonCoordinates(intersectedObject, instanceId);
          console.log(`Hexagon clicked: col=${hexData.hexCoords.col}, row=${hexData.hexCoords.row}`);

          this.handleHexClick(hexData.hexCoords.col, hexData.hexCoords.row);
          this.showClickFeedback(instanceId);
        }
      }
    }
  }

  private async handleHexClick(col: number, row: number): Promise<void> {
    const armies = this.armyRenderer.getObjectsAtHex(col, row);
    const structures = this.structureRenderer.getObjectsAtHex(col, row);
    const quests = this.questRenderer.getObjectsAtHex(col, row);

    // Check if we have a selected army and clicked on a highlighted hex
    const selectedObject = this.selectionManager.getSelectedObject();
    if (selectedObject && selectedObject.type === "army") {
      const highlightedHexes = this.selectionManager.getHighlightedHexes();
      const isHighlighted = highlightedHexes.some((hex) => hex.col === col && hex.row === row);

      if (isHighlighted) {
        // Move the army to the clicked hex
        await this.moveArmyToHex(selectedObject.id, col, row);
        this.selectionManager.clearSelection();
        return;
      }
    }

    // Normal selection logic
    if (armies.length > 0) {
      this.selectionManager.selectObject(armies[0].id, "army");
    } else if (structures.length > 0) {
      this.selectionManager.selectObject(structures[0].id, "structure");
    } else if (quests.length > 0) {
      this.selectionManager.selectObject(quests[0].id, "quest");
    } else {
      this.selectionManager.clearSelection();
    }
  }

  private async moveArmyToHex(armyId: number, targetCol: number, targetRow: number): Promise<void> {
    const army = this.armyRenderer.getObject(armyId);
    if (!army) return;

    // Create data structures for pathfinding
    const structureHexes = new Map<number, Map<number, { id: number; owner: bigint }>>();
    const armyHexes = new Map<number, Map<number, { id: number; owner: bigint }>>();

    // Populate structure hexes
    this.structureRenderer.getAllObjects().forEach((structure) => {
      if (!structureHexes.has(structure.col)) {
        structureHexes.set(structure.col, new Map());
      }
      structureHexes.get(structure.col)!.set(structure.row, { id: structure.id, owner: structure.owner! });
    });

    // Populate army hexes (excluding the moving army)
    this.armyRenderer.getAllObjects().forEach((armyObj) => {
      if (armyObj.id !== armyId) {
        if (!armyHexes.has(armyObj.col)) {
          armyHexes.set(armyObj.col, new Map());
        }
        armyHexes.get(armyObj.col)!.set(armyObj.row, { id: armyObj.id, owner: armyObj.owner! });
      }
    });

    // Find path using pathfinding
    const startPosition = new Position({ x: army.col, y: army.row });
    const endPosition = new Position({ x: targetCol, y: targetRow });
    const maxDistance = 10; // Adjust as needed

    const path = findShortestPath(
      startPosition,
      endPosition,
      this.exploredTiles,
      structureHexes,
      armyHexes,
      maxDistance,
    );

    if (path.length > 0) {
      // Skip the first position (current position) and convert to col/row format
      const movementPath = path.slice(1).map((pos) => {
        const normalized = pos.getNormalized();
        return { col: normalized.x, row: normalized.y };
      });

      // Move army along the path with chess-like animation
      await this.armyRenderer.moveObjectAlongPath(armyId, movementPath, 200);

      console.log(`Army ${armyId} moved from (${army.col}, ${army.row}) to (${targetCol}, ${targetRow})`);
    } else {
      console.log(`No path found for army ${armyId} to (${targetCol}, ${targetRow})`);
    }
  }

  private showClickFeedback(instanceId: number): void {
    if (!this.hexagonMesh) return;

    const originalColor = this.tempColor;
    this.hexagonMesh.getColorAt(instanceId, originalColor);

    const originalColorCopy = originalColor.clone();

    this.tempColor.setHex(0xff6b6b);
    this.hexagonMesh.setColorAt(instanceId, this.tempColor);
    this.hexagonMesh.instanceColor!.needsUpdate = true;

    setTimeout(() => {
      if (this.hexagonMesh) {
        this.hexagonMesh.setColorAt(instanceId, originalColorCopy);
        this.hexagonMesh.instanceColor!.needsUpdate = true;
      }
    }, 200);
  }

  public getMapBounds(): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
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

  public debugChunkCalculations(chunkX: number, chunkZ: number): void {
    console.log(`\n=== DEBUG: Chunk (${chunkX}, ${chunkZ}) calculations ===`);

    const inBounds = this.isChunkInBounds(chunkX, chunkZ);
    console.log(`Chunk in bounds: ${inBounds}`);

    if (inBounds) {
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
    if (this.hexagonMesh) {
      this.scene.remove(this.hexagonMesh);
      this.hexagonMesh.dispose();
    }

    this.tileRenderer.dispose();
    this.highlightRenderer.dispose();
    this.armyRenderer.dispose();
    this.structureRenderer.dispose();
    this.questRenderer.dispose();
    this.selectionManager.dispose();

    this.allHexes.clear();
    this.visibleHexes.clear();
  }

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

  public adjustChunkLoadingRadius(screenWidth: number, screenHeight: number, cameraDistance: number = 10): void {
    const aspectRatio = screenWidth / screenHeight;
    const baseRadius = Math.max(1, Math.ceil(cameraDistance / 10));

    if (aspectRatio > 1) {
      this.chunkLoadRadiusX = Math.ceil(baseRadius * aspectRatio);
      this.chunkLoadRadiusZ = baseRadius;
    } else {
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

  public updateArmyHexes(update: ArmySystemUpdate) {
    const {
      hexCoords: { col, row },
      owner: { address },
      entityId,
    } = update;

    const normalized = new Position({ x: col, y: row }).getNormalized();
    const newPos = { col: normalized.x, row: normalized.y };

    const army: ArmyObject = {
      id: entityId,
      col: newPos.col,
      row: newPos.row,
      owner: address,
      type: "army",
    };

    this.armyRenderer.updateObject(army);
  }

  public updateStructureHexes(update: StructureSystemUpdate) {
    const {
      hexCoords: { col, row },
      owner: { address },
      entityId,
    } = update;

    const normalized = new Position({ x: col, y: row }).getNormalized();

    const structure: StructureObject = {
      id: entityId,
      col: normalized.x,
      row: normalized.y,
      owner: address,
      type: "structure",
    };

    this.structureRenderer.updateObject(structure);
  }

  public deleteArmy(entityId: number) {
    this.armyRenderer.removeObject(entityId);
  }

  public hasArmyAtHex(col: number, row: number): boolean {
    const normalized = new Position({ x: col, y: row }).getNormalized();
    return this.armyRenderer.getObjectsAtHex(normalized.x, normalized.y).length > 0;
  }

  public hasStructureAtHex(col: number, row: number): boolean {
    const normalized = new Position({ x: col, y: row }).getNormalized();
    return this.structureRenderer.getObjectsAtHex(normalized.x, normalized.y).length > 0;
  }

  public getArmyAtHex(col: number, row: number): { id: number; owner: bigint } | undefined {
    const normalized = new Position({ x: col, y: row }).getNormalized();
    const armies = this.armyRenderer.getObjectsAtHex(normalized.x, normalized.y);
    return armies.length > 0 ? { id: armies[0].id, owner: armies[0].owner! } : undefined;
  }

  public getStructureAtHex(col: number, row: number): { id: number; owner: bigint } | undefined {
    const normalized = new Position({ x: col, y: row }).getNormalized();
    const structures = this.structureRenderer.getObjectsAtHex(normalized.x, normalized.y);
    return structures.length > 0 ? { id: structures[0].id, owner: structures[0].owner! } : undefined;
  }

  public getHexagonEntity(hexCoords: { col: number; row: number }) {
    const hex = new Position({ x: hexCoords.col, y: hexCoords.row }).getNormalized();
    const armies = this.armyRenderer.getObjectsAtHex(hex.x, hex.y);
    const structures = this.structureRenderer.getObjectsAtHex(hex.x, hex.y);

    return {
      army: armies.length > 0 ? { id: armies[0].id, owner: armies[0].owner! } : undefined,
      structure: structures.length > 0 ? { id: structures[0].id, owner: structures[0].owner! } : undefined,
    };
  }

  public getSelectionManager(): SelectionManager {
    return this.selectionManager;
  }

  public async moveArmy(armyId: number, targetCol: number, targetRow: number): Promise<void> {
    await this.armyRenderer.moveObject(armyId, targetCol, targetRow);
  }
}
