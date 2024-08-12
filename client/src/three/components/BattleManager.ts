import { FELT_CENTER } from "@/ui/config";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import { ID } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import { BattleSystemUpdate } from "../systems/types";
import InstancedModel from "./InstancedModel";
import { LabelManager } from "./LabelManager";

const MODEL_PATH = "models/buildings/fishery.glb";
const LABEL_PATH = "textures/army_label.png";
const MAX_INSTANCES = 1000;

export class BattleManager {
  private scene: THREE.Scene;
  private instancedModel: InstancedModel | undefined;
  private dummy: THREE.Object3D = new THREE.Object3D();
  loadPromise: Promise<void>;
  battles: Battles = new Battles();
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

  async onUpdate(update: BattleSystemUpdate) {
    await this.loadPromise;

    const { entityId, hexCoords } = update;

    const normalizedCoord = { col: hexCoords.col - FELT_CENTER, row: hexCoords.row - FELT_CENTER };

    const position = getWorldPositionForHex(normalizedCoord);

    this.dummy.position.copy(position);
    this.dummy.updateMatrix();

    const index = this.battles.addBattle(entityId);

    if (this.instancedModel) {
      this.instancedModel.setMatrixAt(index, this.dummy.matrix);
      this.instancedModel.setCount(this.battles.counter);

      const label = this.labelManager.createLabel(position as any, new THREE.Color("red"));
      this.scene.add(label);
    }
  }
}

class Battles {
  private battles: Map<number, number> = new Map();
  counter: number = 0;

  addBattle(entityId: ID): number {
    if (!this.battles.has(entityId)) {
      this.battles.set(entityId, this.counter);
      this.counter++;
    }
    return this.battles.get(entityId)!;
  }

  getBattleIndex(entityId: ID) {
    return this.battles.get(entityId);
  }
}
