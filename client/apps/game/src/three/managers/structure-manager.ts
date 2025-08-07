import { useAccountStore } from "@/hooks/store/use-account-store";
import { getStructureModelPaths } from "@/three/constants";
import InstancedModel from "@/three/managers/instanced-model";
import { CameraView, HexagonScene } from "@/three/scenes/hexagon-scene";
import { gltfLoader, isAddressEqualToAccount } from "@/three/utils/utils";
import { FELT_CENTER } from "@/ui/config";
import { getIsBlitz } from "@/ui/constants";
import { getBlockTimestamp } from "@/utils/timestamp";
import { BuildingType, ID, RelicEffect, StructureType } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { StructureInfo, StructureSystemUpdate } from "../types";
import { RenderChunkSize } from "../types/common";
import { getWorldPositionForHex, hashCoordinates } from "../utils";
import { createStructureLabel, updateStructureLabel } from "../utils/labels/label-factory";
import { applyLabelTransitions, transitionManager } from "../utils/labels/label-transitions";
import { FXManager } from "./fx-manager";
import { GuardArmy } from "./map-data-store";

const MAX_INSTANCES = 1000;
const WONDER_MODEL_INDEX = 4;

// Enum to track the source of relic effects
export enum RelicSource {
  Guard = "guard",
  Production = "production",
}

interface PendingLabelUpdate {
  guardArmies?: Array<{ slot: number; category: string | null; tier: number; count: number; stamina: number }>;
  activeProductions?: Array<{ buildingCount: number; buildingType: BuildingType }>;
  owner: { address: bigint; ownerName: string; guildName: string };
}

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
  private structureRelicEffects: Map<
    ID,
    Map<RelicSource, Array<{ relicNumber: number; effect: RelicEffect; fx: { end: () => void } }>>
  > = new Map();
  private applyPendingRelicEffectsCallback?: (entityId: ID) => Promise<void>;
  private clearPendingRelicEffectsCallback?: (entityId: ID) => void;
  private isBlitz: boolean;
  private pendingLabelUpdates: Map<ID, PendingLabelUpdate> = new Map();

  constructor(
    scene: THREE.Scene,
    renderChunkSize: { width: number; height: number },
    labelsGroup?: THREE.Group,
    hexagonScene?: HexagonScene,
    fxManager?: FXManager,
    applyPendingRelicEffectsCallback?: (entityId: ID) => Promise<void>,
    clearPendingRelicEffectsCallback?: (entityId: ID) => void,
  ) {
    this.scene = scene;
    this.renderChunkSize = renderChunkSize;
    this.labelsGroup = labelsGroup || new THREE.Group();
    this.hexagonScene = hexagonScene;
    this.currentCameraView = hexagonScene?.getCurrentCameraView() ?? CameraView.Medium;
    this.fxManager = fxManager || new FXManager(scene);
    this.applyPendingRelicEffectsCallback = applyPendingRelicEffectsCallback;
    this.clearPendingRelicEffectsCallback = clearPendingRelicEffectsCallback;
    this.isBlitz = getIsBlitz();
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
    console.log("StructureManager handleCameraViewChange:", this.currentCameraView, "->", view);
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

    // Use the centralized label transition function
    applyLabelTransitions(this.entityIdLabels, view);
  };

  public destroy() {
    // Clean up camera view listener
    if (this.hexagonScene) {
      this.hexagonScene.removeCameraViewListener(this.handleCameraViewChange);
    }

    // Clean up all pending label updates
    if (this.pendingLabelUpdates.size > 0) {
      console.log(`[PENDING LABEL UPDATE] Clearing ${this.pendingLabelUpdates.size} pending updates on destroy`);
      this.pendingLabelUpdates.clear();
    }

    // Clean up all relic effects
    this.structureRelicEffects.forEach((entityEffectsMap, entityId) => {
      // Clear effects for all sources
      for (const relicSource of entityEffectsMap.keys()) {
        this.updateRelicEffects(entityId, [], relicSource);
      }
      // Clear any pending relic effects
      if (this.clearPendingRelicEffectsCallback) {
        this.clearPendingRelicEffectsCallback(entityId);
      }
    });
  }

  getTotalStructures() {
    return Array.from(this.structures.getStructures().values()).reduce((acc, structures) => acc + structures.size, 0);
  }

  public async loadModels() {
    const loader = gltfLoader;

    for (const [key, modelPaths] of Object.entries(getStructureModelPaths(this.isBlitz))) {
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
    console.log("[UPDATE STRUCTURE SYSTEM ON UPDATE]", update);
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

    // Check for pending label updates and apply them if they exist
    let finalOwner = {
      address: owner.address || 0n,
      ownerName: owner.ownerName || "",
      guildName: owner.guildName || "",
    };
    let finalGuardArmies = update.guardArmies;
    let finalActiveProductions = update.activeProductions;

    const pendingUpdate = this.pendingLabelUpdates.get(entityId);
    if (pendingUpdate) {
      console.log(`[PENDING LABEL UPDATE] Applying pending update for structure ${entityId}`);
      finalOwner = pendingUpdate.owner;
      if (pendingUpdate.guardArmies) {
        finalGuardArmies = pendingUpdate.guardArmies;
      }
      if (pendingUpdate.activeProductions) {
        finalActiveProductions = pendingUpdate.activeProductions;
      }
      // Clear the pending update
      this.pendingLabelUpdates.delete(entityId);
    }

    // Add the structure to the structures map with the complete owner info
    this.structures.addStructure(
      entityId,
      key,
      normalizedCoord,
      update.initialized,
      stage,
      level,
      finalOwner,
      hasWonder,
      update.isAlly,
      finalGuardArmies,
      finalActiveProductions,
    );

    // Clear existing relic effects for this specific structure before re-rendering
    // onUpdate is called multiple times when new chunks are loaded so need to clear existing relic effects for this entity
    // Clear effects for all sources when structure is updated
    const entityEffectsMap = this.structureRelicEffects.get(entityId);
    if (entityEffectsMap) {
      for (const relicSource of entityEffectsMap.keys()) {
        this.updateRelicEffects(entityId, [], relicSource);
      }
    }

    // Apply any pending relic effects for this structure
    if (this.applyPendingRelicEffectsCallback) {
      try {
        await this.applyPendingRelicEffectsCallback(entityId);
      } catch (error) {
        console.error(`Failed to apply pending relic effects for structure ${entityId}:`, error);
      }
    }

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
    console.log("[ADD ENTITY ID LABEL]", structure);
    const labelDiv = createStructureLabel(structure, this.currentCameraView);

    const label = new CSS2DObject(labelDiv);
    label.position.copy(position);
    label.position.y += 2;
    // Store entityId in userData for identification
    label.userData.entityId = structure.entityId;

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

  public removeLabelsExcept(entityId?: ID) {
    this.entityIdLabels.forEach((label, labelEntityId) => {
      if (labelEntityId !== entityId) {
        this.labelsGroup.remove(label);
        // Dispose of the label's DOM element
        if (label.element && label.element.parentNode) {
          label.element.parentNode.removeChild(label.element);
        }
      }
    });
  }

  public showLabels() {
    // First ensure all old labels are properly cleaned up
    this.removeLabelsFromScene();
    // Update visible structures which will create new labels as needed
    this.updateVisibleStructures();
  }

  // Relic effect management methods
  public async updateRelicEffects(
    entityId: ID,
    newRelicEffects: Array<{ relicNumber: number; effect: RelicEffect }>,
    relicSource: RelicSource = RelicSource.Guard,
  ) {
    const structure = this.structures.getStructureByEntityId(entityId);
    if (!structure) return;

    // Get or create the effects map for this entity
    let entityEffectsMap = this.structureRelicEffects.get(entityId);
    if (!entityEffectsMap) {
      entityEffectsMap = new Map();
      this.structureRelicEffects.set(entityId, entityEffectsMap);
    }

    // Get current effects for this specific source
    const currentEffects = entityEffectsMap.get(relicSource) || [];

    const currentRelicNumbers = new Set(currentEffects.map((e) => e.relicNumber));
    const newRelicNumbers = new Set(newRelicEffects.map((e) => e.relicNumber));

    // Remove effects that are no longer in the new list
    for (const currentEffect of currentEffects) {
      if (!newRelicNumbers.has(currentEffect.relicNumber)) {
        currentEffect.fx.end();
      }
    }

    // Add new effects that weren't previously active
    const effectsToAdd: Array<{ relicNumber: number; effect: RelicEffect; fx: { end: () => void } }> = [];
    for (const newEffect of newRelicEffects) {
      if (!currentRelicNumbers.has(newEffect.relicNumber)) {
        try {
          const position = getWorldPositionForHex(structure.hexCoords);
          position.y += 1.5; // Position above structure

          // Register the relic FX type if not already registered (wait for texture to load)
          await this.fxManager.registerRelicFX(newEffect.relicNumber);

          // Create the FX at the structure position
          const fx = this.fxManager.playFxAtCoords(
            `relic_${newEffect.relicNumber}`,
            position.x,
            position.y,
            position.z,
            1,
            undefined,
            true,
          );

          if (fx) {
            effectsToAdd.push({ relicNumber: newEffect.relicNumber, effect: newEffect.effect, fx });
          }
        } catch (error) {
          console.error(`Failed to add relic effect ${newEffect.relicNumber} for structure ${entityId}:`, error);
        }
      }
    }

    // Update the effects for this specific source
    if (newRelicEffects.length === 0) {
      entityEffectsMap.delete(relicSource);
      // If no sources have effects, remove the entity from the main map
      if (entityEffectsMap.size === 0) {
        this.structureRelicEffects.delete(entityId);
      }
    } else {
      // Keep existing effects that are still in the new list, add new ones
      const updatedEffects = currentEffects.filter((e) => newRelicNumbers.has(e.relicNumber)).concat(effectsToAdd);
      entityEffectsMap.set(relicSource, updatedEffects);
    }
  }

  public getStructureRelicEffects(entityId: ID): { relicId: number; effect: RelicEffect }[] {
    const entityEffectsMap = this.structureRelicEffects.get(entityId);
    if (!entityEffectsMap) return [];

    // Combine effects from all sources
    const allEffects: { relicId: number; effect: RelicEffect }[] = [];
    for (const effects of entityEffectsMap.values()) {
      allEffects.push(...effects.map((effect) => ({ relicId: effect.relicNumber, effect: effect.effect })));
    }
    return allEffects;
  }

  public getStructureRelicEffectsBySource(
    entityId: ID,
    relicSource: RelicSource,
  ): { relicId: number; effect: RelicEffect }[] {
    const entityEffectsMap = this.structureRelicEffects.get(entityId);
    if (!entityEffectsMap) return [];

    const effects = entityEffectsMap.get(relicSource);
    return effects ? effects.map((effect) => ({ relicId: effect.relicNumber, effect: effect.effect })) : [];
  }

  /**
   * Update a structure label with fresh data from MapDataStore
   */
  private updateStructureLabelData(entityId: ID, structure: any, existingLabel: CSS2DObject): void {
    // Update the existing label content in-place
    updateStructureLabel(existingLabel.element, structure);
  }

  /**
   * Update structure label from guard update (troop count/stamina changes)
   */
  public updateStructureLabelFromStructureUpdate(update: {
    entityId: ID;
    guardArmies: GuardArmy[];
    owner: { address: bigint; ownerName: string; guildName: string };
  }): void {
    const structure = this.structures.getStructureByEntityId(update.entityId);
    console.log("[UPDATING STRUCTURE LABEL]", update);

    // If structure doesn't exist yet, store the update as pending
    if (!structure) {
      console.log(`[PENDING LABEL UPDATE] Storing pending update for structure ${update.entityId}`);
      const { currentArmiesTick } = getBlockTimestamp();
      this.pendingLabelUpdates.set(update.entityId, {
        guardArmies: update.guardArmies.map((guard) => ({
          slot: guard.slot,
          category: guard.category,
          tier: guard.tier,
          count: guard.count,
          stamina: guard.stamina,
        })),
        owner: update.owner,
      });
      return;
    }

    // Update cached guard armies data
    structure.guardArmies = update.guardArmies.map((guard) => ({
      slot: guard.slot,
      category: guard.category,
      tier: guard.tier,
      count: guard.count,
      stamina: guard.stamina,
    }));
    structure.owner = update.owner;
    structure.isMine = isAddressEqualToAccount(update.owner.address);

    this.structures.updateStructure(update.entityId, structure);

    // Update the label if it exists
    const label = this.entityIdLabels.get(update.entityId);
    if (label) {
      this.updateStructureLabelData(update.entityId, structure, label);
    }
  }

  /**
   * Update structure label from building update (active productions)
   */
  public updateStructureLabelFromBuildingUpdate(update: {
    entityId: ID;
    activeProductions: Array<{ buildingCount: number; buildingType: BuildingType }>;
  }): void {
    const structure = this.structures.getStructureByEntityId(update.entityId);

    // If structure doesn't exist yet, store the update as pending
    if (!structure) {
      console.log(`[PENDING LABEL UPDATE] Storing pending building update for structure ${update.entityId}`);

      // Check if there's already a pending update for this structure
      const existingPending = this.pendingLabelUpdates.get(update.entityId);
      if (existingPending) {
        // Update the existing pending with new active productions
        existingPending.activeProductions = update.activeProductions;
      } else {
        // Create a new pending update with just the active productions
        this.pendingLabelUpdates.set(update.entityId, {
          activeProductions: update.activeProductions,
          owner: { address: 0n, ownerName: "", guildName: "" }, // Will be updated when structure is created
        });
      }
      return;
    }

    // Update cached active productions data
    structure.activeProductions = update.activeProductions;

    // Update the label if it exists
    const label = this.entityIdLabels.get(update.entityId);
    if (label) {
      this.updateStructureLabelData(update.entityId, structure, label);
    }
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
    guardArmies?: Array<{ slot: number; category: string | null; tier: number; count: number; stamina: number }>,
    activeProductions?: Array<{ buildingCount: number; buildingType: BuildingType }>,
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
      // Enhanced data
      guardArmies,
      activeProductions,
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

  updateStructure(entityId: ID, structure: StructureInfo) {
    this.structures.get(structure.structureType)?.set(entityId, structure);
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
