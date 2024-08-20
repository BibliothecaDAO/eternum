import * as THREE from "three";
import { Raycaster } from "three";

import { ArmyMovementManager, TravelPaths } from "@/dojo/modelManager/ArmyMovementManager";
import { SetupResult } from "@/dojo/setup";
import useUIStore from "@/hooks/store/useUIStore";
import { HexPosition, SceneName } from "@/types";
import { Position } from "@/types/Position";
import { FELT_CENTER } from "@/ui/config";
import { View } from "@/ui/modules/navigation/LeftNavigationModule";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import { BiomeType, ID, neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import { throttle } from "lodash";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { SceneManager } from "../SceneManager";
import { ArmyManager } from "../components/ArmyManager";
import { BattleManager } from "../components/BattleManager";
import { Biome } from "../components/Biome";
import { StructureManager } from "../components/StructureManager";
import { ArmySystemUpdate, TileSystemUpdate } from "../systems/types";
import { HexagonScene } from "./HexagonScene";
import { HEX_SIZE, PREVIEW_BUILD_COLOR_INVALID } from "./constants";
import { LocationManager } from "../helpers/LocationManager";
import { StructurePreview } from "../components/StructurePreview";
import { TileManager } from "@/dojo/modelManager/TileManager";
import { hexagonEdgeMesh } from "../geometry/HexagonGeometry";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";

export default class WorldmapScene extends HexagonScene {
  private biome!: Biome;

  private chunkSize = 10; // Size of each chunk
  private renderChunkSize = {
    width: 40,
    height: 30,
  };

  private totalStructures: number = 0;

  private currentChunk: string = "null";

  private armyManager: ArmyManager;
  private structureManager: StructureManager;
  private battleManager: BattleManager;
  private exploredTiles: Map<number, Set<number>> = new Map();
  private battles: Map<number, Set<number>> = new Map();
  private tileManager: TileManager;
  private structurePreview: StructurePreview | null = null;
  private structureEntityId: ID = UNDEFINED_STRUCTURE_ENTITY_ID;
  private armySubscription: any;

  private cachedMatrices: Map<string, Map<string, { matrices: THREE.InstancedBufferAttribute; count: number }>> =
    new Map();
  private cachedHexagonEdges: Map<string, THREE.Group> = new Map();

  constructor(
    dojoContext: SetupResult,
    raycaster: Raycaster,
    controls: MapControls,
    mouse: THREE.Vector2,
    sceneManager: SceneManager,
  ) {
    super(SceneName.WorldMap, controls, dojoContext, mouse, raycaster, sceneManager);

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
        } else {
          this.structurePreview?.clearPreviewStructure();
        }
      },
    );

    useUIStore.subscribe(
      (state) => state.structureEntityId,
      (structureEntityId) => {
        this.structureEntityId = structureEntityId;
      },
    );

    this.armyManager = new ArmyManager(this.scene);
    this.structureManager = new StructureManager(this.scene);
    this.battleManager = new BattleManager(this.scene);

    this.armySubscription?.unsubscribe();
    this.armySubscription = this.systemManager.Army.onUpdate((update: ArmySystemUpdate) =>
      this.armyManager.onUpdate(update),
    );

    this.systemManager.Battle.onUpdate((value) => this.battleManager.onUpdate(value));
    this.systemManager.Tile.onUpdate((value) => this.updateExploredHex(value));
    this.systemManager.Structure.onUpdate((value) => {
      this.structureManager.onUpdate(value);
      if (this.totalStructures !== this.structureManager.totalStructures) {
        const { col, row } = value.hexCoords;
        const { chunkX, chunkZ } = this.worldToChunkCoordinates(
          getWorldPositionForHex({ col: col - FELT_CENTER, row: row - FELT_CENTER }).x,
          getWorldPositionForHex({ col: col - FELT_CENTER, row: row - FELT_CENTER }).z,
        );
        const startRow = chunkZ * this.chunkSize;
        const startCol = chunkX * this.chunkSize;

        this.totalStructures = this.structureManager.totalStructures;

        this.removeCachedMatricesForChunk(startRow, startCol);
        this.updateHexagonGrid(startRow, startCol, this.renderChunkSize.height, this.renderChunkSize.width);
      }
    });

    this.inputManager.addListener(
      "mousemove",
      throttle((raycaster) => {
        const entityId = this.armyManager.onMouseMove(raycaster);
        this.onArmyMouseMove(entityId);
      }, 10),
    );
    this.inputManager.addListener("contextmenu", (raycaster) => {
      const selectedEntityId = this.armyManager.onRightClick(raycaster);
      this.onArmyRightClick(selectedEntityId);
    });
  }

  public moveCameraToURLLocation() {
    const col = this.locationManager.getCol();
    const row = this.locationManager.getRow();
    if (col && row) {
      this.moveCameraToColRow(col, row, 0);
    }
  }

  private onArmyMouseMove(entityId: ID | undefined) {
    if (entityId) {
      this.state.setHoveredArmyEntityId(entityId);
    } else {
      this.state.setHoveredArmyEntityId(null);
    }
  }

  // methods needed to add worldmap specific behavior to the click events
  protected onHexagonMouseMove({ hexCoords }: { hexCoords: HexPosition }) {
    const { selectedEntityId, travelPaths } = this.state.armyActions;
    if (selectedEntityId && travelPaths.size > 0) {
      this.state.updateHoveredHex(hexCoords);
    }
    this.structurePreview?.setStructurePosition(getWorldPositionForHex(hexCoords));

    if (!this._canBuildStructure(hexCoords)) {
      this.structurePreview?.setStructureColor(new THREE.Color(PREVIEW_BUILD_COLOR_INVALID));
    } else {
      this.structurePreview?.resetStructureColor();
    }
  }

  private _canBuildStructure(hexCoords: HexPosition) {
    const contractPos = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();

    const isStructure = this.structureManager.structureHexCoords.get(hexCoords.col)?.has(hexCoords.row) || false;
    const isExplored = this.exploredTiles.get(hexCoords.col)?.has(hexCoords.row) || false;

    const biomeType = this.biome.getBiome(contractPos.x, contractPos.y);
    const isOcean = biomeType === BiomeType.Ocean || biomeType === BiomeType.DeepOcean;

    return !isStructure && isExplored && !isOcean;
  }

  protected onHexagonDoubleClick(hexCoords: HexPosition) {
    const url = new Position({ x: hexCoords.col, y: hexCoords.row }).toHexLocationUrl();
    LocationManager.updateUrl(url);
  }

  protected onHexagonClick(hexCoords: HexPosition) {
    const { selectedEntityId, travelPaths } = this.state.armyActions;

    const buildingType = this.structurePreview?.getPreviewStructure();

    if (buildingType && this._canBuildStructure(hexCoords)) {
      const normalizedHexCoords = { col: hexCoords.col + FELT_CENTER, row: hexCoords.row + FELT_CENTER };
      this.tileManager.placeStructure(this.structureEntityId, buildingType.type, normalizedHexCoords);
      this.clearEntitySelection();
    } else if (selectedEntityId && travelPaths.size > 0) {
      const travelPath = travelPaths.get(TravelPaths.posKey(hexCoords, true));
      if (travelPath) {
        const selectedPath = travelPath.path;
        const isExplored = travelPath.isExplored ?? false;
        if (selectedPath.length > 0) {
          const armyMovementManager = new ArmyMovementManager(this.dojo, selectedEntityId);
          armyMovementManager.moveArmy(selectedPath, isExplored);
          this.clearEntitySelection();
        }
      }
    } else {
      this.state.setSelectedHex({ col: hexCoords.col + FELT_CENTER, row: hexCoords.row + FELT_CENTER });
      this.state.setLeftNavigationView(View.EntityView);
    }
  }
  protected onHexagonRightClick(): void {}

  private onArmyRightClick(selectedEntityId: ID | undefined) {
    if (!selectedEntityId) {
      this.clearEntitySelection();
      return;
    }
    this.state.updateSelectedEntityId(selectedEntityId);
    const armyMovementManager = new ArmyMovementManager(this.dojo, selectedEntityId);
    const travelPaths = armyMovementManager.findPaths(this.exploredTiles);
    this.state.updateTravelPaths(travelPaths.getPaths());
    this.highlightHexManager.highlightHexes(travelPaths.getHighlightedHexes());
  }

  private clearEntitySelection() {
    this.state.updateSelectedEntityId(null);
    this.highlightHexManager.highlightHexes([]);
    this.state.updateTravelPaths(new Map());
    this.structurePreview?.clearPreviewStructure();
  }

  setup() {
    this.controls.maxDistance = 20;
    this.controls.enablePan = true;
    this.controls.zoomToCursor = true;
    this.moveCameraToURLLocation();
  }

  public async updateExploredHex(update: TileSystemUpdate) {
    const { hexCoords, removeExplored } = update;

    if (removeExplored) {
      return;
    }

    const col = hexCoords.col - FELT_CENTER;
    const row = hexCoords.row - FELT_CENTER;
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
      const neighborOffsets = row % 2 === 0 ? neighborOffsetsOdd : neighborOffsetsEven;

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

    // remove the cached matrices for the explored hexes that are not in the visible chunk
    for (let i = -this.renderChunkSize.width / 2; i <= this.renderChunkSize.width / 2; i += 10) {
      for (let j = -this.renderChunkSize.width / 2; j <= this.renderChunkSize.height / 2; j += 10) {
        if (i === 0 && j === 0) {
          continue;
        }
        this.removeCachedMatricesForChunk(renderedChunkCenterRow + i, renderedChunkCenterCol + j);
      }
    }
  }

  async updateHexagonGrid(startRow: number, startCol: number, rows: number, cols: number) {
    await Promise.all(this.modelLoadPromises);
    if (this.applyCachedMatricesForChunk(startRow, startCol)) {
      return;
    }

    this.setHexagonEdges(new THREE.Group());
    const dummy = new THREE.Object3D();
    const biomeHexes: Record<BiomeType, THREE.Matrix4[]> = {
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
    };

    const hexPositions: THREE.Vector3[] = [];
    const batchSize = 25; // Adjust batch size as needed
    let currentIndex = 0;

    const processBatch = () => {
      const endIndex = Math.min(currentIndex + batchSize, rows * cols);
      for (let i = currentIndex; i < endIndex; i++) {
        const row = Math.floor(i / cols) - rows / 2;
        const col = (i % cols) - cols / 2;

        const globalRow = startRow + row;
        const globalCol = startCol + col;

        hexPositions.push(new THREE.Vector3(dummy.position.x, dummy.position.y, dummy.position.z));
        const pos = getWorldPositionForHex({ row: globalRow, col: globalCol });
        dummy.position.copy(pos);
        const hexEdge = hexagonEdgeMesh.clone();
        hexEdge.position.copy(pos);
        hexEdge.position.y += 0.1;
        this.addHexagonEdge(hexEdge);

        const isStructure = this.structureManager.structureHexCoords.get(globalCol)?.has(globalRow) || false;
        const isBattle = this.battles.get(globalCol)?.has(globalRow) || false;
        const isExplored = this.exploredTiles.get(globalCol)?.has(globalRow) || false;
        if (isStructure || !isExplored || isBattle) {
          dummy.scale.set(0, 0, 0);
        } else {
          dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
        }

        if (!isExplored) {
          const neighborOffsets = globalRow % 2 === 0 ? neighborOffsetsOdd : neighborOffsetsEven;
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

        biomeHexes[biome].push(dummy.matrix.clone());
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
      }
    };

    Promise.all(this.modelLoadPromises).then(() => {
      requestAnimationFrame(processBatch);
    });
  }

  public createGroundMesh() {
    const scale = 60;
    const metalness = 0.5;
    const roughness = 0.7;

    const geometry = new THREE.PlaneGeometry(2668, 1390.35);
    const texture = new THREE.TextureLoader().load("/textures/paper/worldmap-bg.png", () => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(scale, scale / 2.5);
    });

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: metalness,
      roughness: roughness,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.set(Math.PI / 2, 0, 0);
    mesh.position.set(1334.1, 0.05, -695.175);
    mesh.receiveShadow = true;
    // disable raycast
    mesh.raycast = () => {};

    this.scene.add(mesh);
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
    const hexEdges = this.getHexagonEdges();
    this.cachedHexagonEdges.set(chunkKey, hexEdges);
  }

  removeCachedMatricesForChunk(startRow: number, startCol: number) {
    const chunkKey = `${startRow},${startCol}`;
    this.cachedMatrices.delete(chunkKey);
  }

  private applyCachedMatricesForChunk(startRow: number, startCol: number) {
    const chunkKey = `${startRow},${startCol}`;
    const cachedMatrices = this.cachedMatrices.get(chunkKey);
    const cachedHexEdges = this.cachedHexagonEdges.get(chunkKey);
    if (cachedMatrices) {
      for (const [biome, { matrices, count }] of cachedMatrices) {
        const hexMesh = this.biomeModels.get(biome as BiomeType)!;
        hexMesh.setMatricesAndCount(matrices, count);
      }
      if (cachedHexEdges) {
        this.setHexagonEdges(cachedHexEdges);
      }
      return true;
    }
    return false;
  }

  private worldToChunkCoordinates(x: number, z: number): { chunkX: number; chunkZ: number } {
    const chunkX = Math.floor(x / (this.chunkSize * HEX_SIZE * Math.sqrt(3)));
    const chunkZ = Math.floor(-z / (this.chunkSize * HEX_SIZE * 1.5));
    return { chunkX, chunkZ };
  }

  updateVisibleChunks() {
    const cameraPosition = new THREE.Vector3();
    cameraPosition.copy(this.controls.target);

    // Adjust the camera position to load chunks earlier in both directions
    const adjustedX = cameraPosition.x + (this.chunkSize * HEX_SIZE * Math.sqrt(3)) / 2;
    const adjustedZ = cameraPosition.z - (this.chunkSize * HEX_SIZE * 1.5) / 3;

    const { chunkX, chunkZ } = this.worldToChunkCoordinates(adjustedX, adjustedZ);
    const startCol = chunkX * this.chunkSize;
    const startRow = chunkZ * this.chunkSize;
    const chunkKey = `${startRow},${startCol}`;
    if (this.currentChunk !== chunkKey) {
      this.currentChunk = chunkKey;
      // Calculate the starting position for the new chunk
      this.updateHexagonGrid(startRow, startCol, this.renderChunkSize.height, this.renderChunkSize.width);
    }
  }

  update(deltaTime: number) {
    super.update(deltaTime);
    this.armyManager.update(deltaTime);
  }
}
