import * as THREE from "three";
import { SetupResult } from "@/dojo/setup";
import { GLTFLoader } from "three-stdlib";
import WorldmapScene from "../scenes/Worldmap";
import InstancedModel from "./InstancedModel";
import { world } from "@/dojo/world";

const horizontalSpacing = Math.sqrt(3);
const verticalSpacing = 3 / 2;

export class StructureManager {
  private worldMapScene: WorldmapScene;
  private instancedModel: InstancedModel | undefined;
  private dummy: THREE.Object3D = new THREE.Object3D();
  private isLoaded: boolean = false;
  loadPromise: Promise<void>;
  structures: Structures = new Structures();

  constructor(worldMapScene: WorldmapScene, modelPath: string, maxInstances: number) {
    this.worldMapScene = worldMapScene;
    this.loadPromise = new Promise<void>((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        modelPath,
        (gltf) => {
          const model = gltf.scene as THREE.Group;
          this.instancedModel = new InstancedModel(model, maxInstances);
          this.instancedModel.setCount(0);
          this.worldMapScene.scene.add(this.instancedModel.group);
          this.isLoaded = true;
          resolve();
        },
        undefined,
        (error) => {
          console.error("An error occurred while loading the model:", error);
          reject(error);
        },
      );
    });
  }

  updateInstanceMatrix(entityId: string, hexCoords: { col: number; row: number }) {
    if (!this.isLoaded) {
      throw new Error("Model not loaded yet");
    }
    const position = this.worldMapScene.getWorldPositionForHex(hexCoords);
    this.dummy.position.copy(position);
    this.dummy.updateMatrix();

    // Ensure the structure is added and get its index
    const index = this.structures.addStructure(entityId);

    if (this.instancedModel) {
      this.instancedModel.setMatrixAt(index, this.dummy.matrix);
      this.instancedModel.setCount(this.structures.counter); // Set the count to the current number of structures
    }
  }

  calculateWorldPosition(hexCoords: { col: number; row: number }) {
    const { row, col } = hexCoords;
    const colOffset = col;
    const rowOffset = row;
    const newTargetX = colOffset * horizontalSpacing + (rowOffset % 2) * (horizontalSpacing / 2);
    const newTargetZ = -rowOffset * verticalSpacing;
    const newTargetY = 0;

    return new THREE.Vector3(newTargetX, newTargetY, newTargetZ);
  }
}

class Structures {
  private structures: Map<string, number> = new Map();
  counter: number = 0;

  addStructure(entityId: string): number {
    if (!this.structures.has(entityId)) {
      this.structures.set(entityId, this.counter);
      this.counter++;
    }
    return this.structures.get(entityId)!;
  }

  getStructureIndex(entityId: string) {
    return this.structures.get(entityId);
  }
}
