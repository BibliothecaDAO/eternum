import * as THREE from "three";
import { Scene, Raycaster } from "three";
import { getEntityIdFromKeys, snoise } from "@dojoengine/utils";
import { Character } from "../components/Character";
import { Trees } from "../components/Trees";
import { SandDunes } from "../components/SandDunes";
import { Grass } from "../components/Grass";
import { FogManager } from "../components/Fog";
import { Roads } from "../components/Roads";

import { ContextMenuManager } from "../components/ContextMenuManager";
import { getComponentValue } from "@dojoengine/recs";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { SetupResult } from "@/dojo/setup";

export const MAP_AMPLITUDE = 16;

type BiomeType = "snow" | "mountain" | "forest" | "hills" | "savanna" | "plains" | "desert" | "beach" | "sea";

export default class HexagonMap {
  private character: Character;
  private trees: Trees;
  private sandDunes: SandDunes;
  private grass: Grass;
  // private roads: Roads;

  private fogManager: FogManager;
  contextMenuManager: ContextMenuManager;

  private chunkSize = 6; // Size of each chunk
  private loadedChunks: Map<string, THREE.Group> = new Map();
  private hexSize = 0.8;

  private originalColor: THREE.Color = new THREE.Color("white");

  private biomeModels: Map<BiomeType, THREE.Mesh> = new Map();
  private modelLoadPromises: Promise<void>[] = [];

  constructor(
    private scene: Scene,
    private dojoConfig: SetupResult,
    private raycaster: Raycaster,
    private camera: THREE.PerspectiveCamera,
    private mouse: THREE.Vector2,
  ) {
    this.character = new Character(scene, { row: 0, col: 0 });
    this.addCharacterMovementListeners();

    this.trees = new Trees(this.hexSize);
    this.sandDunes = new SandDunes(this.hexSize);
    this.grass = new Grass(this.hexSize);

    // this.roads = new Roads(this.hexSize);

    this.fogManager = new FogManager(scene, camera);

    this.contextMenuManager = new ContextMenuManager(
      scene,
      raycaster,
      camera,
      mouse,
      this.loadedChunks,
      this.hexSize,
      this.character,
    );

    this.loadBiomeModels();
  }

  private loadBiomeModels() {
    const biomeModelPaths: Record<BiomeType, string> = {
      snow: "/ocean.glb",
      mountain: "/ocean.glb",
      forest: "/ocean.glb",
      hills: "/ocean.glb",
      savanna: "/beach.glb",
      plains: "/grassland.glb",
      desert: "/beach.glb",
      beach: "/beach.glb",
      sea: "/ocean.glb",
    };

    const loader = new GLTFLoader();

    for (const [biome, path] of Object.entries(biomeModelPaths)) {
      const loadPromise = new Promise<void>((resolve, reject) => {
        loader.load(
          path,
          (gltf) => {
            const model = gltf.scene.children[0] as THREE.Mesh;
            model.scale.set(this.hexSize, this.hexSize, this.hexSize);
            model.position.set(0, 0, 0);

            model.rotation.y = Math.PI;

            this.biomeModels.set(biome as BiomeType, model);
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
      this.updateExistingChunks();
    });
  }

  private updateExistingChunks() {
    for (const [key, chunk] of this.loadedChunks) {
      this.scene.remove(chunk);
      const [z, x] = key.split(",").map(Number);
      const newChunk = this.createHexagonGrid(z * this.chunkSize, x * this.chunkSize, this.chunkSize, this.chunkSize);
      this.loadedChunks.set(key, newChunk);
      this.scene.add(newChunk);
    }
  }

  createHexagonGrid(startRow: number, startCol: number, rows: number, cols: number): THREE.Group {
    const group = new THREE.Group();
    const hexInstanced = this.createHexagonInstancedMesh(rows * cols);
    group.add(hexInstanced);

    const horizontalSpacing = this.hexSize * Math.sqrt(3);
    const verticalSpacing = (this.hexSize * 3) / 2;

    const dummy = new THREE.Object3D();
    let index = 0;

    const hexPositions: THREE.Vector3[] = [];
    const gridCreationPromise = Promise.all(this.modelLoadPromises).then(() => {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          hexPositions.push(new THREE.Vector3(dummy.position.x, dummy.position.y, dummy.position.z));

          dummy.position.x = (startCol + col) * horizontalSpacing + ((startRow + row) % 2) * (horizontalSpacing / 2);
          dummy.position.z = -(startRow + row) * verticalSpacing;
          dummy.position.y = 0;

          const noiseInput = [(startCol + col) / MAP_AMPLITUDE, (startRow + row) / MAP_AMPLITUDE, 0];

          const noise = (snoise(noiseInput) + 1) / 2;

          dummy.updateMatrix();
          hexInstanced.setMatrixAt(index, dummy.matrix);
          hexInstanced.setColorAt(index, this.originalColor);

          // const state = getComponentValue(
          // 	this.dojoConfig.network.contractComponents.Position,
          // 	getEntityIdFromKeys([BigInt(startRow + row), BigInt(startCol + col)])
          // );

          let biome: BiomeType;
          if (noise > 0.85) biome = "snow";
          else if (noise > 0.7) biome = "mountain";
          else if (noise > 0.6) biome = "forest";
          else if (noise > 0.5) biome = "hills";
          else if (noise > 0.4) biome = "savanna";
          else if (noise > 0.3) biome = "plains";
          else if (noise > 0.25) biome = "desert";
          else if (noise > 0.2) biome = "beach";
          else biome = "sea";

          // if (noise > 0.85) {
          // 	// Snow-capped Mountains
          // 	hexInstanced.setColorAt(index, new THREE.Color('white'));
          // 	const trees = this.trees.createTrees(dummy.position.x, dummy.scale.y, dummy.position.z, 'white');
          // 	group.add(trees);
          // } else if (noise > 0.7) {
          // 	// Rocky Mountains
          // 	hexInstanced.setColorAt(index, new THREE.Color('gray'));
          // 	const trees = this.trees.createTrees(dummy.position.x, dummy.scale.y, dummy.position.z, 'darkgreen');
          // 	group.add(trees);
          // } else if (noise > 0.6) {
          // 	// Forest
          // 	hexInstanced.setColorAt(index, new THREE.Color('darkgreen'));
          // 	const trees = this.trees.createTrees(dummy.position.x, dummy.scale.y, dummy.position.z);
          // 	group.add(trees);
          // } else if (noise > 0.5) {
          // 	// Hills
          // 	hexInstanced.setColorAt(index, new THREE.Color('olivedrab'));
          // 	const grass = this.grass.createGrass(dummy.position.x, dummy.scale.y, dummy.position.z);
          // 	group.add(grass);
          // } else if (noise > 0.4) {
          // 	// Savanna
          // 	hexInstanced.setColorAt(index, new THREE.Color('khaki'));
          // 	const grass = this.grass.createGrass(dummy.position.x, dummy.scale.y, dummy.position.z);
          // 	group.add(grass);
          // } else if (noise > 0.3) {
          // 	// Plains
          // 	hexInstanced.setColorAt(index, new THREE.Color('green'));
          // 	const grass = this.grass.createGrass(dummy.position.x, dummy.scale.y, dummy.position.z);
          // 	group.add(grass);
          // } else if (noise > 0.25) {
          // 	// Desert
          // 	hexInstanced.setColorAt(index, new THREE.Color('sandybrown'));
          // 	const sandDunes = this.sandDunes.createSandDunes(dummy.position.x, dummy.scale.y, dummy.position.z);
          // 	group.add(sandDunes);
          // } else if (noise > 0.2) {
          // 	// Beach
          // 	hexInstanced.setColorAt(index, new THREE.Color('yellow'));
          // 	// const sandDunes = this.sandDunes.createSandDunes(dummy.position.x, dummy.scale.y, dummy.position.z);
          // 	// group.add(sandDunes);
          // } else {
          // 	// Sea
          // 	hexInstanced.setColorAt(index, new THREE.Color('blue'));
          // }

          const hexModel = this.biomeModels.get(biome)!.clone();
          hexModel.position.set(dummy.position.x, 0, dummy.position.z);
          // hexModel.scale.y = 0; // Adjust height based on noise
          group.add(hexModel);

          // const number = this.processHexagon(startRow + row, startCol + col, dummy.position.x, dummy.position.z);

          index++;
        }
      }
    });

    // const roadCount = Math.floor(rows * cols * 0.1); // Increase to 20% of hexagons
    // // const roadGroup = this.roads.createRandomRoads(hexPositions, roadCount);
    // group.add(roadGroup); // Add roads last to ensure they're on top

    // hexInstanced.instanceMatrix.needsUpdate = true;
    // hexInstanced.instanceColor!.needsUpdate = true;

    group.userData.loadPromise = gridCreationPromise;

    return group;
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
        this.updateVisibleChunks(); // Ensure the map updates when the character moves
      }
    });
  }

  private createHexagonInstancedMesh(instanceCount: number): THREE.InstancedMesh {
    // Create a minimal geometry, like a single point
    const minimalGeometry = new THREE.BufferGeometry();
    minimalGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));

    // Create a material that won't render anything
    const invisibleMaterial = new THREE.MeshBasicMaterial({ visible: false });

    // Create the instanced mesh with the minimal geometry
    const hexInstanced = new THREE.InstancedMesh(minimalGeometry, invisibleMaterial, instanceCount);

    // We don't need to cast shadows for invisible geometry
    hexInstanced.castShadow = false;

    // Keep the original color in userData if needed for future reference
    hexInstanced.userData.originalColor = this.originalColor.clone();

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

  updateVisibleChunks() {
    const cameraPosition = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPosition);

    const { chunkX, chunkZ } = this.worldToChunkCoordinates(cameraPosition.x, cameraPosition.z);

    const visibleChunks = new Set<string>();

    // Expand the range of visible chunks
    for (let x = chunkX - 2; x <= chunkX + 2; x++) {
      for (let z = chunkZ - 2; z <= chunkZ + 2; z++) {
        const chunkKey = `${x},${z}`;
        visibleChunks.add(chunkKey);

        if (!this.loadedChunks.has(chunkKey)) {
          const chunk = this.createHexagonGrid(z * this.chunkSize, x * this.chunkSize, this.chunkSize, this.chunkSize);
          this.loadedChunks.set(chunkKey, chunk);
          this.scene.add(chunk);

          chunk.userData.loadPromise.then(() => {
            this.scene.add(chunk);
          });
        }
      }
    }

    // Remove chunks that are no longer visible
    for (const [key, chunk] of this.loadedChunks) {
      if (!visibleChunks.has(key)) {
        this.scene.remove(chunk);
        this.loadedChunks.delete(key);
      }
    }

    this.fogManager.updateFog();
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
