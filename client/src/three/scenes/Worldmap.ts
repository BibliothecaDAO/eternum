import * as THREE from "three";
import { Scene, Raycaster, MathUtils } from "three";
import { FogManager } from "../components/Fog";

import { ContextMenuManager } from "../components/ContextMenuManager";
import { Entity, getComponentValue, getEntitiesWithValue } from "@dojoengine/recs";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { SetupResult } from "@/dojo/setup";
import { Biome, BiomeType, MAP_AMPLITUDE } from "../components/Biome";
import { FELT_CENTER } from "@/ui/config";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import InstancedModel from "../components/InstancedModel";
import { ThreeStore } from "@/hooks/store/useThreeStore";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import GUI from "lil-gui";
import { ArmySystem } from "../systems/ArmySystem";
import { StructureSystem } from "../systems/StructureSystem";
import { SystemManager } from "../systems/SystemManager";
import { createHexagonShape } from "@/ui/components/worldmap/hexagon/HexagonGeometry";
import { placeholderMaterial } from "@/shaders/placeholderMaterial";

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
  public systemManager: SystemManager;

  private biome!: Biome;
  private lightType: "pmrem" | "hemisphere" = "hemisphere";
  private lightHelper!: THREE.DirectionalLightHelper;

  contextMenuManager: ContextMenuManager;

  private chunkSize = 10; // Size of each chunk
  private renderChunkSize = {
    width: 40,
    height: 30,
  };
  private loadedChunks: Map<string, THREE.Group> = new Map();
  private hexSize = 1;

  private biomeModels: Map<BiomeType, InstancedModel> = new Map();
  private modelLoadPromises: Promise<void>[] = [];

  private currentChunk: string = "null";

  private entities: Entity[] = [];

  private cachedMatrices: Map<string, Map<string, { matrices: THREE.InstancedBufferAttribute; count: number }>> =
    new Map();

  // green highlighted hexes
  private highlightedHexes: THREE.Mesh[] = [];
  private highlightMaterial: THREE.ShaderMaterial;

  constructor(
    private dojoConfig: SetupResult,
    private raycaster: Raycaster,
    private controls: MapControls,
    private mouse: THREE.Vector2,
    private state: ThreeStore,
    private gui: GUI,
  ) {
    this.scene = new THREE.Scene();

    this.biome = new Biome();

    this.fogManager = new FogManager(this.scene, controls.object as THREE.PerspectiveCamera);

    this.contextMenuManager = new ContextMenuManager(
      this.scene,
      this.raycaster,
      controls.object as THREE.PerspectiveCamera,
      mouse,
      this.loadedChunks,
      this.hexSize,
      this,
      state,
    );

    // Create the highlight material
    this.highlightMaterial = placeholderMaterial;

    this.scene.background = new THREE.Color(0x8790a1);
    this.gui.addColor(this.scene, "background");

    const hemisphereLight = new THREE.HemisphereLight(0xf3f3c8, 0xd0e7f0, 2);
    const hemisphereLightFolder = this.gui.addFolder("Hemisphere Light");
    hemisphereLightFolder.addColor(hemisphereLight, "color");
    hemisphereLightFolder.addColor(hemisphereLight, "groundColor");
    hemisphereLightFolder.add(hemisphereLight, "intensity", 0, 3, 0.1);
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
    const shadowFolder = this.gui.addFolder("Shadow");
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "left", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "right", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "top", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "bottom", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "far", 0, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "near", 0, 50, 0.1);
    const directionalLightFolder = this.gui.addFolder("Directional Light");
    directionalLightFolder.addColor(this.mainDirectionalLight, "color");
    directionalLightFolder.add(this.mainDirectionalLight.position, "x", -20, 20, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.position, "y", -20, 20, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.position, "z", -20, 20, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight, "intensity", 0, 3, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.target.position, "x", 0, 10, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.target.position, "y", 0, 10, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.target.position, "z", 0, 10, 0.1);
    this.scene.add(this.mainDirectionalLight);
    this.scene.add(this.mainDirectionalLight.target);

    this.lightHelper = new THREE.DirectionalLightHelper(this.mainDirectionalLight, 1);
    this.scene.add(this.lightHelper);

    this.loadBiomeModels();

    this.systemManager = new SystemManager(this.dojoConfig, this);
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

  highlightHexes(hexes: { row: number; col: number }[]) {
    // Remove existing highlights
    this.highlightedHexes.forEach((mesh) => this.scene.remove(mesh));
    this.highlightedHexes = [];

    // Create new highlight meshes
    const bigHexagonShape = createHexagonShape(this.hexSize);
    const hexagonGeometry = new THREE.ShapeGeometry(bigHexagonShape);

    hexes.forEach((hex) => {
      const position = this.getWorldPositionForHex(hex);
      const highlightMesh = new THREE.Mesh(hexagonGeometry, this.highlightMaterial.clone());
      highlightMesh.position.set(position.x, 0.32, position.z);
      highlightMesh.rotation.x = -Math.PI / 2;

      // Disable raycasting for this mesh
      highlightMesh.raycast = () => {};

      this.scene.add(highlightMesh);
      this.highlightedHexes.push(highlightMesh);
    });
  }

  getWorldPositionForHex(hexCoords: { row: number; col: number }): THREE.Vector3 {
    const { row, col } = hexCoords;
    const horizontalSpacing = this.hexSize * Math.sqrt(3);
    const verticalSpacing = (this.hexSize * 3) / 2;
    // Calculate the x and z coordinates
    const x = col * horizontalSpacing + (row % 2) * (horizontalSpacing / 2);
    const z = -row * verticalSpacing;

    // y coordinate is half of the hexagon height
    const y = 0;

    return new THREE.Vector3(x, y, z);
  }

  updateHexagonGrid(startRow: number, startCol: number, rows: number, cols: number) {
    if (this.applyCachedMatricesForChunk(startRow, startCol)) return;
    const horizontalSpacing = this.hexSize * Math.sqrt(3);
    const verticalSpacing = (this.hexSize * 3) / 2;

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
        const pos = this.getWorldPositionForHex({ row: globalRow, col: globalCol });
        dummy.position.copy(pos);

        const isStructure = structuresMap.has(`${globalCol},${globalRow}`);
        // const isExplored = exploredMap.get(globalCol)?.has(globalRow) || false;
        const isExplored = true;
        if (isStructure || !isExplored) {
          dummy.scale.set(0, 0, 0);
        } else {
          dummy.scale.set(this.hexSize, this.hexSize, this.hexSize);
        }
        const rotationSeed = this.hashCoordinates(startCol + col, startRow + row);
        const rotationIndex = Math.floor(rotationSeed * 6);
        const randomRotation = (rotationIndex * Math.PI) / 3;
        dummy.rotation.y = randomRotation;

        const biome = this.biome.getBiome(startCol + col + FELT_CENTER, startRow + row + FELT_CENTER);

        const entities = getEntitiesWithValue(this.dojoConfig.components.Position, {
          x: startCol + col + FELT_CENTER,
          y: startRow + row + FELT_CENTER,
        });

        // if (entities.size > 0) console.log("Entities", entities);

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
      }
    };

    Promise.all(this.modelLoadPromises).then(() => {
      requestAnimationFrame(processBatch);
    });
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
    const chunkX = Math.floor(x / (this.chunkSize * this.hexSize * Math.sqrt(3)));
    const chunkZ = Math.floor(-z / (this.chunkSize * this.hexSize * 1.5));
    return { chunkX, chunkZ };
  }

  getHexagonCoordinates(
    instancedMesh: THREE.InstancedMesh,
    instanceId: number,
  ): { row: number; col: number; x: number; z: number } {
    const matrix = new THREE.Matrix4();
    instancedMesh.getMatrixAt(instanceId, matrix);
    const position = new THREE.Vector3();
    matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());

    const horizontalSpacing = this.hexSize * Math.sqrt(3);
    const verticalSpacing = (this.hexSize * 3) / 2;

    const col = Math.round(position.x / horizontalSpacing);
    const row = Math.round(-position.z / verticalSpacing);

    return { row, col, x: position.x, z: position.z };
  }

  updateVisibleChunks() {
    const cameraPosition = new THREE.Vector3();
    cameraPosition.copy(this.controls.target);

    // Adjust the camera position to load chunks earlier in both directions
    const adjustedX = cameraPosition.x + (this.chunkSize * this.hexSize * Math.sqrt(3)) / 2;
    const adjustedZ = cameraPosition.z - (this.chunkSize * this.hexSize * 1.5) / 3;

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
    this.systemManager.update(deltaTime);

    if (this.mainDirectionalLight) {
      this.mainDirectionalLight.shadow.camera.updateProjectionMatrix();
    }
    if (this.lightHelper) this.lightHelper.update();

    // Update highlight pulse
    const elapsedTime = performance.now() / 1000; // Convert to seconds
    const pulseFactor = Math.abs(Math.sin(elapsedTime * 2) / 16);
    this.highlightedHexes.forEach((mesh) => {
      if (mesh.material instanceof THREE.ShaderMaterial) {
        mesh.material.uniforms.opacity.value = pulseFactor;
      }
    });
  }
}
