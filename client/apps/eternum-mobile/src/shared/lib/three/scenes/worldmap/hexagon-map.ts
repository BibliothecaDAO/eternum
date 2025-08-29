import { ActionPaths, ActionType, ExplorerMoveSystemUpdate, WorldUpdateListener } from "@bibliothecadao/eternum";
import { DojoResult } from "@bibliothecadao/react";
import { FELT_CENTER } from "@bibliothecadao/types";
import * as THREE from "three";
import { getMapFromTorii } from "../../../../../app/dojo/queries";
import { ArmyManager, BiomesManager, ChestManager, QuestManager, StructureManager } from "../../entity-managers";
import { FXManager } from "../../managers/fx-manager";
import { GUIManager } from "../../managers/gui-manager";
import { HighlightRenderer } from "../../managers/highlight-renderer";
import { RelicEffectsManager } from "../../managers/relic-effects-manager";
import { SelectionManager } from "../../managers/selection-manager";
import { createHexagonShape } from "../../utils/hexagon-geometry";
import { getHexagonCoordinates, getWorldPositionForHex, HEX_SIZE } from "../../utils/utils";

export class HexagonMap {
  // === STATIC ASSETS & CONSTANTS ===
  private static readonly MAX_HEX_CAPACITY = 5000;
  private static readonly CHUNK_LOAD_RADIUS_X = 1;
  private static readonly CHUNK_LOAD_RADIUS_Z = 3;
  private static readonly CHUNK_SIZE = 5;
  private static hexagonGeometry: THREE.ShapeGeometry | null = null;
  private static hexagonMaterial: THREE.MeshLambertMaterial | null = null;

  // === CORE DEPENDENCIES ===
  private scene: THREE.Scene;
  private dojo: DojoResult;
  private store: any;
  private systemManager: WorldUpdateListener;
  private fxManager: FXManager;

  // === ENTITY MANAGERS ===
  private biomesManager!: BiomesManager;
  private highlightRenderer!: HighlightRenderer;
  private armyManager!: ArmyManager;
  private structureManager!: StructureManager;
  private questManager!: QuestManager;
  private chestManager!: ChestManager;
  private selectionManager!: SelectionManager;
  private relicEffectsManager!: RelicEffectsManager;

  // === HEX STATE ===
  private allHexes: Set<string> = new Set();
  private visibleHexes: Set<string> = new Set();
  private hexagonMesh: THREE.InstancedMesh | null = null;
  private hexagonMeshCapacity: number = 0;

  // === CHUNK MANAGEMENT ===
  private lastChunkX: number = -9999;
  private lastChunkZ: number = -9999;
  private chunkLoadRadiusX = HexagonMap.CHUNK_LOAD_RADIUS_X;
  private chunkLoadRadiusZ = HexagonMap.CHUNK_LOAD_RADIUS_Z;
  private fetchedChunks: Set<string> = new Set();
  private isLoadingChunks: boolean = false;
  private pendingChunkUpdate: { chunkX: number; chunkZ: number } | null = null;
  private currentAbortController: AbortController | null = null;

  // === THREE.JS UTILITIES ===
  private raycaster: THREE.Raycaster;
  private dummy = new THREE.Object3D();
  private tempVector3 = new THREE.Vector3();
  private tempColor = new THREE.Color();

  // === PERFORMANCE & GUI ===
  private performanceMetrics: Map<string, number[]> = new Map();
  private chunkUpdateCount: number = 0;
  private GUIFolder: any;

  // === CONSTRUCTOR & INITIALIZATION ===
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

    this.initializeManagers();
    this.setupSystemListeners();
    this.initializeGUI();

    this.initializeStaticAssets();
    this.initializeMap();
  }

  private initializeManagers(): void {
    this.biomesManager = new BiomesManager(this.scene);
    this.highlightRenderer = new HighlightRenderer(this.scene);
    this.armyManager = new ArmyManager(this.scene);
    this.structureManager = new StructureManager(this.scene);
    this.questManager = new QuestManager(this.scene);
    this.chestManager = new ChestManager(this.scene);
    this.relicEffectsManager = new RelicEffectsManager(this.fxManager);

    this.armyManager.setDependencies(this.dojo, this.fxManager, this.biomesManager.getExploredTiles());
    this.structureManager.setDependencies(this.dojo, this.biomesManager.getExploredTiles());

    this.selectionManager = new SelectionManager(this.highlightRenderer);
    this.selectionManager.registerObjectRenderer("army", this.armyManager);
    this.selectionManager.registerObjectRenderer("structure", this.structureManager);
    this.selectionManager.registerObjectRenderer("quest", this.questManager);
    this.selectionManager.registerObjectRenderer("chest", this.chestManager);
  }

  private setupSystemListeners(): void {
    this.systemManager.Tile.onTileUpdate((value) => this.biomesManager.handleTileUpdate(value));
    this.systemManager.Army.onTileUpdate((update) => this.armyManager.handleSystemUpdate(update));
    this.systemManager.Army.onExplorerTroopsUpdate((update) => this.armyManager.handleExplorerTroopsUpdate(update));
    this.systemManager.Army.onDeadArmy((entityId) =>
      this.armyManager.deleteArmy(entityId, (id) => this.relicEffectsManager.clearEntityRelicEffects(id)),
    );
    this.systemManager.Structure.onTileUpdate((update) => this.structureManager.handleSystemUpdate(update));
    this.systemManager.Structure.onStructureUpdate((update) => this.structureManager.handleStructureUpdate(update));
    this.systemManager.Structure.onStructureBuildingsUpdate((update) =>
      this.structureManager.handleBuildingUpdate(update),
    );
    this.systemManager.Structure.onContribution((value) => this.structureManager.handleContributionUpdate(value));
    this.systemManager.Quest.onTileUpdate((update) => this.questManager.handleSystemUpdate(update));
    this.systemManager.Chest.onTileUpdate((update) => this.chestManager.handleSystemUpdate(update));
    this.systemManager.Chest.onDeadChest((entityId) => this.chestManager.deleteChest(entityId));
    this.systemManager.RelicEffect.onExplorerTroopsUpdate(async (update) =>
      this.relicEffectsManager.handleRelicEffectUpdate(update, (id) => this.armyManager.getArmyPosition(id)),
    );
    this.systemManager.RelicEffect.onStructureGuardUpdate((update) =>
      this.relicEffectsManager.handleRelicEffectUpdate(update, (id) => this.getStructurePosition(id)),
    );
    this.systemManager.RelicEffect.onStructureProductionUpdate((update) =>
      this.relicEffectsManager.handleRelicEffectUpdate(update, (id) => this.getStructurePosition(id)),
    );
    this.systemManager.ExplorerMove.onExplorerMoveEventUpdate((update) => this.handleExplorerMoveUpdate(update));
  }

  private initializeGUI(): void {
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

      const entityFetchStartTime = performance.now();
      for (let x = centerChunkX - radiusX; x <= centerChunkX + radiusX; x++) {
        for (let z = centerChunkZ - radiusZ; z <= centerChunkZ + radiusZ; z++) {
          const chunkKey = `${z * HexagonMap.CHUNK_SIZE},${x * HexagonMap.CHUNK_SIZE}`;
          this.computeTileEntities(chunkKey);
        }
      }
      const entityFetchTime = performance.now() - entityFetchStartTime;
      console.log(`[CHUNK-TIMING] Compute tile entities: ${entityFetchTime.toFixed(2)}ms`);
      this.recordPerformanceMetric("Compute Tile Entities", entityFetchTime);

      const loadHexesStartTime = performance.now();
      for (let x = centerChunkX - radiusX; x <= centerChunkX + radiusX; x++) {
        for (let z = centerChunkZ - radiusZ; z <= centerChunkZ + radiusZ; z++) {
          this.loadChunkHexes(x, z);
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

  // === RENDERING ===
  private renderHexes(): void {
    const hexRenderData = this.prepareHexRenderingData();
    if (hexRenderData.instanceCount === 0) {
      if (this.hexagonMesh) {
        this.hexagonMesh.count = 0;
      }
      return;
    }

    this.ensureHexagonMeshCapacityWithTiming(hexRenderData.instanceCount);
    this.setupHexInstances(hexRenderData.allVisibleHexes);
    this.updateRenderAttributes();
    this.updateManagerBounds();
  }

  private prepareHexRenderingData(): { allVisibleHexes: Array<{col: number, row: number}>, instanceCount: number } {
    const prepareStartTime = performance.now();
    const allVisibleHexes = Array.from(this.visibleHexes).map((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      return { col, row };
    });

    const instanceCount = allVisibleHexes.length;
    console.log(
      `[RENDER-TIMING] Prepare data (${instanceCount} hexes): ${(performance.now() - prepareStartTime).toFixed(2)}ms`,
    );

    return { allVisibleHexes, instanceCount };
  }

  private ensureHexagonMeshCapacityWithTiming(instanceCount: number): void {
    const capacityStartTime = performance.now();
    this.ensureHexagonMeshCapacity(instanceCount);
    console.log(`[RENDER-TIMING] Ensure mesh capacity: ${(performance.now() - capacityStartTime).toFixed(2)}ms`);
  }

  private setupHexInstances(allVisibleHexes: Array<{col: number, row: number}>): void {
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
  }

  private updateRenderAttributes(): void {
    const updateStartTime = performance.now();
    this.hexagonMesh!.instanceMatrix.needsUpdate = true;
    if (this.hexagonMesh!.instanceColor) {
      this.hexagonMesh!.instanceColor.needsUpdate = true;
    }
    this.hexagonMesh!.computeBoundingBox();
    this.hexagonMesh!.computeBoundingSphere();
    console.log(`[RENDER-TIMING] Update attributes: ${(performance.now() - updateStartTime).toFixed(2)}ms`);
  }

  private updateManagerBounds(): void {
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
    if (!this.validateClickPreconditions()) return;

    const intersect = this.performRaycast(mouse, camera);
    if (intersect) {
      this.processHexagonClick(intersect);
    }
  }

  private validateClickPreconditions(): boolean {
    if (!this.hexagonMesh) {
      console.log("[HexagonMap] No hexagon mesh available for click detection");
      return false;
    }

    if (this.hexagonMesh.count === 0) {
      console.log("[HexagonMap] Hexagon mesh has no instances");
      return false;
    }

    return true;
  }

  private performRaycast(mouse: THREE.Vector2, camera: THREE.Camera): THREE.Intersection | null {
    this.raycaster.setFromCamera(mouse, camera);
    this.raycaster.layers.enableAll();
    this.raycaster.params.Points!.threshold = 0.1;

    const intersects = this.raycaster.intersectObjects([this.hexagonMesh!], false);

    console.log(
      `[HexagonMap] Click at mouse (${mouse.x.toFixed(3)}, ${mouse.y.toFixed(3)}) found ${intersects.length} intersections`,
    );

    if (intersects.length > 0) {
      const intersect = intersects[0];
      console.log(`[HexagonMap] Intersected object:`, intersect.object.type, intersect.object.uuid);
      return intersect;
    } else {
      console.log(
        `[HexagonMap] No intersections found. Mesh bounds:`,
        this.hexagonMesh!.boundingBox,
        this.hexagonMesh!.boundingSphere,
      );
      return null;
    }
  }

  private processHexagonClick(intersect: THREE.Intersection): void {
    const intersectedObject = intersect.object;

    if (intersectedObject instanceof THREE.InstancedMesh) {
      const instanceId = intersect.instanceId;
      console.log(`[HexagonMap] Instance ID: ${instanceId}, Distance: ${intersect.distance.toFixed(3)}`);

      if (instanceId !== undefined && instanceId >= 0 && instanceId < this.hexagonMesh!.count) {
        const hexData = getHexagonCoordinates(intersectedObject, instanceId);
        console.log(`[HexagonMap] Hexagon clicked: col=${hexData.hexCoords.col}, row=${hexData.hexCoords.row}`);

        this.handleHexClick(hexData.hexCoords.col, hexData.hexCoords.row);
        this.showClickFeedback(instanceId);
      } else {
        console.warn(`[HexagonMap] Invalid instance ID: ${instanceId}, mesh count: ${this.hexagonMesh!.count}`);
      }
    }
  }

  // === USER INTERACTION ===
  private async handleHexClick(col: number, row: number): Promise<void> {
    const selectedObject = this.selectionManager.getSelectedObject();
    if (selectedObject) {
      const handled = await this.executeSelectedObjectAction(selectedObject, col, row);
      if (handled) return;
    }

    const entityInfo = this.getHexEntityInfo(col, row);
    this.selectHexEntity(entityInfo, col, row);
  }

  private async executeSelectedObjectAction(selectedObject: any, col: number, row: number): Promise<boolean> {
    const actionPath = this.selectionManager.getActionPath(col, row);
    if (!actionPath) return false;

    const actionType = ActionPaths.getActionType(actionPath);
    this.selectionManager.clearSelection();

    switch (actionType) {
      case ActionType.Move:
      case ActionType.Explore:
        await this.armyManager.handleArmyMovement(selectedObject.id, actionPath);
        break;
      case ActionType.Attack:
        console.log(`Attack action at (${col}, ${row})`);
        break;
      case ActionType.Help:
        console.log(`Help action at (${col}, ${row})`);
        break;
      case ActionType.Quest:
        console.log(`Quest action at (${col}, ${row})`);
        break;
      case ActionType.Chest:
        console.log(`Chest action at (${col}, ${row})`);
        this.chestManager.handleChestAction(selectedObject.id, actionPath, this.store);
        break;
    }

    return true;
  }

  private getHexEntityInfo(col: number, row: number) {
    const armyInfo = this.armyManager.getArmyHexes().get(col)?.get(row);
    const structureInfo = this.structureManager.getStructureHexes().get(col)?.get(row);
    const questInfo = this.questManager.getQuestHexes().get(col)?.get(row);
    const chestInfo = this.chestManager.getChestHexes().get(col)?.get(row);

    return {
      armies: armyInfo
        ? [this.armyManager.getObject(armyInfo.id)].filter((obj): obj is NonNullable<typeof obj> => obj !== undefined)
        : [],
      structures: structureInfo
        ? [this.structureManager.getObject(structureInfo.id)].filter(
            (obj): obj is NonNullable<typeof obj> => obj !== undefined,
          )
        : [],
      quests: questInfo
        ? [this.questManager.getObject(questInfo.id)].filter((obj): obj is NonNullable<typeof obj> => obj !== undefined)
        : [],
      chests: chestInfo
        ? [this.chestManager.getObject(chestInfo.id)].filter((obj): obj is NonNullable<typeof obj> => obj !== undefined)
        : [],
    };
  }

  private selectHexEntity(entityInfo: any, col: number, row: number): void {
    const { armies, structures, quests, chests } = entityInfo;

    if (armies.length > 0) {
      this.handleArmyHexClick(armies[0], col, row);
    } else if (structures.length > 0) {
      this.handleStructureHexClick(structures[0], col, row);
    } else if (quests.length > 0) {
      this.handleQuestHexClick(quests[0], col, row);
    } else if (chests.length > 0) {
      this.handleChestHexClick();
    } else {
      this.handleEmptyHexClick();
    }
  }

  private handleArmyHexClick(army: any, col: number, row: number): void {
    const result = this.armyManager.handleHexClick(
      army.id,
      col,
      row,
      this.store,
      this.structureManager.getStructureHexes(),
      this.questManager.getQuestHexes(),
      this.chestManager.getChestHexes(),
    );

    if (result.shouldSelect && result.actionPaths) {
      this.selectionManager.selectObject(army.id, "army", col, row);
      this.selectionManager.setActionPaths(result.actionPaths);
    }
  }

  private handleStructureHexClick(structure: any, col: number, row: number): void {
    const result = this.structureManager.handleHexClick(
      structure.id,
      col,
      row,
      this.store,
      this.armyManager.getArmyHexes(),
    );

    if (result.shouldSelect && result.actionPaths) {
      this.selectionManager.selectObject(structure.id, "structure", col, row);
      this.selectionManager.setActionPaths(result.actionPaths);
    }
  }

  private handleQuestHexClick(quest: any, col: number, row: number): void {
    const result = this.questManager.handleHexClick(quest.id, col, row, this.store);

    if (result.shouldSelect) {
      this.selectionManager.selectObject(quest.id, "quest", col, row);
    }
  }

  private handleChestHexClick(): void {
    this.selectionManager.clearSelection();
  }

  private handleEmptyHexClick(): void {
    this.selectionManager.clearSelection();
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

  public dispose(): void {
    // Clean up relic effects
    this.relicEffectsManager.dispose();

    if (this.GUIFolder) {
      this.GUIFolder.destroy();
      this.GUIFolder = null;
    }

    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
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

      this.updateChunkLoading(camera.position, true);
    }

    return worldPosition;
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

  private handleExplorerMoveUpdate(update: ExplorerMoveSystemUpdate): void {
    const { explorerId, resourceId, amount } = update;
    console.log("[HexagonMap] Explorer move update:", update);

    setTimeout(() => {
      const armyPosition = this.armyManager.getArmyPosition(explorerId);
      if (armyPosition && resourceId !== 0) {
        console.log(
          `Army ${explorerId} found resource ${resourceId} (amount: ${amount}) at position (${armyPosition.col}, ${armyPosition.row})`,
        );
      }
    }, 500);
  }

  private getStructurePosition(structureId: number): { col: number; row: number } | undefined {
    const structure = this.structureManager.getObject(structureId);
    return structure ? { col: structure.col, row: structure.row } : undefined;
  }
}
