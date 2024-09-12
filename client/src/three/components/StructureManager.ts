import { FELT_CENTER } from "@/ui/config";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import { ID, StructureType } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import { StructureLabelPaths, StructureModelPaths } from "../scenes/constants";
import { StructureSystemUpdate } from "../systems/types";
import InstancedModel from "./InstancedModel";
import { LabelManager } from "./LabelManager";

const neutralColor = new THREE.Color(0xffffff);
const myColor = new THREE.Color("lime");

const MAX_INSTANCES = 1000;

export class StructureManager {
  private scene: THREE.Scene;
  private structureModels: Map<StructureType, InstancedModel[]> = new Map();
  private labelManagers: Map<StructureType, LabelManager> = new Map();
  private dummy: THREE.Object3D = new THREE.Object3D();
  modelLoadPromises: Promise<InstancedModel>[] = [];
  structures: Structures = new Structures();
  structureHexCoords: Map<number, Set<number>> = new Map();
  totalStructures: number = 0;
  private currentChunk: string = "";
  private renderChunkSize: { width: number; height: number };

  constructor(scene: THREE.Scene, renderChunkSize: { width: number; height: number }) {
    this.scene = scene;
    this.renderChunkSize = renderChunkSize;
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

    const { entityId, hexCoords, isMine, structureType, stage } = update;
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

    // Add the structure to the structures map
    this.structures.addStructure(entityId, key, normalizedCoord, stage);

    // Update the visible structures if this structure is in the current chunk
    if (this.isInCurrentChunk(normalizedCoord)) {
      this.updateVisibleStructures();
    }
  }

  updateChunk(chunkKey: string) {
    if (this.currentChunk !== chunkKey) {
      this.currentChunk = chunkKey;
      this.updateVisibleStructures();
    }
  }

  private updateVisibleStructures() {
    for (const [structureType, structures] of this.structures.getStructures()) {
      const visibleStructures = this.getVisibleStructures(structures);
      const models = this.structureModels.get(structureType);

      if (models && models.length > 0) {
        // Reset all models for this structure type
        models.forEach((model) => model.setCount(0));

        visibleStructures.forEach((structure) => {
          const position = getWorldPositionForHex(structure.hexCoords);
          this.dummy.position.copy(position);
          this.dummy.updateMatrix();

          const modelType = models[structure.stage];
          const currentCount = modelType.getCount();
          modelType.setMatrixAt(currentCount, this.dummy.matrix);
          modelType.setCount(currentCount + 1);
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
}

interface StructureInfo {
  hexCoords: { col: number; row: number };
  stage: number;
}

class Structures {
  private structures: Map<StructureType, Map<ID, StructureInfo>> = new Map();

  addStructure(entityId: ID, structureType: StructureType, hexCoords: { col: number; row: number }, stage: number = 0) {
    if (!this.structures.has(structureType)) {
      this.structures.set(structureType, new Map());
    }
    this.structures.get(structureType)!.set(entityId, { hexCoords, stage });
  }

  getStructures(): Map<StructureType, Map<ID, StructureInfo>> {
    return this.structures;
  }
}
