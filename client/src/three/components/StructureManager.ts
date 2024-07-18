import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import WorldmapScene from "../scenes/Worldmap";
import InstancedModel from "./InstancedModel";
import { LabelManager } from "./LabelManager";

const neutralColor = new THREE.Color(0xffffff);
const myColor = new THREE.Color("lime");

export class StructureManager {
  private worldMapScene: WorldmapScene;
  private instancedModel: InstancedModel | undefined;
  private dummy: THREE.Object3D = new THREE.Object3D();
  private isLoaded: boolean = false;
  loadPromise: Promise<void>;
  structures: Structures = new Structures();
  private labelManager: LabelManager;

  constructor(worldMapScene: WorldmapScene, modelPath: string, labelPath: string, maxInstances: number) {
    this.worldMapScene = worldMapScene;
    this.labelManager = new LabelManager(labelPath);

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

  updateInstanceMatrix(entityId: number, hexCoords: { col: number; row: number }, isMine: boolean) {
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

      // Add label on top of the structure with appropriate color
      const labelColor = isMine ? myColor : neutralColor;
      const label = this.labelManager.createLabel(position, labelColor);
      this.worldMapScene.scene.add(label);
    }
  }
}

class Structures {
  private structures: Map<number, number> = new Map();
  counter: number = 0;

  addStructure(entityId: number): number {
    if (!this.structures.has(entityId)) {
      this.structures.set(entityId, this.counter);
      this.counter++;
    }
    return this.structures.get(entityId)!;
  }

  getStructureIndex(entityId: number) {
    return this.structures.get(entityId);
  }
}
