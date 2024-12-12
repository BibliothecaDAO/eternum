import { ArmyMovementManager, TravelPaths } from "@/dojo/modelManager/ArmyMovementManager";
import { TileManager } from "@/dojo/modelManager/TileManager";
import { SetupResult } from "@/dojo/setup";
import useUIStore from "@/hooks/store/useUIStore";
import { soundSelector } from "@/hooks/useUISound";
import { HexPosition, SceneName } from "@/types";
import { Position } from "@/types/Position";
import { FELT_CENTER, IS_MOBILE } from "@/ui/config";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import { BiomeType, ID, getNeighborOffsets } from "@bibliothecadao/eternum";
import { getEntities } from "@dojoengine/state";
import * as torii from "@dojoengine/torii-client";
import throttle from "lodash/throttle";
import * as THREE from "three";
import { Raycaster } from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { SceneManager } from "../SceneManager";
import { ArmyManager } from "../components/ArmyManager";
import { BattleManager } from "../components/BattleManager";
import { Biome } from "../components/Biome";
import Minimap from "../components/Minimap";
import { SelectedHexManager } from "../components/SelectedHexManager";
import { StructureManager } from "../components/StructureManager";
import { StructurePreview } from "../components/StructurePreview";
import { playSound } from "../sound/utils";
import { ArmySystemUpdate, TileSystemUpdate } from "../systems/types";
import { HexagonScene } from "./HexagonScene";
import { DUMMY_HYPERSTRUCTURE_ENTITY_ID, HEX_SIZE, PREVIEW_BUILD_COLOR_INVALID } from "./constants";

export default class WorldmapScene extends HexagonScene {
  private biome!: Biome;

  private chunkSize = 10; // Size of each chunk
  private renderChunkSize = {
    width: 40,
    height: 30,
  };

  private totalStructures: number = 0;

  private currentChunk: string = "null";

  private subscription: torii.Subscription | null = null;

  private armyManager: ArmyManager;
  private structureManager: StructureManager;
  private battleManager: BattleManager;
  private exploredTiles: Map<number, Set<number>> = new Map();
  private battles: Map<number, Set<number>> = new Map();
  private tileManager: TileManager;
  private structurePreview: StructurePreview | null = null;
  private structureEntityId: ID = UNDEFINED_STRUCTURE_ENTITY_ID;
  private armySubscription: any;
  private selectedHexManager: SelectedHexManager;
  private minimap!: Minimap;
  private previouslyHoveredHex: HexPosition | null = null;
  private cachedMatrices: Map<string, Map<string, { matrices: THREE.InstancedBufferAttribute; count: number }>> =
    new Map();

  dojo: SetupResult;

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

    this.biome = new Biome();

    this.structurePreview = new StructurePreview(this.scene);
    this.tileManager = new TileManager(this.dojo, { col: 0, row: 0 });

    this.loadBiomeModels(this.renderChunkSize.width * this.renderChunkSize.height);

    useUIStore.subscribe((state) => {
      this.state = state;
    });

    useUIStore.subscribe(
      (state) => state.previewBuilding,
      (structure) => {
        if (structure) {
          this.structurePreview?.setPreviewStructure(structure as any);
          this.highlightHexManager.highlightHexes(this.getBuildableHexesForCurrentChunk());
        } else {
          this.structurePreview?.clearPreviewStructure();
          this.highlightHexManager.highlightHexes([]);
        }
      },
    );

    useUIStore.subscribe(
      (state) => state.structureEntityId,
      (structureEntityId) => {
        this.structureEntityId = structureEntityId;
      },
    );

    this.armyManager = new ArmyManager(this.scene, this.renderChunkSize, this.exploredTiles);
    this.structureManager = new StructureManager(this.scene, this.renderChunkSize);
    this.battleManager = new BattleManager(this.scene);

    this.armySubscription?.unsubscribe();
    this.armySubscription = this.systemManager.Army.onUpdate((update: ArmySystemUpdate) => {
      this.armyManager.onUpdate(update).then((needsUpdate) => {
        if (needsUpdate) {
          this.updateVisibleChunks();
        }
      });
    });

    this.systemManager.Battle.onUpdate((value) => this.battleManager.onUpdate(value));
    this.systemManager.Tile.onUpdate((value) => this.updateExploredHex(value));
    this.systemManager.Structure.onUpdate((value) => {
      const optimisticStructure = this.structureManager.structures.removeStructure(
        Number(DUMMY_HYPERSTRUCTURE_ENTITY_ID),
      );
      if (optimisticStructure) {
        this.dojo.components.Structure.removeOverride(DUMMY_HYPERSTRUCTURE_ENTITY_ID.toString());
        this.dojo.components.Position.removeOverride(DUMMY_HYPERSTRUCTURE_ENTITY_ID.toString());
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

    this.systemManager.Structure.onContribution((value) => {
      this.structureManager.structures.updateStructureStage(value.entityId, value.structureType, value.stage);
      this.structureManager.updateChunk(this.currentChunk);
    });

    this.inputManager.addListener(
      "mousemove",
      throttle((raycaster) => {
        const entityId = this.armyManager.onMouseMove(raycaster);
        this.onArmyMouseMove(entityId);
      }, 10),
    );

    // add particles
    this.selectedHexManager = new SelectedHexManager(this.scene);

    // subscribe to changes in the selected army coming from React
    useUIStore.subscribe(
      (state) => state.armyActions.selectedEntityId,
      (selectedEntityId) => {
        this.onArmySelection(selectedEntityId);
      },
    );

    if (!IS_MOBILE) {
      this.minimap = new Minimap(
        this,
        this.exploredTiles,
        this.camera,
        this.structureManager,
        this.armyManager,
        this.battleManager,
        this.biome,
      );
    }

    // Add event listener for Escape key
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.sceneManager.getCurrentScene() === SceneName.WorldMap) {
        if (this.isNavigationViewOpen()) {
          this.closeNavigationViews();
        } else {
          this.clearEntitySelection();
          this.clearHexSelection();
        }
      }
    });

    window.addEventListener("urlChanged", () => {
      this.clearEntitySelection();
      this.clearHexSelection();
    });
  }

  public moveCameraToURLLocation() {
    const col = this.locationManager.getCol();
    const row = this.locationManager.getRow();
    if (col !== undefined && row !== undefined) {
      this.moveCameraToColRow(col, row, 0);
    }
  }

  private onArmyMouseMove(entityId: ID | undefined) {
    if (entityId) {
      this.state.setHoveredArmyEntityId(entityId);
    } else if (this.state.hoveredArmyEntityId) {
      this.state.setHoveredArmyEntityId(null);
    }
  }

  // methods needed to add worldmap specific behavior to the click events
  protected onHexagonMouseMove(hex: { hexCoords: HexPosition; position: THREE.Vector3 } | null): void {
    if (hex === null) {
      this.state.updateHoveredHex(null);
      this.state.setHoveredStructure(null);
      this.state.setHoveredBattle(null);
      return;
    }
    const { hexCoords } = hex;
    const { selectedEntityId, travelPaths } = this.state.armyActions;
    if (selectedEntityId && travelPaths.size > 0) {
      if (this.previouslyHoveredHex?.col !== hexCoords.col || this.previouslyHoveredHex?.row !== hexCoords.row) {
        this.previouslyHoveredHex = hexCoords;
      }
      this.state.updateHoveredHex(hexCoords);
    }

    this.structurePreview?.setStructurePosition(getWorldPositionForHex(hexCoords));

    if (!this._canBuildStructure(hexCoords)) {
      this.structurePreview?.setStructureColor(new THREE.Color(PREVIEW_BUILD_COLOR_INVALID));
    } else {
      this.structurePreview?.resetStructureColor();
    }

    if (this.state.hoveredArmyEntityId) return;

    const structure = this.structureManager.getStructureByHexCoords(hexCoords);
    if (structure) {
      this.state.setHoveredStructure(structure);
    } else if (this.state.hoveredStructure) {
      this.state.setHoveredStructure(null);
    }

    const position = new Position({ x: hexCoords.col, y: hexCoords.row });
    const isBattle = this.battleManager.battles.hasByPosition(position);

    if (isBattle) {
      const contractPosition = position.getContract();
      if (this.state.hoveredBattle?.x !== contractPosition.x || this.state.hoveredBattle?.y !== contractPosition.y) {
        this.state.setHoveredBattle(position.getContract());
      }
    } else {
      this.state.setHoveredBattle(null);
    }
  }

  private _canBuildStructure(hexCoords: HexPosition) {
    const isStructure = this.structureManager.structureHexCoords.get(hexCoords.col)?.has(hexCoords.row) || false;
    const isExplored = this.exploredTiles.get(hexCoords.col)?.has(hexCoords.row) || false;

    return !isStructure && isExplored;
  }

  protected onHexagonDoubleClick(hexCoords: HexPosition) {}

  protected onHexagonClick(hexCoords: HexPosition | null) {
    const overlay = document.querySelector(".shepherd-modal-overlay-container");
    const overlayClick = document.querySelector(".allow-modal-click");
    if (overlay && !overlayClick) {
      return;
    }
    if (!hexCoords) return;

    const buildingType = this.structurePreview?.getPreviewStructure();

    if (buildingType && this._canBuildStructure(hexCoords)) {
      this.handleStructurePlacement(hexCoords);
    } else {
      this.handleHexSelection(hexCoords);
    }
  }

  protected handleStructurePlacement(hexCoords: HexPosition) {
    const buildingType = this.structurePreview?.getPreviewStructure();
    if (!buildingType) return;

    const contractHexPosition = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();

    this.clearCache();
    this.totalStructures = this.structureManager.getTotalStructures() + 1;

    this.tileManager.placeStructure(this.structureEntityId, buildingType.type, contractHexPosition).catch(() => {
      this.structureManager.structures.removeStructureFromPosition(hexCoords);
      this.structureManager.structureHexCoords.get(hexCoords.col)?.delete(hexCoords.row);
      this.clearCache();
      this.updateVisibleChunks(true);
    });
    this.clearEntitySelection();
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

    const { selectedEntityId, travelPaths } = this.state.armyActions;
    if (selectedEntityId && travelPaths.size > 0 && hexCoords) {
      const travelPath = travelPaths.get(TravelPaths.posKey(hexCoords, true));
      if (travelPath) {
        const selectedPath = travelPath.path;
        const isExplored = travelPath.isExplored ?? false;
        if (selectedPath.length > 0) {
          const armyMovementManager = new ArmyMovementManager(this.dojo, selectedEntityId);
          playSound(soundSelector.unitMarching1, this.state.isSoundOn, this.state.effectsLevel);
          armyMovementManager.moveArmy(selectedPath, isExplored, this.state.currentArmiesTick);
        }
      }
    }
  }

  private onArmySelection(selectedEntityId: ID | null) {
    if (!selectedEntityId) {
      this.clearEntitySelection();
      return;
    }

    const armyMovementManager = new ArmyMovementManager(this.dojo, selectedEntityId);
    const travelPaths = armyMovementManager.findPaths(
      this.exploredTiles,
      this.state.currentDefaultTick,
      this.state.currentArmiesTick,
    );
    this.state.updateTravelPaths(travelPaths.getPaths());
    this.highlightHexManager.highlightHexes(travelPaths.getHighlightedHexes());
  }

  private clearEntitySelection() {
    this.highlightHexManager.highlightHexes([]);
    this.state.updateTravelPaths(new Map());
    this.structurePreview?.clearPreviewStructure();
  }

  private clearHexSelection() {
    this.state.setSelectedHex(null);
  }

  setup() {
    this.controls.maxDistance = 20;
    this.controls.enablePan = true;
    this.controls.zoomToCursor = true;
    this.moveCameraToURLLocation();
    if (!IS_MOBILE) {
      this.minimap.moveMinimapCenterToUrlLocation();
      this.minimap.showMinimap();
    }

    // Close left navigation on world map load
    useUIStore.getState().setLeftNavigationView(LeftView.None);

    this.armyManager.addLabelsToScene();
  }

  onSwitchOff() {
    if (!IS_MOBILE) {
      this.minimap.hideMinimap();
    }
    this.armyManager.removeLabelsFromScene();
  }

  public async updateExploredHex(update: TileSystemUpdate) {
    const { hexCoords, removeExplored } = update;

    const col = hexCoords.col - FELT_CENTER;
    const row = hexCoords.row - FELT_CENTER;

    if (removeExplored) {
      const chunkRow = parseInt(this.currentChunk.split(",")[0]);
      const chunkCol = parseInt(this.currentChunk.split(",")[1]);
      this.exploredTiles.get(col)?.delete(row);
      this.removeCachedMatricesForChunk(chunkRow, chunkCol);
      this.currentChunk = "null"; // reset the current chunk to force a recomputation
      this.updateVisibleChunks();
      return;
    }

    if (!this.exploredTiles.has(col)) {
      this.exploredTiles.set(col, new Set());
    }
    if (!this.exploredTiles.get(col)!.has(row)) {
      this.exploredTiles.get(col)!.add(row);
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

    const rotationSeed = this.hashCoordinates(col, row);
    const rotationIndex = Math.floor(rotationSeed * 6);
    const randomRotation = (rotationIndex * Math.PI) / 3;
    dummy.rotation.y = randomRotation;

    const biomePosition = new Position({ x: col, y: row }).getContract();
    const biome = this.biome.getBiome(biomePosition.x, biomePosition.y);

    dummy.updateMatrix();

    const { chunkX, chunkZ } = this.worldToChunkCoordinates(pos.x, pos.z);
    const hexCol = chunkX * this.chunkSize;
    const hexRow = chunkZ * this.chunkSize;
    const renderedChunkCenterRow = parseInt(this.currentChunk.split(",")[0]);
    const renderedChunkCenterCol = parseInt(this.currentChunk.split(",")[1]);

    // if the hex is within the chunk, add it to the interactive hex manager and to the biome
    if (
      hexCol >= renderedChunkCenterCol - this.renderChunkSize.width / 2 &&
      hexCol <= renderedChunkCenterCol + this.renderChunkSize.width / 2 &&
      hexRow >= renderedChunkCenterRow - this.renderChunkSize.height / 2 &&
      hexRow <= renderedChunkCenterRow + this.renderChunkSize.height / 2
    ) {
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

      this.cacheMatricesForChunk(renderedChunkCenterRow, renderedChunkCenterCol);

      this.interactiveHexManager.renderHexes();
    }

    this.removeCachedMatricesAroundColRow(renderedChunkCenterCol, renderedChunkCenterRow);
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
    const batchSize = 25;

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
      this.computeInteractiveHexes(startRow, startCol, rows, cols);
      return;
    }

    this.interactiveHexManager.clearHexes();
    const dummy = new THREE.Object3D();
    const biomeHexes: Record<BiomeType | "Outline", THREE.Matrix4[]> = {
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

    const hexPositions: THREE.Vector3[] = [];
    const batchSize = 25; // Adjust batch size as needed
    let currentIndex = 0;
    let hashedTiles: string[] = [];

    const processBatch = async () => {
      const endIndex = Math.min(currentIndex + batchSize, rows * cols);

      for (let i = currentIndex; i < endIndex; i++) {
        const row = Math.floor(i / cols) - rows / 2;
        const col = (i % cols) - cols / 2;

        const globalRow = startRow + row;
        const globalCol = startCol + col;

        hexPositions.push(new THREE.Vector3(dummy.position.x, dummy.position.y, dummy.position.z));
        const pos = getWorldPositionForHex({ row: globalRow, col: globalCol });
        dummy.position.copy(pos);

        const isStructure = this.structureManager.structureHexCoords.get(globalCol)?.has(globalRow) || false;

        const isBattle = this.battles.get(globalCol)?.has(globalRow) || false;
        const isExplored = this.exploredTiles.get(globalCol)?.has(globalRow) || false;
        if (isStructure || isBattle) {
          dummy.scale.set(0, 0, 0);
        } else {
          dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
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
        dummy.rotation.y = randomRotation;

        const biome = this.biome.getBiome(startCol + col + FELT_CENTER, startRow + row + FELT_CENTER);

        dummy.updateMatrix();

        if (isExplored) {
          biomeHexes[biome].push(dummy.matrix.clone());
        } else {
          dummy.position.y = 0.01;
          dummy.updateMatrix();
          biomeHexes["Outline"].push(dummy.matrix.clone());
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

        await this.computeTileEntities();
      }
    };

    Promise.all(this.modelLoadPromises).then(() => {
      requestAnimationFrame(processBatch);
    });
  }

  private async computeTileEntities() {
    const cameraPosition = new THREE.Vector3();
    cameraPosition.copy(this.controls.target);

    const adjustedX = cameraPosition.x + (this.chunkSize * HEX_SIZE * Math.sqrt(3)) / 2;
    const adjustedZ = cameraPosition.z + (this.chunkSize * HEX_SIZE * 1.5) / 3;

    // Parse current chunk coordinates
    const { chunkX, chunkZ } = this.worldToChunkCoordinates(adjustedX, adjustedZ);

    const startCol = chunkX * this.chunkSize + FELT_CENTER;
    const startRow = chunkZ * this.chunkSize + FELT_CENTER;

    const range = this.chunkSize + 4;

    const sub = await getEntities(
      this.dojo.network.toriiClient,
      {
        Composite: {
          operator: "Or",
          clauses: [
            {
              Member: {
                model: "s0_eternum-Tile",
                member: "col",
                operator: "Gte",
                value: { Primitive: { U32: startCol - range } },
              },
            },
            {
              Member: {
                model: "s0_eternum-Tile",
                member: "col",
                operator: "Lte",
                value: { Primitive: { U32: startCol + range } },
              },
            },
            {
              Member: {
                model: "s0_eternum-Tile",
                member: "row",
                operator: "Gte",
                value: { Primitive: { U32: startRow - range } },
              },
            },
            {
              Member: {
                model: "s0_eternum-Tile",
                member: "row",
                operator: "Lte",
                value: { Primitive: { U32: startRow + range } },
              },
            },
          ],
        },
      },
      this.dojo.network.contractComponents as any,
      1000,
      false,
    );

    console.log(sub);
  }

  private getExploredHexesForCurrentChunk() {
    const chunkKey = this.currentChunk.split(",");
    const startRow = parseInt(chunkKey[0]);
    const startCol = parseInt(chunkKey[1]);
    const exploredHexes: HexPosition[] = [];
    for (
      let row = startRow - this.renderChunkSize.height / 2;
      row <= startRow + this.renderChunkSize.height / 2;
      row++
    ) {
      for (
        let col = startCol - this.renderChunkSize.width / 2;
        col <= startCol + this.renderChunkSize.width / 2;
        col++
      ) {
        if (this.exploredTiles.get(col)?.has(row)) {
          exploredHexes.push({ col, row });
        }
      }
    }
    return exploredHexes;
  }

  private getBuildableHexesForCurrentChunk() {
    const exploredHexes = this.getExploredHexesForCurrentChunk();
    const buildableHexes = exploredHexes.filter(
      (hex) => !this.structureManager.structureHexCoords.get(hex.col)?.has(hex.row),
    );
    return buildableHexes;
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
    const cameraPosition = new THREE.Vector3();
    cameraPosition.copy(this.controls.target);
    const { selectedEntityId } = this.state.armyActions;
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
    if (!selectedEntityId) {
      if (this.structurePreview?.getPreviewStructure()) {
        this.highlightHexManager.highlightHexes(this.getBuildableHexesForCurrentChunk());
      } else {
        this.highlightHexManager.highlightHexes([]);
      }
    }
  }

  update(deltaTime: number) {
    super.update(deltaTime);
    this.armyManager.update(deltaTime);
    this.selectedHexManager.update(deltaTime);
    this.battleManager.update(deltaTime);
    this.structureManager.updateAnimations(deltaTime);
    if (!IS_MOBILE) {
      this.minimap.update();
    }
  }
}
