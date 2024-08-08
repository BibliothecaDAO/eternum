import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import InstancedModel from "./InstancedModel";
import { LabelManager } from "./LabelManager";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import { StructureSystemUpdate } from "../systems/types";
import { FELT_CENTER } from "@/ui/config";
import { ID, StructureType } from "@bibliothecadao/eternum";

const neutralColor = new THREE.Color(0xffffff);
const myColor = new THREE.Color("lime");

export const StructureModelPaths: Record<StructureType, string> = {
  [StructureType.Realm]: "models/buildings/castle2.glb",
  [StructureType.Hyperstructure]: "models/buildings/farm.glb", // USING PLACEHOLDER MODEL
  // [StructureType.Hyperstructure]: "models/buildings/hyperstructure-half-transformed.glb",
  // [StructureType.Hyperstructure]: "models/buildings/hyperstructure.glb",
  [StructureType.Bank]: "models/buildings/bank.glb",
  [StructureType.FragmentMine]: "models/buildings/mine.glb",
  [StructureType.Settlement]: "",
};

export const StructureLabelPaths: Record<StructureType, string> = {
  [StructureType.Realm]: "textures/realm_label.png",
  [StructureType.Hyperstructure]: "textures/hyper_label.png",
  [StructureType.FragmentMine]: "textures/shard_label.png",
  [StructureType.Bank]: "",
  [StructureType.Settlement]: "",
};

const MAX_INSTANCES = 1000;

export class StructureManager {
  private scene: THREE.Scene;
  private structureModels: Map<StructureType, InstancedModel> = new Map();
  private labelManagers: Map<StructureType, LabelManager> = new Map();
  private dummy: THREE.Object3D = new THREE.Object3D();
  modelLoadPromises: Promise<void>[] = [];
  structures: Structures = new Structures();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.loadModels();
  }

  public async loadModels() {
    const loader = new GLTFLoader();

    for (const [key, modelPath] of Object.entries(StructureModelPaths)) {
      const structureType = StructureType[key as keyof typeof StructureType];

      if (structureType === undefined) continue;
      if (!modelPath) continue;

      const loadPromise = new Promise<void>((resolve, reject) => {
        loader.load(
          modelPath,
          (gltf) => {
            const model = gltf.scene as THREE.Group;

            const instancedModel = new InstancedModel(model, MAX_INSTANCES);
            instancedModel.setCount(0);
            this.structureModels.set(structureType, instancedModel);
            this.scene.add(instancedModel.group);

            const labelManager = new LabelManager(
              StructureLabelPaths[StructureType[structureType] as unknown as StructureType],
            );
            this.labelManagers.set(structureType, labelManager);
            resolve();
          },
          undefined,
          (error) => {
            console.error(`An error occurred while loading the ${StructureType[structureType as any]} model:`, error);
            reject(error);
          },
        );
      });
      this.modelLoadPromises.push(loadPromise);
    }
  }

  async onUpdate(update: StructureSystemUpdate) {
    await Promise.all(this.modelLoadPromises);

    const { entityId, hexCoords, isMine, structureType } = update;
    const normalizedCoord = { col: hexCoords.col - FELT_CENTER, row: hexCoords.row - FELT_CENTER };
    const position = getWorldPositionForHex(normalizedCoord);
    this.dummy.position.copy(position);
    this.dummy.updateMatrix();

    const key = StructureType[structureType] as unknown as StructureType;

    // Ensure the structure is added and get its index
    const index = this.structures.addStructure(entityId, key);

    if (this.structureModels) {
      const modelType = this.structureModels.get(key);
      modelType?.setMatrixAt(index, this.dummy.matrix);
      modelType?.setCount(this.structures.getCountForType(key)); // Set the count to the current number of structures

      // Add label on top of the structure with appropriate color
      const labelColor = isMine ? myColor : neutralColor;
      const label = this.labelManagers.get(key)?.createLabel(position as any, labelColor);
      this.scene.add(label!);
    }
  }
}

class Structures {
  private structures: Map<ID, { index: number; structureType: StructureType }> = new Map();
  private counters: Map<StructureType, number> = new Map();

  addStructure(entityId: ID, structureType: StructureType): number {
    const index = this.counters.get(structureType) || 0;

    if (!this.structures.has(entityId)) {
      this.structures.set(entityId, { index, structureType });
      this.counters.set(structureType, index + 1);
    }
    return this.structures.get(entityId)!.index;
  }

  getStructureIndex(entityId: ID) {
    return this.structures.get(entityId)?.index;
  }

  getCountForType(structureType: StructureType): number {
    return this.counters.get(structureType) || 0;
  }
}
