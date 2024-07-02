import * as THREE from "three";
import { Scene, Raycaster } from "three";
import { Character } from "../components/Character";
import { FogManager } from "../components/Fog";

import { ContextMenuManager } from "../components/ContextMenuManager";
import { getComponentValue, getEntitiesWithValue } from "@dojoengine/recs";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { SetupResult } from "@/dojo/setup";
import { Biome, BiomeType, MAP_AMPLITUDE } from "../components/Biome";
import { FELT_CENTER } from "@/ui/config";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import InstancedModel from "../components/InstancedModel";
import { ThreeStore } from "@/hooks/store/useThreeStore";

export default class HexagonMap {
  private character: Character;

  private biome!: Biome;

  private fogManager: FogManager;
  contextMenuManager: ContextMenuManager;

  private chunkSize = 20; // Size of each chunk
  private loadedChunks: Map<string, THREE.Group> = new Map();
  private hexSize = 0.8;

  private originalColor: THREE.Color = new THREE.Color("white");

  private biomeModels: Map<BiomeType, InstancedModel> = new Map();
  private modelLoadPromises: Promise<void>[] = [];

  private currentChunk: string = "null";

  constructor(
    private scene: Scene,
    private dojoConfig: SetupResult,
    private raycaster: Raycaster,
    private camera: THREE.PerspectiveCamera,
    private mouse: THREE.Vector2,
    private state: ThreeStore,
  ) {
    this.character = new Character(scene, { row: 0, col: 0 });
    this.addCharacterMovementListeners();

    this.biome = new Biome();

    this.fogManager = new FogManager(scene, camera);

    this.contextMenuManager = new ContextMenuManager(
      scene,
      raycaster,
      camera,
      mouse,
      this.loadedChunks,
      this.hexSize,
      this.character,
      this,
      state,
    );

    this.loadBiomeModels();
  }

  private loadBiomeModels() {
    const biomeModelPaths: Record<BiomeType, string> = {
      DeepOcean: "/models/new-biomes/deepocean.glb",
      Ocean: "/models/new-biomes/ocean.glb",
      Beach: "/models/new-biomes/beach.glb",
      Scorched: "/models/new-biomes/scorched.glb",
      Bare: "/models/new-biomes/bare.glb",
      Tundra: "/models/new-biomes/tundra.glb",
      Snow: "/models/new-biomes/snow.glb",
      TemperateDesert: "/models/new-biomes/temperatedesert.glb",
      Shrubland: "/models/new-biomes/shrublands.glb",
      Taiga: "/models/new-biomes/taiga.glb",
      Grassland: "/models/new-biomes/grassland.glb",
      TemperateDeciduousForest: "/models/new-biomes/deciduousforest.glb",
      TemperateRainForest: "/models/new-biomes/temperaterainforest.glb",
      SubtropicalDesert: "/models/new-biomes/subtropicaldesert.glb",
      TropicalSeasonalForest: "/models/new-biomes/tropicalseasonalforest.glb",
      TropicalRainForest: "/models/new-biomes/tropicalrainforest.glb",
    };

    const loader = new GLTFLoader();

    for (const [biome, path] of Object.entries(biomeModelPaths)) {
      const loadPromise = new Promise<void>((resolve, reject) => {
        loader.load(
          path,
          (gltf) => {
            const model = gltf.scene as THREE.Group;
            //model.scale.set(this.hexSize, this.hexSize, this.hexSize);
            model.position.set(0, 0, 0);
            model.rotation.y = Math.PI;
            const tmp = new InstancedModel(model, this.chunkSize * this.chunkSize);
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

  getWorldPositionForHex(hexCoords: { row: number; col: number }): THREE.Vector3 {
    const { row, col } = hexCoords;

    // Calculate the x and z coordinates
    const x = ((this.hexSize * 3) / 2) * col;
    const z = this.hexSize * Math.sqrt(3) * (row + 0.5 * (col & 1));

    // y coordinate is half of the hexagon height
    const y = this.hexSize / 2;

    return new THREE.Vector3(x, y, z);
  }

  private updateExistingChunks() {
    for (const [key, chunk] of this.loadedChunks) {
      this.scene.remove(chunk);
      const [z, x] = key.split(",").map(Number);
      // const newChunk = this.createHexagonGrid(z * this.chunkSize, x * this.chunkSize, this.chunkSize, this.chunkSize);
      // this.loadedChunks.set(key, newChunk);
      // this.scene.add(newChunk);
    }
  }

  createHexagonGrid(startRow: number, startCol: number, rows: number, cols: number) {
    //const group = new THREE.Group();
    const hexInstanced = this.createHexagonInstancedMesh(rows * cols);
    //group.add(hexInstanced);

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
    const gridCreationPromise = Promise.all(this.modelLoadPromises).then(() => {
      for (let row = -rows / 2; row < rows / 2; row++) {
        for (let col = -cols / 2; col < cols / 2; col++) {
          hexPositions.push(new THREE.Vector3(dummy.position.x, dummy.position.y, dummy.position.z));

          dummy.position.x = (startCol + col) * horizontalSpacing + ((startRow + row) % 2) * (horizontalSpacing / 2);
          dummy.position.z = -(startRow + row) * verticalSpacing;
          dummy.position.y = 0;
          dummy.scale.set(this.hexSize, this.hexSize, this.hexSize);

          const biome = this.biome.getBiome(startCol + col + FELT_CENTER, startRow + row + FELT_CENTER);

          // const state = getComponentValue(
          //   this.dojoConfig.components.Position,
          //   getEntityIdFromKeys([BigInt(startRow + row + FELT_CENTER), BigInt(startCol + col + FELT_CENTER)]),
          // );

          const entities = getEntitiesWithValue(this.dojoConfig.components.Position, {
            x: startCol + col + FELT_CENTER,
            y: startRow + row + FELT_CENTER,
          });

          if (entities.size > 0) console.log(entities);

          dummy.updateMatrix();

          // hexInstanced.setMatrixAt(index, dummy.matrix);
          // hexInstanced.setColorAt(index, this.originalColor);

          //instancedModel.setColorAt(index, this.originalColor);

          //console.log(hexInstanced);
          //const hexMesh = this.biomeModels.get(biome)!;
          biomeHexes[biome].push(dummy.matrix.clone());
          //hexMesh.setMatrixAt(index, dummy.matrix);
          //group.add(hexMesh.group);

          // const number = this.processHexagon(startRow + row, startCol + col, dummy.position.x, dummy.position.z);

          //index++;
        }
      }
      for (const [biome, matrices] of Object.entries(biomeHexes)) {
        //console.log("test", biome, this.biomeModels.get(biome as BiomeType));
        const hexMesh = this.biomeModels.get(biome as BiomeType)!;
        hexMesh.setCount(matrices.length);
        matrices.forEach((matrix, index) => {
          hexMesh.setMatrixAt(index, matrix);
        });
        hexMesh.needsUpdate();
        console.log("updating");
        //group.add(hexMesh.group);
      }
    });

    //group.userData.loadPromise = gridCreationPromise;
  }

  private addCharacterMovementListeners() {
    document.addEventListener("keydown", (event) => {
      const currentPosition = this.character.getPosition();
      let newPosition = { ...currentPosition };

      switch (event.key) {
        case "ArrowUp":
          newPosition.row--;
          break;
        case "ArrowDown":
          newPosition.row++;
          break;
        case "ArrowLeft":
          newPosition.col++;
          break;
        case "ArrowRight":
          newPosition.col--;
          break;
      }

      if (this.character.isValidHexPosition(newPosition)) {
        this.character.moveToHex(newPosition);
        //this.updateVisibleChunks(); // Ensure the map updates when the character moves
      }
    });
  }

  private createHexagonInstancedMesh(instanceCount: number): THREE.InstancedMesh {
    // Create a minimal geometry, like a single point
    const minimalGeometry = new THREE.SphereGeometry(0.1, 10, 10);
    //minimalGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));

    // Create a material that won't render anything
    const invisibleMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

    // Create the instanced mesh with the minimal geometry
    const hexInstanced = new THREE.InstancedMesh(minimalGeometry, invisibleMaterial, instanceCount);

    // We don't need to cast shadows for invisible geometry
    hexInstanced.castShadow = false;

    // Keep the original color in userData if needed for future reference
    //hexInstanced.userData.originalColor = this.originalColor.clone();

    return hexInstanced;
  }

  private worldToChunkCoordinates(x: number, z: number): { chunkX: number; chunkZ: number } {
    const chunkX = Math.floor(x / (this.chunkSize * this.hexSize * Math.sqrt(3)));
    const chunkZ = Math.floor(-z / (this.chunkSize * this.hexSize * 1.5));
    return { chunkX, chunkZ };
  }

  private processHexagon(row: number, col: number, x: number, z: number): number {
    console.log(`Processing hexagon at (${row}, ${col}) with position (${x}, ${z})`);

    return Math.random();
  }

  getHexagonCoordinates(instancedMesh: THREE.InstancedMesh, instanceId: number): { row: number; col: number } {
    const matrix = new THREE.Matrix4();
    instancedMesh.getMatrixAt(instanceId, matrix);
    const position = new THREE.Vector3();
    matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());

    const horizontalSpacing = this.hexSize * Math.sqrt(3);
    const verticalSpacing = (this.hexSize * 3) / 2;

    const col = Math.round(position.x / horizontalSpacing);
    const row = Math.round(-position.z / verticalSpacing);

    return { row, col };
  }

  updateVisibleChunks() {
    const cameraPosition = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPosition);

    const { chunkX, chunkZ } = this.worldToChunkCoordinates(cameraPosition.x, cameraPosition.z);

    //const visibleChunks = new Set<string>();

    // Expand the range of visible chunks
    const z = chunkZ;
    const x = chunkX;
    const chunkKey = `${x},${z}`;
    //visibleChunks.add(chunkKey);
    if (this.currentChunk !== chunkKey) {
      this.currentChunk = chunkKey;
      console.log("currentChunk", this.currentChunk);
      this.createHexagonGrid(z * this.chunkSize, x * this.chunkSize, this.chunkSize * 2, this.chunkSize * 2);
      //this.loadedChunks.set(chunkKey, chunk);
      //this.scene.add(chunk);

      // chunk.userData.loadPromise.then(() => {
      //   this.scene.add(chunk);
      // });
    }

    // Remove chunks that are no longer visible
    // for (const [key, chunk] of this.loadedChunks) {
    //   if (!visibleChunks.has(key)) {
    //     this.scene.remove(chunk);
    //     this.loadedChunks.delete(key);
    //   }
    // }
    //console.log("chunks", this.loadedChunks);
    //this.fogManager.updateFog();
  }

  private updateCameraPosition() {
    const characterPosition = this.character.getWorldPosition();

    // Position the camera above and behind the character
    this.camera.position.set(
      characterPosition.x,
      characterPosition.y + 15, // Adjust this value to change camera height
      characterPosition.z + 15, // Adjust this value to change camera distance
    );

    // Make the camera look at the character
    this.camera.lookAt(characterPosition);
  }

  update(deltaTime: number) {
    this.character.update(deltaTime);

    // this.updateCameraPosition();
  }
}
