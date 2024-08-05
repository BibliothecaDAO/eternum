import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import WorldmapScene from "../scenes/Worldmap";
import InstancedModel from "./InstancedModel";
import { LabelManager } from "./LabelManager";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import { StructureSystemUpdate } from "../systems/types";
import { FELT_CENTER } from "@/ui/config";
import { ID } from "@bibliothecadao/eternum";

const neutralColor = new THREE.Color(0xffffff);
const myColor = new THREE.Color("lime");

const MODEL_PATH = "models/buildings/castle2.glb";
const LABEL_PATH = "textures/realm_label.png";
const MAX_INSTANCES = 1000;

export class StructureManager {
  private scene: THREE.Scene;
  private instancedModel: InstancedModel | undefined;
  private dummy: THREE.Object3D = new THREE.Object3D();
  private isLoaded: boolean = false;
  loadPromise: Promise<void>;
  structures: Structures = new Structures();
  private labelManager: LabelManager;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.labelManager = new LabelManager(LABEL_PATH);

    this.loadPromise = new Promise<void>((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        MODEL_PATH,
        (gltf) => {
          const model = gltf.scene as THREE.Group;
          this.instancedModel = new InstancedModel(model, MAX_INSTANCES);
          this.instancedModel.setCount(0);
          this.scene.add(this.instancedModel.group);
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

  async onUpdate(update: StructureSystemUpdate) {
    await this.loadPromise;
    const { entityId, hexCoords, isMine } = update;
    const normalizedCoord = { col: hexCoords.col - FELT_CENTER, row: hexCoords.row - FELT_CENTER };
    const position = getWorldPositionForHex(normalizedCoord);
    this.dummy.position.copy(position);
    this.dummy.updateMatrix();

    // Ensure the structure is added and get its index
    const index = this.structures.addStructure(entityId);

    if (this.instancedModel) {
      this.instancedModel.setMatrixAt(index, this.dummy.matrix);
      this.instancedModel.setCount(this.structures.counter); // Set the count to the current number of structures

      // Add label on top of the structure with appropriate color
      const labelColor = isMine ? myColor : neutralColor;
      const label = this.labelManager.createLabel(position as any, labelColor);
      this.scene.add(label);
    }
  }
}

class Structures {
  private structures: Map<number, number> = new Map();
  counter: number = 0;

  addStructure(entityId: ID): number {
    if (!this.structures.has(entityId)) {
      this.structures.set(entityId, this.counter);
      this.counter++;
    }
    return this.structures.get(entityId)!;
  }

  getStructureIndex(entityId: ID) {
    return this.structures.get(entityId);
  }
}
