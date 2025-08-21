import { useAccountStore } from "@/hooks/store/use-account-store";
import { getStructureModelPaths } from "@/three/constants";
import InstancedModel from "@/three/managers/instanced-model";
import { CameraView, HexagonScene } from "@/three/scenes/hexagon-scene";
import { gltfLoader, isAddressEqualToAccount } from "@/three/utils/utils";
import { FELT_CENTER } from "@/ui/config";
import { getIsBlitz, StructureSystemUpdate } from "@bibliothecadao/eternum";
import { BuildingType, ID, RelicEffect, StructureType } from "@bibliothecadao/types";
import { Group, Object3D, Scene, Vector3 } from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { GuardArmy } from "../../../../../../packages/core/src/stores/map-data-store";
import { StructureInfo } from "../types";
import { RenderChunkSize } from "../types/common";
import { getWorldPositionForHex, hashCoordinates } from "../utils";
import { createStructureLabel, updateStructureLabel } from "../utils/labels/label-factory";
import { applyLabelTransitions, transitionManager } from "../utils/labels/label-transitions";
import { FXManager } from "./fx-manager";

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
  timestamp: number; // When this update was received
  updateType: "structure" | "building"; // Type of update for ordering
}

export class StructureManager {
  private scene: Scene;
  private structureModels: Map<StructureType, InstancedModel[]> = new Map();
  private entityIdMaps: Map<StructureType, Map<number, ID>> = new Map();
  private wonderEntityIdMaps: Map<number, ID> = new Map();
  private entityIdLabels: Map<ID, CSS2DObject> = new Map();
  private dummy: Object3D = new Object3D();
  modelLoadPromises: Promise<InstancedModel>[] = [];
  structures: Structures = new Structures();
  structureHexCoords: Map<number, Set<number>> = new Map();
  private currentChunk: string = "";
  private renderChunkSize: RenderChunkSize;
  private labelsGroup: Group;
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
  private structureUpdateTimestamps: Map<ID, number> = new Map(); // Track when structures were last updated
  private structureUpdateSources: Map<ID, string> = new Map(); // Track update source to prevent relic clearing during chunk switches
  private chunkSwitchPromise: Promise<void> | null = null; // Track ongoing chunk switches

  constructor(
    scene: Scene,
    renderChunkSize: { width: number; height: number },
    labelsGroup?: Group,
    hexagonScene?: HexagonScene,
    fxManager?: FXManager,
    applyPendingRelicEffectsCallback?: (entityId: ID) => Promise<void>,
    clearPendingRelicEffectsCallback?: (entityId: ID) => void,
  ) {
    this.scene = scene;
    this.renderChunkSize = renderChunkSize;
    this.labelsGroup = labelsGroup || new Group();
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

    // Dispose of all structure models
    this.structureModels.forEach((models) => {
      models.forEach((model) => {
        if (typeof model.dispose === "function") {
          model.dispose();
        }
        if (model.group.parent) {
          model.group.parent.remove(model.group);
        }
      });
    });
    this.structureModels.clear();

    // Clear all maps
    this.entityIdMaps.clear();
    this.wonderEntityIdMaps.clear();
    this.structures.getStructures().clear();
    this.structureHexCoords.clear();
    this.structureUpdateTimestamps.clear();
    this.structureUpdateSources.clear();

    console.log("StructureManager: Destroyed and cleaned up");
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
    // Check if structure already exists with valid owner before overwriting
    const existingStructure = this.structures.getStructureByEntityId(entityId);
    let finalOwner = {
      address: owner.address || 0n,
      ownerName: owner.ownerName || "",
      guildName: owner.guildName || "",
    };

    // If incoming owner is invalid (0n or undefined) but existing structure has valid owner, preserve existing
    if (
      (!owner.address || owner.address === 0n) &&
      existingStructure?.owner.address &&
      existingStructure.owner.address !== 0n
    ) {
      console.log(
        `[OWNER PRESERVATION] Structure ${entityId} preserving existing owner ${existingStructure.owner.address} instead of invalid update owner ${owner.address}`,
      );
      finalOwner = existingStructure.owner;
    }
    let finalGuardArmies = update.guardArmies;
    let finalActiveProductions = update.activeProductions;

    const pendingUpdate = this.pendingLabelUpdates.get(entityId);
    if (pendingUpdate) {
      // Check if pending update is not too old (max 30 seconds)
      const isPendingStale = Date.now() - pendingUpdate.timestamp > 30000;

      if (isPendingStale) {
        console.warn(
          `[PENDING LABEL UPDATE] Discarding stale pending update for structure ${entityId} (age: ${Date.now() - pendingUpdate.timestamp}ms)`,
        );
        this.pendingLabelUpdates.delete(entityId);
      } else {
        console.log(
          `[PENDING LABEL UPDATE] Applying pending update for structure ${entityId} (type: ${pendingUpdate.updateType})`,
        );
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
      update.hyperstructureRealmCount,
    );

    // Smart relic effects management - differentiate between genuine updates and chunk reloads
    const currentTime = Date.now();
    const lastUpdateTime = this.structureUpdateTimestamps.get(entityId) || 0;
    const updateSource = `tile-${entityId}`; // Source identifier for this update
    const lastUpdateSource = this.structureUpdateSources.get(entityId);

    // Consider it a genuine structure update if:
    // 1. More than 2 seconds since last update (prevents rapid chunk switches), OR
    // 2. The structure has never been seen before, OR
    // 3. This is the first time we've seen this source type for this entity
    const isGenuineUpdate =
      currentTime - lastUpdateTime > 2000 || lastUpdateTime === 0 || lastUpdateSource !== updateSource;

    if (isGenuineUpdate) {
      console.log(
        `[RELIC EFFECTS] Structure ${entityId} genuine update - clearing existing effects (source: ${updateSource})`,
      );
      // This is a genuine structure update, clear existing relic effects
      const entityEffectsMap = this.structureRelicEffects.get(entityId);
      if (entityEffectsMap) {
        for (const relicSource of entityEffectsMap.keys()) {
          this.updateRelicEffects(entityId, [], relicSource);
        }
      }

      // Update tracking info
      this.structureUpdateTimestamps.set(entityId, currentTime);
      this.structureUpdateSources.set(entityId, updateSource);
    } else {
      console.log(`[RELIC EFFECTS] Structure ${entityId} quick reload/chunk switch - preserving existing effects`);
    }

    // Always apply pending relic effects (for both genuine updates and chunk reloads)
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

  async updateChunk(chunkKey: string) {
    if (this.currentChunk === chunkKey) {
      return;
    }

    // Wait for any ongoing chunk switch to complete first
    if (this.chunkSwitchPromise) {
      console.log(
        `[CHUNK SYNC] Waiting for previous structure chunk switch to complete before switching to ${chunkKey}`,
      );
      try {
        await this.chunkSwitchPromise;
      } catch (error) {
        console.warn(`Previous structure chunk switch failed:`, error);
      }
    }

    // Check again if chunk key is still different (might have changed while waiting)
    if (this.currentChunk === chunkKey) {
      return;
    }

    console.log(`[CHUNK SYNC] Switching structure chunk from ${this.currentChunk} to ${chunkKey}`);
    this.currentChunk = chunkKey;

    // Create and track the chunk switch promise
    this.chunkSwitchPromise = Promise.resolve().then(() => {
      this.updateVisibleStructures();
      this.showLabels();
    });

    try {
      await this.chunkSwitchPromise;
      console.log(`[CHUNK SYNC] Structure chunk switch to ${chunkKey} completed`);
    } finally {
      this.chunkSwitchPromise = null;
    }
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

          // Update existing label or create new one to preserve live data
          const existingLabel = this.entityIdLabels.get(structure.entityId);
          if (existingLabel) {
            // Update existing label to preserve any pending updates
            this.updateStructureLabelData(structure.entityId, structure, existingLabel);
            // Update position if needed
            const newPosition = getWorldPositionForHex(structure.hexCoords);
            newPosition.y += 2;
            existingLabel.position.copy(newPosition);
          } else {
            // Create new label if it doesn't exist
            this.addEntityIdLabel(structure, position);
          }

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
  private addEntityIdLabel(structure: StructureInfo, position: Vector3) {
    console.log("[ADD ENTITY ID LABEL]", { ...structure });
    console.log("[ADD ENTITY ID LABEL] isMine:", structure.isMine, "owner.address:", structure.owner.address);
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
    // Just update visible structures - this will handle labels appropriately
    // without destroying existing labels and their live data
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
  private updateStructureLabelData(_entityId: ID, structure: any, existingLabel: CSS2DObject): void {
    // Update the existing label content in-place with correct camera view
    updateStructureLabel(existingLabel.element, structure, this.currentCameraView);
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
      const currentTime = Date.now();

      // Check if we already have a pending update for this entity
      const existingPending = this.pendingLabelUpdates.get(update.entityId);

      // Only store if this is newer than the existing pending update or it's a different type
      if (!existingPending || currentTime >= existingPending.timestamp) {
        console.log(`[PENDING LABEL UPDATE] Storing pending structure update for ${update.entityId}`);
        this.pendingLabelUpdates.set(update.entityId, {
          guardArmies: update.guardArmies.map((guard) => ({
            slot: guard.slot,
            category: guard.category,
            tier: guard.tier,
            count: guard.count,
            stamina: guard.stamina,
          })),
          owner: update.owner,
          timestamp: currentTime,
          updateType: "structure",
        });
      } else {
        console.log(`[PENDING LABEL UPDATE] Ignoring older pending structure update for ${update.entityId}`);
      }
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
      const currentTime = Date.now();

      console.log(`[PENDING LABEL UPDATE] Storing pending building update for structure ${update.entityId}`);

      // Check if there's already a pending update for this structure
      const existingPending = this.pendingLabelUpdates.get(update.entityId);
      if (existingPending && currentTime >= existingPending.timestamp) {
        // Update the existing pending with new active productions
        existingPending.activeProductions = update.activeProductions;
        existingPending.timestamp = currentTime;
        existingPending.updateType = "building";
      } else if (!existingPending) {
        // Create a new pending update with just the active productions
        this.pendingLabelUpdates.set(update.entityId, {
          activeProductions: update.activeProductions,
          owner: { address: 0n, ownerName: "", guildName: "" }, // Will be updated when structure is created
          timestamp: currentTime,
          updateType: "building",
        });
      } else {
        console.log(`[PENDING LABEL UPDATE] Ignoring older pending building update for structure ${update.entityId}`);
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
    hyperstructureRealmCount?: number,
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
      hyperstructureRealmCount,
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
