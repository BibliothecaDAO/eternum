import {
  ActionPath,
  ActionPaths,
  ActionType,
  ArmyActionManager,
  ArmySystemUpdate,
  ChestSystemUpdate,
  configManager,
  ExplorerMoveSystemUpdate,
  ExplorerTroopsSystemUpdate,
  getBlockTimestamp,
  isRelicActive,
  Position,
  QuestSystemUpdate,
  RelicEffectSystemUpdate,
  StaminaManager,
  StructureActionManager,
  StructureSystemUpdate,
  TileSystemUpdate,
  WorldUpdateListener,
} from "@bibliothecadao/eternum";
import { DojoResult } from "@bibliothecadao/react";
import { BiomeType, FELT_CENTER, HexEntityInfo, ID, RelicEffect, TroopTier, TroopType } from "@bibliothecadao/types";
import * as THREE from "three";
import { getMapFromTorii } from "../../../../../app/dojo/queries";
import {
  ArmyManager,
  ArmyObject,
  BiomesManager,
  ChestManager,
  ChestObject,
  QuestManager,
  StructureManager,
  StructureObject,
} from "../../entity-managers";
import { FXManager } from "../../managers/fx-manager";
import { GUIManager } from "../../managers/gui-manager";
import { HighlightRenderer } from "../../managers/highlight-renderer";
import { SelectionManager } from "../../managers/selection-manager";
import { createHexagonShape } from "../../utils/hexagon-geometry";
import { findShortestPath } from "../../utils/pathfinding";
import { getHexagonCoordinates, getWorldPositionForHex, HEX_SIZE, loggedInAccount } from "../../utils/utils";

export class HexagonMap {
  private scene: THREE.Scene;
  private dojo: DojoResult;
  private store: any;
  private allHexes: Set<string> = new Set();
  private visibleHexes: Set<string> = new Set();
  private exploredTiles: Map<number, Map<number, BiomeType>> = new Map();

  private hexagonMesh: THREE.InstancedMesh | null = null;
  private hexagonMeshCapacity: number = 0;
  private static readonly MAX_HEX_CAPACITY = 5000;
  private biomesManager: BiomesManager;
  private highlightRenderer: HighlightRenderer;
  private armyManager: ArmyManager;
  private structureManager: StructureManager;
  private questManager: QuestManager;
  private chestManager: ChestManager;
  private selectionManager: SelectionManager;
  private fxManager: FXManager;
  private GUIFolder: any;

  private raycaster: THREE.Raycaster;
  private dummy = new THREE.Object3D();
  private systemManager: WorldUpdateListener;

  private tempVector3 = new THREE.Vector3();
  private tempColor = new THREE.Color();

  private static hexagonGeometry: THREE.ShapeGeometry | null = null;
  private static hexagonMaterial: THREE.MeshLambertMaterial | null = null;

  private lastChunkX: number = -9999;
  private lastChunkZ: number = -9999;

  private performanceMetrics: Map<string, number[]> = new Map();
  private chunkUpdateCount: number = 0;

  private static readonly CHUNK_LOAD_RADIUS_X = 1;
  private static readonly CHUNK_LOAD_RADIUS_Z = 3;
  private static readonly CHUNK_SIZE = 5;

  private chunkLoadRadiusX = HexagonMap.CHUNK_LOAD_RADIUS_X;
  private chunkLoadRadiusZ = HexagonMap.CHUNK_LOAD_RADIUS_Z;

  private fetchedChunks: Set<string> = new Set();
  private isLoadingChunks: boolean = false;
  private pendingChunkUpdate: { chunkX: number; chunkZ: number } | null = null;
  private currentAbortController: AbortController | null = null;

  private armyHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  private structureHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  private questHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  private chestHexes: Map<number, Map<number, HexEntityInfo>> = new Map();

  private armiesPositions: Map<number, { col: number; row: number }> = new Map();

  private tileUpdateTimeout: NodeJS.Timeout | null = null;

  private activeTravelEffects: Map<number, { promise: Promise<void>; end: () => void }> = new Map();

  private pendingArmyMovements: Set<number> = new Set();

  // Relic effects storage - holds active relic effects for each army
  private armyRelicEffects: Map<
    number,
    Array<{ relicNumber: number; effect: RelicEffect; fx: { end: () => void; instance?: any } }>
  > = new Map();

  // Pending relic effects store - holds relic effects for entities that aren't loaded yet
  private pendingRelicEffects: Map<number, Set<{ relicResourceId: number; effect: RelicEffect }>> = new Map();

  // Relic effect validation timer
  private relicValidationInterval: NodeJS.Timeout | null = null;

  constructor(
    scene: THREE.Scene,
    dojo: DojoResult,
    systemManager: WorldUpdateListener,
    fxManager: FXManager,
    store: any,
  ) {
    this.scene = scene;
    this.dojo = dojo;
    this.systemManager = systemManager;
    this.fxManager = fxManager;
    this.store = store;
    this.raycaster = new THREE.Raycaster();

    this.biomesManager = new BiomesManager(scene);
    this.highlightRenderer = new HighlightRenderer(scene);
    this.armyManager = new ArmyManager(scene);
    this.structureManager = new StructureManager(scene);
    this.questManager = new QuestManager(scene);
    this.chestManager = new ChestManager(scene);

    this.selectionManager = new SelectionManager(this.highlightRenderer);
    this.selectionManager.registerObjectRenderer("army", this.armyManager);
    this.selectionManager.registerObjectRenderer("structure", this.structureManager);
    this.selectionManager.registerObjectRenderer("quest", this.questManager);
    this.selectionManager.registerObjectRenderer("chest", this.chestManager);

    this.initializeStaticAssets();
    this.initializeMap();

    this.systemManager.Tile.onTileUpdate((value) => this.updateExploredHex(value));
    this.systemManager.Army.onTileUpdate((update) => this.updateArmyHexes(update));
    this.systemManager.Army.onExplorerTroopsUpdate((update) => this.updateArmyFromExplorerTroopsUpdate(update));
    this.systemManager.Army.onDeadArmy((entityId) => this.deleteArmy(entityId));
    this.systemManager.Structure.onTileUpdate((update) => this.updateStructureHexes(update));
    this.systemManager.Structure.onStructureUpdate((update) => this.updateStructureFromStructureUpdate(update));
    this.systemManager.Structure.onStructureBuildingsUpdate((update) => this.updateStructureFromBuildingUpdate(update));
    this.systemManager.Structure.onContribution((value) => this.updateStructureContribution(value));
    this.systemManager.Quest.onTileUpdate((update) => this.updateQuestHexes(update));
    this.systemManager.Chest.onTileUpdate((update) => this.updateChestHexes(update));
    this.systemManager.Chest.onDeadChest((entityId) => this.deleteChest(entityId));
    this.systemManager.RelicEffect.onExplorerTroopsUpdate(async (update) => this.handleRelicEffectUpdate(update));
    this.systemManager.RelicEffect.onStructureGuardUpdate((update) => this.handleRelicEffectUpdate(update));
    this.systemManager.RelicEffect.onStructureProductionUpdate((update) => this.handleRelicEffectUpdate(update));
    this.systemManager.ExplorerMove.onExplorerMoveEventUpdate((update) => this.handleExplorerMoveUpdate(update));

    const folderName = "HexagonMap";
    const existingFolder = GUIManager.folders.find((folder: any) => folder._title === folderName);
    if (existingFolder) {
      existingFolder.destroy();
    }

    this.GUIFolder = GUIManager.addFolder(folderName);
    this.GUIFolder.add(this, "moveCameraToColRow");
    this.GUIFolder.add(this, "getPerformanceSummary").name("Performance Summary");

    // Start relic effect validation timer (every 5 seconds)
    this.startRelicValidationTimer();
  }

  private initializeStaticAssets(): void {
    if (!HexagonMap.hexagonGeometry) {
      const hexagonShape = createHexagonShape(HEX_SIZE);
      HexagonMap.hexagonGeometry = new THREE.ShapeGeometry(hexagonShape);
      HexagonMap.hexagonGeometry.computeBoundingBox();
      HexagonMap.hexagonGeometry.computeBoundingSphere();
    }

    if (!HexagonMap.hexagonMaterial) {
      HexagonMap.hexagonMaterial = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5,
      });
    }
  }

  private async initializeMap(): Promise<void> {
    const centerChunkX = 0;
    const centerChunkZ = 0;

    this.lastChunkX = centerChunkX;
    this.lastChunkZ = centerChunkZ;

    await this.waitUntilMaterialsReady();

    this.updateVisibleHexes(centerChunkX, centerChunkZ);
  }

  private async waitUntilMaterialsReady(): Promise<void> {
    await this.biomesManager.ensureMaterialsReady();
    await this.structureManager.ensureMaterialsReady();
    await this.armyManager.ensureMaterialsReady();
    await this.questManager.ensureMaterialsReady();
    await this.chestManager.ensureMaterialsReady();
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
          this.updateVisibleHexes(chunkX, chunkZ);
        }
      }
    }
  }

  private isChunkInBounds(_chunkX: number, _chunkZ: number): boolean {
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
      this.hexagonMesh.computeBoundingBox();
      this.hexagonMesh.computeBoundingSphere();
      this.hexagonMeshCapacity = capacity;
      this.scene.add(this.hexagonMesh);
    }
  }

  private renderHexes(): void {
    const prepareStartTime = performance.now();
    const allVisibleHexes = Array.from(this.visibleHexes).map((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      return { col, row };
    });

    const instanceCount = allVisibleHexes.length;

    if (instanceCount === 0) {
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

    allVisibleHexes.forEach(({ col, row }) => {
      getWorldPositionForHex({ col, row }, true, this.tempVector3);

      this.dummy.position.copy(this.tempVector3);
      this.dummy.position.y = 0.1;
      this.dummy.rotation.set(-Math.PI / 2, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.hexagonMesh!.setMatrixAt(index, this.dummy.matrix);

      this.tempColor.setHex(0x4a90e2);
      this.hexagonMesh!.setColorAt(index, this.tempColor);

      index++;
    });

    this.hexagonMesh!.count = index;
    const instanceSetupTime = performance.now() - instanceSetupStartTime;
    console.log(`[RENDER-TIMING] Setup instances: ${instanceSetupTime.toFixed(2)}ms`);
    this.recordPerformanceMetric("Setup Instances", instanceSetupTime);

    const updateStartTime = performance.now();
    this.hexagonMesh!.instanceMatrix.needsUpdate = true;
    if (this.hexagonMesh!.instanceColor) {
      this.hexagonMesh!.instanceColor.needsUpdate = true;
    }
    this.hexagonMesh!.computeBoundingBox();
    this.hexagonMesh!.computeBoundingSphere();
    console.log(`[RENDER-TIMING] Update attributes: ${(performance.now() - updateStartTime).toFixed(2)}ms`);

    const boundsUpdateStartTime = performance.now();
    const bounds = this.getMapBounds();
    this.biomesManager.setVisibleBounds(bounds);
    this.armyManager.setVisibleBounds(bounds);
    this.structureManager.setVisibleBounds(bounds);
    this.questManager.setVisibleBounds(bounds);
    this.chestManager.setVisibleBounds(bounds);
    console.log(`[RENDER-TIMING] Update bounds: ${(performance.now() - boundsUpdateStartTime).toFixed(2)}ms`);
  }

  public async updateChunkLoading(cameraPosition: THREE.Vector3, force: boolean = false): Promise<void> {
    await this.waitUntilMaterialsReady();

    const chunkLoadStartTime = performance.now();

    if (this.isLoadingChunks && !force) {
      return;
    }

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
    if (!this.hexagonMesh) {
      console.log("[HexagonMap] No hexagon mesh available for click detection");
      return;
    }

    if (this.hexagonMesh.count === 0) {
      console.log("[HexagonMap] Hexagon mesh has no instances");
      return;
    }

    this.raycaster.setFromCamera(mouse, camera);
    this.raycaster.layers.enableAll();
    this.raycaster.params.Points!.threshold = 0.1;

    const intersects = this.raycaster.intersectObjects([this.hexagonMesh], false);

    console.log(
      `[HexagonMap] Click at mouse (${mouse.x.toFixed(3)}, ${mouse.y.toFixed(3)}) found ${intersects.length} intersections`,
    );

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const intersectedObject = intersect.object;

      console.log(`[HexagonMap] Intersected object:`, intersectedObject.type, intersectedObject.uuid);

      if (intersectedObject instanceof THREE.InstancedMesh) {
        const instanceId = intersect.instanceId;
        console.log(`[HexagonMap] Instance ID: ${instanceId}, Distance: ${intersect.distance.toFixed(3)}`);

        if (instanceId !== undefined && instanceId >= 0 && instanceId < this.hexagonMesh.count) {
          const hexData = getHexagonCoordinates(intersectedObject, instanceId);
          console.log(`[HexagonMap] Hexagon clicked: col=${hexData.hexCoords.col}, row=${hexData.hexCoords.row}`);

          this.handleHexClick(hexData.hexCoords.col, hexData.hexCoords.row);
          this.showClickFeedback(instanceId);
        } else {
          console.warn(`[HexagonMap] Invalid instance ID: ${instanceId}, mesh count: ${this.hexagonMesh.count}`);
        }
      }
    } else {
      console.log(
        `[HexagonMap] No intersections found. Mesh bounds:`,
        this.hexagonMesh.boundingBox,
        this.hexagonMesh.boundingSphere,
      );
    }
  }

  private async handleHexClick(col: number, row: number): Promise<void> {
    const armyInfo = this.armyHexes.get(col)?.get(row);
    const structureInfo = this.structureHexes.get(col)?.get(row);
    const questInfo = this.questHexes.get(col)?.get(row);
    const chestInfo = this.chestHexes.get(col)?.get(row);

    const armies = armyInfo
      ? [this.armyManager.getObject(armyInfo.id)].filter((obj): obj is NonNullable<typeof obj> => obj !== undefined)
      : [];
    const structures = structureInfo
      ? [this.structureManager.getObject(structureInfo.id)].filter(
          (obj): obj is NonNullable<typeof obj> => obj !== undefined,
        )
      : [];
    const quests = questInfo
      ? [this.questManager.getObject(questInfo.id)].filter((obj): obj is NonNullable<typeof obj> => obj !== undefined)
      : [];
    const chests = chestInfo
      ? [this.chestManager.getObject(chestInfo.id)].filter((obj): obj is NonNullable<typeof obj> => obj !== undefined)
      : [];

    const selectedObject = this.selectionManager.getSelectedObject();
    if (selectedObject) {
      const actionPath = this.selectionManager.getActionPath(col, row);
      if (actionPath) {
        const actionType = ActionPaths.getActionType(actionPath);

        if (actionType === ActionType.Move || actionType === ActionType.Explore) {
          this.selectionManager.clearSelection();

          await this.handleArmyMovement(selectedObject.id, actionPath);
        } else if (actionType === ActionType.Attack) {
          console.log(`Attack action at (${col}, ${row})`);
          this.selectionManager.clearSelection();
        } else if (actionType === ActionType.Help) {
          console.log(`Help action at (${col}, ${row})`);
          this.selectionManager.clearSelection();
        } else if (actionType === ActionType.Quest) {
          console.log(`Quest action at (${col}, ${row})`);
          this.selectionManager.clearSelection();
        } else if (actionType === ActionType.Chest) {
          console.log(`Chest action at (${col}, ${row})`);
          this.handleChestAction(selectedObject.id, actionPath);
          this.selectionManager.clearSelection();
        }

        return;
      }
    }

    // TEST: Play relic fx at clicked hex coordinates
    // await this.playTestRelicFx(col, row);

    if (armies.length > 0) {
      this.selectArmy(armies[0].id);
    } else if (structures.length > 0) {
      this.selectStructure(structures[0].id, col, row);
    } else if (quests.length > 0) {
      this.selectionManager.selectObject(quests[0].id, "quest", col, row);
    } else if (chests.length > 0) {
      this.selectionManager.clearSelection();
    } else {
      this.selectionManager.clearSelection();
    }
  }

  private async handleArmyMovement(armyId: number, actionPath: ActionPath[]): Promise<void> {
    const army = this.armyManager.getObject(armyId);
    if (!army || actionPath.length < 2) return;

    const targetHex = actionPath[actionPath.length - 1].hex;
    const targetCol = targetHex.col - FELT_CENTER;
    const targetRow = targetHex.row - FELT_CENTER;

    getWorldPositionForHex({ col: targetCol, row: targetRow }, true, this.tempVector3);
    const targetWorldPos = this.tempVector3.clone();

    const actionType = ActionPaths.getActionType(actionPath);
    const isExplored = actionType === ActionType.Move;

    const effectType = isExplored ? "travel" : "compass";
    const effectLabel = isExplored ? "Traveling" : "Exploring";

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

    this.pendingArmyMovements.add(armyId);

    const account = this.dojo.account.account;
    if (!account) {
      console.error("No account available for army movement");
      effect.end();
      this.activeTravelEffects.delete(armyId);
      this.pendingArmyMovements.delete(armyId);
      return;
    }

    try {
      const armyActionManager = new ArmyActionManager(this.dojo.setup.components, this.dojo.setup.systemCalls, armyId);

      const { currentArmiesTick } = getBlockTimestamp();

      await armyActionManager.moveArmy(account, actionPath, isExplored, currentArmiesTick);

      effect.end();
      this.activeTravelEffects.delete(armyId);

      console.log(
        `Army ${armyId} ${isExplored ? "moved" : "explored"} from (${army.col}, ${army.row}) to (${targetCol}, ${targetRow})`,
      );
    } catch (error) {
      console.error("Army movement failed:", error);
      effect.end();
      this.activeTravelEffects.delete(armyId);
      this.pendingArmyMovements.delete(armyId);

      throw error;
    }
  }

  private handleChestAction(explorerEntityId: number, actionPath: ActionPath[]): void {
    const targetHex = actionPath[actionPath.length - 1].hex;

    this.store.openChestDrawer(explorerEntityId, { x: targetHex.col, y: targetHex.row });
  }

  private selectArmy(armyId: number): void {
    if (this.pendingArmyMovements.has(armyId)) {
      return;
    }

    if (this.armyManager.isObjectMoving(armyId)) {
      console.log(`[HexagonMap] Cannot select army ${armyId} - it is currently moving`);
      return;
    }

    const army = this.armyManager.getObject(armyId);
    if (!army) return;

    this.selectionManager.selectObject(armyId, "army", army.col, army.row);

    console.log(`[HexagonMap] Selecting army ${armyId} at position (${army.col}, ${army.row})`);

    const armyActionManager = new ArmyActionManager(this.dojo.setup.components, this.dojo.setup.systemCalls, armyId);

    const playerAddress = loggedInAccount();

    const { currentDefaultTick, currentArmiesTick } = getBlockTimestamp();

    const actionPaths = armyActionManager.findActionPaths(
      this.structureHexes,
      this.armyHexes,
      this.exploredTiles,
      this.questHexes,
      this.chestHexes,
      currentDefaultTick,
      currentArmiesTick,
      playerAddress,
    );

    this.selectionManager.setActionPaths(actionPaths);
  }

  private selectStructure(structureId: number, col: number, row: number): void {
    this.selectionManager.selectObject(structureId, "structure", col, row);

    const structureActionManager = new StructureActionManager(this.dojo.setup.components, structureId);

    const playerAddress = loggedInAccount();

    const actionPaths = structureActionManager.findActionPaths(this.armyHexes, this.exploredTiles, playerAddress);

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
    this.activeTravelEffects.forEach((effect) => {
      effect.end();
    });
    this.activeTravelEffects.clear();

    // Stop relic validation timer
    this.stopRelicValidationTimer();

    // Clean up relic effects
    for (const [entityId] of this.armyRelicEffects) {
      this.updateArmyRelicEffects(entityId, []);
    }
    this.armyRelicEffects.clear();
    this.pendingRelicEffects.clear();

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

    this.biomesManager.dispose();
    this.highlightRenderer.dispose();
    this.armyManager.dispose();
    this.structureManager.dispose();
    this.questManager.dispose();
    this.chestManager.dispose();
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

    this.armyManager.getAllObjects().forEach((army) => {
      this.armyManager.removeObject(army.id);
    });

    this.chestManager.getAllObjects().forEach((chest) => {
      this.chestManager.removeObject(chest.id);
    });

    this.structureManager.getAllObjects().forEach((structure) => {
      this.structureManager.removeObject(structure.id);
    });

    this.questManager.getAllObjects().forEach((quest) => {
      this.questManager.removeObject(quest.id);
    });

    this.armyHexes.clear();
    this.chestHexes.clear();
    this.structureHexes.clear();
    this.questHexes.clear();

    this.fetchedChunks.clear();
    this.isLoadingChunks = false;
    this.pendingChunkUpdate = null;
  }

  public moveCameraToColRow(col: number, row: number, controls?: any) {
    const worldPosition = getWorldPositionForHex({ col, row }, true, this.tempVector3);

    if (controls) {
      console.log("Moving camera to col", col, "row", row);

      controls.target.copy(worldPosition);

      const camera = controls.object;
      if (camera) {
        camera.position.set(worldPosition.x, 10, worldPosition.z);
        camera.lookAt(worldPosition.x, 0, worldPosition.z);
      }

      controls.update();

      this.updateChunkLoading(worldPosition, true);
    }

    return worldPosition;
  }

  private async updateExploredHex(update: TileSystemUpdate) {
    const { hexCoords, removeExplored, biome } = update;
    const normalized = new Position({ x: hexCoords.col, y: hexCoords.row }).getNormalized();

    const col = normalized.x;
    const row = normalized.y;

    if (removeExplored) {
      this.exploredTiles.get(col)?.delete(row);
      this.biomesManager.removeExploredTile(col, row);
      return;
    }

    if (!this.exploredTiles.has(col)) {
      this.exploredTiles.set(col, new Map());
    }
    if (!this.exploredTiles.get(col)!.has(row)) {
      this.exploredTiles.get(col)!.set(row, biome);

      await this.biomesManager.ensureMaterialsReady();
      this.biomesManager.addExploredTile(col, row, biome);
    }
  }

  public async updateArmyHexes(update: ArmySystemUpdate) {
    const {
      hexCoords: { col, row },
      ownerAddress,
      ownerName,
      guildName,
      entityId,
      troopType,
      troopTier,
      isDaydreamsAgent,
      troopCount,
      currentStamina,
      maxStamina,
      onChainStamina,
    } = update;

    if (ownerAddress === undefined) return;

    const normalized = new Position({ x: col, y: row }).getNormalized();
    const newPos = { col: normalized.x, row: normalized.y };
    const oldPos = this.armiesPositions.get(entityId);

    this.armiesPositions.set(entityId, newPos);

    const existingArmy = this.armyManager.getObject(entityId);
    const isNewArmy = !existingArmy;

    if (isNewArmy) {
      let finalMaxStamina = maxStamina || 0;
      if (!finalMaxStamina && troopType && troopTier) {
        try {
          finalMaxStamina = Number(configManager.getTroopStaminaConfig(troopType, troopTier));
        } catch (error) {
          console.warn(`Failed to get max stamina config for ${troopType} ${troopTier}:`, error);
        }
      }

      console.log(
        `[HexagonMap] Added new army ${entityId} at (${newPos.col}, ${newPos.row}) with stamina ${currentStamina || 0}/${finalMaxStamina}`,
      );

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
        troopCount: troopCount || 0,
        currentStamina: currentStamina || 0,
        maxStamina: finalMaxStamina,
        onChainStamina: onChainStamina,
      };

      this.armyManager.addObject(army);

      // Apply any pending relic effects for this newly added army
      await this.applyPendingRelicEffects(entityId);

      if (!this.armyHexes.has(newPos.col)) {
        this.armyHexes.set(newPos.col, new Map());
      }
      this.armyHexes.get(newPos.col)?.set(newPos.row, { id: entityId, owner: ownerAddress });
    } else {
      const hasMoved = oldPos && (oldPos.col !== newPos.col || oldPos.row !== newPos.row);

      if (hasMoved) {
        console.log(
          `[HexagonMap] Moved army ${entityId} from (${oldPos.col}, ${oldPos.row}) to (${newPos.col}, ${newPos.row})`,
        );

        const selectedObject = this.selectionManager.getSelectedObject();
        if (selectedObject && selectedObject.id === entityId && selectedObject.type === "army") {
          this.selectionManager.clearSelection();
        }

        let finalMaxStamina = maxStamina || existingArmy.maxStamina || 0;
        if (!finalMaxStamina && troopType && troopTier) {
          try {
            const troopTypeEnum =
              typeof troopType === "string" ? TroopType[troopType as keyof typeof TroopType] : troopType;
            const troopTierEnum =
              typeof troopTier === "string" ? TroopTier[troopTier as keyof typeof TroopTier] : troopTier;
            const staminaConfig = configManager.getTroopStaminaConfig(troopTypeEnum, troopTierEnum);
            finalMaxStamina = Number(staminaConfig.staminaMax);
          } catch (error) {
            console.warn(`Failed to get max stamina config for ${troopType} ${troopTier}:`, error);
          }
        }

        const updatedArmy: ArmyObject = {
          ...existingArmy,
          owner: ownerAddress,
          troopType,
          troopTier,
          ownerName,
          guildName,
          isDaydreamsAgent,
          isAlly: false,
          troopCount: troopCount ?? existingArmy.troopCount ?? 0,
          currentStamina: existingArmy.currentStamina ?? 0,
          maxStamina: existingArmy.maxStamina ?? 0,
          onChainStamina: existingArmy.onChainStamina,
        };
        this.armyManager.updateObject(updatedArmy);

        this.startSmoothArmyMovement(entityId, oldPos, newPos);
      } else {
        if (!this.armyHexes.has(newPos.col)) {
          this.armyHexes.set(newPos.col, new Map());
        }
        this.armyHexes.get(newPos.col)?.set(newPos.row, { id: entityId, owner: ownerAddress });

        let finalMaxStamina = maxStamina || existingArmy.maxStamina || 0;
        if (!finalMaxStamina && troopType && troopTier) {
          try {
            const troopTypeEnum =
              typeof troopType === "string" ? TroopType[troopType as keyof typeof TroopType] : troopType;
            const troopTierEnum =
              typeof troopTier === "string" ? TroopTier[troopTier as keyof typeof TroopTier] : troopTier;
            const staminaConfig = configManager.getTroopStaminaConfig(troopTypeEnum, troopTierEnum);
            finalMaxStamina = Number(staminaConfig.staminaMax);
          } catch (error) {
            console.warn(`Failed to get max stamina config for ${troopType} ${troopTier}:`, error);
          }
        }

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
          troopCount: troopCount ?? existingArmy.troopCount ?? 0,
          currentStamina: existingArmy.currentStamina ?? 0,
          maxStamina: existingArmy.maxStamina ?? 0,
          onChainStamina: existingArmy.onChainStamina,
        };

        this.armyManager.updateObject(updatedArmy);
      }
    }

    this.pendingArmyMovements.delete(entityId);
  }

  private startSmoothArmyMovement(
    entityId: number,
    oldPos: { col: number; row: number },
    newPos: { col: number; row: number },
  ) {
    this.updateArmyHexTracking(entityId, oldPos, newPos);

    const oldPosition = new Position({ x: oldPos.col, y: oldPos.row });
    const newPosition = new Position({ x: newPos.col, y: newPos.row });

    const maxDistance = 50;

    const path = findShortestPath(
      oldPosition,
      newPosition,
      this.exploredTiles,
      this.structureHexes,
      this.armyHexes,
      maxDistance,
    );

    if (path && path.length > 0) {
      const movementPath = path.map((pos) => {
        const normalized = pos.getNormalized();
        return { col: normalized.x, row: normalized.y };
      });

      // Update relic effects to follow the moving army
      this.updateRelicEffectPositions(entityId);
      this.armyManager.moveObjectAlongPath(entityId, movementPath, 300);
    } else {
      this.armyManager.updateObjectPosition(entityId, newPos.col, newPos.row);
      // Update relic effects for teleported army
      this.updateRelicEffectPositions(entityId);
    }
  }

  private updateArmyHexTracking(
    entityId: number,
    oldPos: { col: number; row: number },
    newPos: { col: number; row: number },
  ) {
    this.armyHexes.get(oldPos.col)?.delete(oldPos.row);

    if (!this.armyHexes.has(newPos.col)) {
      this.armyHexes.set(newPos.col, new Map());
    }

    const army = this.armyManager.getObject(entityId);
    if (army) {
      this.armyHexes.get(newPos.col)?.set(newPos.row, { id: entityId, owner: army.owner || 0n });
    }
  }

  public updateStructureHexes(update: StructureSystemUpdate) {
    console.log("[HexagonMap] Structure tile update:", update);
    const {
      hexCoords: { col, row },
      owner: { address },
      entityId,
      structureType,
    } = update;

    const normalized = new Position({ x: col, y: row }).getNormalized();

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
      ownerName: update.owner.ownerName,
      guildName: update.owner.guildName,
      guardArmies: update.guardArmies,
      activeProductions: update.activeProductions,
      hyperstructureRealmCount: update.hyperstructureRealmCount,
      stage: update.stage,
      initialized: update.initialized,
      level: update.level,
      hasWonder: update.hasWonder,
    };
    this.structureManager.updateObject(structure);
  }

  public deleteArmy(entityId: number) {
    // Clear any relic effects for this army
    this.updateArmyRelicEffects(entityId, []);

    // Clear any pending relic effects
    this.clearPendingRelicEffects(entityId);

    const oldPos = this.armiesPositions.get(entityId);
    if (oldPos) {
      this.armyHexes.get(oldPos.col)?.delete(oldPos.row);
      this.armiesPositions.delete(entityId);
    }

    this.armyManager.removeObject(entityId);
  }

  public updateQuestHexes(update: QuestSystemUpdate) {
    const {
      hexCoords: { col, row },
      entityId,
    } = update;

    const normalized = new Position({ x: col, y: row }).getNormalized();

    if (!this.questHexes.has(normalized.x)) {
      this.questHexes.set(normalized.x, new Map());
    }
    this.questHexes.get(normalized.x)?.set(normalized.y, { id: entityId, owner: 0n });

    const quest = {
      id: entityId,
      col: normalized.x,
      row: normalized.y,
      owner: 0n,
      type: "quest" as const,
    };
    this.questManager.addObject(quest);
  }

  public updateChestHexes(update: ChestSystemUpdate) {
    const {
      hexCoords: { col, row },
      occupierId,
    } = update;

    const normalized = new Position({ x: col, y: row }).getNormalized();

    if (!this.chestHexes.has(normalized.x)) {
      this.chestHexes.set(normalized.x, new Map());
    }
    this.chestHexes.get(normalized.x)?.set(normalized.y, { id: occupierId, owner: 0n });

    const chest: ChestObject = {
      id: occupierId,
      col: normalized.x,
      row: normalized.y,
      owner: 0n,
      type: "chest",
    };
    this.chestManager.addObject(chest);
  }

  public deleteChest(entityId: number) {
    this.chestHexes.forEach((rowMap, col) => {
      rowMap.forEach((chestInfo, row) => {
        if (chestInfo.id === entityId) {
          rowMap.delete(row);
          if (rowMap.size === 0) {
            this.chestHexes.delete(col);
          }
        }
      });
    });

    this.chestManager.removeObject(entityId);
  }

  public hasArmyAtHex(col: number, row: number): boolean {
    const normalized = new Position({ x: col, y: row }).getNormalized();
    return this.armyHexes.has(normalized.x) && this.armyHexes.get(normalized.x)!.has(normalized.y);
  }

  public hasStructureAtHex(col: number, row: number): boolean {
    const normalized = new Position({ x: col, y: row }).getNormalized();
    return this.structureHexes.has(normalized.x) && this.structureHexes.get(normalized.x)!.has(normalized.y);
  }

  public hasChestAtHex(col: number, row: number): boolean {
    const normalized = new Position({ x: col, y: row }).getNormalized();
    return this.chestHexes.has(normalized.x) && this.chestHexes.get(normalized.x)!.has(normalized.y);
  }

  public getArmyAtHex(col: number, row: number): { id: number; owner: bigint } | undefined {
    const normalized = new Position({ x: col, y: row }).getNormalized();
    return this.armyHexes.get(normalized.x)?.get(normalized.y);
  }

  public getStructureAtHex(col: number, row: number): { id: number; owner: bigint } | undefined {
    const normalized = new Position({ x: col, y: row }).getNormalized();
    return this.structureHexes.get(normalized.x)?.get(normalized.y);
  }

  public getChestAtHex(col: number, row: number): { id: number; owner: bigint } | undefined {
    const normalized = new Position({ x: col, y: row }).getNormalized();
    return this.chestHexes.get(normalized.x)?.get(normalized.y);
  }

  public getHexagonEntity(hexCoords: { col: number; row: number }) {
    const hex = new Position({ x: hexCoords.col, y: hexCoords.row }).getNormalized();

    return {
      army: this.armyHexes.get(hex.x)?.get(hex.y),
      structure: this.structureHexes.get(hex.x)?.get(hex.y),
      chest: this.chestHexes.get(hex.x)?.get(hex.y),
    };
  }

  public getSelectionManager(): SelectionManager {
    return this.selectionManager;
  }

  public clearSelection(): void {
    this.selectionManager.clearSelection();
  }

  public isArmySelectable(armyId: number): boolean {
    return !this.pendingArmyMovements.has(armyId) && !this.armyManager.isObjectMoving(armyId);
  }

  private recordPerformanceMetric(operation: string, duration: number): void {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    const metrics = this.performanceMetrics.get(operation)!;
    metrics.push(duration);

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

  private updateArmyFromExplorerTroopsUpdate(update: ExplorerTroopsSystemUpdate): void {
    const armyObject = this.armyManager.getObject(update.entityId);

    if (!armyObject) {
      console.log(
        `[HexagonMap] Army ${update.entityId} not found in renderer - update will be applied when army loads`,
      );
      return;
    }

    const { currentArmiesTick } = getBlockTimestamp();
    let currentStamina = armyObject.currentStamina || 0;
    let maxStamina = armyObject.maxStamina || 0;

    if (armyObject.troopType && armyObject.troopTier) {
      try {
        const staminaResult = StaminaManager.getStamina(
          {
            category: armyObject.troopType,
            tier: armyObject.troopTier,
            count: BigInt(update.troopCount),
            stamina: {
              amount: BigInt(update.onChainStamina.amount),
              updated_tick: BigInt(update.onChainStamina.updatedTick),
            },
            boosts: {
              incr_stamina_regen_percent_num: 0,
              incr_stamina_regen_tick_count: 0,
              incr_explore_reward_percent_num: 0,
              incr_explore_reward_end_tick: 0,
              incr_damage_dealt_percent_num: 0,
              incr_damage_dealt_end_tick: 0,
              decr_damage_gotten_percent_num: 0,
              decr_damage_gotten_end_tick: 0,
            },
          },
          currentArmiesTick,
        );

        currentStamina = Number(staminaResult.amount);

        let troopType = armyObject.troopType;
        let troopTier = armyObject.troopTier;

        if (troopType && troopTier) {
          try {
            const troopTypeEnum =
              typeof troopType === "string" ? TroopType[troopType as keyof typeof TroopType] : troopType;
            const troopTierEnum =
              typeof troopTier === "string" ? TroopTier[troopTier as keyof typeof TroopTier] : troopTier;

            const staminaConfig = configManager.getTroopStaminaConfig(troopTypeEnum, troopTierEnum);
            maxStamina = Number(staminaConfig.staminaMax);
          } catch (error) {
            console.warn(`[HexagonMap] Failed to calculate maxStamina for ${troopType} ${troopTier}:`, error);
            maxStamina = armyObject.maxStamina || 0;
          }
        } else {
          console.warn(`[HexagonMap] Missing troopType or troopTier for army ${update.entityId}:`, {
            armyObjectTroopType: armyObject.troopType,
            armyObjectTroopTier: armyObject.troopTier,
          });
          maxStamina = armyObject.maxStamina || 0;
        }
      } catch (error) {
        console.warn(`Failed to calculate stamina for army ${update.entityId}:`, error);
      }
    }

    const updatedArmy = {
      ...armyObject,
      troopCount: update.troopCount,
      currentStamina,
      maxStamina,
      ownerName: update.ownerName,
      owner: update.ownerAddress,
      onChainStamina: update.onChainStamina,
    };

    this.armyManager.updateObject(updatedArmy);

    const position = this.armiesPositions.get(update.entityId);
    if (position) {
      if (!this.armyHexes.has(position.col)) {
        this.armyHexes.set(position.col, new Map());
      }
      this.armyHexes.get(position.col)?.set(position.row, {
        id: update.entityId,
        owner: update.ownerAddress,
      });
    }
  }

  private updateStructureFromStructureUpdate(update: {
    entityId: ID;
    guardArmies: any[];
    owner: { address: bigint; ownerName: string; guildName: string };
  }): void {
    console.log("[HexagonMap] Structure guard update:", update);

    const existingStructure = this.structureManager.getObject(update.entityId);
    if (existingStructure) {
      const updatedStructure = {
        ...existingStructure,
        guardArmies: update.guardArmies,
        ownerName: update.owner.ownerName,
        guildName: update.owner.guildName,
      };
      this.structureManager.updateObject(updatedStructure);
    }
  }

  private updateStructureFromBuildingUpdate(update: {
    entityId: ID;
    activeProductions: Array<{ buildingCount: number; buildingType: any }>;
  }): void {
    console.log("[HexagonMap] Structure building update:", update);

    const existingStructure = this.structureManager.getObject(update.entityId);
    if (existingStructure) {
      const updatedStructure = {
        ...existingStructure,
        activeProductions: update.activeProductions,
      };
      this.structureManager.updateObject(updatedStructure);
    }
  }

  private updateStructureContribution(value: { entityId: ID; structureType: any; stage: any }): void {
    console.log("[HexagonMap] Structure contribution update:", value);

    const existingStructure = this.structureManager.getObject(value.entityId);
    if (existingStructure) {
      const updatedStructure = {
        ...existingStructure,
        stage: value.stage,
        hyperstructureRealmCount: value.stage,
      };
      this.structureManager.updateObject(updatedStructure);
    }
  }

  /**
   * Handle relic effect updates from the game system
   * @param update The relic effect update containing entity ID and array of relic effects
   */
  private async handleRelicEffectUpdate(update: RelicEffectSystemUpdate) {
    const { entityId, relicEffects } = update;

    let entityFound = false;

    // Check if this is an army entity
    const army = this.armyManager.getObject(entityId);
    if (army) {
      // Convert RelicEffectWithEndTick to the format expected by updateRelicEffects
      const { currentArmiesTick } = getBlockTimestamp();
      const newEffects = relicEffects.map((relicEffect) => ({
        relicNumber: relicEffect.id,
        effect: {
          start_tick: currentArmiesTick,
          end_tick: relicEffect.endTick,
          usage_left: 1,
        },
      }));

      await this.updateArmyRelicEffects(entityId, newEffects);
      entityFound = true;
    }

    // If entity is not currently loaded, store as pending effects
    if (!entityFound) {
      // Get or create the entity's pending effects set
      let entityPendingSet = this.pendingRelicEffects.get(entityId);
      if (!entityPendingSet) {
        entityPendingSet = new Set();
        this.pendingRelicEffects.set(entityId, entityPendingSet);
      }

      // Clear existing pending effects for this entity and add new ones
      entityPendingSet.clear();
      for (const relicEffect of relicEffects) {
        entityPendingSet.add({
          relicResourceId: relicEffect.id,
          effect: {
            end_tick: relicEffect.endTick,
            usage_left: 1,
          },
        });
      }

      // If no effects, remove the entity from pending
      if (entityPendingSet.size === 0) {
        this.pendingRelicEffects.delete(entityId);
      }
    }
  }

  private handleExplorerMoveUpdate(update: ExplorerMoveSystemUpdate): void {
    const { explorerId, resourceId, amount } = update;
    console.log("[HexagonMap] Explorer move update:", update);

    setTimeout(() => {
      const armyPosition = this.armiesPositions.get(explorerId);
      if (armyPosition && resourceId !== 0) {
        console.log(
          `Army ${explorerId} found resource ${resourceId} (amount: ${amount}) at position (${armyPosition.col}, ${armyPosition.row})`,
        );
      }
    }, 500);
  }

  /**
   * Update army relic effects and display them visually
   */
  public async updateArmyRelicEffects(
    entityId: number,
    newRelicEffects: Array<{ relicNumber: number; effect: RelicEffect }>,
  ) {
    const army = this.armyManager.getObject(entityId);
    if (!army) {
      console.warn(`Army ${entityId} not found for relic effects update`);
      return;
    }

    const currentEffects = this.armyRelicEffects.get(entityId) || [];
    const currentRelicNumbers = new Set(currentEffects.map((e) => e.relicNumber));
    const newRelicNumbers = new Set(newRelicEffects.map((e) => e.relicNumber));

    // Remove effects that are no longer in the new list
    for (const currentEffect of currentEffects) {
      if (!newRelicNumbers.has(currentEffect.relicNumber)) {
        currentEffect.fx.end();
      }
    }

    // Add new effects that weren't previously active
    const effectsToAdd: Array<{ relicNumber: number; effect: RelicEffect; fx: { end: () => void; instance?: any } }> =
      [];
    for (const newEffect of newRelicEffects) {
      if (!currentRelicNumbers.has(newEffect.relicNumber)) {
        try {
          const position = this.getArmyWorldPosition(army);
          position.y += 1.5;

          // Register the relic FX if not already registered (wait for texture to load)
          await this.fxManager.registerRelicFX(newEffect.relicNumber);

          // Play the relic effect
          const fx = this.fxManager.playFxAtCoords(
            `relic_${newEffect.relicNumber}`,
            position.x,
            position.y,
            position.z,
            0.8,
            undefined,
            true,
          );

          effectsToAdd.push({ relicNumber: newEffect.relicNumber, effect: newEffect.effect, fx });
        } catch (error) {
          console.error(`Failed to add relic effect ${newEffect.relicNumber} for army ${entityId}:`, error);
        }
      }
    }

    // Update the stored effects
    if (newRelicEffects.length === 0) {
      this.armyRelicEffects.delete(entityId);
    } else {
      // Keep existing effects that are still in the new list, add new ones
      const updatedEffects = currentEffects.filter((e) => newRelicNumbers.has(e.relicNumber)).concat(effectsToAdd);
      this.armyRelicEffects.set(entityId, updatedEffects);
    }
  }

  /**
   * Get army relic effects for external access
   */
  public getArmyRelicEffects(entityId: number): { relicId: number; effect: RelicEffect }[] {
    const effects = this.armyRelicEffects.get(entityId);
    return effects ? effects.map((effect) => ({ relicId: effect.relicNumber, effect: effect.effect })) : [];
  }

  /**
   * Get world position for an army
   */
  private getArmyWorldPosition(army: ArmyObject): THREE.Vector3 {
    getWorldPositionForHex({ col: army.col, row: army.row }, true, this.tempVector3);
    return this.tempVector3.clone();
  }

  /**
   * Apply all pending relic effects for an entity (called when entity is loaded)
   */
  private async applyPendingRelicEffects(entityId: number) {
    const entityPendingSet = this.pendingRelicEffects.get(entityId);
    if (!entityPendingSet || entityPendingSet.size === 0) return;

    // Check if this is an army entity
    const army = this.armyManager.getObject(entityId);
    if (army) {
      try {
        // Convert pending relics to array format for updateRelicEffects
        const relicEffectsArray = Array.from(entityPendingSet).map((pendingRelic) => ({
          relicNumber: pendingRelic.relicResourceId,
          effect: pendingRelic.effect,
        }));

        await this.updateArmyRelicEffects(entityId, relicEffectsArray);
        console.log(`Applied ${relicEffectsArray.length} pending relic effects to army ${entityId}`);
      } catch (error) {
        console.error(`Failed to apply pending relic effects to army ${entityId}:`, error);
      }

      // Clear the pending effects
      this.pendingRelicEffects.delete(entityId);
    }
  }

  /**
   * Clear all pending relic effects for an entity (called when entity is removed)
   */
  private clearPendingRelicEffects(entityId: number) {
    const entityPendingSet = this.pendingRelicEffects.get(entityId);
    if (entityPendingSet) {
      console.log(`Cleared ${entityPendingSet.size} pending relic effects for entity ${entityId}`);
      this.pendingRelicEffects.delete(entityId);
    }
  }

  /**
   * Start the periodic relic effect validation timer
   */
  private startRelicValidationTimer() {
    // Clear any existing timer
    this.stopRelicValidationTimer();

    // Set up new timer to run every 5 seconds
    this.relicValidationInterval = setInterval(() => {
      this.validateActiveRelicEffects();
    }, 5000);
  }

  /**
   * Stop the periodic relic effect validation timer
   */
  private stopRelicValidationTimer() {
    if (this.relicValidationInterval) {
      clearInterval(this.relicValidationInterval);
      this.relicValidationInterval = null;
    }
  }

  /**
   * Validate all currently displayed relic effects and remove inactive ones
   */
  private async validateActiveRelicEffects() {
    try {
      const { currentArmiesTick } = getBlockTimestamp();
      let removedCount = 0;

      // Validate army relic effects
      const armies = this.armyManager.getAllObjects();
      for (const army of armies) {
        const currentRelics = this.getArmyRelicEffects(army.id);
        if (currentRelics.length > 0) {
          // Filter out inactive relics
          const activeRelics = currentRelics.filter((relic) => isRelicActive(relic.effect, currentArmiesTick));

          // If some relics were removed, update the effects
          if (activeRelics.length < currentRelics.length) {
            const removedThisArmy = currentRelics.length - activeRelics.length;
            console.log(`Removing ${removedThisArmy} inactive relic effect(s) from army: entityId=${army.id}`);

            await this.updateArmyRelicEffects(
              army.id,
              activeRelics.map((r) => ({ relicNumber: r.relicId, effect: r.effect })),
            );
            removedCount += removedThisArmy;
          }
        }
      }

      if (removedCount > 0) {
        console.log(`Removed ${removedCount} total inactive relic effects`);
      }
    } catch (error) {
      console.error("Error during relic effect validation:", error);
    }
  }

  /**
   * Update relic effect positions to follow moving armies
   */
  private updateRelicEffectPositions(entityId: number) {
    const army = this.armyManager.getObject(entityId);
    if (!army) return;

    const relicEffects = this.armyRelicEffects.get(entityId);
    if (!relicEffects || relicEffects.length === 0) return;

    // Get the current world position of the army
    const armyPosition = this.getArmyWorldPosition(army);
    armyPosition.y += 1.5; // Relic effects are positioned 1.5 units above the army

    // Update each relic effect to follow the army
    relicEffects.forEach((relicEffect) => {
      if (relicEffect.fx && relicEffect.fx.instance) {
        // Update the base position that the orbital animation uses
        relicEffect.fx.instance.initialX = armyPosition.x;
        relicEffect.fx.instance.initialY = armyPosition.y;
        relicEffect.fx.instance.initialZ = armyPosition.z;
      }
    });
  }
}
