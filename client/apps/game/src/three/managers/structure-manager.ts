import { useAccountStore } from "@/hooks/store/use-account-store";
import { getStructureModelPaths } from "@/three/constants";
import InstancedModel, { LAND_NAME } from "@/three/managers/instanced-model";
import { CameraView, HexagonScene } from "@/three/scenes/hexagon-scene";
import { gltfLoader, isAddressEqualToAccount } from "@/three/utils/utils";
import { FELT_CENTER } from "@/ui/config";
import type { SetupResult } from "@bibliothecadao/dojo";
import { getIsBlitz, StructureTileSystemUpdate } from "@bibliothecadao/eternum";
import { BuildingType, ClientComponents, ID, RelicEffect, StructureType } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import * as THREE from "three";
import { Box3, Euler, Group, Object3D, Scene, Sphere, Vector3 } from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { GuardArmy } from "../../../../../../packages/core/src/stores/map-data-store";
import type { AttachmentTransform, CosmeticAttachmentTemplate } from "../cosmetics";
import {
  CosmeticAttachmentManager,
  playerCosmeticsStore,
  resolveStructureCosmetic,
  resolveStructureMountTransforms,
} from "../cosmetics";
import { StructureInfo } from "../types";
import { AnimationVisibilityContext } from "../types/animation";
import { RenderChunkSize } from "../types/common";
import { getWorldPositionForHex, getWorldPositionForHexCoordsInto, hashCoordinates } from "../utils";
import { getRenderBounds } from "../utils/chunk-geometry";
import { getBattleTimerLeft, getCombatAngles } from "../utils/combat-directions";
import { FrustumManager } from "../utils/frustum-manager";
import { CentralizedVisibilityManager } from "../utils/centralized-visibility-manager";
import { createStructureLabel, updateStructureLabel } from "../utils/labels/label-factory";
import { LabelPool } from "../utils/labels/label-pool";
import { applyLabelTransitions, transitionManager } from "../utils/labels/label-transitions";
import { FXManager } from "./fx-manager";
import { PointsLabelRenderer } from "./points-label-renderer";

const INITIAL_STRUCTURE_CAPACITY = 64;
const WONDER_MODEL_INDEX = 4;

// Enum to track the source of relic effects
export enum RelicSource {
  Guard = "guard",
  Production = "production",
}

const normalizeEntityId = (entityId: ID | bigint | string | undefined | null): ID | undefined => {
  if (entityId === undefined || entityId === null) {
    return undefined;
  }

  if (typeof entityId === "bigint") {
    const normalized = Number(entityId);
    if (!Number.isSafeInteger(normalized)) {
      console.warn(`[StructureManager] Entity id ${entityId.toString()} exceeds safe integer range`);
    }
    return normalized as ID;
  }

  if (typeof entityId === "string") {
    const parsed = Number(entityId);
    if (Number.isNaN(parsed)) {
      console.warn(`[StructureManager] Failed to parse entity id string "${entityId}"`);
      return undefined;
    }
    return parsed as ID;
  }

  return entityId;
};

interface PendingLabelUpdate {
  guardArmies?: Array<{ slot: number; category: string | null; tier: number; count: number; stamina: number }>;
  activeProductions?: Array<{ buildingCount: number; buildingType: BuildingType }>;
  owner: { address: bigint; ownerName: string; guildName: string };
  timestamp: number; // When this update was received
  updateType: "structure" | "building"; // Type of update for ordering
  attackedFromDegrees?: number;
  attackedTowardDegrees?: number;
  battleCooldownEnd?: number;
  battleTimerLeft?: number;
}

interface StructureInstanceBinding {
  modelIndex: number;
  instanceIndex: number;
  wonderInstanceIndex?: number;
}

export class StructureManager {
  private scene: Scene;
  private structureModels: Map<StructureType, InstancedModel[]> = new Map();
  private structureModelPromises: Map<StructureType, Promise<InstancedModel[]>> = new Map();
  private structureModelPaths: Record<string, string[]>;
  // Cosmetic skin models keyed by cosmeticId
  private cosmeticStructureModels: Map<string, InstancedModel[]> = new Map();
  private cosmeticStructureModelPromises: Map<string, Promise<InstancedModel[]>> = new Map();
  private isUpdatingVisibleStructures = false;
  private hasPendingVisibleStructuresUpdate = false;
  private entityIdMaps: Map<StructureType, Map<number, ID>> = new Map();
  // Cosmetic entity ID maps keyed by cosmeticId
  private cosmeticEntityIdMaps: Map<string, Map<number, ID>> = new Map();
  private structureInstanceBindings: Map<StructureType, Map<ID, StructureInstanceBinding>> = new Map();
  private structureInstanceOrders: Map<StructureType, Map<number, ID[]>> = new Map();
  private wonderEntityIdMaps: Map<number, ID> = new Map();
  private entityIdLabels: Map<ID, CSS2DObject> = new Map();
  private labelPool = new LabelPool();
  private dummy: Object3D = new Object3D();
  public readonly structures: Structures;
  structureHexCoords: Map<number, Set<number>> = new Map();
  private currentChunk: string = "";
  private renderChunkSize: RenderChunkSize;
  private labelsGroup: Group;
  private currentCameraView: CameraView;
  private hexagonScene?: HexagonScene;
  private fxManager: FXManager;
  private components?: ClientComponents;
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
  private battleTimerInterval: NodeJS.Timeout | null = null; // Timer for updating battle countdown
  private structuresWithActiveBattleTimer: Set<ID> = new Set(); // Track structures with active battle timers for O(1) lookup
  private unsubscribeAccountStore?: () => void;
  private attachmentManager: CosmeticAttachmentManager;
  private structureAttachmentSignatures: Map<number, string> = new Map();
  private activeStructureAttachmentEntities: Set<number> = new Set();
  private chunkToStructures: Map<string, Set<ID>> = new Map();
  private readonly tempCosmeticPosition: Vector3 = new Vector3();
  // Scratch vectors for performVisibleStructuresUpdate to avoid allocations
  private readonly scratchPosition: Vector3 = new Vector3();
  private readonly scratchLabelPosition: Vector3 = new Vector3();
  private readonly scratchIconPosition: Vector3 = new Vector3();
  private readonly tempCosmeticRotation: Euler = new Euler();
  private readonly structureAttachmentTransformScratch = new Map<string, AttachmentTransform>();
  private readonly animationCullDistance = 140;
  private animationCameraPosition: Vector3 = new Vector3();
  private animationVisibilityContext?: AnimationVisibilityContext;
  private pointsRenderers?: {
    myVillage: PointsLabelRenderer;
    enemyVillage: PointsLabelRenderer;
    allyVillage: PointsLabelRenderer;
    myRealm: PointsLabelRenderer;
    enemyRealm: PointsLabelRenderer;
    allyRealm: PointsLabelRenderer;
    hyperstructure: PointsLabelRenderer;
    bank: PointsLabelRenderer;
    fragmentMine: PointsLabelRenderer;
  };
  private frustumManager?: FrustumManager;
  private frustumVisibilityDirty = false;
  private visibilityManager?: CentralizedVisibilityManager;
  private currentChunkBounds?: { box: Box3; sphere: Sphere };
  private unsubscribeFrustum?: () => void;
  private unsubscribeVisibility?: () => void;
  private chunkStride: number;
  private needsSpatialReindex = false;
  private visibleStructureCount = 0;
  private previousVisibleIds: Set<ID> = new Set(); // Track visible structures for diff-based point cleanup
  private readonly handleStructureRecordRemoved = (structure: StructureInfo) => {
    const entityNumericId = Number(structure.entityId);
    this.attachmentManager.removeAttachments(entityNumericId);
    this.activeStructureAttachmentEntities.delete(entityNumericId);
    this.structureAttachmentSignatures.delete(entityNumericId);

    // Remove from battle timer tracking
    this.structuresWithActiveBattleTimer.delete(structure.entityId);

    // Remove from spatial index
    const { col, row } = structure.hexCoords;
    const key = this.getSpatialKey(col, row);
    const set = this.chunkToStructures.get(key);
    if (set) {
      set.delete(structure.entityId);
      if (set.size === 0) {
        this.chunkToStructures.delete(key);
      }
    }
  };

  private getSpatialKey(col: number, row: number): string {
    const bucketX = Math.floor(col / this.chunkStride);
    const bucketY = Math.floor(row / this.chunkStride);
    return `${bucketX},${bucketY}`;
  }

  private updateSpatialIndex(
    entityId: ID,
    oldHex: { col: number; row: number } | undefined,
    newHex: { col: number; row: number },
  ) {
    if (oldHex) {
      const oldKey = this.getSpatialKey(oldHex.col, oldHex.row);
      const newKey = this.getSpatialKey(newHex.col, newHex.row);

      if (oldKey === newKey) return;

      const oldSet = this.chunkToStructures.get(oldKey);
      if (oldSet) {
        oldSet.delete(entityId);
        if (oldSet.size === 0) {
          this.chunkToStructures.delete(oldKey);
        }
      }
    }

    const newKey = this.getSpatialKey(newHex.col, newHex.row);
    let newSet = this.chunkToStructures.get(newKey);
    if (!newSet) {
      newSet = new Set();
      this.chunkToStructures.set(newKey, newSet);
    }
    newSet.add(entityId);
  }

  constructor(
    scene: Scene,
    renderChunkSize: { width: number; height: number },
    labelsGroup?: Group,
    hexagonScene?: HexagonScene,
    fxManager?: FXManager,
    dojoContext?: SetupResult,
    applyPendingRelicEffectsCallback?: (entityId: ID) => Promise<void>,
    clearPendingRelicEffectsCallback?: (entityId: ID) => void,
    frustumManager?: FrustumManager,
    visibilityManager?: CentralizedVisibilityManager,
    chunkStride?: number,
  ) {
    this.scene = scene;
    this.renderChunkSize = renderChunkSize;
    this.structures = new Structures(this.handleStructureRecordRemoved, () => this.updateVisibleStructures());
    this.labelsGroup = labelsGroup || new Group();
    this.hexagonScene = hexagonScene;
    this.currentCameraView = hexagonScene?.getCurrentCameraView() ?? CameraView.Medium;
    this.fxManager = fxManager || new FXManager(scene);
    this.attachmentManager = new CosmeticAttachmentManager(scene);
    this.components = dojoContext?.components as ClientComponents | undefined;
    this.applyPendingRelicEffectsCallback = applyPendingRelicEffectsCallback;
    this.clearPendingRelicEffectsCallback = clearPendingRelicEffectsCallback;
    this.frustumManager = frustumManager;
    this.visibilityManager = visibilityManager;
    if (this.frustumManager) {
      this.frustumVisibilityDirty = true;
      this.unsubscribeFrustum = this.frustumManager.onChange(() => {
        this.frustumVisibilityDirty = true;
      });
    }
    if (this.visibilityManager) {
      this.frustumVisibilityDirty = true;
      this.unsubscribeVisibility = this.visibilityManager.onChange(() => {
        this.frustumVisibilityDirty = true;
      });
    }
    this.isBlitz = getIsBlitz();
    this.structureModelPaths = getStructureModelPaths(this.isBlitz);
    // Keep chunk stride aligned with the world chunk size so visibility/fetch math matches.
    this.chunkStride = Math.max(1, chunkStride ?? Math.floor(this.renderChunkSize.width / 2));
    this.needsSpatialReindex = true;

    // Subscribe to camera view changes if scene is provided
    if (hexagonScene) {
      hexagonScene.addCameraViewListener(this.handleCameraViewChange);
    }

    this.unsubscribeAccountStore = useAccountStore.subscribe(() => {
      this.structures.recheckOwnership();
      // Update labels when ownership changes
      this.updateVisibleStructures();
    });

    // Initialize points-based icon renderers
    this.initializePointsRenderers();

    // Start battle timer updates
    this.startBattleTimerUpdates();
  }

  private initializePointsRenderers(): void {
    const textureLoader = new THREE.TextureLoader();
    const texturePaths = {
      myVillage: "/images/labels/village.png",
      enemyVillage: "/images/labels/enemy_village.png",
      allyVillage: "/images/labels/allies_village.png",
      myRealm: "/images/labels/realm.png",
      enemyRealm: "/images/labels/enemy_realm.png",
      allyRealm: "/images/labels/allies_realm.png",
      hyperstructure: "/images/labels/hyperstructure.png",
      bank: "/images/labels/chest.png", // Using chest as placeholder for bank
      fragmentMine: this.isBlitz ? "/images/labels/essence_rift.png" : "/images/labels/fragment_mine.png",
    };

    const loadedTextures: Partial<Record<keyof typeof texturePaths, THREE.Texture>> = {};
    let loadedCount = 0;
    const totalTextures = Object.keys(texturePaths).length;

    Object.entries(texturePaths).forEach(([key, path]) => {
      textureLoader.load(
        path,
        (texture) => {
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.flipY = false;

          loadedTextures[key as keyof typeof texturePaths] = texture;
          loadedCount++;

          if (loadedCount === totalTextures) {
            const scaledPointSize = 5 * 0.5;
            this.pointsRenderers = {
              myVillage: new PointsLabelRenderer(
                this.scene,
                loadedTextures.myVillage!,
                1000,
                scaledPointSize,
                0,
                1.3,
                true,
                this.frustumManager,
              ),
              enemyVillage: new PointsLabelRenderer(
                this.scene,
                loadedTextures.enemyVillage!,
                1000,
                scaledPointSize,
                0,
                1.3,
                true,
                this.frustumManager,
              ),
              allyVillage: new PointsLabelRenderer(
                this.scene,
                loadedTextures.allyVillage!,
                1000,
                scaledPointSize,
                0,
                1.3,
                true,
                this.frustumManager,
              ),
              myRealm: new PointsLabelRenderer(
                this.scene,
                loadedTextures.myRealm!,
                1000,
                scaledPointSize,
                0,
                1.3,
                true,
                this.frustumManager,
              ),
              enemyRealm: new PointsLabelRenderer(
                this.scene,
                loadedTextures.enemyRealm!,
                1000,
                scaledPointSize,
                0,
                1.3,
                true,
                this.frustumManager,
              ),
              allyRealm: new PointsLabelRenderer(
                this.scene,
                loadedTextures.allyRealm!,
                1000,
                scaledPointSize,
                0,
                1.3,
                true,
                this.frustumManager,
              ),
              hyperstructure: new PointsLabelRenderer(
                this.scene,
                loadedTextures.hyperstructure!,
                1000,
                scaledPointSize,
                0,
                1.3,
                true,
                this.frustumManager,
              ),
              bank: new PointsLabelRenderer(
                this.scene,
                loadedTextures.bank!,
                1000,
                scaledPointSize,
                0,
                1.3,
                true,
                this.frustumManager,
              ),
              fragmentMine: new PointsLabelRenderer(
                this.scene,
                loadedTextures.fragmentMine!,
                1000,
                scaledPointSize,
                0,
                1.3,
                true,
                this.frustumManager,
              ),
            };

            console.log("[StructureManager] Points-based icon renderers initialized");

            if (this.currentChunk) {
              this.updateVisibleStructures();
            }
          }
        },
        undefined,
        (error) => {
          console.error(`[StructureManager] Failed to load structure icon texture (${key}):`, error);
        },
      );
    });
  }

  private handleCameraViewChange = (view: CameraView) => {
    if (this.currentCameraView === view) {
      this.updateShadowFlags();
      return;
    }

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
    this.updateShadowFlags();
  };

  private updateShadowFlags(): void {
    const qualityShadowsEnabled = this.hexagonScene?.getShadowsEnabledByQuality() ?? true;
    const enableCasting = this.currentCameraView === CameraView.Close && qualityShadowsEnabled;
    const enableContactShadows = !enableCasting;
    const applyToModels = (models: InstancedModel[]) => {
      models.forEach((model) => {
        model.instancedMeshes.forEach((mesh) => {
          if (mesh.name === LAND_NAME) {
            mesh.castShadow = false;
            return;
          }
          mesh.castShadow = enableCasting;
        });
        model.setContactShadowsEnabled(enableContactShadows);
      });
    };

    this.structureModels.forEach((models) => applyToModels(models));
    this.cosmeticStructureModels.forEach((models) => applyToModels(models));
  }

  public destroy() {
    if (this.unsubscribeFrustum) {
      this.unsubscribeFrustum();
      this.unsubscribeFrustum = undefined;
    }

    if (this.unsubscribeAccountStore) {
      this.unsubscribeAccountStore();
      this.unsubscribeAccountStore = undefined;
    }

    // Clean up camera view listener
    if (this.hexagonScene) {
      this.hexagonScene.removeCameraViewListener(this.handleCameraViewChange);
    }

    // Clean up battle timer interval
    if (this.battleTimerInterval) {
      clearInterval(this.battleTimerInterval);
      this.battleTimerInterval = null;
    }

    // Clean up all pending label updates
    if (this.pendingLabelUpdates.size > 0) {
      // console.log(`[PENDING LABEL UPDATE] Clearing ${this.pendingLabelUpdates.size} pending updates on destroy`);
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

    this.entityIdLabels.forEach((label) => {
      this.labelsGroup.remove(label);
      this.labelPool.release(label);
    });
    this.entityIdLabels.clear();

    this.labelPool.clear();

    this.attachmentManager.clear();
    this.activeStructureAttachmentEntities.clear();
    this.structureAttachmentSignatures.clear();

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

    // Dispose of cosmetic structure models
    this.cosmeticStructureModels.forEach((models) => {
      models.forEach((model) => {
        if (typeof model.dispose === "function") {
          model.dispose();
        }
        if (model.group.parent) {
          model.group.parent.remove(model.group);
        }
      });
    });
    this.cosmeticStructureModels.clear();

    // Clear all maps
    this.entityIdMaps.clear();
    this.cosmeticEntityIdMaps.clear();
    this.wonderEntityIdMaps.clear();
    this.structures.getStructures().clear();
    this.structureHexCoords.clear();
    this.structureUpdateTimestamps.clear();
    this.structureUpdateSources.clear();
    this.chunkToStructures.clear();
    this.structuresWithActiveBattleTimer.clear();
    this.previousVisibleIds.clear();

    // Clean up points renderers
    if (this.pointsRenderers) {
      Object.values(this.pointsRenderers).forEach((renderer) => renderer.dispose());
    }

    if (this.unsubscribeVisibility) {
      this.unsubscribeVisibility();
      this.unsubscribeVisibility = undefined;
    }

    console.log("StructureManager: Destroyed and cleaned up");
  }

  getTotalStructures() {
    return Array.from(this.structures.getStructures().values()).reduce((acc, structures) => acc + structures.size, 0);
  }

  private async ensureStructureModels(structureType: StructureType): Promise<InstancedModel[]> {
    if (this.structureModels.has(structureType)) {
      return this.structureModels.get(structureType)!;
    }

    let pending = this.structureModelPromises.get(structureType);
    if (pending) {
      return pending;
    }

    const modelPaths = this.structureModelPaths[String(structureType)] ?? [];
    if (modelPaths.length === 0) {
      const empty: InstancedModel[] = [];
      this.structureModels.set(structureType, empty);
      return empty;
    }

    pending = Promise.all(modelPaths.map((modelPath) => this.loadStructureModel(structureType, modelPath)))
      .then((models) => {
        this.structureModels.set(structureType, models);
        models.forEach((model) => {
          this.scene.add(model.group);
          if (this.currentChunkBounds) {
            model.setWorldBounds(this.currentChunkBounds);
          }
        });
        return models;
      })
      .finally(() => {
        this.structureModelPromises.delete(structureType);
      });

    this.structureModelPromises.set(structureType, pending);
    return pending;
  }

  private loadStructureModel(structureType: StructureType, modelPath: string): Promise<InstancedModel> {
    return new Promise((resolve, reject) => {
      gltfLoader.load(
        modelPath,
        (gltf) => {
          try {
            const instancedModel = new InstancedModel(
              gltf,
              INITIAL_STRUCTURE_CAPACITY,
              false,
              modelPath.includes("wonder") ? "wonder" : StructureType[structureType],
            );
            resolve(instancedModel);
          } catch (error) {
            reject(error);
          }
        },
        undefined,
        (error) => {
          console.error(modelPath);
          console.error(`An error occurred while loading the ${StructureType[structureType]} model:`, error);
          reject(error);
        },
      );
    });
  }

  /**
   * Ensures cosmetic structure models are loaded for a given cosmeticId.
   * Returns the loaded models or empty array if loading fails.
   */
  private async ensureCosmeticStructureModels(cosmeticId: string, assetPaths: string[]): Promise<InstancedModel[]> {
    if (this.cosmeticStructureModels.has(cosmeticId)) {
      return this.cosmeticStructureModels.get(cosmeticId)!;
    }

    let pending = this.cosmeticStructureModelPromises.get(cosmeticId);
    if (pending) {
      return pending;
    }

    if (assetPaths.length === 0) {
      const empty: InstancedModel[] = [];
      this.cosmeticStructureModels.set(cosmeticId, empty);
      return empty;
    }

    pending = Promise.all(assetPaths.map((modelPath) => this.loadCosmeticStructureModel(cosmeticId, modelPath)))
      .then((models) => {
        this.cosmeticStructureModels.set(cosmeticId, models);
        models.forEach((model) => {
          this.scene.add(model.group);
          if (this.currentChunkBounds) {
            model.setWorldBounds(this.currentChunkBounds);
          }
        });
        return models;
      })
      .catch((error) => {
        console.warn(`[StructureManager] Failed to load cosmetic models for ${cosmeticId}:`, error);
        const empty: InstancedModel[] = [];
        this.cosmeticStructureModels.set(cosmeticId, empty);
        return empty;
      })
      .finally(() => {
        this.cosmeticStructureModelPromises.delete(cosmeticId);
      });

    this.cosmeticStructureModelPromises.set(cosmeticId, pending);
    return pending;
  }

  private loadCosmeticStructureModel(cosmeticId: string, modelPath: string): Promise<InstancedModel> {
    return new Promise((resolve, reject) => {
      gltfLoader.load(
        modelPath,
        (gltf) => {
          try {
            const instancedModel = new InstancedModel(gltf, INITIAL_STRUCTURE_CAPACITY, false, cosmeticId);
            resolve(instancedModel);
          } catch (error) {
            reject(error);
          }
        },
        undefined,
        (error) => {
          console.error(`[StructureManager] Failed to load cosmetic model ${modelPath}:`, error);
          reject(error);
        },
      );
    });
  }

  async onUpdate(update: StructureTileSystemUpdate) {
    // console.log("[UPDATE STRUCTURE SYSTEM ON UPDATE]", update);
    const { entityId: rawEntityId, hexCoords, structureType, stage, level, owner, hasWonder } = update;
    const entityId = normalizeEntityId(rawEntityId);
    if (entityId === undefined) {
      console.warn("[StructureManager] Received tile update without a valid entity id", update);
      return;
    }
    await this.ensureStructureModels(structureType);
    const normalizedCoord = { col: hexCoords.col - FELT_CENTER(), row: hexCoords.row - FELT_CENTER() };
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

    // Update spatial index
    this.updateSpatialIndex(entityId, existingStructure?.hexCoords, normalizedCoord);

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

    const battleData = update.battleData ?? {};
    let { battleCooldownEnd } = battleData as { battleCooldownEnd?: number };
    const {
      latestAttackerId,
      latestDefenderId,
      latestAttackerCoordX,
      latestAttackerCoordY,
      latestDefenderCoordX,
      latestDefenderCoordY,
    } = battleData as {
      latestAttackerId?: number;
      latestDefenderId?: number;
      latestAttackerCoordX?: number;
      latestAttackerCoordY?: number;
      latestDefenderCoordX?: number;
      latestDefenderCoordY?: number;
    };

    let { attackedFromDegrees, attackTowardDegrees } = getCombatAngles(
      hexCoords,
      latestAttackerId ?? undefined,
      latestAttackerCoordX && latestAttackerCoordY ? { x: latestAttackerCoordX, y: latestAttackerCoordY } : undefined,
      latestDefenderId ?? undefined,
      latestDefenderCoordX && latestDefenderCoordY ? { x: latestDefenderCoordX, y: latestDefenderCoordY } : undefined,
    );

    // Calculate battle timer left
    let battleTimerLeft = getBattleTimerLeft(battleCooldownEnd);

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
          `[PENDING LABEL UPDATE] Applying pending update for structure ${entityId} (type: ${pendingUpdate.updateType}, pendingUpdate: ${pendingUpdate})`,
        );
        finalOwner = pendingUpdate.owner;
        if (pendingUpdate.guardArmies) {
          finalGuardArmies = pendingUpdate.guardArmies;
        }
        if (pendingUpdate.activeProductions) {
          finalActiveProductions = pendingUpdate.activeProductions;
        }
        // Apply any pending battle direction data
        if (pendingUpdate.attackedFromDegrees !== undefined) {
          attackedFromDegrees = pendingUpdate.attackedFromDegrees;
        }
        if (pendingUpdate.attackedTowardDegrees !== undefined) {
          attackTowardDegrees = pendingUpdate.attackedTowardDegrees;
        }
        if (pendingUpdate.battleCooldownEnd !== undefined) {
          battleCooldownEnd = pendingUpdate.battleCooldownEnd;
          battleTimerLeft = getBattleTimerLeft(pendingUpdate.battleCooldownEnd);
        }
        // Clear the pending update
        this.pendingLabelUpdates.delete(entityId);
      }
    }

    if (this.components?.Structure) {
      const liveStructure = getComponentValue(this.components.Structure, getEntityIdFromKeys([BigInt(entityId)]));

      if (liveStructure) {
        const liveOwnerAddress = liveStructure.owner;

        if (liveOwnerAddress !== undefined) {
          let liveOwnerName = finalOwner.ownerName;

          if (this.components.AddressName) {
            const addressName = getComponentValue(this.components.AddressName, getEntityIdFromKeys([liveOwnerAddress]));

            if (addressName?.name) {
              try {
                liveOwnerName = shortString.decodeShortString(addressName.name.toString());
              } catch (error) {
                console.warn(`[StructureManager] Failed to decode owner name for ${entityId}:`, error);
              }
            }
          }

          finalOwner = {
            address: liveOwnerAddress,
            ownerName: liveOwnerName,
            guildName: finalOwner.guildName,
          };
        }
      }
    }

    const ownerForCosmetics = finalOwner.address ?? 0n;
    if (this.components && ownerForCosmetics !== 0n) {
      playerCosmeticsStore.hydrateFromBlitzComponent(this.components, ownerForCosmetics);
    }
    const enumName = StructureType[key as unknown as keyof typeof StructureType];
    const defaultModelKey = typeof enumName === "string" ? enumName : String(key);
    const cosmetic = resolveStructureCosmetic({
      owner: ownerForCosmetics,
      structureType: key,
      stage,
      defaultModelKey,
    });

    // Add the structure to the structures map with the complete owner info
    this.structures.addStructure(
      entityId,
      update.structureName,
      key,
      normalizedCoord,
      update.initialized,
      stage,
      level,
      finalOwner,
      hasWonder,
      cosmetic.attachments,
      update.isAlly,
      finalGuardArmies,
      finalActiveProductions,
      update.hyperstructureRealmCount,
      attackedFromDegrees ?? undefined,
      attackTowardDegrees ?? undefined,
      battleCooldownEnd,
      battleTimerLeft,
    );

    const structureRecord = this.structures.getStructureByEntityId(entityId);
    if (structureRecord) {
      structureRecord.cosmeticId = cosmetic.cosmeticId;
      structureRecord.cosmeticAssetPaths = cosmetic.registryEntry?.assetPaths;
      structureRecord.attachments = cosmetic.attachments;
    }

    // Track structures with active battle timers for efficient timer updates
    this.updateBattleTimerTracking(entityId, battleCooldownEnd);

    const existingLabel = this.entityIdLabels.get(entityId);
    if (existingLabel && structureRecord) {
      this.updateStructureLabelData(structureRecord, existingLabel);
    }

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
      // console.log(
      //   `[RELIC EFFECTS] Structure ${entityId} genuine update - clearing existing effects (source: ${updateSource})`,
      // );
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
      // console.log(`[RELIC EFFECTS] Structure ${entityId} quick reload/chunk switch - preserving existing effects`);
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

  private getChunkBounds(startRow: number, startCol: number) {
    return getRenderBounds(startRow, startCol, this.renderChunkSize, this.chunkStride);
  }

  async updateChunk(chunkKey: string, options?: { force?: boolean }) {
    const force = options?.force ?? false;
    if (!force && this.currentChunk === chunkKey) {
      return;
    }

    // Wait for any ongoing chunk switch to complete first
    if (this.chunkSwitchPromise) {
      // console.log(
      //   `[CHUNK SYNC] Waiting for previous structure chunk switch to complete before switching to ${chunkKey}`,
      // );
      try {
        await this.chunkSwitchPromise;
      } catch (error) {
        console.warn(`Previous structure chunk switch failed:`, error);
      }
    }

    // Check again if chunk key is still different (might have changed while waiting)
    if (!force && this.currentChunk === chunkKey) {
      return;
    }

    const previousChunk = this.currentChunk;
    const isSwitch = previousChunk !== chunkKey;
    if (isSwitch) {
      // console.log(`[CHUNK SYNC] Switching structure chunk from ${this.currentChunk} to ${chunkKey}`);
      this.currentChunk = chunkKey;
    } else if (force) {
      // console.log(`[CHUNK SYNC] Refreshing structure chunk ${chunkKey}`);
    }

    // Create and track the chunk switch promise
    this.chunkSwitchPromise = Promise.resolve().then(() => {
      this.updateVisibleStructures();
      this.showLabels();
    });

    try {
      await this.chunkSwitchPromise;
      // console.log(`[CHUNK SYNC] Structure chunk ${isSwitch ? "switch" : "refresh"} for ${chunkKey} completed`);
    } finally {
      this.chunkSwitchPromise = null;
    }
  }

  getStructureByHexCoords(hexCoords: { col: number; row: number }) {
    const allStructures = this.structures.getStructures();

    for (const structures of allStructures.values()) {
      const structure = Array.from(structures.values()).find(
        (structure) => structure.hexCoords.col === hexCoords.col && structure.hexCoords.row === hexCoords.row,
      );
      if (structure) {
        return structure;
      }
    }
    return undefined;
  }

  public getVisibleCount(): number {
    return this.visibleStructureCount;
  }

  private updateVisibleStructures(): void {
    if (this.isUpdatingVisibleStructures) {
      this.hasPendingVisibleStructuresUpdate = true;
      return;
    }

    this.isUpdatingVisibleStructures = true;
    void this.performVisibleStructuresUpdate()
      .catch((error) => {
        console.error("Failed to update visible structures", error);
      })
      .finally(() => {
        this.isUpdatingVisibleStructures = false;
        if (this.hasPendingVisibleStructuresUpdate) {
          this.hasPendingVisibleStructuresUpdate = false;
          this.updateVisibleStructures();
        }
      });
  }

  private resolveStructureAttachmentsForRender(structure: StructureInfo): CosmeticAttachmentTemplate[] {
    return structure.attachments ? [...structure.attachments] : [];
  }

  /**
   * Check if a structure uses a non-default cosmetic skin.
   */
  private hasCosmeticSkin(structure: StructureInfo): boolean {
    if (!structure.cosmeticId || !structure.cosmeticAssetPaths?.length) {
      return false;
    }
    // Default cosmetics end with ":base" and use the standard model paths
    return !structure.cosmeticId.endsWith(":base");
  }

  private async performVisibleStructuresUpdate(): Promise<void> {
    // Refresh visibility state when invoked outside the render loop
    this.visibilityManager?.beginFrame();

    const visibleStructureIds = new Set<ID>();
    const attachmentRetain = new Set<number>();

    // Get visible structures from spatial index
    const [startRow, startCol] = this.currentChunk?.split(",").map(Number) || [0, 0];
    const visibleStructures = this.getVisibleStructuresForChunk(startRow, startCol);
    this.visibleStructureCount = visibleStructures.length;

    // Organize by type for model loading and rendering
    const structuresByType = new Map<StructureType, StructureInfo[]>();
    // Organize structures with cosmetic skins separately
    const structuresByCosmeticId = new Map<string, StructureInfo[]>();

    visibleStructures.forEach((structure) => {
      if (this.hasCosmeticSkin(structure)) {
        const cosmeticId = structure.cosmeticId!;
        if (!structuresByCosmeticId.has(cosmeticId)) {
          structuresByCosmeticId.set(cosmeticId, []);
        }
        structuresByCosmeticId.get(cosmeticId)!.push(structure);
      } else {
        if (!structuresByType.has(structure.structureType)) {
          structuresByType.set(structure.structureType, []);
        }
        structuresByType.get(structure.structureType)!.push(structure);
      }
    });

    const preloadPromises: Promise<unknown>[] = [];

    for (const [structureType] of structuresByType) {
      if (!this.structureModels.has(structureType)) {
        preloadPromises.push(this.ensureStructureModels(structureType));
      }
    }

    // Preload cosmetic models
    for (const [cosmeticId, structures] of structuresByCosmeticId) {
      if (!this.cosmeticStructureModels.has(cosmeticId)) {
        const assetPaths = structures[0]?.cosmeticAssetPaths ?? [];
        if (assetPaths.length > 0) {
          preloadPromises.push(this.ensureCosmeticStructureModels(cosmeticId, assetPaths));
        }
      }
    }

    if (preloadPromises.length > 0) {
      try {
        await Promise.all(preloadPromises);
      } catch (error) {
        console.error("Failed to preload structure models", error);
      }
    }

    this.wonderEntityIdMaps.clear();

    // Reset all model counts - use a batched approach to avoid repeated needsUpdate/computeBoundingSphere
    // We'll track counts per model and call setCount once at the end
    this.structureModels.forEach((models) => {
      models.forEach((model) => model.setCount(0));
    });
    this.cosmeticStructureModels.forEach((models) => {
      models.forEach((model) => model.setCount(0));
    });
    this.entityIdMaps.clear();
    this.cosmeticEntityIdMaps.clear();

    // Track instance counts per model to batch setCount calls (avoids N calls to computeBoundingSphere)
    const modelInstanceCounts = new Map<InstancedModel, number>();

    // Begin batch mode for all point renderers (avoids computeBoundingSphere per setPoint)
    if (this.pointsRenderers) {
      Object.values(this.pointsRenderers).forEach((renderer) => renderer.beginBatch());
    }

    for (const [structureType, structures] of structuresByType) {
      const models = this.structureModels.get(structureType);

      if (!models || models.length === 0) {
        continue;
      }

      if (!this.entityIdMaps.has(structureType)) {
        this.entityIdMaps.set(structureType, new Map());
      }

      structures.forEach((structure) => {
        visibleStructureIds.add(structure.entityId);
        // Use scratch vector to avoid allocation
        const { col, row } = structure.hexCoords;
        getWorldPositionForHexCoordsInto(col, row, this.scratchPosition);
        this.scratchPosition.y += 0.05;

        const existingLabel = this.entityIdLabels.get(structure.entityId);
        if (existingLabel) {
          this.updateStructureLabelData(structure, existingLabel);
          // Use scratch vector for label position
          getWorldPositionForHexCoordsInto(col, row, this.scratchLabelPosition);
          this.scratchLabelPosition.y += 2;
          existingLabel.position.copy(this.scratchLabelPosition);
        }

        this.dummy.position.copy(this.scratchPosition);

        if (structureType === StructureType.Bank) {
          this.dummy.rotation.y = (4 * Math.PI) / 6;
        } else {
          const rotationSeed = hashCoordinates(col, row);
          const rotationIndex = Math.floor(rotationSeed * 6);
          const randomRotation = (rotationIndex * Math.PI) / 3;
          this.dummy.rotation.y = randomRotation;
        }
        this.dummy.updateMatrix();

        // Add point icon for this structure (always visible)
        if (this.pointsRenderers) {
          // Use scratch vector for icon position
          this.scratchIconPosition.copy(this.scratchPosition);
          this.scratchIconPosition.y += 2; // Match CSS2D label height

          const renderer = this.getRendererForStructure(structure);
          if (renderer) {
            renderer.setPoint({
              entityId: structure.entityId,
              position: this.scratchIconPosition,
            });
          }
        }

        const entityNumericId = Number(structure.entityId);
        const templates = this.resolveStructureAttachmentsForRender(structure);
        if (templates.length > 0) {
          attachmentRetain.add(entityNumericId);
          const signature = this.getAttachmentSignature(templates);
          const isActive = this.activeStructureAttachmentEntities.has(entityNumericId);
          if (!isActive || this.structureAttachmentSignatures.get(entityNumericId) !== signature) {
            this.attachmentManager.spawnAttachments(entityNumericId, templates);
            this.structureAttachmentSignatures.set(entityNumericId, signature);
            this.activeStructureAttachmentEntities.add(entityNumericId);
          }

          this.tempCosmeticPosition.copy(this.scratchPosition);
          this.tempCosmeticRotation.copy(this.dummy.rotation);

          const baseTransform = {
            position: this.tempCosmeticPosition,
            rotation: this.tempCosmeticRotation,
            scale: this.dummy.scale,
          };

          const mountTransforms = resolveStructureMountTransforms(
            structure.structureType,
            baseTransform,
            this.structureAttachmentTransformScratch,
          );

          this.attachmentManager.updateAttachmentTransforms(entityNumericId, baseTransform, mountTransforms);
        } else if (this.activeStructureAttachmentEntities.has(entityNumericId)) {
          this.attachmentManager.removeAttachments(entityNumericId);
          this.activeStructureAttachmentEntities.delete(entityNumericId);
          this.structureAttachmentSignatures.delete(entityNumericId);
        }

        let modelType = models[structure.stage];
        if (structureType === StructureType.Realm) {
          modelType = models[structure.level];

          // Use tracked count instead of getCount/setCount to avoid repeated needsUpdate calls
          const currentCount = modelInstanceCounts.get(modelType) ?? 0;
          modelType.setMatrixAt(currentCount, this.dummy.matrix);
          modelInstanceCounts.set(modelType, currentCount + 1);
          this.entityIdMaps.get(structureType)!.set(currentCount, structure.entityId);

          if (structure.hasWonder) {
            const wonderModel = models[WONDER_MODEL_INDEX];
            const wonderCount = modelInstanceCounts.get(wonderModel) ?? 0;
            wonderModel.setMatrixAt(wonderCount, this.dummy.matrix);
            modelInstanceCounts.set(wonderModel, wonderCount + 1);
            this.wonderEntityIdMaps.set(wonderCount, structure.entityId);
          }
        } else {
          // Use tracked count instead of getCount/setCount to avoid repeated needsUpdate calls
          const currentCount = modelInstanceCounts.get(modelType) ?? 0;
          modelType.setMatrixAt(currentCount, this.dummy.matrix);
          modelInstanceCounts.set(modelType, currentCount + 1);
          this.entityIdMaps.get(structureType)!.set(currentCount, structure.entityId);
        }
      });

      // Note: setCount will be called once per model after all structures are processed
    }

    // Render structures with cosmetic skins
    for (const [cosmeticId, structures] of structuresByCosmeticId) {
      const models = this.cosmeticStructureModels.get(cosmeticId);

      if (!models || models.length === 0) {
        continue;
      }

      if (!this.cosmeticEntityIdMaps.has(cosmeticId)) {
        this.cosmeticEntityIdMaps.set(cosmeticId, new Map());
      }

      structures.forEach((structure) => {
        visibleStructureIds.add(structure.entityId);
        // Use scratch vector to avoid allocation
        const { col, row } = structure.hexCoords;
        getWorldPositionForHexCoordsInto(col, row, this.scratchPosition);
        this.scratchPosition.y += 0.05;

        const existingLabel = this.entityIdLabels.get(structure.entityId);
        if (existingLabel) {
          this.updateStructureLabelData(structure, existingLabel);
          // Use scratch vector for label position
          getWorldPositionForHexCoordsInto(col, row, this.scratchLabelPosition);
          this.scratchLabelPosition.y += 2;
          existingLabel.position.copy(this.scratchLabelPosition);
        }

        this.dummy.position.copy(this.scratchPosition);

        const rotationSeed = hashCoordinates(col, row);
        const rotationIndex = Math.floor(rotationSeed * 6);
        const randomRotation = (rotationIndex * Math.PI) / 3;
        this.dummy.rotation.y = randomRotation;
        this.dummy.updateMatrix();

        // Add point icon for this structure
        if (this.pointsRenderers) {
          // Use scratch vector for icon position
          this.scratchIconPosition.copy(this.scratchPosition);
          this.scratchIconPosition.y += 2;

          const renderer = this.getRendererForStructure(structure);
          if (renderer) {
            renderer.setPoint({
              entityId: structure.entityId,
              position: this.scratchIconPosition,
            });
          }
        }

        // Handle attachments
        const entityNumericId = Number(structure.entityId);
        const templates = this.resolveStructureAttachmentsForRender(structure);
        if (templates.length > 0) {
          attachmentRetain.add(entityNumericId);
          const signature = this.getAttachmentSignature(templates);
          const isActive = this.activeStructureAttachmentEntities.has(entityNumericId);
          if (!isActive || this.structureAttachmentSignatures.get(entityNumericId) !== signature) {
            this.attachmentManager.spawnAttachments(entityNumericId, templates);
            this.structureAttachmentSignatures.set(entityNumericId, signature);
            this.activeStructureAttachmentEntities.add(entityNumericId);
          }

          this.tempCosmeticPosition.copy(this.scratchPosition);
          this.tempCosmeticRotation.copy(this.dummy.rotation);

          const baseTransform = {
            position: this.tempCosmeticPosition,
            rotation: this.tempCosmeticRotation,
            scale: this.dummy.scale,
          };

          const mountTransforms = resolveStructureMountTransforms(
            structure.structureType,
            baseTransform,
            this.structureAttachmentTransformScratch,
          );

          this.attachmentManager.updateAttachmentTransforms(entityNumericId, baseTransform, mountTransforms);
        } else if (this.activeStructureAttachmentEntities.has(entityNumericId)) {
          this.attachmentManager.removeAttachments(entityNumericId);
          this.activeStructureAttachmentEntities.delete(entityNumericId);
          this.structureAttachmentSignatures.delete(entityNumericId);
        }

        // Cosmetic skins typically have a single model (index 0)
        const model = models[0];
        if (model) {
          // Use tracked count instead of getCount/setCount to avoid repeated needsUpdate calls
          const currentCount = modelInstanceCounts.get(model) ?? 0;
          model.setMatrixAt(currentCount, this.dummy.matrix);
          modelInstanceCounts.set(model, currentCount + 1);
          this.cosmeticEntityIdMaps.get(cosmeticId)!.set(currentCount, structure.entityId);
        }
      });

      // Note: setCount will be called once per model after all structures are processed
    }

    // Batch update: call setCount once per model that was used (triggers needsUpdate + computeBoundingSphere once)
    for (const [model, count] of modelInstanceCounts) {
      model.setCount(count);
    }

    // End batch mode for all point renderers (triggers single computeBoundingSphere per renderer)
    if (this.pointsRenderers) {
      Object.values(this.pointsRenderers).forEach((renderer) => renderer.endBatch());
    }

    if (this.activeStructureAttachmentEntities.size > 0) {
      const toRemove: number[] = [];
      this.activeStructureAttachmentEntities.forEach((entityId) => {
        if (!attachmentRetain.has(entityId)) {
          toRemove.push(entityId);
        }
      });

      toRemove.forEach((entityId) => {
        this.attachmentManager.removeAttachments(entityId);
        this.activeStructureAttachmentEntities.delete(entityId);
        this.structureAttachmentSignatures.delete(entityId);
      });
    }

    const labelsToRemove: ID[] = [];
    for (const entityId of this.entityIdLabels.keys()) {
      if (!visibleStructureIds.has(entityId)) {
        labelsToRemove.push(entityId);
      }
    }

    labelsToRemove.forEach((entityId) => {
      this.removeEntityIdLabel(entityId);
    });

    // Remove points for structures no longer visible (diff-based: O(previously_visible) instead of O(all_structures))
    if (this.pointsRenderers) {
      for (const entityId of this.previousVisibleIds) {
        if (!visibleStructureIds.has(entityId)) {
          // Structure was visible last frame but not anymore - remove its point
          const structure = this.structures.getStructureByEntityId(entityId);
          if (structure) {
            const renderer = this.getRendererForStructure(structure);
            renderer?.removePoint(entityId);
          }
        }
      }
    }

    // Update tracking for next frame's diff
    this.previousVisibleIds = visibleStructureIds;

    this.frustumVisibilityDirty = true;
  }

  private getRendererForStructure(structure: StructureInfo): PointsLabelRenderer | null {
    if (!this.pointsRenderers) return null;

    const { structureType, isMine, isAlly } = structure;

    if (structureType === StructureType.Village) {
      return isMine
        ? this.pointsRenderers.myVillage
        : isAlly
          ? this.pointsRenderers.allyVillage
          : this.pointsRenderers.enemyVillage;
    }
    if (structureType === StructureType.Realm) {
      return isMine
        ? this.pointsRenderers.myRealm
        : isAlly
          ? this.pointsRenderers.allyRealm
          : this.pointsRenderers.enemyRealm;
    }
    if (structureType === StructureType.Hyperstructure) {
      return this.pointsRenderers.hyperstructure;
    }
    if (structureType === StructureType.Bank) {
      return this.pointsRenderers.bank;
    }
    if (structureType === StructureType.FragmentMine) {
      return this.pointsRenderers.fragmentMine;
    }
    return null;
  }

  private getVisibleStructuresForChunk(startRow: number, startCol: number): StructureInfo[] {
    if (this.needsSpatialReindex) {
      this.rebuildSpatialIndex();
    }
    const visibleStructures: StructureInfo[] = [];
    const bounds = this.getChunkBounds(startRow, startCol);

    const minCol = bounds.minCol;
    const maxCol = bounds.maxCol;
    const minRow = bounds.minRow;
    const maxRow = bounds.maxRow;

    const startBucketX = Math.floor(minCol / this.chunkStride);
    const endBucketX = Math.floor(maxCol / this.chunkStride);
    const startBucketY = Math.floor(minRow / this.chunkStride);
    const endBucketY = Math.floor(maxRow / this.chunkStride);

    for (let bx = startBucketX; bx <= endBucketX; bx++) {
      for (let by = startBucketY; by <= endBucketY; by++) {
        const key = `${bx},${by}`;
        const structureIds = this.chunkToStructures.get(key);
        if (structureIds) {
          for (const id of structureIds) {
            const structure = this.structures.getStructureByEntityId(id);
            if (structure && this.isStructureVisible(structure)) {
              visibleStructures.push(structure);
            }
          }
        }
      }
    }

    return visibleStructures;
  }

  private rebuildSpatialIndex() {
    this.chunkToStructures.clear();
    this.structures.getStructures().forEach((structures) => {
      structures.forEach((structure) => {
        this.updateSpatialIndex(structure.entityId, undefined, {
          col: structure.hexCoords.col,
          row: structure.hexCoords.row,
        });
      });
    });
    this.needsSpatialReindex = false;
  }

  private getAttachmentSignature(templates: CosmeticAttachmentTemplate[]): string {
    if (templates.length === 0) {
      return "";
    }
    return templates
      .map((template) => `${template.id}:${template.slot ?? ""}`)
      .sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))
      .join("|");
  }

  private getVisibleStructures(structures: Map<ID, StructureInfo>): StructureInfo[] {
    return Array.from(structures.values()).filter((structure) => this.isStructureVisible(structure));
  }

  private isInCurrentChunk(hexCoords: { col: number; row: number }): boolean {
    const [chunkRow, chunkCol] = this.currentChunk?.split(",").map(Number) || [];
    const bounds = this.getChunkBounds(chunkRow || 0, chunkCol || 0);
    // Use inclusive bounds (<=) to match isStructureVisible behavior
    return (
      hexCoords.col >= bounds.minCol &&
      hexCoords.col <= bounds.maxCol &&
      hexCoords.row >= bounds.minRow &&
      hexCoords.row <= bounds.maxRow
    );
  }

  private isStructureVisible(structure: StructureInfo): boolean {
    if (!this.isInCurrentChunk(structure.hexCoords)) {
      return false;
    }

    // Skip frustum culling during chunk updates - bounds check is sufficient.
    // Frustum culling can fail when the camera is still animating to the new chunk position,
    // causing structures to not appear until the next frame/click.
    // The bounds check already ensures we only render structures in the current chunk area.
    return true;
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
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return undefined;
    }

    // First check the wonder map
    if (structureType === StructureType.Realm) {
      for (const [instanceId, id] of this.wonderEntityIdMaps.entries()) {
        if (id === normalizedEntityId) {
          return instanceId;
        }
      }
    }

    const map = this.entityIdMaps.get(structureType);
    if (!map) return undefined;
    for (const [instanceId, id] of map.entries()) {
      if (id === normalizedEntityId) {
        return instanceId;
      }
    }
    return undefined;
  }

  public setChunkBounds(bounds?: { box: Box3; sphere: Sphere }) {
    this.currentChunkBounds = bounds ?? undefined;
    this.structureModels.forEach((models) => {
      models.forEach((model) => model.setWorldBounds(bounds));
    });
    this.cosmeticStructureModels.forEach((models) => {
      models.forEach((model) => model.setWorldBounds(bounds));
    });
  }

  private isChunkVisible(): boolean {
    if (!this.currentChunkBounds) {
      return true;
    }
    if (this.visibilityManager) {
      return this.visibilityManager.isBoxVisible(this.currentChunkBounds.box);
    }
    if (!this.frustumManager) {
      return true;
    }
    return this.frustumManager.isBoxVisible(this.currentChunkBounds.box);
  }

  updateAnimations(deltaTime: number, visibility?: AnimationVisibilityContext) {
    if (!this.isChunkVisible()) {
      return;
    }

    const context = this.resolveAnimationVisibilityContext(visibility);
    this.structureModels.forEach((models) => {
      models.forEach((model) => model.updateAnimations(deltaTime, context));
    });
    this.cosmeticStructureModels.forEach((models) => {
      models.forEach((model) => model.updateAnimations(deltaTime, context));
    });

    if (this.frustumVisibilityDirty) {
      this.applyFrustumVisibilityToLabels();
      this.frustumVisibilityDirty = false;
    }

    // Flush batched label pool operations to minimize layout thrashing
    this.labelPool.flushBatch();
  }

  private resolveAnimationVisibilityContext(
    provided?: AnimationVisibilityContext,
  ): AnimationVisibilityContext | undefined {
    if (provided) {
      return provided;
    }

    if (!this.hexagonScene) {
      return undefined;
    }

    const camera = this.hexagonScene.getCamera();
    if (!camera) {
      return undefined;
    }

    this.animationCameraPosition.copy(camera.position);

    if (!this.animationVisibilityContext) {
      this.animationVisibilityContext = {
        visibilityManager: this.visibilityManager,
        frustumManager: this.frustumManager,
        cameraPosition: this.animationCameraPosition,
        maxDistance: this.animationCullDistance,
      };
    } else {
      this.animationVisibilityContext.visibilityManager = this.visibilityManager;
      this.animationVisibilityContext.frustumManager = this.frustumManager;
      this.animationVisibilityContext.cameraPosition = this.animationCameraPosition;
      this.animationVisibilityContext.maxDistance = this.animationCullDistance;
    }

    return this.animationVisibilityContext;
  }

  private applyFrustumVisibilityToLabels() {
    this.entityIdLabels.forEach((label) => {
      const isVisible = this.visibilityManager
        ? this.visibilityManager.isPointVisible(label.position)
        : (this.frustumManager?.isPointVisible(label.position) ?? true);
      if (isVisible) {
        if (label.parent !== this.labelsGroup) {
          this.labelsGroup.add(label);
          label.element.style.display = "";

          // Force update data when showing again
          const entityId = label.userData.entityId;
          const structure = this.structures.getStructureByEntityId(entityId);
          if (structure) {
            updateStructureLabel(label.element, structure, this.currentCameraView);
          }
        }
      } else {
        if (label.parent === this.labelsGroup) {
          this.labelsGroup.remove(label);
          label.element.style.display = "none";
        }
      }
    });
  }

  // Label Management Methods
  private addEntityIdLabel(structure: StructureInfo, position: Vector3) {
    console.log("[ADD ENTITY ID LABEL]", { ...structure });
    console.log("[ADD ENTITY ID LABEL] isMine:", structure.isMine, "owner.address:", structure.owner.address);
    const { label } = this.labelPool.acquire(() => {
      const element = createStructureLabel(structure, this.currentCameraView);
      const cssLabel = new CSS2DObject(element);
      cssLabel.userData.baseRenderOrder = cssLabel.renderOrder;
      return cssLabel;
    });

    label.position.copy(position);
    label.position.y += 2;
    label.userData.entityId = structure.entityId;

    this.configureStructureLabelInteractions(label);

    this.entityIdLabels.set(structure.entityId, label);
    this.labelsGroup.add(label);
    this.updateStructureLabelData(structure, label);
    this.frustumVisibilityDirty = true;
  }

  private removeEntityIdLabel(entityId: ID) {
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return;
    }

    const label = this.entityIdLabels.get(normalizedEntityId);
    if (label) {
      this.labelsGroup.remove(label);
      this.labelPool.release(label);
      this.entityIdLabels.delete(normalizedEntityId);
      this.frustumVisibilityDirty = true;
    }
  }

  private configureStructureLabelInteractions(label: CSS2DObject): void {
    const element = label.element as HTMLElement;
    const baseRenderOrder = (label.userData.baseRenderOrder as number | undefined) ?? label.renderOrder;
    label.userData.baseRenderOrder = baseRenderOrder;

    element.onmouseenter = () => {
      label.renderOrder = Infinity;
    };

    element.onmouseleave = () => {
      label.renderOrder = baseRenderOrder;
    };
  }

  public removeLabelsFromScene() {
    this.entityIdLabels.forEach((label) => {
      this.labelsGroup.remove(label);
      this.labelPool.release(label);
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
    this.frustumVisibilityDirty = true;
  }

  public removeLabelsExcept(entityId?: ID) {
    const normalizedEntityId = entityId !== undefined ? normalizeEntityId(entityId) : undefined;
    const labelsToRemove: ID[] = [];

    this.entityIdLabels.forEach((_label, labelEntityId) => {
      if (labelEntityId !== normalizedEntityId) {
        labelsToRemove.push(labelEntityId);
      }
    });

    labelsToRemove.forEach((labelEntityId) => {
      const label = this.entityIdLabels.get(labelEntityId);
      if (!label) {
        return;
      }

      this.labelsGroup.remove(label);
      this.labelPool.release(label);
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
      this.entityIdLabels.delete(labelEntityId);
    });
    this.frustumVisibilityDirty = true;
  }

  public showLabels() {
    // Just update visible structures - this will handle labels appropriately
    // without destroying existing labels and their live data
    this.updateVisibleStructures();
  }

  public showLabel(entityId: ID): void {
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return;
    }

    const structure = this.structures.getStructureByEntityId(normalizedEntityId);
    if (!structure) {
      return;
    }

    const position = getWorldPositionForHex(structure.hexCoords);
    position.y += 0.05;

    const existingLabel = this.entityIdLabels.get(normalizedEntityId);
    if (existingLabel) {
      const newPosition = getWorldPositionForHex(structure.hexCoords);
      newPosition.y += 2;
      existingLabel.position.copy(newPosition);
      this.updateStructureLabelData(structure, existingLabel);

      // Highlight point icon on hover
      if (this.pointsRenderers) {
        const renderer = this.getRendererForStructure(structure);
        if (renderer) {
          renderer.setHover(normalizedEntityId);
        }
      }
      return;
    }

    this.addEntityIdLabel(structure, position);

    // Highlight point icon on hover
    if (this.pointsRenderers) {
      const renderer = this.getRendererForStructure(structure);
      if (renderer) {
        renderer.setHover(normalizedEntityId);
      }
    }
    this.frustumVisibilityDirty = true;
  }

  public hideLabel(entityId: ID): void {
    this.removeEntityIdLabel(entityId);

    // Remove hover highlight from point icon
    if (this.pointsRenderers) {
      Object.values(this.pointsRenderers).forEach((renderer) => renderer.clearHover());
    }
    this.frustumVisibilityDirty = true;
  }

  public hideAllLabels(): void {
    Array.from(this.entityIdLabels.keys()).forEach((structureId) => this.removeEntityIdLabel(structureId));

    // Clear hover highlight from all points
    if (this.pointsRenderers) {
      Object.values(this.pointsRenderers).forEach((renderer) => renderer.clearHover());
    }
    this.frustumVisibilityDirty = true;
  }

  // Relic effect management methods
  public async updateRelicEffects(
    entityId: ID,
    newRelicEffects: Array<{ relicNumber: number; effect: RelicEffect }>,
    relicSource: RelicSource = RelicSource.Guard,
  ) {
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      console.warn("[StructureManager] Received relic effect update without a valid entity id", {
        entityId,
        relicSource,
      });
      return;
    }

    const structure = this.structures.getStructureByEntityId(normalizedEntityId);
    if (!structure) return;

    // Get or create the effects map for this entity
    let entityEffectsMap = this.structureRelicEffects.get(normalizedEntityId);
    if (!entityEffectsMap) {
      entityEffectsMap = new Map();
      this.structureRelicEffects.set(normalizedEntityId, entityEffectsMap);
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
          console.error(
            `Failed to add relic effect ${newEffect.relicNumber} for structure ${normalizedEntityId}:`,
            error,
          );
        }
      }
    }

    // Update the effects for this specific source
    if (newRelicEffects.length === 0) {
      entityEffectsMap.delete(relicSource);
      // If no sources have effects, remove the entity from the main map
      if (entityEffectsMap.size === 0) {
        this.structureRelicEffects.delete(normalizedEntityId);
      }
    } else {
      // Keep existing effects that are still in the new list, add new ones
      const updatedEffects = currentEffects.filter((e) => newRelicNumbers.has(e.relicNumber)).concat(effectsToAdd);
      entityEffectsMap.set(relicSource, updatedEffects);
    }
  }

  public getStructureRelicEffects(entityId: ID): { relicId: number; effect: RelicEffect }[] {
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return [];
    }

    const entityEffectsMap = this.structureRelicEffects.get(normalizedEntityId);
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
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return [];
    }

    const entityEffectsMap = this.structureRelicEffects.get(normalizedEntityId);
    if (!entityEffectsMap) return [];

    const effects = entityEffectsMap.get(relicSource);
    return effects ? effects.map((effect) => ({ relicId: effect.relicNumber, effect: effect.effect })) : [];
  }

  /**
   * Update structure label from guard update (troop count/stamina changes)
   */
  public updateStructureLabelFromStructureUpdate(update: {
    entityId: ID;
    guardArmies: GuardArmy[];
    owner: { address: bigint; ownerName: string; guildName: string };
    battleCooldownEnd: number;
  }): void {
    const entityId = normalizeEntityId(update.entityId);
    if (entityId === undefined) {
      console.warn("[StructureManager] Received structure update without a valid entity id", update);
      return;
    }

    const structure = this.structures.getStructureByEntityId(entityId);
    console.log("[UPDATING STRUCTURE LABEL]", { ...update, entityId });

    // If structure doesn't exist yet, store the update as pending
    if (!structure) {
      const currentTime = Date.now();

      // Check if we already have a pending update for this entity
      const existingPending = this.pendingLabelUpdates.get(entityId);
      const guardArmies = update.guardArmies.map((guard) => ({
        slot: guard.slot,
        category: guard.category,
        tier: guard.tier,
        count: guard.count,
        stamina: guard.stamina,
      }));

      if (!existingPending) {
        // console.log(`[PENDING LABEL UPDATE] Storing new pending structure update for ${entityId}`);
        this.pendingLabelUpdates.set(entityId, {
          guardArmies,
          owner: { ...update.owner },
          timestamp: currentTime,
          updateType: "structure",
          battleCooldownEnd: update.battleCooldownEnd,
          battleTimerLeft: getBattleTimerLeft(update.battleCooldownEnd),
        });
      } else if (currentTime >= existingPending.timestamp) {
        // console.log(`[PENDING LABEL UPDATE] Merging pending structure update for ${entityId}`);
        existingPending.guardArmies = guardArmies;
        existingPending.owner = { ...update.owner };
        existingPending.timestamp = currentTime;
        existingPending.updateType = "structure";
        existingPending.battleCooldownEnd = update.battleCooldownEnd;
        existingPending.battleTimerLeft = getBattleTimerLeft(update.battleCooldownEnd);
        this.pendingLabelUpdates.set(entityId, existingPending);
      } else {
        // console.log(`[PENDING LABEL UPDATE] Ignoring older pending structure update for ${entityId}`);
      }
      return;
    }

    // Log guard troop count diff for battle damage tracking
    if (structure.guardArmies) {
      for (const newGuard of update.guardArmies) {
        const oldGuard = structure.guardArmies.find((g) => g.slot === newGuard.slot);
        if (oldGuard && oldGuard.count !== newGuard.count) {
          const diff = newGuard.count - oldGuard.count;
          const diffSign = diff > 0 ? "+" : "";
          console.log(
            `[TroopCountDiff] Structure #${entityId} Guard Slot ${newGuard.slot} | Previous: ${oldGuard.count} | Current: ${newGuard.count} | Diff: ${diffSign}${diff}`,
          );
        }
      }
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
    structure.battleCooldownEnd = update.battleCooldownEnd;
    structure.battleTimerLeft = getBattleTimerLeft(update.battleCooldownEnd);

    // Track structures with active battle timers for efficient timer updates
    this.updateBattleTimerTracking(entityId, update.battleCooldownEnd);

    this.structures.updateStructure(entityId, structure);

    // Update the label if it exists
    const label = this.entityIdLabels.get(entityId);
    if (label) {
      this.updateStructureLabelData(structure, label);
    }

    // Refresh visible structures to update point icons (e.g., myRealm vs enemyRealm)
    // when ownership changes
    this.updateVisibleStructures();
  }

  /**
   * Update structure battle direction and label
   */
  public updateBattleDirection(entityId: ID, degrees: number | undefined, role: "attacker" | "defender"): void {
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      console.warn("[StructureManager] Received battle direction update without a valid entity id", {
        entityId,
        degrees,
        role,
      });
      return;
    }

    // console.log("[UPDATING BATTLE DEGREES FOR STRUCTURE]", { entityId: normalizedEntityId, degrees, role });
    const structure = this.structures.getStructureByEntityId(normalizedEntityId);
    if (!structure) return;

    // Update degrees based on role
    if (role === "attacker") {
      structure.attackedTowardDegrees = degrees;
    } else {
      structure.attackedFromDegrees = degrees;
    }

    // Update label
    const label = this.entityIdLabels.get(normalizedEntityId);
    if (label) {
      this.updateStructureLabelData(structure, label);
    }
  }

  /**
   * Update structure label from building update (active productions)
   */
  public updateStructureLabelFromBuildingUpdate(update: {
    entityId: ID;
    activeProductions: Array<{ buildingCount: number; buildingType: BuildingType }>;
  }): void {
    const entityId = normalizeEntityId(update.entityId);
    if (entityId === undefined) {
      console.warn("[StructureManager] Received building update without a valid entity id", update);
      return;
    }

    const structure = this.structures.getStructureByEntityId(entityId);

    // If structure doesn't exist yet, store the update as pending
    if (!structure) {
      const currentTime = Date.now();

      // console.log(`[PENDING LABEL UPDATE] Storing pending building update for structure ${entityId}`);

      // Check if there's already a pending update for this structure
      const existingPending = this.pendingLabelUpdates.get(entityId);
      if (existingPending && currentTime >= existingPending.timestamp) {
        // Update the existing pending with new active productions
        existingPending.activeProductions = update.activeProductions;
        existingPending.timestamp = currentTime;
        existingPending.updateType = "building";
      } else if (!existingPending) {
        // Create a new pending update with just the active productions
        this.pendingLabelUpdates.set(entityId, {
          activeProductions: update.activeProductions,
          owner: { address: 0n, ownerName: "", guildName: "" }, // Will be updated when structure is created
          timestamp: currentTime,
          updateType: "building",
        });
      } else {
        // console.log(`[PENDING LABEL UPDATE] Ignoring older pending building update for structure ${entityId}`);
      }
      return;
    }

    // Update cached active productions data
    structure.activeProductions = update.activeProductions;

    // Update the label if it exists
    const label = this.entityIdLabels.get(entityId);
    if (label) {
      this.updateStructureLabelData(structure, label);
    }
  }

  /**
   * Update battle timer tracking for a structure.
   * Adds to or removes from the active timer set based on whether the timer is active.
   */
  private updateBattleTimerTracking(entityId: ID, battleCooldownEnd: number | undefined): void {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const isActive = battleCooldownEnd !== undefined && battleCooldownEnd > currentTimestamp;

    if (isActive) {
      this.structuresWithActiveBattleTimer.add(entityId);
    } else {
      this.structuresWithActiveBattleTimer.delete(entityId);
    }
  }

  /**
   * Start the battle timer update system
   */
  private startBattleTimerUpdates(): void {
    this.battleTimerInterval = setInterval(() => {
      this.recomputeBattleTimersForAllStructures();
    }, 1000);
  }

  /**
   * Update battle timers for structures with active timers and update visible labels.
   * Only iterates structures in structuresWithActiveBattleTimer set (O(active) instead of O(total)).
   */
  private recomputeBattleTimersForAllStructures(): void {
    // Collect expired timers to remove after iteration (can't modify Set while iterating)
    const expiredTimers: ID[] = [];

    for (const entityId of this.structuresWithActiveBattleTimer) {
      const structure = this.structures.getStructureByEntityId(entityId);
      if (!structure) {
        // Structure was removed, clean up tracking
        expiredTimers.push(entityId);
        continue;
      }

      const newBattleTimerLeft = getBattleTimerLeft(structure.battleCooldownEnd);

      // Timer has expired
      if (newBattleTimerLeft === undefined) {
        expiredTimers.push(entityId);
        structure.battleTimerLeft = undefined;

        // Update visible label if it exists
        const label = this.entityIdLabels.get(entityId);
        if (label) {
          this.updateStructureLabelData(structure, label);
        }
        continue;
      }

      // Only update if timer has changed
      if (structure.battleTimerLeft !== newBattleTimerLeft) {
        structure.battleTimerLeft = newBattleTimerLeft;

        // Update visible label if it exists
        const label = this.entityIdLabels.get(entityId);
        if (label) {
          this.updateStructureLabelData(structure, label);
        }
      }
    }

    // Remove expired timers from tracking set
    for (const entityId of expiredTimers) {
      this.structuresWithActiveBattleTimer.delete(entityId);
    }
  }

  /**
   * Update a structure label with fresh data
   */
  private updateStructureLabelData(structure: StructureInfo, existingLabel: CSS2DObject): void {
    // Optimization: Don't update DOM if label is culled/invisible
    if (existingLabel.parent !== this.labelsGroup) {
      return;
    }
    // Update the existing label content in-place with correct camera view
    updateStructureLabel(existingLabel.element, structure, this.currentCameraView);
  }
}

class Structures {
  private structures: Map<StructureType, Map<ID, StructureInfo>> = new Map();

  constructor(
    private readonly onRemove?: (structure: StructureInfo) => void,
    private readonly onStructuresChanged?: () => void,
  ) {}

  addStructure(
    entityId: ID,
    structureName: string,
    structureType: StructureType,
    hexCoords: { col: number; row: number },
    initialized: boolean,
    stage: number = 0,
    level: number = 0,
    owner: { address: bigint; ownerName: string; guildName: string },
    hasWonder: boolean,
    attachments: CosmeticAttachmentTemplate[] | undefined,
    isAlly: boolean,
    guardArmies?: Array<{ slot: number; category: string | null; tier: number; count: number; stamina: number }>,
    activeProductions?: Array<{ buildingCount: number; buildingType: BuildingType }>,
    hyperstructureRealmCount?: number,
    attackedFromDegrees?: number,
    attackedTowardDegrees?: number,
    battleCooldownEnd?: number,
    battleTimerLeft?: number,
  ) {
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      console.warn("[Structures] Attempted to add structure without a valid entity id", {
        entityId,
        structureType,
      });
      return;
    }

    if (!this.structures.has(structureType)) {
      this.structures.set(structureType, new Map());
    }
    this.structures.get(structureType)!.set(normalizedEntityId, {
      entityId: normalizedEntityId,
      structureName,
      hexCoords,
      stage,
      initialized,
      level,
      isMine: isAddressEqualToAccount(owner.address),
      owner,
      structureType,
      hasWonder,
      attachments,
      isAlly,
      // Enhanced data
      guardArmies,
      activeProductions,
      hyperstructureRealmCount,
      // Battle data
      attackedFromDegrees,
      attackedTowardDegrees,
      battleCooldownEnd,
      battleTimerLeft,
    });
  }

  updateStructureStage(entityId: ID, structureType: StructureType, stage: number) {
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return;
    }
    const structure = this.structures.get(structureType)?.get(normalizedEntityId);
    if (structure) {
      structure.stage = stage;
    }
  }

  removeStructureFromPosition(hexCoords: { col: number; row: number }) {
    let removed = false;
    this.structures.forEach((structures) => {
      const removalQueue: ID[] = [];
      structures.forEach((structure, entityId) => {
        if (structure.hexCoords.col === hexCoords.col && structure.hexCoords.row === hexCoords.row) {
          removalQueue.push(entityId);
          this.onRemove?.(structure);
          removed = true;
        }
      });
      removalQueue.forEach((entityId) => structures.delete(entityId));
    });

    if (removed) {
      this.onStructuresChanged?.();
    }
  }

  updateStructure(entityId: ID, structure: StructureInfo) {
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return;
    }
    this.structures.get(structure.structureType)?.set(normalizedEntityId, structure);
  }

  removeStructure(entityId: ID): StructureInfo | null {
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return null;
    }

    let removedStructure: StructureInfo | null = null;

    this.structures.forEach((structures) => {
      const structure = structures.get(normalizedEntityId);
      if (structure) {
        this.onRemove?.(structure);
        structures.delete(normalizedEntityId);
        removedStructure = structure;
      }
    });

    if (removedStructure) {
      this.onStructuresChanged?.();
    }

    return removedStructure;
  }

  getStructures(): Map<StructureType, Map<ID, StructureInfo>> {
    return this.structures;
  }

  getStructureByEntityId(entityId: ID): StructureInfo | undefined {
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return undefined;
    }
    for (const structures of this.structures.values()) {
      const structure = structures.get(normalizedEntityId);
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
