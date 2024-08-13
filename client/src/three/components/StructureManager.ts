import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import InstancedModel from "./InstancedModel";
import { LabelManager } from "./LabelManager";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import { HyperstructureProgressSystemUpdate, StructureSystemUpdate } from "../systems/types";
import { FELT_CENTER } from "@/ui/config";
import { EternumGlobalConfig, HYPERSTRUCTURE_TOTAL_COSTS_SCALED, ID, StructureType } from "@bibliothecadao/eternum";
import {
  PROGRESS_FINAL_THRESHOLD,
  PROGRESS_HALF_THRESHOLD,
  StructureLabelPaths,
  StructureModelPaths,
  StructureProgress,
} from "../scenes/constants";
import { Component, ComponentValue, getComponentValue, Has, HasValue, runQuery } from "@dojoengine/recs";
import { ClientComponents } from "@/dojo/createClientComponents";
import { SetupResult } from "@/dojo/setup";
import { ResourceMultipliers } from "@/dojo/modelManager/utils/constants";
import { TOTAL_CONTRIBUTABLE_AMOUNT } from "@/dojo/modelManager/utils/LeaderboardUtils";

const neutralColor = new THREE.Color(0xffffff);
const myColor = new THREE.Color("lime");

const MAX_INSTANCES = 1000;

export class StructureManager {
  private models: {
    progress: Component<ClientComponents["Progress"]["schema"]>;
  };

  private scene: THREE.Scene;
  private structureModels: Map<StructureType, InstancedModel[]> = new Map();
  private labelManagers: Map<StructureType, LabelManager> = new Map();
  private dummy: THREE.Object3D = new THREE.Object3D();
  modelLoadPromises: Promise<InstancedModel>[] = [];
  structures: Structures = new Structures();
  structureHexCoords: Map<number, Set<number>> = new Map();
  totalStructures: number = 0;

  constructor(scene: THREE.Scene, private dojo: SetupResult) {
    const { Progress } = dojo.components;
    this.models = {
      progress: Progress,
    };
    this.scene = scene;
    this.loadModels();
  }

  public async loadModels() {
    const loader = new GLTFLoader();

    for (const [key, modelPaths] of Object.entries(StructureModelPaths)) {
      const structureType = StructureType[key as keyof typeof StructureType];

      if (structureType === undefined) continue;
      if (!modelPaths || modelPaths.length === 0) continue;

      const loadPromises = modelPaths.map((modelPath) => {
        return new Promise<InstancedModel>((resolve, reject) => {
          loader.load(
            modelPath,
            (gltf) => {
              const model = gltf.scene as THREE.Group;
              const instancedModel = new InstancedModel(model, MAX_INSTANCES);
              instancedModel.setCount(0);
              resolve(instancedModel);
            },
            undefined,
            (error) => {
              console.error(`An error occurred while loading the ${StructureType[structureType]} model:`, error);
              reject(error);
            },
          );
        });
      });

      Promise.all(loadPromises)
        .then((instancedModels) => {
          this.structureModels.set(structureType, instancedModels);
          instancedModels.forEach((model) => this.scene.add(model.group));

          const labelManager = new LabelManager(
            StructureLabelPaths[StructureType[structureType] as unknown as StructureType],
          );
          this.labelManagers.set(structureType, labelManager);
        })
        .catch((error) => {
          console.error(`Failed to load models for ${StructureType[structureType]}:`, error);
        });

      this.modelLoadPromises.push(...loadPromises);
    }
  }

  async onUpdate(update: StructureSystemUpdate) {
    await Promise.all(this.modelLoadPromises);

    const { entityId, hexCoords, isMine, structureType } = update;
    const normalizedCoord = { col: hexCoords.col - FELT_CENTER, row: hexCoords.row - FELT_CENTER };
    const position = getWorldPositionForHex(normalizedCoord);

    this.dummy.position.copy(position);
    this.dummy.updateMatrix();

    if (!this.structureHexCoords.has(normalizedCoord.col)) {
      this.structureHexCoords.set(normalizedCoord.col, new Set());
    }
    if (!this.structureHexCoords.get(normalizedCoord.col)!.has(normalizedCoord.row)) {
      this.structureHexCoords.get(normalizedCoord.col)!.add(normalizedCoord.row);
      this.totalStructures++;
    }

    const key = StructureType[structureType] as unknown as StructureType;

    // Ensure the structure is added and get its index
    const index = this.structures.addStructure(entityId, key);

    if (this.structureModels) {
      const models = this.structureModels.get(key);
      if (models && models.length > 0) {
        const modelIndex = this.getModelIndex(structureType, entityId);
        const modelType = models[modelIndex];

        modelType.setMatrixAt(index, this.dummy.matrix);
        modelType.setCount(this.structures.getCountForType(key));

        // Add label on top of the structure with appropriate color
        const labelColor = isMine ? myColor : neutralColor;
        const label = this.labelManagers.get(key)?.createLabel(position as any, labelColor);
        this.scene.add(label!);
      }
    }
  }

  getModelIndex(structureType: StructureType, entityId: ID): number {
    if (structureType === StructureType.Hyperstructure) {
      const progressQueryResult = Array.from(
        runQuery([Has(this.models.progress), HasValue(this.models.progress, { hyperstructure_entity_id: entityId })]),
      );

      const progresses = progressQueryResult.map((progressEntityId) => {
        return getComponentValue(this.models.progress, progressEntityId);
      });

      const { percentage } = getAllProgressesAndTotalPercentage(progresses, entityId);

      if (percentage < PROGRESS_HALF_THRESHOLD) {
        return StructureProgress.INIT;
      }
      if (percentage < PROGRESS_FINAL_THRESHOLD && percentage > PROGRESS_HALF_THRESHOLD) {
        return StructureProgress.HALF;
      }
      return StructureProgress.FINAL;
    }
    return StructureProgress.INIT;
  }
}

const getAllProgressesAndTotalPercentage = (
  progresses: (ComponentValue<ClientComponents["Progress"]["schema"]> | undefined)[],
  hyperstructureEntityId: ID,
) => {
  let percentage = 0;
  const allProgresses = HYPERSTRUCTURE_TOTAL_COSTS_SCALED.map(({ resource, amount: resourceCost }) => {
    let foundProgress = progresses.find((progress) => progress!.resource_type === resource);
    let progress = {
      hyperstructure_entity_id: hyperstructureEntityId,
      resource_type: resource,
      amount: !foundProgress ? 0 : Number(foundProgress.amount) / EternumGlobalConfig.resources.resourcePrecision,
      percentage: !foundProgress
        ? 0
        : Math.floor(
            (Number(foundProgress.amount) / EternumGlobalConfig.resources.resourcePrecision / resourceCost!) * 100,
          ),
      costNeeded: resourceCost,
    };
    percentage +=
      (progress.amount * ResourceMultipliers[progress.resource_type as keyof typeof ResourceMultipliers]!) /
      TOTAL_CONTRIBUTABLE_AMOUNT;
    return progress;
  });
  console.log("percentage", percentage);
  return { allProgresses, percentage };
};

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
