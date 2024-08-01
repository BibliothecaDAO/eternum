import * as THREE from "three";
import { Raycaster } from "three";
import { FogManager } from "../components/FogManager";

import { Entity } from "@dojoengine/recs";
import { ContextMenuManager } from "../components/ContextMenuManager";

import { SetupResult } from "@/dojo/setup";
import { FELT_CENTER } from "@/ui/config";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Biome, BiomeType } from "../components/Biome";
import InstancedModel from "../components/InstancedModel";
import { SystemManager } from "../systems/SystemManager";
import { neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import { InteractiveHexManager } from "../components/InteractiveHexManager";
import { HighlightHexManager } from "../components/HighlightHexManager";
import { GUIManager } from "../helpers/GUIManager";
import { HEX_SIZE } from "../GameRenderer";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import { InputManager } from "../components/InputManager";
import { throttle } from "lodash";
import { SceneManager } from "../SceneManager";
import { ArmyManager } from "../components/ArmyManager";
import { StructureManager } from "../components/StructureManager";
import useUIStore from "@/hooks/store/useUIStore";
import { ArmyMovementManager, TravelPaths } from "@/dojo/modelManager/ArmyMovementManager";
import { StructureSystemUpdate, TileSystemUpdate } from "../systems/types";

const BASE_PATH = "/models/bevel-biomes/";
export const biomeModelPaths: Record<BiomeType, string> = {
  DeepOcean: BASE_PATH + "deepocean.glb",
  Ocean: BASE_PATH + "ocean.glb",
  Beach: BASE_PATH + "beach.glb",
  Scorched: BASE_PATH + "scorched.glb",
  Bare: BASE_PATH + "bare.glb",
  Tundra: BASE_PATH + "tundra.glb",
  Snow: BASE_PATH + "snow.glb",
  TemperateDesert: BASE_PATH + "temperatedessert.glb",
  Shrubland: BASE_PATH + "shrublands.glb",
  Taiga: BASE_PATH + "taiga.glb",
  Grassland: BASE_PATH + "grassland.glb",
  TemperateDeciduousForest: BASE_PATH + "deciduousforest.glb",
  TemperateRainForest: BASE_PATH + "temperateRainforest.glb",
  SubtropicalDesert: BASE_PATH + "subtropicaldesert.glb",
  TropicalSeasonalForest: BASE_PATH + "tropicalrainforest.glb",
  TropicalRainForest: BASE_PATH + "tropicalrainforest.glb",
};

export default class WorldmapScene {
  scene!: THREE.Scene;
  private lightAmbient!: THREE.AmbientLight;
  private mainDirectionalLight!: THREE.DirectionalLight;
  private pmremGenerator!: THREE.PMREMGenerator;
  private fogManager: FogManager;

  private biome!: Biome;
  private lightType: "pmrem" | "hemisphere" = "hemisphere";
  private lightHelper!: THREE.DirectionalLightHelper;

  private camera: THREE.PerspectiveCamera;

  contextMenuManager: ContextMenuManager;

  private chunkSize = 10; // Size of each chunk
  private renderChunkSize = {
    width: 40,
    height: 30,
  };
  private loadedChunks: Map<string, THREE.Group> = new Map();

  private biomeModels: Map<BiomeType, InstancedModel> = new Map();
  private modelLoadPromises: Promise<void>[] = [];

  private currentChunk: string = "null";

  private entities: Entity[] = [];

  private armyManager: ArmyManager;
  private structureManager: StructureManager;
  private exploredTiles: Map<number, Set<number>> = new Map();
  private structures: Map<number, Set<number>> = new Map();

  private cachedMatrices: Map<string, Map<string, { matrices: THREE.InstancedBufferAttribute; count: number }>> =
    new Map();

  private interactiveHexManager: InteractiveHexManager;
  public highlightHexManager: HighlightHexManager;

  private inputManager: InputManager;

  constructor(
    private dojoConfig: SetupResult,
    private raycaster: Raycaster,
    private controls: MapControls,
    private mouse: THREE.Vector2,
    private sceneManager: SceneManager,
    private systemManager: SystemManager,
  ) {
    this.scene = new THREE.Scene();

    this.camera = this.controls.object as THREE.PerspectiveCamera;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    this.biome = new Biome();

    this.fogManager = new FogManager(this.scene, this.camera);

    this.contextMenuManager = new ContextMenuManager(
      this.scene,
      this.raycaster,
      this.camera,
      mouse,
      this.loadedChunks,
      this,
    );

    this.scene.background = new THREE.Color(0x8790a1);
    GUIManager.addColor(this.scene, "background");

    const hemisphereLight = new THREE.HemisphereLight(0xf3f3c8, 0xd0e7f0, 2);
    const hemisphereLightFolder = GUIManager.addFolder("Hemisphere Light");
    hemisphereLightFolder.addColor(hemisphereLight, "color");
    hemisphereLightFolder.addColor(hemisphereLight, "groundColor");
    hemisphereLightFolder.add(hemisphereLight, "intensity", 0, 3, 0.1);
    hemisphereLightFolder.close();
    this.scene.add(hemisphereLight);

    this.mainDirectionalLight = new THREE.DirectionalLight(0xffffff, 3);
    this.mainDirectionalLight.castShadow = true;
    this.mainDirectionalLight.shadow.mapSize.width = 2048;
    this.mainDirectionalLight.shadow.mapSize.height = 2048;
    this.mainDirectionalLight.shadow.camera.left = -22;
    this.mainDirectionalLight.shadow.camera.right = 18;
    this.mainDirectionalLight.shadow.camera.top = 14;
    this.mainDirectionalLight.shadow.camera.bottom = -12;
    this.mainDirectionalLight.shadow.camera.far = 38;
    this.mainDirectionalLight.shadow.camera.near = 8;
    this.mainDirectionalLight.position.set(0, 9, 0);
    this.mainDirectionalLight.target.position.set(0, 0, 5.2);

    const shadowFolder = GUIManager.addFolder("Shadow");
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "left", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "right", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "top", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "bottom", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "far", 0, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "near", 0, 50, 0.1);
    shadowFolder.close();

    const directionalLightFolder = GUIManager.addFolder("Directional Light");
    directionalLightFolder.addColor(this.mainDirectionalLight, "color");
    directionalLightFolder.add(this.mainDirectionalLight.position, "x", -20, 20, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.position, "y", -20, 20, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.position, "z", -20, 20, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight, "intensity", 0, 3, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.target.position, "x", 0, 10, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.target.position, "y", 0, 10, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.target.position, "z", 0, 10, 0.1);
    directionalLightFolder.close();
    this.scene.add(this.mainDirectionalLight);
    this.scene.add(this.mainDirectionalLight.target);

    this.lightHelper = new THREE.DirectionalLightHelper(this.mainDirectionalLight, 1);
    this.scene.add(this.lightHelper);

    this.loadBiomeModels();

    this.interactiveHexManager = new InteractiveHexManager(this.scene);
    this.highlightHexManager = new HighlightHexManager(this.scene);

    this.armyManager = new ArmyManager(this);
    this.structureManager = new StructureManager(this);

    this.systemManager.Army.onUpdate((value) => this.armyManager.onUpdate(value));
    this.systemManager.Structure.onUpdate((value) => this.structureManager.onUpdate(value));
    this.systemManager.Tile.onUpdate((value) => this.updateExploredHex(value));

    this.inputManager = new InputManager(this.raycaster, this.mouse, this.camera);
    this.inputManager.addListener("mousemove", throttle(this.interactiveHexManager.onMouseMove, 10));
    this.inputManager.addListener("dblclick", () => {
      const clickedHex = this.interactiveHexManager.onDoubleClick;
      goToHexceptionScene(clickedHex);
    });
    this.inputManager.addListener("click", () => {
      const clickedHex = this.interactiveHexManager.onClick;
      goToHexceptionScene(clickedHex);
    });
    this.inputManager.addListener("mousemove", throttle(this.armyManager.onMouseMove, 10));
    this.inputManager.addListener("contextmenu", this.armyManager.onRightClick);

    const unsub = useUIStore.subscribe(
      (state) => state.armyActions.selectedEntityId,
      (selectedEntityId) => {
        if (selectedEntityId) {
          console.log("worldmap", selectedEntityId);
          const armyMovementManager = new ArmyMovementManager(this.dojoConfig, selectedEntityId);
          const travelPaths = armyMovementManager.findPaths(this.exploredTiles);
          useUIStore.getState().updateTravelPaths(travelPaths.getPaths());
          this.highlightHexManager.highlightHexes(travelPaths.getHighlightedHexes());
        } else {
          useUIStore.getState().updateTravelPaths(new Map());
          this.highlightHexManager.highlightHexes([]);
        }
      },
    );
  }

  public onClickedHex(hex: number) {}

  public goToHexceptionScene(hex: number) {}

  public getCamera() {
    return this.camera;
  }

  private loadBiomeModels() {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/");
    dracoLoader.preload();
    loader.setDRACOLoader(dracoLoader);

    for (const [biome, path] of Object.entries(biomeModelPaths)) {
      const loadPromise = new Promise<void>((resolve, reject) => {
        loader.load(
          path,
          (gltf) => {
            const model = gltf.scene as THREE.Group;

            const tmp = new InstancedModel(model, this.renderChunkSize.width * this.renderChunkSize.height);
            this.biomeModels.set(biome as BiomeType, tmp);
            this.scene.add(tmp.group);
            resolve();
          },
          undefined,
          (error) => {
            console.error(`Error loading ${biome} model:`, error);
            reject(error);
          },
        );
      });
      this.modelLoadPromises.push(loadPromise);
    }

    Promise.all(this.modelLoadPromises).then(() => {
      //this.updateExistingChunks();
    });
  }

  public updateStructures(update: StructureSystemUpdate) {
    const col = update.hexCoords.col - FELT_CENTER;
    const row = update.hexCoords.row - FELT_CENTER;

    if (!this.structures.has(col)) {
      this.structures.set(col, new Set());
    }
    if (!this.structures.get(col)!.has(row)) {
      this.structures.get(col)!.add(row);
    }
  }

  public async updateExploredHex(update: TileSystemUpdate) {
    const col = update.hexCoords.col - FELT_CENTER;
    const row = update.hexCoords.row - FELT_CENTER;
    if (!this.exploredTiles.has(col)) {
      this.exploredTiles.set(col, new Set());
    }
    if (!this.exploredTiles.get(col)!.has(row)) {
      this.exploredTiles.get(col)!.add(row);
    }

    const dummy = new THREE.Object3D();
    const pos = getWorldPositionForHex({ row, col });
    dummy.position.copy(pos);

    const isStructure = this.structures.get(col)?.has(row) || false;

    if (isStructure) {
      dummy.scale.set(0, 0, 0);
    } else {
      dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
    }

    this.interactiveHexManager.addExploredHex({ col, row });

    // Add border hexes for newly explored hex
    const neighborOffsets = row % 2 === 0 ? neighborOffsetsOdd : neighborOffsetsEven;

    neighborOffsets.forEach(({ i, j }) => {
      const neighborCol = col + i;
      const neighborRow = row + j;
      const isNeighborExplored = this.exploredTiles.get(neighborCol)?.has(neighborRow) || false;

      if (!isNeighborExplored) {
        this.interactiveHexManager.addBorderHex({ col: neighborCol, row: neighborRow });
      }
    });

    const rotationSeed = this.hashCoordinates(col, row);
    const rotationIndex = Math.floor(rotationSeed * 6);
    const randomRotation = (rotationIndex * Math.PI) / 3;
    dummy.rotation.y = randomRotation;

    const biome = this.biome.getBiome(col + FELT_CENTER, row + FELT_CENTER);

    dummy.updateMatrix();

    await Promise.all(this.modelLoadPromises);
    const hexMesh = this.biomeModels.get(biome as BiomeType)!;
    console.log({ hexMesh });
    const currentCount = hexMesh.getCount();
    hexMesh.setMatrixAt(currentCount, dummy.matrix);
    hexMesh.setCount(currentCount + 1);
    hexMesh.needsUpdate();

    // Cache the updated matrices for the chunk
    const { chunkX, chunkZ } = this.worldToChunkCoordinates(pos.x, pos.z);
    this.cacheMatricesForChunk(chunkZ * this.chunkSize, chunkX * this.chunkSize);

    this.interactiveHexManager.renderHexes();
  }

  updateHexagonGrid(startRow: number, startCol: number, rows: number, cols: number) {
    if (this.applyCachedMatricesForChunk(startRow, startCol)) return;

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

        const isStructure = this.structures.get(col)?.has(row) || false;
        const isExplored = this.exploredTiles.get(globalCol)?.has(globalRow) || false;
        if (isStructure || !isExplored) {
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
            this.interactiveHexManager.addBorderHex({ col: globalCol, row: globalRow });
          }
        } else {
          this.interactiveHexManager.addExploredHex({ col: globalCol, row: globalRow });
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

  private hashCoordinates(x: number, y: number): number {
    // Simple hash function to generate a deterministic value between 0 and 1
    const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return hash - Math.floor(hash);
  }

  private worldToChunkCoordinates(x: number, z: number): { chunkX: number; chunkZ: number } {
    const chunkX = Math.floor(x / (this.chunkSize * HEX_SIZE * Math.sqrt(3)));
    const chunkZ = Math.floor(-z / (this.chunkSize * HEX_SIZE * 1.5));
    return { chunkX, chunkZ };
  }

  private getHexFromWorldPosition(position: THREE.Vector3): { row: number; col: number } {
    const horizontalSpacing = HEX_SIZE * Math.sqrt(3);
    const verticalSpacing = (HEX_SIZE * 3) / 2;

    // Calculate col first
    const col = Math.round(position.x / horizontalSpacing);

    // Then use col to calculate row
    const row = Math.round(-position.z / verticalSpacing);

    // Adjust x position based on row parity
    const adjustedX = position.x - (row % 2) * (horizontalSpacing / 2);

    // Recalculate col using adjusted x
    const adjustedCol = Math.round(adjustedX / horizontalSpacing);

    return { row, col: adjustedCol };
  }

  getHexagonCoordinates(
    instancedMesh: THREE.InstancedMesh,
    instanceId: number,
  ): { row: number; col: number; x: number; z: number } {
    const matrix = new THREE.Matrix4();
    instancedMesh.getMatrixAt(instanceId, matrix);
    const position = new THREE.Vector3();
    matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());

    const { row, col } = this.getHexFromWorldPosition(position);

    return { row, col, x: position.x, z: position.z };
  }

  updateVisibleChunks() {
    const cameraPosition = new THREE.Vector3();
    cameraPosition.copy(this.controls.target);

    // Adjust the camera position to load chunks earlier in both directions
    const adjustedX = cameraPosition.x + (this.chunkSize * HEX_SIZE * Math.sqrt(3)) / 2;
    const adjustedZ = cameraPosition.z - (this.chunkSize * HEX_SIZE * 1.5) / 3;

    const { chunkX, chunkZ } = this.worldToChunkCoordinates(adjustedX, adjustedZ);

    const chunkKey = `${chunkX},${chunkZ}`;
    if (this.currentChunk !== chunkKey) {
      this.currentChunk = chunkKey;
      console.log("currentChunk", this.currentChunk);

      // Calculate the starting position for the new chunk
      const startCol = chunkX * this.chunkSize;
      const startRow = chunkZ * this.chunkSize;
      this.updateHexagonGrid(startRow, startCol, this.renderChunkSize.height, this.renderChunkSize.width);
    }
  }

  updateLights(target: THREE.Vector3) {
    if (this.mainDirectionalLight) {
      this.mainDirectionalLight.position.set(target.x + 15, target.y + 13, target.z - 8);
      this.mainDirectionalLight.target.position.set(target.x, target.y, target.z + 5.2);
      this.mainDirectionalLight.target.updateMatrixWorld();
    }
  }

  update(deltaTime: number) {
    this.interactiveHexManager.update();
    this.armyManager.update(deltaTime);

    if (this.mainDirectionalLight) {
      this.mainDirectionalLight.shadow.camera.updateProjectionMatrix();
    }
    if (this.lightHelper) this.lightHelper.update();

    // Update highlight pulse
    const elapsedTime = performance.now() / 1000; // Convert to seconds
    const pulseFactor = Math.abs(Math.sin(elapsedTime * 2) / 16);
    this.highlightHexManager.updateHighlightPulse(pulseFactor);
  }
}
