import { useAccountStore } from "@/hooks/store/use-account-store";
import { StructureModelPaths } from "@/three/constants";
import InstancedModel from "@/three/managers/instanced-model";
import { CameraView, HexagonScene } from "@/three/scenes/hexagon-scene";
import { gltfLoader, isAddressEqualToAccount } from "@/three/utils/utils";
import { FELT_CENTER } from "@/ui/config";
import { getLevelName, ID, ResourcesIds, StructureType } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { StructureInfo, StructureSystemUpdate } from "../types";
import { RenderChunkSize } from "../types/common";
import { getWorldPositionForHex, hashCoordinates } from "../utils";
import { createContentContainer, createLabelBase, createOwnerDisplayElement, transitionManager } from "../utils/";
import { FXManager } from "./fx-manager";

const MAX_INSTANCES = 1000;
const WONDER_MODEL_INDEX = 4;

const ICONS = {
  ARMY: "/images/labels/enemy_army.png",
  MY_ARMY: "/images/labels/army.png",
  MY_REALM: "/images/labels/realm.png",
  MY_REALM_WONDER: "/images/labels/realm.png",
  REALM_WONDER: "/images/labels/realm.png",
  STRUCTURES: {
    [StructureType.Village]: "/images/labels/enemy_village.png",
    [StructureType.Realm]: "/images/labels/enemy_realm.png",
    [StructureType.Hyperstructure]: "/images/labels/hyperstructure.png",
    [StructureType.Bank]: `/images/resources/${ResourcesIds.Lords}.png`,
    [StructureType.FragmentMine]: "/images/labels/fragment_mine.png",
  } as Record<StructureType, string>,
  MY_STRUCTURES: {
    [StructureType.Village]: "/images/labels/village.png",
    [StructureType.Realm]: "/images/labels/realm.png",
  } as Record<StructureType, string>,
  ALLY_STRUCTURES: {
    [StructureType.Village]: "/images/labels/allies_village.png",
    [StructureType.Realm]: "/images/labels/allies_realm.png",
  } as Record<StructureType, string>,
};

// Create structure info label
const createStructureInfoElement = (structure: StructureInfo, cameraView: CameraView) => {
  // Create label div using the shared base
  const labelDiv = createLabelBase({
    isMine: structure.isMine,
    isAlly: structure.isAlly,
  });

  // Create icon container
  const iconContainer = document.createElement("div");
  iconContainer.classList.add("w-auto", "h-full", "flex-shrink-0");

  // Select appropriate icon
  let iconPath = ICONS.STRUCTURES[structure.structureType];
  if (structure.structureType === StructureType.Realm || structure.structureType === StructureType.Village) {
    iconPath = structure.isMine
      ? ICONS.MY_STRUCTURES[structure.structureType]
      : structure.isAlly
        ? ICONS.ALLY_STRUCTURES[structure.structureType]
        : ICONS.STRUCTURES[structure.structureType];
  }

  // Create and set icon image
  const iconImg = document.createElement("img");
  iconImg.src = iconPath;
  iconImg.classList.add("w-full", "h-full", "object-contain");
  iconContainer.appendChild(iconImg);
  labelDiv.appendChild(iconContainer);

  // Create content container with transition using shared utility
  const contentContainer = createContentContainer(cameraView);

  // Add owner display using shared component
  const ownerText = createOwnerDisplayElement({
    owner: structure.owner,
    isMine: structure.isMine,
    isAlly: structure.isAlly,
    cameraView,
  });
  contentContainer.appendChild(ownerText);

  // Add structure type and level
  const typeText = document.createElement("strong");
  typeText.textContent = `${StructureType[structure.structureType]} ${structure.structureType === StructureType.Realm ? `(${getLevelName(structure.level)})` : ""} ${
    structure.structureType === StructureType.Hyperstructure
      ? structure.initialized
        ? `(Stage ${structure.stage + 1})`
        : "Foundation"
      : ""
  }`;
  contentContainer.appendChild(typeText);

  labelDiv.appendChild(contentContainer);
  return labelDiv;
};

export class StructureManager {
  private scene: THREE.Scene;
  private structureModels: Map<StructureType, InstancedModel[]> = new Map();
  private entityIdMaps: Map<StructureType, Map<number, ID>> = new Map();
  private wonderEntityIdMaps: Map<number, ID> = new Map();
  private entityIdLabels: Map<ID, CSS2DObject> = new Map();
  private dummy: THREE.Object3D = new THREE.Object3D();
  modelLoadPromises: Promise<InstancedModel>[] = [];
  structures: Structures = new Structures();
  structureHexCoords: Map<number, Set<number>> = new Map();
  private currentChunk: string = "";
  private renderChunkSize: RenderChunkSize;
  private labelsGroup: THREE.Group;
  private currentCameraView: CameraView;
  private hexagonScene?: HexagonScene;
  private fxManager: FXManager;
  private structureRelicEffects: Map<ID, Array<{ relicNumber: number; fx: { end: () => void } }>> = new Map();

  constructor(
    scene: THREE.Scene,
    renderChunkSize: { width: number; height: number },
    labelsGroup?: THREE.Group,
    hexagonScene?: HexagonScene,
    fxManager?: FXManager,
  ) {
    this.scene = scene;
    this.renderChunkSize = renderChunkSize;
    this.labelsGroup = labelsGroup || new THREE.Group();
    this.hexagonScene = hexagonScene;
    this.currentCameraView = hexagonScene?.getCurrentCameraView() ?? CameraView.Medium;
    this.fxManager = fxManager || new FXManager(scene);
    this.loadModels();

    // Subscribe to camera view changes if scene is provided
    if (hexagonScene) {
      hexagonScene.addCameraViewListener(this.handleCameraViewChange);
    }

    useAccountStore.subscribe(() => {
      this.structures.recheckOwnership();
      // Update labels when ownership changes
      this.updateVisibleStructures();
    });
  }

  private handleCameraViewChange = (view: CameraView) => {
    if (this.currentCameraView === view) return;

    // If we're moving away from Medium view, clean up transition state
    if (this.currentCameraView === CameraView.Medium) {
      transitionManager.clearMediumViewTransition();
    }

    this.currentCameraView = view;

    // If we're switching to Medium view, store timestamp
    if (view === CameraView.Medium) {
      transitionManager.setMediumViewTransition();
    }

    // Update all existing labels to reflect the new view
    this.entityIdLabels.forEach((label, entityId) => {
      if (label.element) {
        const contentContainer = label.element.querySelector(".flex.flex-col");
        if (contentContainer) {
          // Get or create a container ID for tracking timeouts
          let containerId = (contentContainer as HTMLElement).dataset.containerId;
          if (!containerId) {
            containerId = `structure_${entityId}_${Math.random().toString(36).substring(2, 9)}`;
            (contentContainer as HTMLElement).dataset.containerId = containerId;
          }

          if (view === CameraView.Far) {
            // For Far view, always collapse immediately
            contentContainer.classList.add("max-w-0", "ml-0");
            contentContainer.classList.remove("max-w-[250px]", "ml-2");
            transitionManager.clearTimeout(containerId);
          } else if (view === CameraView.Close) {
            // For Close view, always expand and never collapse
            contentContainer.classList.remove("max-w-0", "ml-0");
            contentContainer.classList.add("max-w-[250px]", "ml-2");
            transitionManager.clearTimeout(containerId);
          } else if (view === CameraView.Medium) {
            // For Medium view, expand initially
            contentContainer.classList.remove("max-w-0", "ml-0");
            contentContainer.classList.add("max-w-[250px]", "ml-2");

            // And set up timeout to collapse after 2 seconds
            transitionManager.setMediumViewTransition(containerId);
            transitionManager.setLabelTimeout(
              () => {
                if (contentContainer.isConnected) {
                  contentContainer.classList.remove("max-w-[250px]", "ml-2");
                  contentContainer.classList.add("max-w-0", "ml-0");
                  transitionManager.clearMediumViewTransition(containerId);
                }
              },
              2000,
              containerId,
            );
          }
        }
      }
    });
  };

  public destroy() {
    // Clean up camera view listener
    if (this.hexagonScene) {
      this.hexagonScene.removeCameraViewListener(this.handleCameraViewChange);
    }
    // Clean up all relic effects
    this.structureRelicEffects.forEach((_effects, entityId) => {
      this.removeAllRelicEffects(entityId);
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
              const instancedModel = new InstancedModel(
                gltf,
                MAX_INSTANCES,
                false,
                modelPath.includes("wonder") ? "wonder" : StructureType[structureType],
              );
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
          instancedModels.forEach((model) => {
            this.scene.add(model.group);
          });
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
    position.y += 0.05;
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
      update.initialized,
      stage,
      level,
      {
        address: owner.address,
        ownerName: owner.ownerName || "",
        guildName: owner.guildName || "",
      },
      hasWonder,
      update.isAlly,
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
        this.wonderEntityIdMaps.clear();

        visibleStructures.forEach((structure) => {
          visibleStructureIds.add(structure.entityId);
          const position = getWorldPositionForHex(structure.hexCoords);
          position.y += 0.05;

          // Always recreate the label to ensure it matches current camera view
          if (this.entityIdLabels.has(structure.entityId)) {
            this.removeEntityIdLabel(structure.entityId);
          }
          this.addEntityIdLabel(structure, position);

          this.dummy.position.copy(position);

          if (structureType === StructureType.Bank) {
            this.dummy.rotation.y = (4 * Math.PI) / 6;
          } else {
            const rotationSeed = hashCoordinates(structure.hexCoords.col, structure.hexCoords.row);
            const rotationIndex = Math.floor(rotationSeed * 6);
            const randomRotation = (rotationIndex * Math.PI) / 3;
            this.dummy.rotation.y = randomRotation;
          }
          this.dummy.updateMatrix();
          let modelType = models[structure.stage];
          if (structureType === StructureType.Realm) {
            modelType = models[structure.level];

            // Add the Realm model
            const currentCount = modelType.getCount();
            modelType.setMatrixAt(currentCount, this.dummy.matrix);
            modelType.setCount(currentCount + 1);
            this.entityIdMaps.get(structureType)!.set(currentCount, structure.entityId);

            // If the Realm has a wonder, also add the Wonder model at the same location
            if (structure.hasWonder) {
              const wonderModel = models[WONDER_MODEL_INDEX];
              const wonderCount = wonderModel.getCount();
              wonderModel.setMatrixAt(wonderCount, this.dummy.matrix);
              wonderModel.setCount(wonderCount + 1);

              // Store the entity ID mapping for the wonder model
              this.wonderEntityIdMaps.set(wonderCount, structure.entityId);
            }
          } else {
            const currentCount = modelType.getCount();
            modelType.setMatrixAt(currentCount, this.dummy.matrix);
            modelType.setCount(currentCount + 1);
            this.entityIdMaps.get(structureType)!.set(currentCount, structure.entityId);
          }
        });

        models.forEach((model) => model.needsUpdate());
      }
    }

    const labelsToRemove: ID[] = [];
    this.entityIdLabels.forEach((_label, entityId) => {
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
    // Check if this is a wonder model instance
    if (structureType === StructureType.Realm && this.wonderEntityIdMaps.has(instanceId)) {
      return this.wonderEntityIdMaps.get(instanceId);
    }

    const map = this.entityIdMaps.get(structureType);
    return map ? map.get(instanceId) : undefined;
  }

  public getInstanceIdFromEntityId(structureType: StructureType, entityId: ID): number | undefined {
    // First check the wonder map
    if (structureType === StructureType.Realm) {
      for (const [instanceId, id] of this.wonderEntityIdMaps.entries()) {
        if (id === entityId) {
          return instanceId;
        }
      }
    }

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
    const labelDiv = createStructureInfoElement(structure, this.currentCameraView);

    const label = new CSS2DObject(labelDiv);
    label.position.copy(position);
    label.position.y += 2;

    // Store original renderOrder
    const originalRenderOrder = label.renderOrder;

    // Set renderOrder to Infinity on hover
    labelDiv.addEventListener("mouseenter", () => {
      label.renderOrder = Infinity;
    });

    // Restore original renderOrder when mouse leaves
    labelDiv.addEventListener("mouseleave", () => {
      label.renderOrder = originalRenderOrder;
    });

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
    this.entityIdLabels.forEach((label, _entityId) => {
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
      remainingLabels.forEach((label) => {
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

  // Relic effect management methods
  public async addRelicEffect(entityId: ID, relicNumber: number) {
    const structure = this.structures.getStructureByEntityId(entityId);
    if (!structure) return;

    const position = getWorldPositionForHex(structure.hexCoords);
    position.y += 3; // Position above structure

    try {
      // Register the relic FX type if not already registered (wait for texture to load)
      await this.fxManager.registerRelicFX(relicNumber);

      // Create the FX at the structure position
      const fx = this.fxManager.playFxAtCoords(
        `relic_${relicNumber}`,
        position.x,
        position.y,
        position.z,
        1.5,
        undefined,
        true,
      );

      if (fx) {
        // Store the effect
        if (!this.structureRelicEffects.has(entityId)) {
          this.structureRelicEffects.set(entityId, []);
        }
        this.structureRelicEffects.get(entityId)!.push({ relicNumber, fx });
      }
    } catch (error) {
      console.error(`Failed to add relic effect ${relicNumber} for structure ${entityId}:`, error);
    }
  }

  public removeRelicEffect(entityId: ID, relicNumber: number) {
    const effects = this.structureRelicEffects.get(entityId);
    if (!effects) return;

    const index = effects.findIndex((effect) => effect.relicNumber === relicNumber);
    if (index !== -1) {
      const effect = effects[index];
      effect.fx.end();
      effects.splice(index, 1);

      if (effects.length === 0) {
        this.structureRelicEffects.delete(entityId);
      }
    }
  }

  public removeAllRelicEffects(entityId: ID) {
    const effects = this.structureRelicEffects.get(entityId);
    if (!effects) return;

    effects.forEach((effect) => {
      effect.fx.end();
    });

    this.structureRelicEffects.delete(entityId);
  }

  public getStructureRelicEffects(entityId: ID): number[] {
    const effects = this.structureRelicEffects.get(entityId);
    return effects ? effects.map((effect) => effect.relicNumber) : [];
  }
}

class Structures {
  private structures: Map<StructureType, Map<ID, StructureInfo>> = new Map();

  addStructure(
    entityId: ID,
    structureType: StructureType,
    hexCoords: { col: number; row: number },
    initialized: boolean,
    stage: number = 0,
    level: number = 0,
    owner: { address: bigint; ownerName: string; guildName: string },
    hasWonder: boolean,
    isAlly: boolean,
  ) {
    if (!this.structures.has(structureType)) {
      this.structures.set(structureType, new Map());
    }
    this.structures.get(structureType)!.set(entityId, {
      entityId,
      hexCoords,
      stage,
      initialized,
      level,
      isMine: isAddressEqualToAccount(owner.address),
      owner,
      structureType,
      hasWonder,
      isAlly,
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

  getStructureByEntityId(entityId: ID): StructureInfo | undefined {
    for (const [_, structures] of this.structures) {
      const structure = structures.get(entityId);
      if (structure) {
        return structure;
      }
    }
    return undefined;
  }

  recheckOwnership() {
    this.structures.forEach((structures) => {
      structures.forEach((structure) => {
        structure.isMine = isAddressEqualToAccount(structure.owner.address);
      });
    });
  }
}
