import { useAccountStore } from "@/hooks/store/use-account-store";
import { gltfLoader, isAddressEqualToAccount } from "@/three/helpers/utils";
import InstancedModel from "@/three/managers/instanced-model";
import { StructureModelPaths } from "@/three/scenes/constants";
import { FELT_CENTER } from "@/ui/config";
import { getLevelName, ID, ResourcesIds, StructureType } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { StructureInfo, StructureSystemUpdate } from "../types";
import { RenderChunkSize } from "../types/common";
import { getWorldPositionForHex } from "../utils";

const neutralColor = new THREE.Color(0xffffff);
const myColor = new THREE.Color("lime");

const MAX_INSTANCES = 1000;
const WONDER_MODEL_INDEX = 4;

const ICONS = {
  ARMY: "/textures/army_label.png",
  MY_ARMY: "/textures/my_army_label.png",
  MY_REALM: "/textures/my_realm_label.png",
  MY_REALM_WONDER: "/textures/my_realm_wonder_label.png",
  REALM_WONDER: "/textures/realm_wonder_label.png",
  STRUCTURES: {
    [StructureType.Realm]: "/textures/realm_label.png",
    [StructureType.Hyperstructure]: "/textures/hyper_label.png",
    [StructureType.Bank]: `/images/resources/${ResourcesIds.Lords}.png`,
    [StructureType.FragmentMine]: "/textures/fragment_mine_label.png",
  } as Record<StructureType, string>,
};

export class StructureManager {
  private scene: THREE.Scene;
  private structureModels: Map<StructureType, InstancedModel[]> = new Map();
  private entityIdMaps: Map<StructureType, Map<number, ID>> = new Map();
  private entityIdLabels: Map<ID, CSS2DObject> = new Map();
  private dummy: THREE.Object3D = new THREE.Object3D();
  modelLoadPromises: Promise<InstancedModel>[] = [];
  structures: Structures = new Structures();
  structureHexCoords: Map<number, Set<number>> = new Map();
  private currentChunk: string = "";
  private renderChunkSize: RenderChunkSize;
  private labelsGroup: THREE.Group;

  constructor(scene: THREE.Scene, renderChunkSize: { width: number; height: number }, labelsGroup?: THREE.Group) {
    this.scene = scene;
    this.renderChunkSize = renderChunkSize;
    this.labelsGroup = labelsGroup || new THREE.Group();
    this.loadModels();

    useAccountStore.subscribe(() => {
      this.structures.recheckOwnership();
      // Update labels when ownership changes
      this.updateVisibleStructures();
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
              console.error(modelPath);
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
    // Add the structure to the structures map with the complete owner info
    this.structures.addStructure(
      entityId,
      key,
      normalizedCoord,
      stage,
      level,
      {
        address: owner.address,
        ownerName: owner.ownerName || "",
        guildName: owner.guildName || "",
      },
      hasWonder,
    );

    // Update the visible structures if this structure is in the current chunk
    if (this.isInCurrentChunk(normalizedCoord)) {
      this.updateVisibleStructures();
    }
  }

  updateChunk(chunkKey: string) {
    this.currentChunk = chunkKey;
    this.updateVisibleStructures();
    this.showLabels();
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
    const visibleStructureIds = new Set<ID>();

    for (const [structureType, structures] of _structures) {
      const visibleStructures = this.getVisibleStructures(structures);
      const models = this.structureModels.get(structureType);

      if (models && models.length > 0) {
        models.forEach((model) => {
          model.setCount(0);
        });

        this.entityIdMaps.set(structureType, new Map());

        visibleStructures.forEach((structure) => {
          visibleStructureIds.add(structure.entityId);
          const position = getWorldPositionForHex(structure.hexCoords);

          if (this.entityIdLabels.has(structure.entityId)) {
            const label = this.entityIdLabels.get(structure.entityId)!;
            label.position.copy(position);
            label.position.y += 1.5;
          } else {
            this.addEntityIdLabel(structure, position);
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

          this.entityIdMaps.get(structureType)!.set(currentCount, structure.entityId);
        });

        models.forEach((model) => model.needsUpdate());
      }
    }

    const labelsToRemove: ID[] = [];
    this.entityIdLabels.forEach((label, entityId) => {
      if (!visibleStructureIds.has(entityId)) {
        labelsToRemove.push(entityId);
      }
    });

    labelsToRemove.forEach((entityId) => {
      this.removeEntityIdLabel(entityId);
    });
  }

  private getVisibleStructures(structures: Map<ID, StructureInfo>): StructureInfo[] {
    return Array.from(structures.values()).filter((structure) => this.isInCurrentChunk(structure.hexCoords));
  }

  private isInCurrentChunk(hexCoords: { col: number; row: number }): boolean {
    const [chunkRow, chunkCol] = this.currentChunk?.split(",").map(Number) || [];
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

  // Label Management Methods
  private addEntityIdLabel(structure: StructureInfo, position: THREE.Vector3) {
    const labelDiv = document.createElement("div");
    labelDiv.classList.add(
      "rounded-md",
      "bg-brown/50",
      "text-gold",
      "p-1",
      "-translate-x-1/2",
      "text-xs",
      "flex",
      "items-center",
      "gap-2",
    );

    // Create icon container
    const iconContainer = document.createElement("div");
    iconContainer.classList.add("w-8", "h-8", "flex-shrink-0");

    // Select appropriate icon
    let iconPath = ICONS.STRUCTURES[structure.structureType];
    if (structure.structureType === StructureType.Realm) {
      if (structure.hasWonder) {
        iconPath = structure.isMine ? ICONS.MY_REALM_WONDER : ICONS.REALM_WONDER;
      } else {
        iconPath = structure.isMine ? ICONS.MY_REALM : ICONS.STRUCTURES[StructureType.Realm];
      }
    }

    // Create and set icon image
    const iconImg = document.createElement("img");
    iconImg.src = iconPath;
    iconImg.classList.add("w-full", "h-full", "object-contain");
    iconContainer.appendChild(iconImg);

    // Create content container
    const contentContainer = document.createElement("div");
    contentContainer.classList.add("flex", "flex-col");

    // Add owner name and address
    const ownerText = document.createElement("span");
    const displayName = structure.owner.ownerName || `0x${structure.owner.address.toString(16).slice(0, 6)}...`;
    ownerText.textContent = displayName;
    ownerText.classList.add("text-xs", "opacity-80");

    // Add guild name if available
    if (structure.owner.guildName) {
      const guildText = document.createElement("span");
      guildText.textContent = structure.owner.guildName;
      guildText.classList.add("text-xs", "text-gold/70", "italic");
      contentContainer.appendChild(guildText);
    }

    // Add structure type and level
    const typeText = document.createElement("strong");
    typeText.textContent = `${StructureType[structure.structureType]} ${structure.structureType === StructureType.Realm ? `(${getLevelName(structure.level)})` : ""} ${
      structure.structureType === StructureType.Hyperstructure ? `(Stage ${structure.stage + 1})` : ""
    }`;
    typeText.classList.add("text-xs");

    contentContainer.appendChild(ownerText);
    contentContainer.appendChild(typeText);

    labelDiv.appendChild(iconContainer);
    labelDiv.appendChild(contentContainer);

    const label = new CSS2DObject(labelDiv);
    label.position.copy(position);
    label.position.y += 1.5;

    this.entityIdLabels.set(structure.entityId, label);
    this.labelsGroup.add(label);
  }

  private removeEntityIdLabel(entityId: ID) {
    const label = this.entityIdLabels.get(entityId);
    if (label) {
      this.labelsGroup.remove(label);
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
      this.entityIdLabels.delete(entityId);
    }
  }

  public removeLabelsFromScene() {
    this.entityIdLabels.forEach((label, entityId) => {
      this.labelsGroup.remove(label);
      // Dispose of the label's DOM element
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
    });
    // Clear the labels map after removing all labels
    this.entityIdLabels.clear();

    // Additional verification
    const remainingLabels = this.labelsGroup.children.filter((child) => child instanceof CSS2DObject);
    if (remainingLabels.length > 0) {
      console.warn(`[StructureManager] Found ${remainingLabels.length} remaining labels in group after cleanup!`);
      remainingLabels.forEach((label) => {
        console.warn("[StructureManager] Forcefully removing remaining label");
        this.labelsGroup.remove(label);
      });
    }
  }

  public showLabels() {
    // First ensure all old labels are properly cleaned up
    this.removeLabelsFromScene();
    // Update visible structures which will create new labels as needed
    this.updateVisibleStructures();
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
    owner: { address: bigint; ownerName: string; guildName: string },
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
