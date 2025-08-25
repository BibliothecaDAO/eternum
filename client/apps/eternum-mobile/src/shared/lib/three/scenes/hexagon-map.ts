import {
  ActionPath,
  ActionPaths,
  ActionType,
  ArmyActionManager,
  ArmySystemUpdate,
  Position,
  StructureActionManager,
  StructureSystemUpdate,
  TileSystemUpdate,
  WorldUpdateListener,
} from "@bibliothecadao/eternum";
import { DojoResult } from "@bibliothecadao/react";
import { BiomeType, FELT_CENTER, HexEntityInfo } from "@bibliothecadao/types";
import * as THREE from "three";
import { getMapFromTorii } from "../../../../app/dojo/queries";
import { getBlockTimestamp } from "../../../../shared/hooks/use-block-timestamp";
import { GUIManager } from "../helpers/gui-manager";
import { findShortestPath } from "../helpers/pathfinding";
import { loggedInAccount } from "../helpers/utils";
import { FXManager } from "./fx-manager";
import { createHexagonShape } from "./hexagon-geometry";
import { HighlightRenderer } from "./highlight-renderer";
import { ArmyObject, ArmyRenderer, QuestRenderer, StructureObject, StructureRenderer } from "./object-renderer";
import { SelectionManager } from "./selection-manager";
import { TilePosition, TileRenderer } from "./tiles/tile-renderer";
import { getHexagonCoordinates, getWorldPositionForHex, HEX_SIZE } from "./utils";

export class HexagonMap {
  private scene: THREE.Scene;
  private dojo: DojoResult;
  private allHexes: Set<string> = new Set();
  private visibleHexes: Set<string> = new Set();
  private exploredTiles: Map<number, Map<number, BiomeType>> = new Map();

  private hexagonMesh: THREE.InstancedMesh | null = null;
  private hexagonMeshCapacity: number = 0;
  private static readonly MAX_HEX_CAPACITY = 5000;
  private tileRenderer: TileRenderer;
  private highlightRenderer: HighlightRenderer;
  private armyRenderer: ArmyRenderer;
  private structureRenderer: StructureRenderer;
  private questRenderer: QuestRenderer;
  private selectionManager: SelectionManager;
  private fxManager: FXManager;
  private GUIFolder: any;

  private raycaster: THREE.Raycaster;
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private dummy = new THREE.Object3D();
  private systemManager: WorldUpdateListener;

  private tempVector3 = new THREE.Vector3();
  private tempColor = new THREE.Color();
  private tempQuaternion = new THREE.Quaternion();
  private tempMatrix = new THREE.Matrix4();

  private static hexagonGeometry: THREE.ShapeGeometry | null = null;
  private static hexagonMaterial: THREE.MeshLambertMaterial | null = null;

  private lastChunkX: number = -9999;
  private lastChunkZ: number = -9999;

  private performanceMetrics: Map<string, number[]> = new Map();
  private chunkUpdateCount: number = 0;

  private static readonly CHUNK_LOAD_RADIUS_X = 2;
  private static readonly CHUNK_LOAD_RADIUS_Z = 3;
  private static readonly CHUNK_SIZE = 5;

  private chunkLoadRadiusX = HexagonMap.CHUNK_LOAD_RADIUS_X;
  private chunkLoadRadiusZ = HexagonMap.CHUNK_LOAD_RADIUS_Z;

  private fetchedChunks: Set<string> = new Set();
  private isLoadingChunks: boolean = false;
  private pendingChunkUpdate: { chunkX: number; chunkZ: number } | null = null;
  private currentAbortController: AbortController | null = null;

  // Data structures for action path calculation
  private armyHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  private structureHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  private questHexes: Map<number, Map<number, HexEntityInfo>> = new Map();

  // Store armies positions by ID, to remove previous positions when army moves
  private armiesPositions: Map<number, { col: number; row: number }> = new Map();

  // Debounced re-render for tile updates
  private tileUpdateTimeout: NodeJS.Timeout | null = null;

  // Travel effects tracking
  private activeTravelEffects: Map<number, { promise: Promise<void>; end: () => void }> = new Map();

  // Track armies with pending movement transactions
  private pendingArmyMovements: Set<number> = new Set();

  constructor(scene: THREE.Scene, dojo: DojoResult, systemManager: WorldUpdateListener, fxManager: FXManager) {
    this.scene = scene;
    this.dojo = dojo;
    this.systemManager = systemManager;
    this.fxManager = fxManager;
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

    this.systemManager.Tile.onTileUpdate((value) => this.updateExploredHex(value));
    this.systemManager.Army.onTileUpdate((update) => this.updateArmyHexes(update));
    this.systemManager.Army.onDeadArmy((entityId) => this.deleteArmy(entityId));
    this.systemManager.Structure.onTileUpdate((update) => this.updateStructureHexes(update));

    // Setup GUI with duplicate prevention
    const folderName = "HexagonMap";
    const existingFolder = GUIManager.folders.find((folder: any) => folder._title === folderName);
    if (existingFolder) {
      existingFolder.destroy();
    }

    this.GUIFolder = GUIManager.addFolder(folderName);
    this.GUIFolder.add(this, "moveCameraToColRow");
    this.GUIFolder.add(this, "getPerformanceSummary").name("Performance Summary");
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
    const updateStartTime = performance.now();
    console.log(`[CHUNK-TIMING] Starting chunk update (${centerChunkX}, ${centerChunkZ})`);

    if (this.isLoadingChunks) {
      this.pendingChunkUpdate = { chunkX: centerChunkX, chunkZ: centerChunkZ };
      return;
    }

    this.isLoadingChunks = true;

    try {
      const clearStartTime = performance.now();
      this.visibleHexes.clear();
      console.log(`[CHUNK-TIMING] Clear visible hexes: ${(performance.now() - clearStartTime).toFixed(2)}ms`);

      const radiusX = this.chunkLoadRadiusX;
      const radiusZ = this.chunkLoadRadiusZ;
      console.log(
        `\n=== Updating visible hexes for center chunk (${centerChunkX}, ${centerChunkZ}) with radius (${radiusX}, ${radiusZ}) ===`,
      );

      const chunkKey = `${centerChunkZ * HexagonMap.CHUNK_SIZE},${centerChunkX * HexagonMap.CHUNK_SIZE}`;
      const entityFetchStartTime = performance.now();
      this.computeTileEntities(chunkKey);
      const entityFetchTime = performance.now() - entityFetchStartTime;
      console.log(`[CHUNK-TIMING] Compute tile entities: ${entityFetchTime.toFixed(2)}ms`);
      this.recordPerformanceMetric("Compute Tile Entities", entityFetchTime);

      const loadHexesStartTime = performance.now();
      for (let x = centerChunkX - radiusX; x <= centerChunkX + radiusX; x++) {
        for (let z = centerChunkZ - radiusZ; z <= centerChunkZ + radiusZ; z++) {
          if (this.isChunkInBounds(x, z)) {
            this.loadChunkHexes(x, z);
          } else {
            console.log(`Skipping chunk (${x}, ${z}) - out of bounds`);
          }
        }
      }
      console.log(`[CHUNK-TIMING] Load chunk hexes: ${(performance.now() - loadHexesStartTime).toFixed(2)}ms`);

      const boundsCalcStartTime = performance.now();
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
      console.log(`[CHUNK-TIMING] Bounds calculation: ${(performance.now() - boundsCalcStartTime).toFixed(2)}ms`);
      console.log("=== End update ===\n");

      const renderStartTime = performance.now();
      this.renderHexes();
      const renderTime = performance.now() - renderStartTime;
      console.log(`[CHUNK-TIMING] Render hexes: ${renderTime.toFixed(2)}ms`);
      this.recordPerformanceMetric("Render Hexes", renderTime);
    } finally {
      this.isLoadingChunks = false;
      const totalTime = performance.now() - updateStartTime;
      console.log(`[CHUNK-TIMING] Total chunk update time: ${totalTime.toFixed(2)}ms`);
      this.recordPerformanceMetric("Total Chunk Update", totalTime);

      this.chunkUpdateCount++;
      if (this.chunkUpdateCount % 3 === 0) {
        console.log(`[CHUNK-TIMING] Completed ${this.chunkUpdateCount} chunk updates. Performance summary:`);
        this.getPerformanceSummary();
      }

      if (this.pendingChunkUpdate) {
        const { chunkX, chunkZ } = this.pendingChunkUpdate;
        this.pendingChunkUpdate = null;

        if (chunkX !== centerChunkX || chunkZ !== centerChunkZ) {
          await this.updateVisibleHexes(chunkX, chunkZ);
        }
      }
    }
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

  private ensureHexagonMeshCapacity(requiredCapacity: number): void {
    if (!this.hexagonMesh || this.hexagonMeshCapacity < requiredCapacity) {
      if (this.hexagonMesh) {
        this.scene.remove(this.hexagonMesh);
        this.hexagonMesh.dispose();
      }

      const capacity = Math.min(Math.max(requiredCapacity, 1000), HexagonMap.MAX_HEX_CAPACITY);
      this.hexagonMesh = new THREE.InstancedMesh(HexagonMap.hexagonGeometry!, HexagonMap.hexagonMaterial!, capacity);
      this.hexagonMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
      this.hexagonMeshCapacity = capacity;
      this.scene.add(this.hexagonMesh);
    }
  }

  private renderHexes(): void {
    const prepareStartTime = performance.now();
    const allVisibleHexes = Array.from(this.visibleHexes).map((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      return { col, row, hexString };
    });

    const instanceCount = allVisibleHexes.length;

    if (instanceCount === 0) {
      this.tileRenderer.clearTiles();
      if (this.hexagonMesh) {
        this.hexagonMesh.count = 0;
      }
      return;
    }

    const capacityStartTime = performance.now();
    this.ensureHexagonMeshCapacity(instanceCount);
    console.log(`[RENDER-TIMING] Ensure mesh capacity: ${(performance.now() - capacityStartTime).toFixed(2)}ms`);

    console.log(
      `[RENDER-TIMING] Prepare data (${instanceCount} hexes): ${(performance.now() - prepareStartTime).toFixed(2)}ms`,
    );

    const instanceSetupStartTime = performance.now();
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

      if (!this.hasStructureAtHex(col, row)) {
        tilePositions.push({ col, row, biome, isExplored });
      }

      index++;
    });

    this.hexagonMesh!.count = instanceCount;
    const instanceSetupTime = performance.now() - instanceSetupStartTime;
    console.log(`[RENDER-TIMING] Setup instances: ${instanceSetupTime.toFixed(2)}ms`);
    this.recordPerformanceMetric("Setup Instances", instanceSetupTime);

    const updateStartTime = performance.now();
    this.hexagonMesh!.instanceMatrix.needsUpdate = true;
    if (this.hexagonMesh!.instanceColor) {
      this.hexagonMesh!.instanceColor.needsUpdate = true;
    }
    console.log(`[RENDER-TIMING] Update attributes: ${(performance.now() - updateStartTime).toFixed(2)}ms`);

    const tileRenderStartTime = performance.now();
    this.tileRenderer.renderTilesForHexes(tilePositions);
    const tileRenderTime = performance.now() - tileRenderStartTime;
    console.log(`[RENDER-TIMING] Render tiles: ${tileRenderTime.toFixed(2)}ms`);
    this.recordPerformanceMetric("Render Tiles", tileRenderTime);

    const boundsUpdateStartTime = performance.now();
    const bounds = this.getMapBounds();
    this.armyRenderer.setVisibleBounds(bounds);
    this.structureRenderer.setVisibleBounds(bounds);
    this.questRenderer.setVisibleBounds(bounds);
    console.log(`[RENDER-TIMING] Update bounds: ${(performance.now() - boundsUpdateStartTime).toFixed(2)}ms`);
  }

  public updateChunkLoading(cameraPosition: THREE.Vector3, force: boolean = false): void {
    const chunkLoadStartTime = performance.now();

    if (this.isLoadingChunks && !force) {
      return;
    }

    const coordCalcStartTime = performance.now();
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
    console.log(`[CHUNK-TIMING] Coordinate calculations: ${(performance.now() - coordCalcStartTime).toFixed(2)}ms`);

    if (chunkX !== this.lastChunkX || chunkZ !== this.lastChunkZ || force) {
      console.log(
        `[CHUNK-TIMING] Moving from chunk (${this.lastChunkX}, ${this.lastChunkZ}) to chunk (${chunkX}, ${chunkZ})${force ? " (forced)" : ""}`,
      );
      console.log(`Camera at (${cameraPosition.x.toFixed(2)}, ${cameraPosition.z.toFixed(2)}) -> Hex (${col}, ${row})`);
      console.log(`[CHUNK-TIMING] Chunk loading check: ${(performance.now() - chunkLoadStartTime).toFixed(2)}ms`);
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

    // Check if we have a selected object and clicked on a highlighted hex
    const selectedObject = this.selectionManager.getSelectedObject();
    if (selectedObject) {
      const actionPath = this.selectionManager.getActionPath(col, row);
      if (actionPath) {
        const actionType = ActionPaths.getActionType(actionPath);

        if (actionType === ActionType.Move || actionType === ActionType.Explore) {
          // Clear selection immediately to prevent further interactions
          this.selectionManager.clearSelection();

          // Move the army to the clicked hex
          await this.handleArmyMovement(selectedObject.id, actionPath);
        } else if (actionType === ActionType.Attack) {
          console.log(`Attack action at (${col}, ${row})`);
          // Handle attack action
          this.selectionManager.clearSelection();
        } else if (actionType === ActionType.Help) {
          console.log(`Help action at (${col}, ${row})`);
          // Handle help action
          this.selectionManager.clearSelection();
        } else if (actionType === ActionType.Quest) {
          console.log(`Quest action at (${col}, ${row})`);
          // Handle quest action
          this.selectionManager.clearSelection();
        }

        return;
      }
    }

    // Normal selection logic
    if (armies.length > 0) {
      this.selectArmy(armies[0].id);
    } else if (structures.length > 0) {
      this.selectStructure(structures[0].id);
    } else if (quests.length > 0) {
      this.selectionManager.selectObject(quests[0].id, "quest");
    } else {
      this.selectionManager.clearSelection();
    }
  }

  private async handleArmyMovement(armyId: number, actionPath: ActionPath[]): Promise<void> {
    const army = this.armyRenderer.getObject(armyId);
    if (!army || actionPath.length < 2) return;

    // Get target hex position
    const targetHex = actionPath[actionPath.length - 1].hex;
    const targetCol = targetHex.col - FELT_CENTER;
    const targetRow = targetHex.row - FELT_CENTER;

    // Get world position for target hex
    getWorldPositionForHex({ col: targetCol, row: targetRow }, true, this.tempVector3);
    const targetWorldPos = this.tempVector3.clone();

    // Determine action type and use appropriate effect
    const actionType = ActionPaths.getActionType(actionPath);
    const isExplored = actionType === ActionType.Move;

    const effectType = isExplored ? "travel" : "compass";
    const effectLabel = isExplored ? "Traveling" : "Exploring";

    // Start appropriate effect at destination
    const effect = this.fxManager.playFxAtCoords(
      effectType,
      targetWorldPos.x,
      targetWorldPos.y + 1,
      targetWorldPos.z - 1,
      2,
      effectLabel,
      true,
    );

    this.activeTravelEffects.set(armyId, effect);

    // Mark army as having pending movement transaction
    this.pendingArmyMovements.add(armyId);

    // Get account from store
    const account = this.dojo.account.account;
    if (!account) {
      console.error("No account available for army movement");
      effect.end();
      this.activeTravelEffects.delete(armyId);
      this.pendingArmyMovements.delete(armyId);
      return;
    }

    try {
      // Create army action manager and perform actual movement
      const armyActionManager = new ArmyActionManager(this.dojo.setup.components, this.dojo.setup.systemCalls, armyId);

      // Get current timestamps for movement
      const { currentArmiesTick } = getBlockTimestamp();

      // Perform the actual movement call
      await armyActionManager.moveArmy(account, actionPath, isExplored, currentArmiesTick);

      // End effect when transaction completes
      effect.end();
      this.activeTravelEffects.delete(armyId);

      console.log(
        `Army ${armyId} ${isExplored ? "moved" : "explored"} from (${army.col}, ${army.row}) to (${targetCol}, ${targetRow})`,
      );
    } catch (error) {
      console.error("Army movement failed:", error);
      // Clean up effects and pending state on error
      effect.end();
      this.activeTravelEffects.delete(armyId);
      this.pendingArmyMovements.delete(armyId);

      // Re-throw error to let caller handle it
      throw error;
    }
  }

  private selectArmy(armyId: number): void {
    // Check if army has pending movement transactions
    if (this.pendingArmyMovements.has(armyId)) {
      return;
    }

    // Check if army is currently moving
    if (this.armyRenderer.isObjectMoving(armyId)) {
      console.log(`[HexagonMap] Cannot select army ${armyId} - it is currently moving`);
      return;
    }

    this.selectionManager.selectObject(armyId, "army");

    // Get army object to find current position
    const army = this.armyRenderer.getObject(armyId);
    if (!army) return;

    console.log(`[HexagonMap] Selecting army ${armyId} at position (${army.col}, ${army.row})`);

    // Create army action manager
    const armyActionManager = new ArmyActionManager(this.dojo.setup.components, this.dojo.setup.systemCalls, armyId);

    // Get actual player address from store
    const playerAddress = loggedInAccount();

    // Get proper timestamps from block timestamp utility
    const { currentDefaultTick, currentArmiesTick } = getBlockTimestamp();

    // Debug: Log current armyHexes state
    console.log(`[HexagonMap] Current armyHexes state:`);
    for (const [col, rowMap] of this.armyHexes) {
      for (const [row, armyInfo] of rowMap) {
        console.log(`  Army ${armyInfo.id} at (${col}, ${row})`);
      }
    }

    // Find action paths for the army
    const actionPaths = armyActionManager.findActionPaths(
      this.structureHexes,
      this.armyHexes,
      this.exploredTiles,
      this.structureHexes,
      this.questHexes,
      currentDefaultTick,
      currentArmiesTick,
      playerAddress,
    );

    // Set action paths in selection manager for highlighting - pass ActionPaths object directly
    this.selectionManager.setActionPaths(actionPaths);
  }

  private selectStructure(structureId: number): void {
    this.selectionManager.selectObject(structureId, "structure");

    // Create structure action manager
    const structureActionManager = new StructureActionManager(this.dojo.setup.components, structureId);

    // Get actual player address from store
    const playerAddress = loggedInAccount();

    // Find action paths for the structure
    const actionPaths = structureActionManager.findActionPaths(this.armyHexes, this.exploredTiles, playerAddress);

    // Set action paths in selection manager for highlighting - pass ActionPaths object directly
    this.selectionManager.setActionPaths(actionPaths);
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
    // Clean up active travel effects
    this.activeTravelEffects.forEach((effect) => {
      effect.end();
    });
    this.activeTravelEffects.clear();

    if (this.GUIFolder) {
      this.GUIFolder.destroy();
      this.GUIFolder = null;
    }

    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }

    if (this.tileUpdateTimeout) {
      clearTimeout(this.tileUpdateTimeout);
      this.tileUpdateTimeout = null;
    }

    if (this.hexagonMesh) {
      this.scene.remove(this.hexagonMesh);
      this.hexagonMesh.dispose();
      this.hexagonMesh = null;
      this.hexagonMeshCapacity = 0;
    }

    this.tileRenderer.dispose();
    this.highlightRenderer.dispose();
    this.armyRenderer.dispose();
    this.structureRenderer.dispose();
    this.questRenderer.dispose();
    this.selectionManager.dispose();

    this.allHexes.clear();
    this.visibleHexes.clear();
    this.fetchedChunks.clear();
    this.isLoadingChunks = false;
    this.pendingChunkUpdate = null;
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

    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }

    this.currentAbortController = new AbortController();
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
      if (error instanceof Error && error.name === "AbortError") {
        console.log(`[HexagonMap] Tile entities request for chunk ${chunkKey} was aborted`);
      } else {
        this.fetchedChunks.delete(chunkKey);
        console.error("Error fetching tile entities:", error);
      }
    } finally {
      const end = performance.now();
      console.log("[HexagonMap] Tile entities query completed in", end - start, "ms");
      this.currentAbortController = null;
    }
  }

  public clearTileEntityCache() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }

    this.fetchedChunks.clear();
    this.isLoadingChunks = false;
    this.pendingChunkUpdate = null;
  }

  public moveCameraToColRow(col: number, row: number, controls?: any) {
    const worldPosition = getWorldPositionForHex({ col, row }, true, this.tempVector3);

    if (controls) {
      console.log("Moving camera to col", col, "row", row);

      // Update the target to the hex position
      controls.target.copy(worldPosition);

      // Maintain the top-down view by setting camera position relative to target
      // Keep the same height (y=10) and directly above the target
      const camera = controls.object;
      if (camera) {
        camera.position.set(worldPosition.x, 10, worldPosition.z);
        camera.lookAt(worldPosition.x, 0, worldPosition.z);
      }

      controls.update();

      // Force chunk loading at the new camera position
      this.updateChunkLoading(worldPosition, true);
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

      // Debounced re-render to batch tile updates
      if (this.tileUpdateTimeout) {
        clearTimeout(this.tileUpdateTimeout);
      }
      this.tileUpdateTimeout = setTimeout(() => {
        this.renderHexes();
        this.tileUpdateTimeout = null;
      }, 50);
    }
  }

  private isHexExplored(col: number, row: number): boolean {
    return this.exploredTiles.has(col) && this.exploredTiles.get(col)!.has(row);
  }

  public updateArmyHexes(update: ArmySystemUpdate) {
    const {
      hexCoords: { col, row },
      ownerAddress,
      ownerName,
      guildName,
      entityId,
      troopType,
      troopTier,
      isDaydreamsAgent,
    } = update;

    if (ownerAddress === undefined) return;

    const normalized = new Position({ x: col, y: row }).getNormalized();
    const newPos = { col: normalized.x, row: normalized.y };
    const oldPos = this.armiesPositions.get(entityId);

    // Update army position in our tracking
    this.armiesPositions.set(entityId, newPos);

    // Check if this is a new army or an existing one
    const existingArmy = this.armyRenderer.getObject(entityId);
    const isNewArmy = !existingArmy;

    if (isNewArmy) {
      // New army - add it
      console.log(`[HexagonMap] Added new army ${entityId} at (${newPos.col}, ${newPos.row})`);

      const army: ArmyObject = {
        id: entityId,
        col: newPos.col,
        row: newPos.row,
        owner: ownerAddress,
        type: "army",
        troopType,
        troopTier,
        ownerName,
        guildName,
        isDaydreamsAgent,
        isAlly: false,
      };

      this.armyRenderer.addObject(army);

      // Update hex tracking immediately for new armies
      if (!this.armyHexes.has(newPos.col)) {
        this.armyHexes.set(newPos.col, new Map());
      }
      this.armyHexes.get(newPos.col)?.set(newPos.row, { id: entityId, owner: ownerAddress });
    } else {
      // Existing army - check if it moved
      const hasMoved = oldPos && (oldPos.col !== newPos.col || oldPos.row !== newPos.row);

      if (hasMoved) {
        // Army moved - start movement (hex tracking will be updated after movement completes)
        console.log(
          `[HexagonMap] Moved army ${entityId} from (${oldPos.col}, ${oldPos.row}) to (${newPos.col}, ${newPos.row})`,
        );

        // Clear selection if this army is currently selected and has moved
        const selectedObject = this.selectionManager.getSelectedObject();
        if (selectedObject && selectedObject.id === entityId && selectedObject.type === "army") {
          this.selectionManager.clearSelection();
        }

        // Update army properties BEFORE starting movement (so movement logic has correct data)
        const updatedArmy: ArmyObject = {
          ...existingArmy,
          owner: ownerAddress,
          troopType,
          troopTier,
          ownerName,
          guildName,
          isDaydreamsAgent,
          isAlly: false,
        };
        this.armyRenderer.updateObject(updatedArmy);

        // Start smooth movement animation
        this.startSmoothArmyMovement(entityId, oldPos, newPos);
      } else {
        // Army didn't move, update hex tracking immediately
        if (!this.armyHexes.has(newPos.col)) {
          this.armyHexes.set(newPos.col, new Map());
        }
        this.armyHexes.get(newPos.col)?.set(newPos.row, { id: entityId, owner: ownerAddress });

        // Update army properties without position change
        const updatedArmy: ArmyObject = {
          ...existingArmy,
          col: newPos.col,
          row: newPos.row,
          owner: ownerAddress,
          troopType,
          troopTier,
          ownerName,
          guildName,
          isDaydreamsAgent,
          isAlly: false,
        };

        this.armyRenderer.updateObject(updatedArmy);
      }
    }

    // Remove from pending movements when position is updated from blockchain
    this.pendingArmyMovements.delete(entityId);
  }

  private startSmoothArmyMovement(
    entityId: number,
    oldPos: { col: number; row: number },
    newPos: { col: number; row: number },
  ) {
    // Update hex tracking immediately before starting animation
    this.updateArmyHexTracking(entityId, oldPos, newPos);

    // Calculate path using pathfinding
    const oldPosition = new Position({ x: oldPos.col, y: oldPos.row });
    const newPosition = new Position({ x: newPos.col, y: newPos.row });

    // Use a reasonable max distance for pathfinding (similar to desktop)
    const maxDistance = 50; // This should be based on army stamina, but using a reasonable default

    const path = findShortestPath(
      oldPosition,
      newPosition,
      this.exploredTiles,
      this.structureHexes,
      this.armyHexes,
      maxDistance,
    );

    if (path && path.length > 0) {
      // Convert path to movement format for the renderer
      const movementPath = path.map((pos) => {
        const normalized = pos.getNormalized();
        return { col: normalized.x, row: normalized.y };
      });

      // Start smooth movement animation (hex tracking already updated)
      this.armyRenderer.moveObjectAlongPath(entityId, movementPath, 300);
    } else {
      // If no path found, just update the sprite position to match the object position
      this.armyRenderer.updateObjectPosition(entityId, newPos.col, newPos.row);
    }
  }

  private updateArmyHexTracking(
    entityId: number,
    oldPos: { col: number; row: number },
    newPos: { col: number; row: number },
  ) {
    // Remove from old position in hex tracking
    this.armyHexes.get(oldPos.col)?.delete(oldPos.row);

    // Add to new position in hex tracking
    if (!this.armyHexes.has(newPos.col)) {
      this.armyHexes.set(newPos.col, new Map());
    }

    const army = this.armyRenderer.getObject(entityId);
    if (army) {
      this.armyHexes.get(newPos.col)?.set(newPos.row, { id: entityId, owner: army.owner || 0n });
    }
  }

  public updateStructureHexes(update: StructureSystemUpdate) {
    const {
      hexCoords: { col, row },
      owner: { address },
      entityId,
      structureType,
    } = update;

    const normalized = new Position({ x: col, y: row }).getNormalized();

    // Update structure hexes map for action path calculation
    if (!this.structureHexes.has(normalized.x)) {
      this.structureHexes.set(normalized.x, new Map());
    }
    this.structureHexes.get(normalized.x)?.set(normalized.y, { id: entityId, owner: address || 0n });

    const structure: StructureObject = {
      id: entityId,
      col: normalized.x,
      row: normalized.y,
      owner: address || 0n,
      type: "structure",
      structureType: structureType.toString(),
    };
    this.structureRenderer.updateObject(structure);
  }

  public deleteArmy(entityId: number) {
    // Remove from army hexes map
    const oldPos = this.armiesPositions.get(entityId);
    if (oldPos) {
      this.armyHexes.get(oldPos.col)?.delete(oldPos.row);
      this.armiesPositions.delete(entityId);
    }

    // Remove from renderer (this will properly dispose of the sprite)
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

  public clearSelection(): void {
    this.selectionManager.clearSelection();
  }

  public isArmySelectable(armyId: number): boolean {
    return !this.pendingArmyMovements.has(armyId) && !this.armyRenderer.isObjectMoving(armyId);
  }

  private recordPerformanceMetric(operation: string, duration: number): void {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    const metrics = this.performanceMetrics.get(operation)!;
    metrics.push(duration);

    // Keep only last 10 measurements to avoid memory bloat
    if (metrics.length > 10) {
      metrics.shift();
    }
  }

  public getPerformanceSummary(): void {
    console.log("\n=== CHUNK PERFORMANCE SUMMARY ===");

    this.performanceMetrics.forEach((durations, operation) => {
      if (durations.length === 0) return;

      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const max = Math.max(...durations);
      const min = Math.min(...durations);
      const latest = durations[durations.length - 1];

      console.log(`${operation}:`);
      console.log(
        `  Latest: ${latest.toFixed(2)}ms | Avg: ${avg.toFixed(2)}ms | Min: ${min.toFixed(2)}ms | Max: ${max.toFixed(2)}ms`,
      );
    });

    console.log("=== END PERFORMANCE SUMMARY ===\n");
  }
}
