import * as THREE from "three";
import { Raycaster } from "three";

import { Entity } from "@dojoengine/recs";
import { ContextMenuManager } from "../components/ContextMenuManager";

import { SetupResult } from "@/dojo/setup";
import { highlightHexMaterial } from "@/three/shaders/highlightHexMaterial";
import { borderHexMaterial } from "@/three/shaders/borderHexMaterial";
import { FELT_CENTER } from "@/ui/config";
import GUI from "lil-gui";
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
import { getWorldPositionForHex } from "@/ui/utils/utils";
import { InputManager } from "../components/InputManager";
import { throttle } from "lodash";
import { SceneManager } from "../SceneManager";
import { HEX_SIZE, HexagonScene } from "./HexagonScene";

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

export default class WorldmapScene extends HexagonScene {
  public systemManager: SystemManager;

  private biome!: Biome;

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

  private cachedMatrices: Map<string, Map<string, { matrices: THREE.InstancedBufferAttribute; count: number }>> =
    new Map();

  constructor(
    dojoContext: SetupResult,
    raycaster: Raycaster,
    controls: MapControls,
    mouse: THREE.Vector2,
    sceneManager: SceneManager,
  ) {
    super("Worldmap", controls, dojoContext, mouse, raycaster, sceneManager);

    this.GUIFolder.add(this, "moveCameraToURLLocation");

    this.biome = new Biome();

    this.loadBiomeModels();

    this.systemManager = new SystemManager(dojoContext, this);
    this.systemManager.tileSystem.addListener(this.updateExploredHex.bind(this));

    this.inputManager.addListener("mousemove", throttle(this.interactiveHexManager.onMouseMove, 10));
    this.inputManager.addListener("dblclick", this.interactiveHexManager.onDoubleClick);
  }

  setup() {
    this.moveCameraToURLLocation();
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

  public updateExploredHex(col: number, row: number) {
    const dummy = new THREE.Object3D();
    const pos = getWorldPositionForHex({ row, col });
    dummy.position.copy(pos);

    const structures = this.systemManager.structureSystem.getStructures();
    const structuresMap = new Map(structures.map((s) => [`${s.col},${s.row}`, true]));

    const isStructure = structuresMap.has(`${col},${row}`);

    if (isStructure) {
      dummy.scale.set(0, 0, 0);
    } else {
      dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
    }

    this.interactiveHexManager.addExploredHex({ col, row });

    // Add border hexes for newly explored hex
    const neighborOffsets = row % 2 === 0 ? neighborOffsetsOdd : neighborOffsetsEven;
    const exploredMap = this.systemManager.tileSystem.getExplored();

    neighborOffsets.forEach(({ i, j }) => {
      const neighborCol = col + i;
      const neighborRow = row + j;
      const isNeighborExplored = exploredMap.get(neighborCol)?.has(neighborRow) || false;

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

    const hexMesh = this.biomeModels.get(biome as BiomeType)!;
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
    const structures = this.systemManager.structureSystem.getStructures();
    const exploredMap = this.systemManager.tileSystem.getExplored();
    const structuresMap = new Map(structures.map((s) => [`${s.col},${s.row}`, true]));

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

        const isStructure = structuresMap.has(`${globalCol},${globalRow}`);
        const isExplored = exploredMap.get(globalCol)?.has(globalRow) || false;
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
            return exploredMap.get(neighborCol)?.has(neighborRow) || false;
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

  update(deltaTime: number) {
    super.update(deltaTime);
    this.systemManager.update(deltaTime);
  }
}
