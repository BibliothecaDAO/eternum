import { useAccountStore } from "@/hooks/context/accountStore";
import { RenderChunkSize, StructureInfo } from "@/types";
import { FELT_CENTER } from "@/ui/config";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import { ID, StructureType } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { gltfLoader, isAddressEqualToAccount } from "../helpers/utils";
import { StructureLabelPaths, StructureModelPaths } from "../scenes/constants";
import { StructureSystemUpdate } from "../systems/types";
import InstancedModel from "./InstancedModel";
import { LabelManager } from "./LabelManager";

const neutralColor = new THREE.Color(0xffffff);
const myColor = new THREE.Color("lime");

const MAX_INSTANCES = 1000;
const WONDER_MODEL_INDEX = 4;
export class StructureManager {
  private scene: THREE.Scene;
  private structureModels: Map<StructureType, InstancedModel[]> = new Map();
  private labelManagers: Map<StructureType, LabelManager> = new Map();
  //private labels: Map<number, THREE.Points> = new Map();
  private labels: Map<number, THREE.Points> = new Map();
  private dummy: THREE.Object3D = new THREE.Object3D();
  modelLoadPromises: Promise<InstancedModel>[] = [];
  structures: Structures = new Structures();
  structureHexCoords: Map<number, Set<number>> = new Map();
  private currentChunk: string = "";
  private renderChunkSize: RenderChunkSize;
  private entityIdMaps: Map<StructureType, Map<number, ID>> = new Map();

  constructor(scene: THREE.Scene, renderChunkSize: { width: number; height: number }) {
    this.scene = scene;
    this.renderChunkSize = renderChunkSize;
    this.loadModels();

    useAccountStore.subscribe(() => {
      this.structures.recheckOwnership();
    });
  }

  getTotalStructures() {
    return Array.from(this.structures.getStructures().values()).reduce((acc, structures) => acc + structures.size, 0);
  }

  public async loadModels() {
    const loader = gltfLoader;

    for (const [key, modelPaths] of Object.entries(StructureModelPaths)) {
      const structureType = parseInt(key) as StructureType;

      if (structureType === undefined) continue;
      if (!modelPaths || modelPaths.length === 0) continue;

      const loadPromises = modelPaths.map((modelPath) => {
        return new Promise<InstancedModel>((resolve, reject) => {
          loader.load(
            modelPath,
            (gltf) => {
              const model = gltf.scene as THREE.Group;
              const instancedModel = new InstancedModel(gltf, MAX_INSTANCES, false, StructureType[structureType]);
              resolve(instancedModel);
            },
            undefined,
            (error) => {
              console.error(`An error occurred while loading the ${structureType} model:`, error);
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
    const { entityId, hexCoords, structureType, stage, level, owner, hasWonder } = update;
    const normalizedCoord = { col: hexCoords.col - FELT_CENTER, row: hexCoords.row - FELT_CENTER };
    const position = getWorldPositionForHex(normalizedCoord);

    this.dummy.position.copy(position);
    this.dummy.updateMatrix();

    if (!this.structureHexCoords.has(normalizedCoord.col)) {
      this.structureHexCoords.set(normalizedCoord.col, new Set());
    }
    if (!this.structureHexCoords.get(normalizedCoord.col)!.has(normalizedCoord.row)) {
      this.structureHexCoords.get(normalizedCoord.col)!.add(normalizedCoord.row);
    }

    const key = structureType;
    // Add the structure to the structures map
    this.structures.addStructure(entityId, key, normalizedCoord, stage, level, owner, hasWonder);

    // Update the visible structures if this structure is in the current chunk
    if (this.isInCurrentChunk(normalizedCoord)) {
      this.updateVisibleStructures();
    }
  }

  updateChunk(chunkKey: string) {
    this.currentChunk = chunkKey;
    this.updateVisibleStructures();
  }

  getStructureByHexCoords(hexCoords: { col: number; row: number }) {
    const allStructures = this.structures.getStructures();

    for (const [_, structures] of allStructures) {
      const structure = Array.from(structures.values()).find(
        (structure) => structure.hexCoords.col === hexCoords.col && structure.hexCoords.row === hexCoords.row,
      );
      if (structure) {
        return structure;
      }
    }
    return undefined;
  }

  private updateVisibleStructures() {
    const _structures = this.structures.getStructures();
    for (const [structureType, structures] of _structures) {
      const visibleStructures = this.getVisibleStructures(structures);
      const models = this.structureModels.get(structureType);

      if (models && models.length > 0) {
        // Reset all models for this structure type
        models.forEach((model) => {
          model.setCount(0);
        });

        // Clear the entityIdMap for this structure type
        this.entityIdMaps.set(structureType, new Map());

        visibleStructures.forEach((structure) => {
          const position = getWorldPositionForHex(structure.hexCoords);
          if (!this.labels.has(structure.entityId)) {
            const labelManager = this.labelManagers.get(structureType)!;
            const label = labelManager.createLabel(position, structure.isMine ? myColor : neutralColor);
            this.labels.set(structure.entityId, label);
            this.scene.add(label);
          }
          this.dummy.position.copy(position);

          if (structureType === StructureType.Bank) {
            this.dummy.rotation.y = (4 * Math.PI) / 6;
          }
          this.dummy.updateMatrix();
          let modelType = models[structure.stage];
          if (structureType === StructureType.Realm) {
            modelType = models[structure.level];
            if (structure.hasWonder) {
              modelType = models[WONDER_MODEL_INDEX];
            }
          }
          const currentCount = modelType.getCount();
          modelType.setMatrixAt(currentCount, this.dummy.matrix);
          modelType.setCount(currentCount + 1);

          // Add the entityId to the map for this instance
          this.entityIdMaps.get(structureType)!.set(currentCount, structure.entityId);
        });

        // Update all models
        models.forEach((model) => model.needsUpdate());
      }
    }
  }

  private getVisibleStructures(structures: Map<ID, StructureInfo>): StructureInfo[] {
    return Array.from(structures.values()).filter((structure) => this.isInCurrentChunk(structure.hexCoords));
  }

  private isInCurrentChunk(hexCoords: { col: number; row: number }): boolean {
    const [chunkRow, chunkCol] = this.currentChunk.split(",").map(Number);
    return (
      hexCoords.col >= chunkCol - this.renderChunkSize.width / 2 &&
      hexCoords.col < chunkCol + this.renderChunkSize.width / 2 &&
      hexCoords.row >= chunkRow - this.renderChunkSize.height / 2 &&
      hexCoords.row < chunkRow + this.renderChunkSize.height / 2
    );
  }

  public getEntityIdFromInstance(structureType: StructureType, instanceId: number): ID | undefined {
    const map = this.entityIdMaps.get(structureType);
    return map ? map.get(instanceId) : undefined;
  }

  public getInstanceIdFromEntityId(structureType: StructureType, entityId: ID): number | undefined {
    const map = this.entityIdMaps.get(structureType);
    if (!map) return undefined;
    for (const [instanceId, id] of map.entries()) {
      if (id === entityId) {
        return instanceId;
      }
    }
    return undefined;
  }

  updateAnimations(deltaTime: number) {
    this.structureModels.forEach((models) => {
      models.forEach((model) => model.updateAnimations(deltaTime));
    });
  }
}

class Structures {
  private structures: Map<StructureType, Map<ID, StructureInfo>> = new Map();

  addStructure(
    entityId: ID,
    structureType: StructureType,
    hexCoords: { col: number; row: number },
    stage: number = 0,
    level: number = 0,
    owner: { address: bigint },
    hasWonder: boolean,
  ) {
    if (!this.structures.has(structureType)) {
      this.structures.set(structureType, new Map());
    }
    this.structures.get(structureType)!.set(entityId, {
      entityId,
      hexCoords,
      stage,
      level,
      isMine: isAddressEqualToAccount(owner.address),
      owner,
      structureType,
      hasWonder,
    });
  }

  updateStructureStage(entityId: ID, structureType: StructureType, stage: number) {
    const structure = this.structures.get(structureType)?.get(entityId);
    if (structure) {
      structure.stage = stage;
    }
  }

  removeStructureFromPosition(hexCoords: { col: number; row: number }) {
    this.structures.forEach((structures) => {
      structures.forEach((structure) => {
        if (structure.hexCoords.col === hexCoords.col && structure.hexCoords.row === hexCoords.row) {
          structures.delete(structure.entityId);
        }
      });
    });
  }

  removeStructure(entityId: ID): StructureInfo | null {
    let removedStructure: StructureInfo | null = null;

    this.structures.forEach((structures) => {
      const structure = structures.get(entityId);
      if (structure) {
        structures.delete(entityId);
        removedStructure = structure;
      }
    });

    return removedStructure;
  }

  getStructures(): Map<StructureType, Map<ID, StructureInfo>> {
    return this.structures;
  }

  recheckOwnership() {
    this.structures.forEach((structures) => {
      structures.forEach((structure) => {
        structure.isMine = isAddressEqualToAccount(structure.owner.address);
      });
    });
  }
}
