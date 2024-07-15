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
          //   model.scale.set(0.1, 0.1, 0.1);

          // model.traverse((child) => {
          //   if (child instanceof THREE.Mesh) {
          //     child.castShadow = true;
          //     child.receiveShadow = true;
          //   }
          // });
          this.instancedModel = new InstancedModel(model, maxInstances);
          this.instancedModel.setCount(0);
          //this.instancedModel.scaleModel(new THREE.Vector3(0.3, 0.3, 0.3));
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
    console.log({ hexCoords });
    // const position = this.calculateWorldPosition({ col: hexCoords.col, row: hexCoords.row + 3 });
    // const position = this.worldMapScene.getWorldPositionForHex(hexCoords);
    const position = this.worldMapScene.getWorldPositionForHex({ col: 10, row: 0 });
    // const position = this.worldMapScene.getWorldPositionForHex(hexCoords);
    // const position = this.worldMapScene.getWorldPositionForHex({ col: 10, row: 0 });
    this.dummy.position.copy(position);
    this.dummy.updateMatrix();

    // Ensure the structure is added and get its index
    const index = this.structures.addStructure(entityId);

    if (this.instancedModel) {
      this.instancedModel.setMatrixAt(index, this.dummy.matrix);
      this.instancedModel.setCount(this.structures.counter); // Set the count to the current number of structures
    }

    console.log({ counter: this.structures.counter });

    console.log({ models: this.instancedModel });
  }

  //   private calculateWorldPosition(hexCoords: { col: number; row: number }): THREE.Vector3 {
  //     const { row, col } = hexCoords;
  //     const hexSize = 2; // Make sure this matches the hexSize in HexagonMap
  //     const horizontalSpacing = hexSize * Math.sqrt(3);
  //     const verticalSpacing = (hexSize * 3) / 2;

  //     const x = col * horizontalSpacing + (row % 2) * (horizontalSpacing / 2);
  //     const z = -row * verticalSpacing;
  //     const y = 3; // Adjust this value to place the character on top of the hexagons

  //     return new THREE.Vector3(x, y, z);
  //   }

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
