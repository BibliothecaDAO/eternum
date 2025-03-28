import { soundSelector } from "@/hooks/helpers/use-ui-sound";
import throttle from "lodash/throttle";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { ArmyManager } from "@/three/managers/army-manager";
import Minimap from "@/three/managers/minimap";
import { SelectedHexManager } from "@/three/managers/selected-hex-manager";
import { StructureManager } from "@/three/managers/structure-manager";
import { SceneManager } from "@/three/scene-manager";
import { HEX_SIZE } from "@/three/scenes/constants";
import { HexagonScene } from "@/three/scenes/hexagon-scene";
import { playSound } from "@/three/sound/utils";
import { LeftView } from "@/types";
import { Position } from "@/types/position";
import { FELT_CENTER, IS_FLAT_MODE } from "@/ui/config";
import { CombatModal } from "@/ui/modules/military/combat-modal";
import { HelpModal } from "@/ui/modules/military/help-modal";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  ActionPath,
  ActionPaths,
  ActionType,
  ArmyActionManager,
  Biome,
  BiomeType,
  ContractAddress,
  DUMMY_HYPERSTRUCTURE_ENTITY_ID,
  getNeighborOffsets,
  HexEntityInfo,
  HexPosition,
  ID,
  SetupResult,
  StructureActionManager,
} from "@bibliothecadao/eternum";
import { AndComposeClause, MemberClause } from "@dojoengine/sdk";
import { getEntities } from "@dojoengine/state";
import { Account, AccountInterface } from "starknet";
import * as THREE from "three";
import { Raycaster } from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { ArmySystemUpdate, SceneName, StructureSystemUpdate, TileSystemUpdate } from "../types";
import { getWorldPositionForHex } from "../utils";

const dummyObject = new THREE.Object3D();
const dummyVector = new THREE.Vector3();

export default class WorldmapScene extends HexagonScene {
  private chunkSize = 10; // Size of each chunk
  private wheelHandler: ((event: WheelEvent) => void) | null = null;
  private renderChunkSize = {
    width: 60,
    height: 44,
  };

  private totalStructures: number = 0;

  private currentChunk: string = "null";

  private armyManager: ArmyManager;
  private structureManager: StructureManager;
  private exploredTiles: Map<number, Map<number, BiomeType>> = new Map();
  // normalized positions and if they are allied or not
  private armyHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  // normalized positions and if they are allied or not
  private structureHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  // store armies positions by ID, to remove previous positions when army moves
  private armiesPositions: Map<ID, HexPosition> = new Map();
  private selectedHexManager: SelectedHexManager;
  private minimap!: Minimap;
  private previouslyHoveredHex: HexPosition | null = null;
  private cachedMatrices: Map<string, Map<string, { matrices: THREE.InstancedBufferAttribute; count: number }>> =
    new Map();
  private updateHexagonGridPromise: Promise<void> | null = null;

  // Label groups
  private armyLabelsGroup: THREE.Group;
  private structureLabelsGroup: THREE.Group;

  dojo: SetupResult;

  private fetchedChunks: Set<string> = new Set();

  constructor(
    dojoContext: SetupResult,
    raycaster: Raycaster,
    controls: MapControls,
    mouse: THREE.Vector2,
    sceneManager: SceneManager,
  ) {
    super(SceneName.WorldMap, controls, dojoContext, mouse, raycaster, sceneManager);

    this.dojo = dojoContext;

    this.GUIFolder.add(this, "moveCameraToURLLocation");

    this.loadBiomeModels(this.renderChunkSize.width * this.renderChunkSize.height);

    useUIStore.subscribe(
      (state) => state.entityActions,
      (armyActions) => {
        this.state.entityActions = armyActions;
      },
    );
    useUIStore.subscribe(
      (state) => state.selectedHex,
      (selectedHex) => {
        this.state.selectedHex = selectedHex;
      },
    );
    useUIStore.subscribe(
      (state) => state.isSoundOn,
      (isSoundOn) => {
        this.state.isSoundOn = isSoundOn;
      },
    );
    useUIStore.subscribe(
      (state) => state.effectsLevel,
      (effectsLevel) => {
        this.state.effectsLevel = effectsLevel;
      },
    );

    useUIStore.subscribe(
      (state) => state.entityActions.selectedEntityId,
      (selectedEntityId) => {
        if (!selectedEntityId) this.clearSelection();
      },
    );

    // Initialize label groups
    this.armyLabelsGroup = new THREE.Group();
    this.armyLabelsGroup.name = "ArmyLabelsGroup";
    this.structureLabelsGroup = new THREE.Group();
    this.structureLabelsGroup.name = "StructureLabelsGroup";

    this.armyManager = new ArmyManager(this.scene, this.renderChunkSize, this.armyLabelsGroup);
    this.structureManager = new StructureManager(this.scene, this.renderChunkSize, this.structureLabelsGroup);

    // Store the unsubscribe function for Army updates
    this.systemManager.Army.onUpdate((update: ArmySystemUpdate) => {
      this.updateArmyHexes(update);
      this.armyManager.onUpdate(update, this.armyHexes, this.structureHexes, this.exploredTiles).then((needsUpdate) => {
        if (needsUpdate) {
          this.updateVisibleChunks();
        }
      });
    });

    // Store the unsubscribe function for Tile updates
    this.systemManager.Tile.onUpdate((value) => this.updateExploredHex(value));

    // Store the unsubscribe function for Structure updates
    this.systemManager.Structure.onUpdate((value) => {
      this.updateStructureHexes(value);

      const optimisticStructure = this.structureManager.structures.removeStructure(
        Number(DUMMY_HYPERSTRUCTURE_ENTITY_ID),
      );
      if (optimisticStructure) {
        this.dojo.components.Structure.removeOverride(DUMMY_HYPERSTRUCTURE_ENTITY_ID.toString());
        this.structureManager.structureHexCoords
          .get(optimisticStructure.hexCoords.col)
          ?.delete(optimisticStructure.hexCoords.row);
        this.structureManager.updateChunk(this.currentChunk);
      }
      this.structureManager.onUpdate(value);
      if (this.totalStructures !== this.structureManager.getTotalStructures()) {
        this.totalStructures = this.structureManager.getTotalStructures();
        this.clearCache();
        this.updateVisibleChunks(true);
      }
    });

    // Store the unsubscribe function for Structure contributions
    this.systemManager.Structure.onContribution((value) => {
      this.structureManager.structures.updateStructureStage(value.entityId, value.structureType, value.stage);
      this.structureManager.updateChunk(this.currentChunk);
    });

    // add particles
    this.selectedHexManager = new SelectedHexManager(this.scene);

    this.minimap = new Minimap(this, this.exploredTiles, this.camera, this.structureManager, this.armyManager);

    // Add event listener for Escape key
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.sceneManager.getCurrentScene() === SceneName.WorldMap) {
        if (this.isNavigationViewOpen()) {
          this.closeNavigationViews();
        } else {
          this.clearSelection();
        }
      }
    });

    window.addEventListener("urlChanged", () => {
      this.clearSelection();
    });
  }

  private setupCameraZoomHandler() {
    // Add mouse wheel handler
    this.wheelHandler = throttle(
      (event: WheelEvent) => {
        if (event.deltaY > 0) {
          // Zoom out
          this.currentCameraView = Math.min(3, this.currentCameraView + 1);
        } else {
          // Zoom in
          this.currentCameraView = Math.max(1, this.currentCameraView - 1);
        }
        this.changeCameraView(this.currentCameraView as 1 | 2 | 3);
      },
      1000,
      { leading: true, trailing: false },
    );

    window.addEventListener("wheel", this.wheelHandler, { passive: true });
  }

  public moveCameraToURLLocation() {
    const col = this.locationManager.getCol();
    const row = this.locationManager.getRow();
    if (col !== undefined && row !== undefined) {
      this.moveCameraToColRow(col, row, 0);
    }
  }

  // methods needed to add worldmap specific behavior to the click events
  protected onHexagonMouseMove(hex: { hexCoords: HexPosition; position: THREE.Vector3 } | null): void {
    if (hex === null) {
      this.state.updateEntityActionHoveredHex(null);
      this.state.setHoveredHex(null);
      return;
    }
    const { hexCoords } = hex;
    this.state.setHoveredHex(hexCoords);
    const { selectedEntityId, actionPaths } = this.state.entityActions;
    if (selectedEntityId && actionPaths.size > 0) {
      if (this.previouslyHoveredHex?.col !== hexCoords.col || this.previouslyHoveredHex?.row !== hexCoords.row) {
        this.previouslyHoveredHex = hexCoords;
      }
      this.state.updateEntityActionHoveredHex(hexCoords);
    }
  }

  protected onHexagonDoubleClick(hexCoords: HexPosition) {}

  protected onHexagonClick(hexCoords: HexPosition | null) {
    const overlay = document.querySelector(".shepherd-modal-is-visible");
    const overlayClick = document.querySelector(".allow-modal-click");
    if (overlay && !overlayClick) {
      return;
    }
    if (!hexCoords) return;

    this.handleHexSelection(hexCoords);

    const army = this.armyHexes.get(hexCoords.col)?.get(hexCoords.row);
    const structure = this.structureHexes.get(hexCoords.col)?.get(hexCoords.row);
    const account = ContractAddress(useAccountStore.getState().account?.address || "");

    if (army?.owner === account) {
      this.onArmySelection(army.id, account);
    } else if (structure?.owner === account) {
      this.onStructureSelection(structure.id);
    } else {
      this.clearSelection();
    }
  }

  protected handleHexSelection(hexCoords: HexPosition) {
    const contractHexPosition = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();
    const position = getWorldPositionForHex(hexCoords);
    if (contractHexPosition.x !== this.state.selectedHex?.col || contractHexPosition.y !== this.state.selectedHex.row) {
      playSound(soundSelector.click, this.state.isSoundOn, this.state.effectsLevel);
      this.selectedHexManager.setPosition(position.x, position.z);
      this.state.setSelectedHex({
        col: contractHexPosition.x,
        row: contractHexPosition.y,
      });
    } else {
      this.state.setLeftNavigationView(LeftView.EntityView);
    }
  }

  protected onHexagonRightClick(hexCoords: HexPosition | null): void {
    const overlay = document.querySelector(".shepherd-modal-overlay-container");
    const overlayClick = document.querySelector(".allow-modal-click");
    if (overlay && !overlayClick) {
      return;
    }

    // Check if account exists before allowing actions
    const account = useAccountStore.getState().account;

    const { selectedEntityId, actionPaths } = this.state.entityActions;
    if (selectedEntityId && actionPaths.size > 0 && hexCoords) {
      const actionPath = actionPaths.get(ActionPaths.posKey(hexCoords, true));
      if (actionPath && account) {
        const actionType = ActionPaths.getActionType(actionPath);
        if (actionType === ActionType.Explore || actionType === ActionType.Move) {
          this.onArmyMovement(account, actionPath, selectedEntityId);
        } else if (actionType === ActionType.Attack) {
          this.onArmyAttack(actionPath, selectedEntityId);
        } else if (actionType === ActionType.Help) {
          this.onArmyHelp(actionPath, selectedEntityId);
        }
      }
    }
  }

  private onArmyMovement(account: Account | AccountInterface, actionPath: ActionPath[], selectedEntityId: ID) {
    // can only move on explored hexes
    const isExplored = ActionPaths.getActionType(actionPath) === ActionType.Move;
    if (actionPath.length > 0) {
      const armyActionManager = new ArmyActionManager(this.dojo.components, this.dojo.systemCalls, selectedEntityId);
      playSound(soundSelector.unitMarching1, this.state.isSoundOn, this.state.effectsLevel);
      armyActionManager.moveArmy(account!, actionPath, isExplored, getBlockTimestamp().currentArmiesTick);
      this.state.updateEntityActionHoveredHex(null);
    }
    // clear after movement
    this.clearSelection();
  }

  private onArmyAttack(actionPath: ActionPath[], selectedEntityId: ID) {
    const selectedPath = actionPath.map((path) => path.hex);

    // Get the target hex (last hex in the path)
    const targetHex = selectedPath[selectedPath.length - 1];

    // Find the army at the target position
    this.state.toggleModal(
      <CombatModal
        attackerEntityId={selectedEntityId}
        targetHex={new Position({ x: targetHex.col, y: targetHex.row }).getContract()}
      />,
    );
  }

  private onArmyHelp(actionPath: ActionPath[], selectedEntityId: ID) {
    const selectedPath = actionPath.map((path) => path.hex);
    const targetHex = selectedPath[selectedPath.length - 1];

    this.state.toggleModal(
      <HelpModal
        selectedEntityId={selectedEntityId}
        targetHex={new Position({ x: targetHex.col, y: targetHex.row }).getContract()}
      />,
    );
  }

  private onStructureSelection(selectedEntityId: ID) {
    this.state.updateEntityActionSelectedEntityId(selectedEntityId);

    const structure = new StructureActionManager(this.dojo.components, selectedEntityId);

    const playerAddress = useAccountStore.getState().account?.address;

    if (!playerAddress) return;

    const actionPaths = structure.findActionPaths(this.armyHexes, this.exploredTiles, ContractAddress(playerAddress));

    this.state.updateEntityActionActionPaths(actionPaths.getPaths());

    this.highlightHexManager.highlightHexes(actionPaths.getHighlightedHexes());
  }

  private onArmySelection(selectedEntityId: ID, playerAddress: ContractAddress) {
    this.state.updateEntityActionSelectedEntityId(selectedEntityId);

    const armyActionManager = new ArmyActionManager(this.dojo.components, this.dojo.systemCalls, selectedEntityId);

    const { currentDefaultTick, currentArmiesTick } = getBlockTimestamp();

    const actionPaths = armyActionManager.findActionPaths(
      this.structureHexes,
      this.armyHexes,
      this.exploredTiles,
      currentDefaultTick,
      currentArmiesTick,
      playerAddress,
    );
    this.state.updateEntityActionActionPaths(actionPaths.getPaths());
    this.highlightHexManager.highlightHexes(actionPaths.getHighlightedHexes());
  }

  private clearSelection() {
    console.log("clearSelection");
    this.highlightHexManager.highlightHexes([]);
    this.state.updateEntityActionActionPaths(new Map());
    this.state.updateEntityActionSelectedEntityId(null);
    this.state.setSelectedHex(null);
  }

  setup() {
    this.controls.maxDistance = 40;
    this.camera.far = 65;
    this.camera.updateProjectionMatrix();
    this.mainDirectionalLight.castShadow = false;
    this.controls.enablePan = true;
    this.controls.enableZoom = false;
    this.controls.zoomToCursor = false;
    this.highlightHexManager.setYOffset(0.025);
    this.moveCameraToURLLocation();
    this.changeCameraView(2);
    this.minimap.moveMinimapCenterToUrlLocation();
    this.minimap.showMinimap();

    // Close left navigation on world map load
    useUIStore.getState().setLeftNavigationView(LeftView.None);

    // Add label groups to scene
    this.scene.add(this.armyLabelsGroup);
    this.scene.add(this.structureLabelsGroup);

    // Update army and structure managers
    this.armyManager.addLabelsToScene();
    this.structureManager.showLabels();
    this.clearTileEntityCache();

    this.setupCameraZoomHandler();
  }

  onSwitchOff() {
    // Remove label groups from scene
    this.scene.remove(this.armyLabelsGroup);
    this.scene.remove(this.structureLabelsGroup);

    // Clean up labels
    this.minimap.hideMinimap();
    this.armyManager.removeLabelsFromScene();
    console.debug("[WorldMap] Removing army labels from scene");
    this.structureManager.removeLabelsFromScene();
    console.debug("[WorldMap] Removing structure labels from scene");

    // Clean up wheel event listener
    if (this.wheelHandler) {
      window.removeEventListener("wheel", this.wheelHandler);
      this.wheelHandler = null;
    }
  }

  // used to track the position of the armies on the map
  public updateArmyHexes(update: ArmySystemUpdate) {
    const {
      hexCoords: { col, row },
      owner: { address },
      entityId,
      deleted,
    } = update;

    // If the army is marked as deleted, remove it from the map
    if (deleted) {
      const oldPos = this.armiesPositions.get(entityId);
      if (oldPos) {
        this.armyHexes.get(oldPos.col)?.delete(oldPos.row);
        this.armiesPositions.delete(entityId);
      }
      return;
    }

    const normalized = new Position({ x: col, y: row }).getNormalized();
    const newPos = { col: normalized.x, row: normalized.y };
    const oldPos = this.armiesPositions.get(entityId);

    // Update army position
    this.armiesPositions.set(entityId, newPos);

    // Remove from old position if it changed
    if (
      oldPos &&
      (oldPos.col !== newPos.col || oldPos.row !== newPos.row) &&
      this.armyHexes.get(oldPos.col)?.get(oldPos.row)?.id === entityId
    ) {
      this.armyHexes.get(oldPos.col)?.delete(oldPos.row);
    }

    // Add to new position
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

  public async updateExploredHex(update: TileSystemUpdate) {
    const { hexCoords, removeExplored, biome } = update;

    const normalized = new Position({ x: hexCoords.col, y: hexCoords.row }).getNormalized();

    const col = normalized.x;
    const row = normalized.y;

    if (removeExplored) {
      const chunkRow = parseInt(this.currentChunk.split(",")[0]);
      const chunkCol = parseInt(this.currentChunk.split(",")[1]);
      this.exploredTiles.get(col)?.delete(row);
      this.removeCachedMatricesForChunk(chunkRow, chunkCol);
      this.removeCachedMatricesAroundColRow(chunkRow, chunkCol);
      this.currentChunk = "null"; // reset the current chunk to force a recomputation
      this.updateVisibleChunks();
      return;
    }

    if (!this.exploredTiles.has(col)) {
      this.exploredTiles.set(col, new Map());
    }
    if (!this.exploredTiles.get(col)!.has(row)) {
      this.exploredTiles.get(col)!.set(row, biome);
    } else {
      return;
    }

    const dummy = new THREE.Object3D();
    const pos = getWorldPositionForHex({ row, col });

    dummy.position.copy(pos);

    const isStructure = this.structureManager.structureHexCoords.get(col)?.has(row) || false;

    if (isStructure) {
      dummy.scale.set(0, 0, 0);
    } else {
      dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
    }

    if (!IS_FLAT_MODE) {
      const rotationSeed = this.hashCoordinates(col, row);
      const rotationIndex = Math.floor(rotationSeed * 6);
      const randomRotation = (rotationIndex * Math.PI) / 3;
      dummy.rotation.y = randomRotation;
      dummy.position.y += 0.05;
    } else {
      dummy.position.y += 0.1;
      dummy.rotation.y = 0;
    }

    dummy.updateMatrix();

    const { chunkX, chunkZ } = this.worldToChunkCoordinates(pos.x, pos.z);
    const hexChunkCol = chunkX * this.chunkSize;
    const hexChunkRow = chunkZ * this.chunkSize;

    const renderedChunkCenterRow = parseInt(this.currentChunk.split(",")[0]);
    const renderedChunkCenterCol = parseInt(this.currentChunk.split(",")[1]);

    // if the hex is within the chunk, add it to the interactive hex manager and to the biome
    if (this.isColRowInVisibleChunk(col, row)) {
      await this.updateHexagonGridPromise;
      this.interactiveHexManager.addHex({ col, row });

      // Add border hexes for newly explored hex
      const neighborOffsets = getNeighborOffsets(row);

      neighborOffsets.forEach(({ i, j }) => {
        const neighborCol = col + i;
        const neighborRow = row + j;
        const isNeighborExplored = this.exploredTiles.get(neighborCol)?.has(neighborRow) || false;

        if (!isNeighborExplored) {
          this.interactiveHexManager.addHex({ col: neighborCol, row: neighborRow });
        }
      });

      await Promise.all(this.modelLoadPromises);
      const hexMesh = this.biomeModels.get(biome as BiomeType)!;
      const currentCount = hexMesh.getCount();
      hexMesh.setMatrixAt(currentCount, dummy.matrix);
      hexMesh.setCount(currentCount + 1);
      hexMesh.needsUpdate();

      // Cache the updated matrices for the chunk
      this.removeCachedMatricesAroundColRow(renderedChunkCenterCol, renderedChunkCenterRow);
      this.cacheMatricesForChunk(renderedChunkCenterRow, renderedChunkCenterCol);

      this.interactiveHexManager.renderHexes();
    } else {
      this.removeCachedMatricesAroundColRow(hexChunkCol, hexChunkRow);
    }
  }

  isColRowInVisibleChunk(col: number, row: number) {
    const renderedChunkCenterRow = parseInt(this.currentChunk.split(",")[0]);
    const renderedChunkCenterCol = parseInt(this.currentChunk.split(",")[1]);

    // if the hex is within the chunk, add it to the interactive hex manager and to the biome
    if (
      col >= renderedChunkCenterCol - this.renderChunkSize.width / 2 &&
      col <= renderedChunkCenterCol + this.renderChunkSize.width / 2 &&
      row >= renderedChunkCenterRow - this.renderChunkSize.height / 2 &&
      row <= renderedChunkCenterRow + this.renderChunkSize.height / 2
    ) {
      return true;
    }
    return false;
  }

  getChunksAround(chunkKey: string) {
    const startRow = parseInt(chunkKey.split(",")[0]);
    const startCol = parseInt(chunkKey.split(",")[1]);
    const chunks: string[] = [];
    for (let i = -this.renderChunkSize.width / 2; i <= this.renderChunkSize.width / 2; i += this.chunkSize) {
      for (let j = -this.renderChunkSize.width / 2; j <= this.renderChunkSize.height / 2; j += this.chunkSize) {
        const { x, y, z } = getWorldPositionForHex({ row: startRow + i, col: startCol + j });
        const { chunkX, chunkZ } = this.worldToChunkCoordinates(x, z);
        const _chunkKey = `${chunkZ * this.chunkSize},${chunkX * this.chunkSize}`;
        if (!chunks.includes(_chunkKey)) {
          chunks.push(_chunkKey);
        }
      }
    }
    return chunks;
  }

  removeCachedMatricesAroundColRow(col: number, row: number) {
    for (let i = -this.renderChunkSize.width / 2; i <= this.renderChunkSize.width / 2; i += 10) {
      for (let j = -this.renderChunkSize.width / 2; j <= this.renderChunkSize.height / 2; j += 10) {
        if (i === 0 && j === 0) {
          continue;
        }
        this.removeCachedMatricesForChunk(row + i, col + j);
      }
    }
  }

  clearCache() {
    this.cachedMatrices.clear();
  }

  private computeInteractiveHexes(startRow: number, startCol: number, rows: number, cols: number) {
    this.interactiveHexManager.clearHexes();

    let currentIndex = 0;
    const batchSize = 50;

    const processBatch = () => {
      const endIndex = Math.min(currentIndex + batchSize, rows * cols);

      for (let i = currentIndex; i < endIndex; i++) {
        const row = Math.floor(i / cols) - rows / 2;
        const col = (i % cols) - cols / 2;

        const globalRow = startRow + row;
        const globalCol = startCol + col;

        const isExplored = this.exploredTiles.get(globalCol)?.has(globalRow) || false;

        if (!isExplored) {
          const neighborOffsets = getNeighborOffsets(globalRow);
          const isBorder = neighborOffsets.some(({ i, j }) => {
            const neighborCol = globalCol + i;
            const neighborRow = globalRow + j;
            return this.exploredTiles.get(neighborCol)?.has(neighborRow) || false;
          });

          if (isBorder) {
            this.interactiveHexManager.addHex({ col: globalCol, row: globalRow });
          }
        } else {
          this.interactiveHexManager.addHex({ col: globalCol, row: globalRow });
        }
      }

      currentIndex = endIndex;

      if (currentIndex < rows * cols) {
        requestAnimationFrame(processBatch);
      } else {
        this.interactiveHexManager.renderHexes();
      }
    };

    requestAnimationFrame(processBatch);
  }

  async updateHexagonGrid(startRow: number, startCol: number, rows: number, cols: number) {
    await Promise.all(this.modelLoadPromises);
    if (this.applyCachedMatricesForChunk(startRow, startCol)) {
      console.log("cache applied");
      this.computeInteractiveHexes(startRow, startCol, rows, cols);
      return;
    }

    this.updateHexagonGridPromise = new Promise((resolve) => {
      this.interactiveHexManager.clearHexes();
      const biomeHexes: Record<BiomeType | "Outline", THREE.Matrix4[]> = {
        None: [],
        Ocean: [],
        DeepOcean: [],
        Beach: [],
        Scorched: [],
        Bare: [],
        Tundra: [],
        Snow: [],
        TemperateDesert: [],
        Shrubland: [],
        Taiga: [],
        Grassland: [],
        TemperateDeciduousForest: [],
        TemperateRainForest: [],
        SubtropicalDesert: [],
        TropicalSeasonalForest: [],
        TropicalRainForest: [],
        Outline: [],
      };

      const batchSize = 25; // Adjust batch size as needed
      let currentIndex = 0;

      this.computeTileEntities(this.currentChunk);

      const processBatch = async () => {
        const endIndex = Math.min(currentIndex + batchSize, rows * cols);

        for (let i = currentIndex; i < endIndex; i++) {
          const row = Math.floor(i / cols) - rows / 2;
          const col = (i % cols) - cols / 2;

          const globalRow = startRow + row;
          const globalCol = startCol + col;

          const pos = getWorldPositionForHex({ row: globalRow, col: globalCol });
          dummyObject.position.copy(pos);

          const isStructure = this.structureManager.structureHexCoords.get(globalCol)?.has(globalRow) || false;

          const isExplored = this.exploredTiles.get(globalCol)?.get(globalRow) || true;
          if (isStructure) {
            dummyObject.scale.set(0, 0, 0);
          } else {
            dummyObject.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
          }

          if (!isExplored) {
            const neighborOffsets = getNeighborOffsets(globalRow);
            const isBorder = neighborOffsets.some(({ i, j }) => {
              const neighborCol = globalCol + i;
              const neighborRow = globalRow + j;
              return this.exploredTiles.get(neighborCol)?.has(neighborRow) || false;
            });

            if (isBorder) {
              this.interactiveHexManager.addHex({ col: globalCol, row: globalRow });
            }
          } else {
            this.interactiveHexManager.addHex({ col: globalCol, row: globalRow });
          }

          const rotationSeed = this.hashCoordinates(startCol + col, startRow + row);
          const rotationIndex = Math.floor(rotationSeed * 6);
          const randomRotation = (rotationIndex * Math.PI) / 3;
          if (!IS_FLAT_MODE) {
            dummyObject.position.y += 0.05;
            dummyObject.rotation.y = randomRotation;
          } else {
            dummyObject.position.y += 0.05;
            dummyObject.rotation.y = 0;
          }

          dummyObject.updateMatrix();

          if (isExplored) {
            //const biome = isExplored as BiomeType;
            const biome = Biome.getBiome(startCol + col + FELT_CENTER, startRow + row + FELT_CENTER);
            biomeHexes[biome].push(dummyObject.matrix.clone());
          } else {
            dummyObject.position.y = 0.01;
            dummyObject.updateMatrix();
            biomeHexes["Outline"].push(dummyObject.matrix.clone());
          }
        }

        currentIndex = endIndex;
        if (currentIndex < rows * cols) {
          requestAnimationFrame(processBatch);
        } else {
          for (const [biome, matrices] of Object.entries(biomeHexes)) {
            const hexMesh = this.biomeModels.get(biome as BiomeType)!;
            matrices.forEach((matrix, index) => {
              hexMesh.setMatrixAt(index, matrix);
            });
            hexMesh.setCount(matrices.length);
          }
          this.cacheMatricesForChunk(startRow, startCol);
          this.interactiveHexManager.renderHexes();
          resolve();
        }
      };

      Promise.all(this.modelLoadPromises).then(() => {
        requestAnimationFrame(processBatch);
      });
    });
  }

  private async computeTileEntities(chunkKey: string) {
    const startCol = parseInt(chunkKey.split(",")[1]) + FELT_CENTER;
    const startRow = parseInt(chunkKey.split(",")[0]) + FELT_CENTER;

    //const range = this.chunkSize / 2;

    const { width } = this.renderChunkSize;
    const range = width / 2;

    // Skip if we've already fetched this chunk
    if (this.fetchedChunks.has(chunkKey)) {
      console.log("Already fetched");
      return;
    }

    // Add to fetched chunks before the query to prevent concurrent duplicate requests
    this.fetchedChunks.add(chunkKey);

    try {
      this.state.setLoading(LoadingStateKey.Map, true);
      const promiseTiles = getEntities(
        this.dojo.network.toriiClient,
        AndComposeClause([
          MemberClause("s1_eternum-Tile", "col", "Gte", startCol - range),
          MemberClause("s1_eternum-Tile", "col", "Lte", startCol + range),
          MemberClause("s1_eternum-Tile", "row", "Gte", startRow - range),
          MemberClause("s1_eternum-Tile", "row", "Lte", startRow + range),
        ]).build(),
        this.dojo.network.contractComponents as any,
        [],
        ["s1_eternum-Tile"],
        1000,
        false,
      );
      // todo: verify that this works with nested struct
      const promiseExplorers = getEntities(
        this.dojo.network.toriiClient,
        AndComposeClause([
          MemberClause("s1_eternum-ExplorerTroops", "coord.x", "Gte", startCol - range),
          MemberClause("s1_eternum-ExplorerTroops", "coord.x", "Lte", startCol + range),
          MemberClause("s1_eternum-ExplorerTroops", "coord.y", "Gte", startRow - range),
          MemberClause("s1_eternum-ExplorerTroops", "coord.y", "Lte", startRow + range),
        ]).build(),
        this.dojo.network.contractComponents as any,
        [],
        ["s1_eternum-ExplorerTroops", "s1_eternum-Resource"],
        1000,
        false,
      );

      const promiseStructures = getEntities(
        this.dojo.network.toriiClient,
        AndComposeClause([
          MemberClause("s1_eternum-Structure", "base.coord_x", "Gte", startCol - range),
          MemberClause("s1_eternum-Structure", "base.coord_x", "Lte", startCol + range),
          MemberClause("s1_eternum-Structure", "base.coord_y", "Gte", startRow - range),
          MemberClause("s1_eternum-Structure", "base.coord_y", "Lte", startRow + range),
        ]).build(),
        this.dojo.network.contractComponents as any,
        [],
        ["s1_eternum-Structure", "s1_eternum-Resource"],
        1000,
        false,
      );

      Promise.all([promiseTiles, promiseExplorers, promiseStructures]).then(() => {
        this.state.setLoading(LoadingStateKey.Map, false);
      });
    } catch (error) {
      // If there's an error, remove the chunk from cached set so it can be retried
      this.fetchedChunks.delete(chunkKey);
      console.error("Error fetching tile entities:", error);
    }
  }

  private cacheMatricesForChunk(startRow: number, startCol: number) {
    const chunkKey = `${startRow},${startCol}`;
    for (const [biome, model] of this.biomeModels) {
      const { matrices, count } = model.getMatricesAndCount();
      if (!this.cachedMatrices.has(chunkKey)) {
        this.cachedMatrices.set(chunkKey, new Map());
      }
      this.cachedMatrices.get(chunkKey)!.set(biome, { matrices: matrices as any, count });
    }
  }

  removeCachedMatricesForChunk(startRow: number, startCol: number) {
    const chunkKey = `${startRow},${startCol}`;
    this.cachedMatrices.delete(chunkKey);
  }

  private applyCachedMatricesForChunk(startRow: number, startCol: number) {
    const chunkKey = `${startRow},${startCol}`;
    const cachedMatrices = this.cachedMatrices.get(chunkKey);
    if (cachedMatrices) {
      for (const [biome, { matrices, count }] of cachedMatrices) {
        const hexMesh = this.biomeModels.get(biome as BiomeType)!;
        hexMesh.setMatricesAndCount(matrices, count);
      }
      return true;
    }
    return false;
  }

  private worldToChunkCoordinates(x: number, z: number): { chunkX: number; chunkZ: number } {
    const chunkX = Math.floor(x / (this.chunkSize * HEX_SIZE * Math.sqrt(3)));
    const chunkZ = Math.floor(z / (this.chunkSize * HEX_SIZE * 1.5));
    return { chunkX, chunkZ };
  }

  updateVisibleChunks(force: boolean = false) {
    const cameraPosition = dummyVector;
    cameraPosition.copy(this.controls.target);
    const { selectedEntityId } = this.state.entityActions;
    // Adjust the camera position to load chunks earlier in both directions
    const adjustedX = cameraPosition.x + (this.chunkSize * HEX_SIZE * Math.sqrt(3)) / 2;
    const adjustedZ = cameraPosition.z + (this.chunkSize * HEX_SIZE * 1.5) / 3;

    const { chunkX, chunkZ } = this.worldToChunkCoordinates(adjustedX, adjustedZ);
    const startCol = chunkX * this.chunkSize;
    const startRow = chunkZ * this.chunkSize;
    const chunkKey = `${startRow},${startCol}`;
    if (this.currentChunk !== chunkKey || force) {
      this.currentChunk = chunkKey;
      // Calculate the starting position for the new chunk
      this.updateHexagonGrid(startRow, startCol, this.renderChunkSize.height, this.renderChunkSize.width);
      this.armyManager.updateChunk(chunkKey);
      this.structureManager.updateChunk(chunkKey);
    }
  }

  update(deltaTime: number) {
    super.update(deltaTime);
    this.armyManager.update(deltaTime);
    this.selectedHexManager.update(deltaTime);
    this.structureManager.updateAnimations(deltaTime);
    this.minimap.update();
  }

  public clearTileEntityCache() {
    this.fetchedChunks.clear();
  }
}
