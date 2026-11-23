import { createInstancedMesh } from "../utils/create-instanced-mesh";
import { gltfLoader } from "@/three/utils/utils";
import { FELT_CENTER } from "@/ui/config";
import { SHIP_WORLD_SCALE } from "@/three/characters/ships/ship-design";
import { BiomeType, TroopTier, TroopType } from "@bibliothecadao/types";
import {
  BufferGeometry,
  Color,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Scene,
  Vector3,
} from "three";
import { incrementWorldmapRenderCounter } from "../perf/worldmap-render-diagnostics";
import { createSlotDirtyRange, flushSlotDirtyRange, markSlotDirty } from "../utils/instance-update-ranges";
import { env } from "../../../env";
import { VERBOSE_LOGS_ENABLED } from "@/utils/dev-mode";
import {
  ARMY_PACE_SPEED,
  buildArmyModelAssetPath,
  TROOP_TO_MODEL,
  TROOP_TO_SHIP_MODEL,
  isShipModel,
} from "../constants";
import { ArmyInstanceData, type ArmyPace, ModelData, ModelType, MovementData, SplineMovementData } from "../types/army";
import { getHexForWorldPosition } from "../utils";
import { applyEasing, EasingType } from "../utils/easing";
import { getArmyGroundOffset, groundModelMatrix } from "../utils/model-grounding";
import { MaterialPool } from "../utils/material-pool";
import { MemoryMonitor } from "../utils/memory-monitor";
import { createPooledInstancedMaterial, releasePooledInstancedMaterial } from "./army-model-materials";
import { ArmyContactShadows } from "./army-contact-shadow";
import type { ResolvedCosmeticSkin } from "../cosmetics/types";
import { resolvePrimarySkinGltf } from "../cosmetics/skin-asset-source";
import {
  resolveMovementProgressUpdate,
  resolveRotationUpdate,
  shouldSwitchModelForPosition,
} from "./army-model-behavior-policy";
import {
  buildMovementSpline,
  resolveSplinePosition,
  resolveSplineTangent,
  resolveJourneyProgressUpdate,
  resolveAnticipationScale,
  resolveSettlementOffset,
  resolvePathBankAngle,
  resolveTerrainSpeedMultiplier,
  resolveRhythmicLean,
  resolveArrivalSlamScale,
} from "../utils/spline-path";
import { installArmyModelDebugHooks } from "./army-model-debug-hooks";
import { resolveRenderableBaseModel } from "./army-model-render-policy";
import type { PipelineCompiler } from "../pipeline-compiler";

const MEMORY_MONITORING_ENABLED = env.VITE_PUBLIC_ENABLE_MEMORY_MONITORING;

const flushArmyModelSlotUploads = (modelData: ModelData): void => {
  flushSlotDirtyRange(modelData.dirtySlots, [
    ...modelData.instancedMeshes.flatMap((mesh) => [mesh.instanceMatrix, mesh.instanceColor]),
  ]);
};

/** Bake authored -Z bows into the movement system's +Z forward axis and tile scale. */
function bakeShipWorldScale(scene: Object3D): void {
  const scaled = new Set<BufferGeometry>();
  scene.traverse((child) => {
    if (!(child instanceof Mesh) || scaled.has(child.geometry)) return;
    child.geometry.rotateY(Math.PI);
    child.geometry.scale(SHIP_WORLD_SCALE, SHIP_WORLD_SCALE, SHIP_WORLD_SCALE);
    scaled.add(child.geometry);
  });
}

function isWaterBiome(biome: BiomeType): boolean {
  return biome === BiomeType.Ocean || biome === BiomeType.DeepOcean;
}

/** Unknown troop types or tiers are loud in dev but still render the table's first model rather than nothing. */
function resolveTroopModel(
  table: Record<TroopType, Record<TroopTier, ModelType>>,
  troopType: TroopType,
  troopTier: TroopTier,
  entityId: number,
): ModelType {
  const defaultModel = table[TroopType.Knight][TroopTier.T1];
  const troopModels = table[troopType];
  if (!troopModels) {
    console.warn(
      `[ArmyModel] Unknown troop type "${troopType}" for entity ${entityId}; falling back to ${defaultModel}.`,
    );
    return defaultModel;
  }

  const modelForTier = troopModels[troopTier];
  if (modelForTier) {
    return modelForTier;
  }

  const fallbackModel =
    troopModels[TroopTier.T1] ?? troopModels[TroopTier.T2] ?? troopModels[TroopTier.T3] ?? defaultModel;
  console.warn(
    `[ArmyModel] Unknown troop tier "${troopTier}" for type ${troopType} on entity ${entityId}; using ${fallbackModel}.`,
  );
  return fallbackModel;
}

export class ArmyModel {
  // Core properties
  private readonly scene: Scene;
  private readonly dummyObject: Object3D;
  public readonly loadPromise: Promise<void>;

  // Model and instance management
  private readonly models: Map<ModelType, ModelData> = new Map();
  private readonly pendingModelLoads: Map<ModelType, Promise<ModelData>> = new Map();
  private readonly entityModelMap: Map<number, ModelType> = new Map();
  private readonly movingInstances: Map<number, MovementData> = new Map();
  private readonly instanceData: Map<number, ArmyInstanceData> = new Map();
  private readonly matrixIndexOwners: Map<number, number> = new Map();
  private movementCompleteCallbacks: Map<number, () => void> = new Map();

  // Cosmetic model management
  private readonly cosmeticModels: Map<string, ModelData> = new Map();
  private modelsVisible = true;
  private readonly pendingCosmeticModelLoads: Map<string, Promise<ModelData>> = new Map();
  private readonly entityCosmeticMap: Map<number, string> = new Map(); // entityId -> cosmeticId
  private readonly activeBaseModelByEntity: Map<number, ModelType | null> = new Map();
  private readonly activeCosmeticByEntity: Map<number, string | null> = new Map();
  private readonly hiddenEntityRepresentations = new Set<number>();

  // Reusable objects for matrix operations and memory optimization
  private readonly dummyMatrix: Matrix4 = new Matrix4();
  private readonly dummyEuler: Euler = new Euler();
  private readonly tempVector1: Vector3 = new Vector3();
  private readonly tempVector3: Vector3 = new Vector3();

  private instanceCount = 0;
  private currentVisibleCount: number = 0;
  private readonly freeSlots: number[] = [];
  private readonly freeSlotSet: Set<number> = new Set();
  private nextInstanceIndex = 0;
  private hasPendingBounds = false;

  // Configuration constants
  private readonly SCALE_TRANSITION_SPEED = 5.0;
  private readonly MOVEMENT_SPEED = 3.75;
  private readonly ROTATION_SPEED = 5.0;
  private readonly zeroScale = new Vector3(0, 0, 0);
  private readonly normalScale = new Vector3(1, 1, 1);
  private readonly zeroInstanceMatrix = new Matrix4().makeScale(0, 0, 0);
  // Fixed for the mesh's whole life. The renderer's node pipeline captures
  // instanceMatrix/instanceColor at the mesh's first draw and uploads from the
  // captured objects forever (three r184 InstanceNode) — replacing an attribute
  // to "grow" it permanently freezes the mesh on the GPU while CPU reads stay
  // correct. So capacity is sized to the army cap up front and never resized;
  // ~76KB per mesh buys the invariant.
  private readonly ARMY_INSTANCE_CAPACITY = 1024;

  // Spline-based movement
  private readonly USE_SPLINE_MOVEMENT = true;
  private readonly splineMovingInstances: Map<number, SplineMovementData> = new Map();

  private groundBiomeForHex(col: number, row: number): BiomeType {
    return this.groundBiomeAt(col + FELT_CENTER(), row + FELT_CENTER());
  }

  private hasWarnedInstanceCapacityOverflow = false;
  private readonly shadows: ArmyContactShadows;

  // Memory monitoring
  private memoryMonitor?: MemoryMonitor;

  // Material sharing
  private static materialPool = MaterialPool.getInstance();

  // Movement easing configuration
  private defaultEasingType: EasingType = EasingType.EaseOut;
  private tierEasingMap: Map<TroopTier, EasingType> = new Map([
    ["T1" as TroopTier, EasingType.EaseOut],
    ["T2" as TroopTier, EasingType.EaseOutCubic],
    ["T3" as TroopTier, EasingType.EaseOutQuart],
  ]);

  constructor(
    scene: Scene,
    /** The biome an army stands on at contract coordinates: its tile's stored biome (see ArmyManager). */
    private readonly groundBiomeAt: (col: number, row: number) => BiomeType,
    private readonly compilePipelines?: PipelineCompiler,
  ) {
    this.scene = scene;
    this.shadows = new ArmyContactShadows(this.ARMY_INSTANCE_CAPACITY);
    scene.add(this.shadows.mesh);
    this.dummyObject = new Object3D();
    this.loadPromise = Promise.resolve();

    // Initialize memory monitor for army model operations
    if (MEMORY_MONITORING_ENABLED) {
      this.memoryMonitor = new MemoryMonitor({
        spikeThresholdMB: 20, // Lower threshold for model operations
        onMemorySpike: (spike) => {
          if (VERBOSE_LOGS_ENABLED) {
            console.warn(`🪖  Army Model Memory Spike: +${spike.increaseMB.toFixed(1)}MB in ${spike.context}`);
          }
        },
      });
    }
  }

  private async ensureModel(modelType: ModelType): Promise<ModelData> {
    if (this.models.has(modelType)) {
      return this.models.get(modelType)!;
    }

    let pending = this.pendingModelLoads.get(modelType);
    if (pending) {
      return pending;
    }

    const assetPath = buildArmyModelAssetPath(modelType);

    pending = new Promise<ModelData>((resolve, reject) => {
      gltfLoader.load(
        assetPath,
        async (gltf) => {
          try {
            if (isShipModel(modelType)) bakeShipWorldScale(gltf.scene);
            const modelData = this.createModelData(gltf, true);
            await this.compilePipelines?.(modelData.group, this.scene);
            this.scene.add(modelData.group);
            this.models.set(modelType, modelData);
            this.reapplyInstancesForModel(modelType, modelData);
            resolve(modelData);
          } catch (error) {
            reject(error as Error);
          }
        },
        undefined,
        (error) => reject(error),
      );
    }).finally(() => {
      this.pendingModelLoads.delete(modelType);
    });

    this.pendingModelLoads.set(modelType, pending);
    return pending;
  }

  /**
   * Ensures a cosmetic model is loaded by cosmeticId and asset path.
   */
  private async ensureCosmeticModel(skin: ResolvedCosmeticSkin): Promise<ModelData> {
    const { cosmeticId, assetPaths, registryEntry } = skin;
    if (this.cosmeticModels.has(cosmeticId)) {
      return this.cosmeticModels.get(cosmeticId)!;
    }

    let pending = this.pendingCosmeticModelLoads.get(cosmeticId);
    if (pending) {
      return pending;
    }

    pending = new Promise<ModelData>((resolve, reject) => {
      void resolvePrimarySkinGltf({
        cosmeticId,
        assetPath: assetPaths[0] ?? "",
        registryEntry,
      })
        .then(async (gltf) => {
          const modelData = this.createModelData(gltf, false);
          await this.compilePipelines?.(modelData.group, this.scene);
          this.scene.add(modelData.group);
          this.cosmeticModels.set(cosmeticId, modelData);
          this.reapplyInstancesForCosmeticModel(cosmeticId, modelData);
          resolve(modelData);
        })
        .catch((error) => {
          console.error(`[ArmyModel] Failed to load cosmetic model ${cosmeticId}:`, error);
          reject(error);
        });
    }).finally(() => {
      this.pendingCosmeticModelLoads.delete(cosmeticId);
    });

    this.pendingCosmeticModelLoads.set(cosmeticId, pending);
    return pending;
  }

  private reapplyInstancesForCosmeticModel(cosmeticId: string, modelData: ModelData): void {
    this.instanceData.forEach((instance, entityId) => {
      if (this.entityCosmeticMap.get(entityId) !== cosmeticId) {
        return;
      }
      if (instance.matrixIndex === undefined) {
        return;
      }
      const position = instance.position;
      const scale = instance.scale;
      const rotation = instance.rotation;
      const color = instance.color;

      if (!position || !scale) {
        return;
      }

      this.updateInstance(entityId, instance.matrixIndex, position, scale, rotation, color);
    });

    this.syncModelDrawCount(modelData);
  }

  private reapplyInstancesForModel(modelType: ModelType, modelData: ModelData): void {
    this.instanceData.forEach((instance, entityId) => {
      if (this.entityModelMap.get(entityId) !== modelType) {
        return;
      }
      if (instance.matrixIndex === undefined) {
        return;
      }
      const position = instance.position;
      const scale = instance.scale;
      const rotation = instance.rotation;
      const color = instance.color;

      if (!position || !scale) {
        return;
      }

      this.updateInstance(entityId, instance.matrixIndex, position, scale, rotation, color);
    });

    this.syncModelDrawCount(modelData);
  }

  /**
   * Keep draw counts in sync after async model load replays instance state.
   * Without this, meshes can stay hidden until the next explicit visibility sync.
   */
  private syncModelDrawCount(modelData: ModelData): void {
    const drawCount = this.getModelDrawCount(modelData);
    modelData.instancedMeshes.forEach((mesh) => {
      mesh.count = drawCount;
    });
  }

  /**
   * Ensure a model's draw count covers a freshly added instance slot.
   *
   * `mesh.count` only draws slots in [0, count). `updateInstance` can move an
   * entity onto a different (already-loaded) model mid-move — e.g. a biome
   * switch to a ship over water — by adding its slot to that model's
   * `activeInstances` without `setVisibleSlots`/`syncModelDrawCount` running.
   * Without bumping the count here the slot stays >= count and the model is not
   * drawn (while the entity's label, keyed by entityId, keeps following). This
   * is an O(1) additive guard; `setVisibleSlots`/`getModelDrawCount` remains the
   * authoritative recompactor on removal/compaction (which may shrink count).
   */
  private extendModelDrawCount(modelData: ModelData, index: number): void {
    const minCount = index + 1;
    modelData.instancedMeshes.forEach((mesh) => {
      if (mesh.count < minCount) {
        mesh.count = minCount;
      }
    });
  }

  private createModelData(gltf: any, ownsGeometry: boolean = true): ModelData {
    const group = new Group();
    const instancedMeshes: InstancedMesh[] = [];

    this.processGLTFScene(gltf, group, instancedMeshes);

    group.visible = this.modelsVisible;

    return {
      group,
      instancedMeshes,
      activeInstances: new Set(),
      dirtySlots: createSlotDirtyRange(),
      ownsGeometry,
    };
  }

  private processGLTFScene(gltf: any, group: Group, instancedMeshes: InstancedMesh[]): void {
    let meshIndex = 0;

    gltf.scene.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        const instancedMesh = this.createInstancedMesh(child, meshIndex);
        group.add(instancedMesh);
        instancedMeshes.push(instancedMesh);
        meshIndex++;
      }
    });
  }

  private createInstancedMesh(mesh: Mesh, meshIndex: number): InstancedMesh {
    const pooledMaterial = createPooledInstancedMaterial(mesh.material);
    const instancedMesh = createInstancedMesh(mesh.geometry, pooledMaterial.material, this.ARMY_INSTANCE_CAPACITY);

    instancedMesh.frustumCulled = true;
    instancedMesh.userData.gameEndFrost = true;
    instancedMesh.castShadow = true;
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.renderOrder = 10 + meshIndex;
    if (pooledMaterial.usesInstanceColor) {
      instancedMesh.instanceColor = new InstancedBufferAttribute(new Float32Array(this.ARMY_INSTANCE_CAPACITY * 3), 3);
      instancedMesh.instanceColor.needsUpdate = true;
    }

    instancedMesh.count = 0;
    return instancedMesh;
  }

  // Buffers are never grown (see ARMY_INSTANCE_CAPACITY) — an out-of-range slot
  // is a bug in the slot allocator or an army count past the game cap. Refuse
  // the write loudly instead of silently truncating into a TypedArray no-op.
  private guardInstanceCapacity(requiredCount: number): boolean {
    if (requiredCount <= this.ARMY_INSTANCE_CAPACITY) {
      return true;
    }
    incrementWorldmapRenderCounter("armyInstanceCapacityOverflow");
    if (!this.hasWarnedInstanceCapacityOverflow) {
      this.hasWarnedInstanceCapacityOverflow = true;
      console.error(
        `[ArmyModel] instance slot ${requiredCount - 1} exceeds the fixed capacity ${this.ARMY_INSTANCE_CAPACITY}; refusing the write`,
      );
    }
    return false;
  }

  private clearInstanceSlot(matrixIndex: number): void {
    const entityId = this.matrixIndexOwners.get(matrixIndex);

    if (entityId !== undefined) {
      this.clearKnownOwnerSlot(entityId, matrixIndex);
    } else {
      this.clearSlotFromEveryRenderable(matrixIndex);
    }

    this.shadows.clear(matrixIndex);
  }

  private clearKnownOwnerSlot(entityId: number, matrixIndex: number): void {
    this.clearActiveBaseModelSlot(entityId, matrixIndex);
    this.clearActiveCosmeticModelSlot(entityId, matrixIndex);
    this.clearStaleRenderableSlotMemberships(matrixIndex);
  }

  private clearActiveBaseModelSlot(entityId: number, matrixIndex: number): void {
    const activeBaseModel = this.activeBaseModelByEntity.get(entityId);
    if (!activeBaseModel) {
      return;
    }

    const modelData = this.models.get(activeBaseModel);
    if (!modelData) {
      return;
    }

    modelData.activeInstances.delete(matrixIndex);
    this.clearModelSlot(modelData, matrixIndex);
  }

  private clearActiveCosmeticModelSlot(entityId: number, matrixIndex: number): void {
    const activeCosmetic = this.activeCosmeticByEntity.get(entityId);
    if (!activeCosmetic) {
      return;
    }

    const cosmeticData = this.cosmeticModels.get(activeCosmetic);
    if (!cosmeticData) {
      return;
    }

    cosmeticData.activeInstances.delete(matrixIndex);
    this.clearModelSlot(cosmeticData, matrixIndex);
  }

  private clearStaleRenderableSlotMemberships(matrixIndex: number): void {
    this.models.forEach((modelData) => {
      this.clearModelSlotIfActive(modelData, matrixIndex);
    });
    this.cosmeticModels.forEach((modelData) => {
      this.clearModelSlotIfActive(modelData, matrixIndex);
    });
  }

  private clearSlotFromEveryRenderable(matrixIndex: number): void {
    this.models.forEach((modelData) => {
      modelData.activeInstances.delete(matrixIndex);
      this.clearModelSlot(modelData, matrixIndex);
    });
    this.cosmeticModels.forEach((modelData) => {
      modelData.activeInstances.delete(matrixIndex);
      this.clearModelSlot(modelData, matrixIndex);
    });
  }

  private clearModelSlotIfActive(modelData: ModelData, matrixIndex: number): void {
    if (!modelData.activeInstances.has(matrixIndex)) {
      return;
    }

    modelData.activeInstances.delete(matrixIndex);
    this.clearModelSlot(modelData, matrixIndex);
  }

  /**
   * Helper to clear a single slot from a model's meshes
   */
  private clearModelSlot(modelData: ModelData, matrixIndex: number): void {
    modelData.instancedMeshes.forEach((mesh) => {
      mesh.setMatrixAt(matrixIndex, this.zeroInstanceMatrix);
      mesh.userData.entityIdMap?.delete(matrixIndex);
    });
    markSlotDirty(modelData.dirtySlots, matrixIndex);
  }

  // Instance Management Methods
  public async preloadModels(modelTypes: Iterable<ModelType>): Promise<void> {
    const loads: Promise<ModelData>[] = [];
    for (const type of modelTypes) {
      loads.push(this.ensureModel(type));
    }
    if (loads.length === 0) {
      return;
    }
    try {
      await Promise.all(loads);
    } catch (error) {
      console.error("Failed to preload army models", error);
    }
  }

  public assignModelToEntity(entityId: number, modelType: ModelType): void {
    const oldModelType = this.entityModelMap.get(entityId);
    if (oldModelType === modelType) return;
    this.entityModelMap.set(entityId, modelType);
    void this.ensureModel(modelType).catch((error) => {
      console.error(`Failed to load model for ${modelType}`, error);
    });
  }

  /**
   * Preloads a cosmetic model by ID and asset path.
   */
  public async preloadCosmeticModel(skin: ResolvedCosmeticSkin): Promise<void> {
    try {
      await this.ensureCosmeticModel(skin);
    } catch (error) {
      console.error(`Failed to preload cosmetic model ${skin.cosmeticId}`, error);
    }
  }

  /**
   * Assigns a cosmetic model to an entity. This takes precedence over the base ModelType.
   */
  public assignCosmeticToEntity(entityId: number, skin: ResolvedCosmeticSkin): void {
    const { cosmeticId } = skin;
    const oldCosmeticId = this.entityCosmeticMap.get(entityId);
    if (oldCosmeticId === cosmeticId) return;
    this.entityCosmeticMap.set(entityId, cosmeticId);
    void this.ensureCosmeticModel(skin).catch((error) => {
      console.error(`Failed to load cosmetic model ${cosmeticId}`, error);
    });
  }

  /**
   * Clears cosmetic assignment for an entity, falling back to base ModelType.
   */
  public clearCosmeticForEntity(entityId: number): void {
    const cosmeticKey = this.entityCosmeticMap.get(entityId);
    if (cosmeticKey) {
      const instanceInfo = this.instanceData.get(entityId);
      if (instanceInfo && instanceInfo.matrixIndex !== undefined) {
        const cosmeticData = this.cosmeticModels.get(cosmeticKey);
        if (cosmeticData) {
          cosmeticData.activeInstances.delete(instanceInfo.matrixIndex);
          this.clearModelSlot(cosmeticData, instanceInfo.matrixIndex);
        }
      }
    }
    this.entityCosmeticMap.delete(entityId);
  }

  /**
   * Checks if an entity has a cosmetic model assigned.
   */
  public hasCosmeticModel(entityId: number): boolean {
    const cosmeticId = this.entityCosmeticMap.get(entityId);
    return cosmeticId !== undefined && this.cosmeticModels.has(cosmeticId);
  }

  public getModelForEntity(entityId: number): ModelData | undefined {
    // Check for cosmetic model first
    const cosmeticId = this.entityCosmeticMap.get(entityId);
    if (cosmeticId) {
      const cosmeticModel = this.cosmeticModels.get(cosmeticId);
      if (cosmeticModel) {
        return cosmeticModel;
      }
    }
    // Fall back to base model
    const modelType = this.entityModelMap.get(entityId);
    if (!modelType) return undefined;
    return this.models.get(modelType);
  }

  public getAssignedModelType(entityId: number): ModelType | undefined {
    return this.entityModelMap.get(entityId);
  }

  // The single source of truth for an entity's live instance slot. Callers
  // (e.g. the army-manager move path) must consult this rather than a cached
  // mirror, so a stale mirror can never relocate the unit onto the wrong slot.
  public getEntitySlot(entityId: number): number | undefined {
    return this.instanceData.get(entityId)?.matrixIndex;
  }

  public allocateInstanceSlot(entityId: number): number {
    const existingSlot = this.instanceData.get(entityId)?.matrixIndex;
    if (existingSlot !== undefined) {
      this.matrixIndexOwners.set(existingSlot, entityId);
      return existingSlot;
    }

    const reusedSlot = this.freeSlots.pop();
    const slot = reusedSlot !== undefined ? reusedSlot : this.nextInstanceIndex++;
    if (reusedSlot !== undefined) {
      this.freeSlotSet.delete(reusedSlot);
    }
    this.matrixIndexOwners.set(slot, entityId);
    return slot;
  }

  public freeInstanceSlot(entityId: number, slot?: number): void {
    const instanceData = this.instanceData.get(entityId);
    const resolvedSlot = slot ?? instanceData?.matrixIndex;
    if (resolvedSlot === undefined) {
      return;
    }

    this.clearMovementState(entityId);
    this.clearInstanceSlot(resolvedSlot);
    this.matrixIndexOwners.delete(resolvedSlot);

    // Detach the entity from the freed slot up front. If the slot is already
    // pooled we early-return below; leaving instanceData.matrixIndex pointing at
    // a pooled slot lets a later allocateInstanceSlot hand that (reused) slot
    // back and share it between two entities — a ghost. Only clear when we are
    // freeing the entity's *current* slot.
    if (instanceData && instanceData.matrixIndex === resolvedSlot) {
      instanceData.matrixIndex = undefined;
    }

    if (this.freeSlotSet.has(resolvedSlot)) return;

    this.freeSlotSet.add(resolvedSlot);
    this.freeSlots.push(resolvedSlot);
  }

  // Returns the entity's resulting live slot so callers can mirror EXACTLY what
  // the model did: the new slot on a real move, the current slot on a no-op, or
  // undefined when the entity has no live slot (nothing to mirror). Mirroring a
  // planned slot the model declined to take is what strands ghosts.
  public moveInstanceSlot(entityId: number, newSlot: number): number | undefined {
    const instanceData = this.instanceData.get(entityId);
    const previousSlot = instanceData?.matrixIndex;
    if (!instanceData || previousSlot === undefined) {
      return undefined;
    }
    if (previousSlot === newSlot) {
      return previousSlot;
    }

    this.takeFreedSlot(newSlot);
    this.updateInstance(
      entityId,
      newSlot,
      instanceData.position,
      instanceData.scale,
      instanceData.rotation,
      instanceData.color,
    );
    this.clearInstanceSlot(previousSlot);
    this.matrixIndexOwners.delete(previousSlot);
    instanceData.matrixIndex = newSlot;
    return newSlot;
  }

  private takeFreedSlot(slot: number): void {
    if (!this.freeSlotSet.has(slot)) {
      return;
    }

    this.freeSlotSet.delete(slot);
    const freeSlotIndex = this.freeSlots.indexOf(slot);
    if (freeSlotIndex !== -1) {
      this.freeSlots.splice(freeSlotIndex, 1);
    }
  }

  public updateInstance(
    entityId: number,
    index: number,
    position: Vector3,
    scale: Vector3,
    rotation?: Euler,
    color?: Color,
  ): void {
    if (!this.guardInstanceCapacity(index + 1)) {
      return;
    }
    const previousOwner = this.matrixIndexOwners.get(index);
    if (import.meta.env?.DEV && previousOwner !== undefined && previousOwner !== entityId) {
      console.warn(`[ArmyModel] Matrix slot ${index} reassigned from entity ${previousOwner} to ${entityId}.`);
    }
    this.matrixIndexOwners.set(index, entityId);

    const state = this.storeInstanceState(entityId, index, position, scale, rotation, color);
    this.placeShadow(index, state);

    const desiredModelType = this.entityModelMap.get(entityId) ?? null;
    const desiredCosmeticId = this.entityCosmeticMap.get(entityId);
    const hasActiveCosmetic = desiredCosmeticId !== undefined && this.cosmeticModels.has(desiredCosmeticId);

    const previousRenderableModel = this.activeBaseModelByEntity.get(entityId) ?? null;
    const activeBaseModel = resolveRenderableBaseModel({
      hasActiveCosmetic,
      desiredModel: desiredModelType,
      previousRenderableModel,
      isDesiredModelLoaded: desiredModelType !== null && this.models.has(desiredModelType),
      isPreviousModelLoaded: previousRenderableModel !== null && this.models.has(previousRenderableModel),
    });
    const activeCosmetic = hasActiveCosmetic ? desiredCosmeticId! : null;

    const prevActiveBaseModel = previousRenderableModel;
    const prevActiveCosmetic = this.activeCosmeticByEntity.get(entityId) ?? null;

    if (prevActiveBaseModel !== activeBaseModel) {
      if (prevActiveBaseModel) {
        const prevModelData = this.models.get(prevActiveBaseModel);
        if (prevModelData) {
          // Remove from previous model's active instances
          prevModelData.activeInstances.delete(index);
          this.updateInstanceTransform(state.position, this.zeroScale, state.rotation);
          this.updateInstanceMeshes(prevModelData, index, entityId, state.position, state.color);
        }
      }
      this.activeBaseModelByEntity.set(entityId, activeBaseModel);
    }

    if (prevActiveCosmetic !== activeCosmetic) {
      if (prevActiveCosmetic) {
        const prevCosmeticData = this.cosmeticModels.get(prevActiveCosmetic);
        if (prevCosmeticData) {
          // Remove from previous cosmetic's active instances
          prevCosmeticData.activeInstances.delete(index);
          this.updateInstanceTransform(state.position, this.zeroScale, state.rotation);
          this.updateInstanceMeshes(prevCosmeticData, index, entityId, state.position, state.color);
        }
      }
      this.activeCosmeticByEntity.set(entityId, activeCosmetic);
    }

    this.clearInactiveRenderableSlotMemberships(index, activeBaseModel, activeCosmetic);

    if (activeBaseModel) {
      const modelData = this.models.get(activeBaseModel);
      if (modelData) {
        this.syncRenderableInstance(modelData, state, index, entityId, this.normalScale);
      }
    }

    if (activeCosmetic) {
      const cosmeticData = this.cosmeticModels.get(activeCosmetic);
      if (cosmeticData) {
        this.syncRenderableInstance(cosmeticData, state, index, entityId, this.normalScale);
      }
    }
  }

  private placeShadow(slot: number, state: ArmyInstanceData): void {
    if (state.scale.x === 0 && state.scale.z === 0) {
      this.shadows.clear(slot);
      return;
    }
    this.shadows.place(slot, state.position);
  }

  private syncRenderableInstance(
    modelData: ModelData,
    state: ArmyInstanceData,
    index: number,
    entityId: number,
    visibleScale: Vector3,
  ): void {
    if (this.hiddenEntityRepresentations.has(entityId)) {
      if (modelData.activeInstances.delete(index)) {
        this.clearModelSlot(modelData, index);
        this.syncModelDrawCount(modelData);
      }
      return;
    }

    modelData.activeInstances.add(index);
    this.updateInstanceTransform(state.position, visibleScale, state.rotation);
    this.updateInstanceMeshes(modelData, index, entityId, state.position, state.color);
    // Bump count so the just-added slot draws now, not only after the next
    // setVisibleSlots (see extendModelDrawCount).
    this.extendModelDrawCount(modelData, index);
  }

  private clearInactiveRenderableSlotMemberships(
    index: number,
    activeBaseModel: ModelType | null,
    activeCosmetic: string | null,
  ): void {
    this.models.forEach((modelData, modelType) => {
      if (modelType === activeBaseModel) {
        return;
      }
      this.clearModelSlotIfActive(modelData, index);
    });
    this.cosmeticModels.forEach((modelData, cosmeticId) => {
      if (cosmeticId === activeCosmetic) {
        return;
      }
      this.clearModelSlotIfActive(modelData, index);
    });
  }

  public releaseEntity(entityId: number, freedSlot?: number): void {
    this.freeInstanceSlot(entityId, freedSlot);
    // Defensive: freeInstanceSlot keys off instanceData.matrixIndex. If that was
    // already detached (a desync) while a slot still drew this entity, the slot
    // would render forever as a ghost with no label. Sweep matrixIndexOwners for
    // any slot still mapped to this entity and hard-clear it.
    this.purgeOwnedSlotsForEntity(entityId);
    this.instanceData.delete(entityId);
    this.entityModelMap.delete(entityId);
    this.entityCosmeticMap.delete(entityId);
    this.activeBaseModelByEntity.delete(entityId);
    this.activeCosmeticByEntity.delete(entityId);
    this.hiddenEntityRepresentations.delete(entityId);
    this.movementCompleteCallbacks.delete(entityId);
  }

  /** Hard-clear a single slot across every renderable, drop its ownership, and pool it. */
  public purgeDrawnSlot(slot: number): void {
    this.clearMovementStateForSlot(slot);
    this.clearSlotFromEveryRenderable(slot);
    this.shadows.clear(slot);
    this.matrixIndexOwners.delete(slot);
    if (!this.freeSlotSet.has(slot)) {
      this.freeSlotSet.add(slot);
      this.freeSlots.push(slot);
    }
  }

  private purgeOwnedSlotsForEntity(entityId: number): void {
    const leaked: number[] = [];
    this.matrixIndexOwners.forEach((owner, slot) => {
      if (owner === entityId) {
        leaked.push(slot);
      }
    });
    for (const slot of leaked) {
      this.purgeDrawnSlot(slot);
    }
  }

  private clearMovementStateForSlot(slot: number): void {
    const owner = this.matrixIndexOwners.get(slot);
    if (owner !== undefined) {
      this.clearMovementState(owner);
    }
  }

  /**
   * Slots the GPU is actually drawing (present in a model's activeInstances AND
   * within that mesh's draw count), paired with their recorded owner entity.
   * Used by the render-integrity auditor/heal to spot orphaned ghost slots.
   */
  public collectDrawnSlotOwners(): Array<{ slot: number; owner: number | undefined }> {
    const seen = new Set<number>();
    const result: Array<{ slot: number; owner: number | undefined }> = [];
    const collect = (models: Iterable<ModelData>) => {
      for (const modelData of models) {
        const count = modelData.instancedMeshes[0]?.count ?? 0;
        modelData.activeInstances.forEach((slot) => {
          if (slot < count && !seen.has(slot)) {
            seen.add(slot);
            result.push({ slot, owner: this.matrixIndexOwners.get(slot) });
          }
        });
      }
    };
    collect(this.models.values());
    collect(this.cosmeticModels.values());
    return result;
  }

  /**
   * The translation the GPU is actually drawing for a slot, read from the
   * instance matrix of the first model holding it. This is deliberately NOT
   * instanceData.position — comparing the two is how the render-integrity
   * auditor detects a stale matrix (model on the old hex, label on the new).
   */
  public getDrawnSlotPosition(slot: number): Vector3 | undefined {
    const read = (models: Iterable<ModelData>): Vector3 | undefined => {
      for (const modelData of models) {
        if (!modelData.activeInstances.has(slot)) continue;
        const mesh = modelData.instancedMeshes[0];
        if (!mesh || slot >= mesh.count) continue;
        mesh.getMatrixAt(slot, this.dummyMatrix);
        return new Vector3().setFromMatrixPosition(this.dummyMatrix);
      }
      return undefined;
    };
    return read(this.models.values()) ?? read(this.cosmeticModels.values());
  }

  /** True when the entity's slot is present and drawn in its active base or cosmetic model. */
  public isEntityDrawn(entityId: number): boolean {
    const slot = this.instanceData.get(entityId)?.matrixIndex;
    if (slot === undefined) {
      return false;
    }
    const drawnIn = (modelData: ModelData | undefined): boolean => {
      if (!modelData || !modelData.activeInstances.has(slot)) {
        return false;
      }
      const count = modelData.instancedMeshes[0]?.count ?? 0;
      return slot < count;
    };
    const baseType = this.activeBaseModelByEntity.get(entityId);
    if (baseType && drawnIn(this.models.get(baseType))) {
      return true;
    }
    const cosmeticId = this.activeCosmeticByEntity.get(entityId);
    if (cosmeticId && drawnIn(this.cosmeticModels.get(cosmeticId))) {
      return true;
    }
    return false;
  }

  private storeInstanceState(
    entityId: number,
    matrixIndex: number,
    position: Vector3,
    scale: Vector3,
    rotation?: Euler,
    color?: Color,
  ): ArmyInstanceData {
    let state = this.instanceData.get(entityId);
    if (!state) {
      state = {
        entityId,
        position: position.clone(),
        scale: scale.clone(),
        isMoving: false,
        matrixIndex,
      };
      this.instanceData.set(entityId, state);
    } else {
      state.position.copy(position);
      state.scale.copy(scale);
      state.matrixIndex = matrixIndex;
    }

    if (rotation) {
      state.rotation = state.rotation ? state.rotation.copy(rotation) : rotation.clone();
    } else {
      state.rotation = undefined;
    }

    if (color) {
      state.color = state.color ? state.color.copy(color) : color.clone();
    }

    state.matrixIndex = matrixIndex;
    return state;
  }

  private updateInstanceTransform(position: Vector3, scale: Vector3, rotation?: Euler): void {
    this.dummyObject.position.copy(position);
    this.dummyObject.scale.copy(scale);
    if (rotation) {
      this.dummyObject.rotation.copy(rotation);
    }
    this.dummyObject.updateMatrix();
  }

  private updateInstanceMeshes(
    modelData: ModelData,
    index: number,
    entityId: number,
    position: Vector3,
    color?: Color,
  ): void {
    groundModelMatrix(
      this.dummyObject.matrix,
      getArmyGroundOffset(
        modelData.instancedMeshes,
        this.activeBaseModelByEntity.get(entityId) ?? this.entityModelMap.get(entityId),
      ),
    );
    modelData.instancedMeshes.forEach((mesh) => {
      mesh.setMatrixAt(index, this.dummyObject.matrix);

      if (color && mesh.instanceColor) {
        mesh.setColorAt(index, color);
      }

      mesh.userData.entityIdMap = mesh.userData.entityIdMap || new Map<number, number>();
      mesh.userData.entityIdMap.set(index, entityId);
    });

    markSlotDirty(modelData.dirtySlots, index);
  }

  // Movement Methods
  public startMovement(
    entityId: number,
    path: Vector3[],
    matrixIndex: number,
    category: TroopType,
    tier: TroopTier,
    pace: ArmyPace,
  ): void {
    if (path.length < 2) return;

    const memoryMeasurement = this.memoryMonitor?.beginScopedMeasurement(`startMovement-${entityId}`, 5);

    // Log material sharing stats periodically (every 10th movement)
    if (entityId % 10 === 0) {
      ArmyModel.materialPool.logSharingStats();
    }

    this.stopMovement(entityId);
    const [currentPos, nextPos] = [path[0], path[1]];

    // instanceData.matrixIndex is the single source of truth for an entity's
    // live slot. The caller-supplied slot is only a fallback for an entity that
    // has no instance yet — trusting it blindly lets a stale army-manager mirror
    // relocate the unit onto the wrong slot and strand a frozen ghost at the old
    // one (the reported "duplicate at the old position after a move").
    const liveSlot = this.instanceData.get(entityId)?.matrixIndex ?? matrixIndex;
    this.initializeMovement(entityId, currentPos, nextPos, path, liveSlot, category, tier);
    this.updateInstanceDirection(entityId, currentPos, nextPos);

    // Build spline for smooth whole-path movement
    if (this.USE_SPLINE_MOVEMENT && path.length >= 2) {
      const spline = buildMovementSpline(path);
      const totalLength = spline.getLength();

      // Get current rotation from the movement data we just created
      const movement = this.movingInstances.get(entityId);
      const currentRotation = movement?.currentRotation ?? 0;

      // Determine easing type based on tier
      const easingType = this.getSplineEasingType(tier);

      this.splineMovingInstances.set(entityId, {
        spline,
        totalLength,
        journeyProgress: 0,
        currentRotation,
        easingType,
        anticipationTimer: 0,
        settlementTimer: 0,
        isAnticipating: true,
        isSettling: false,
        finalTangent: null,
        currentSpeedMultiplier: 1.0,
        pace,
        elapsedTime: 0,
        arrivalSlamTimer: 0,
        isArrivalSlamming: false,
        endpointCache: new Vector3(),
      });
    }

    if (memoryMeasurement) {
      this.memoryMonitor?.finishScopedMeasurement(memoryMeasurement);
    }
  }

  private initializeMovement(
    entityId: number,
    currentPos: Vector3,
    nextPos: Vector3,
    path: Vector3[],
    matrixIndex: number,
    category: TroopType,
    tier: TroopTier,
  ): void {
    this.instanceData.set(entityId, {
      entityId,
      position: new Vector3().copy(currentPos), // Create once per army
      scale: new Vector3().copy(this.normalScale), // Create once per army
      isMoving: true,
      matrixIndex,
      path,
      category,
      tier,
    });

    // Get current instance rotation using the reusable matrix
    const model = this.getModelForEntity(entityId);
    if (model && model.instancedMeshes.length > 0) {
      model.instancedMeshes[0].getMatrixAt(matrixIndex, this.dummyMatrix);
      this.dummyEuler.setFromRotationMatrix(this.dummyMatrix);

      this.movingInstances.set(entityId, {
        startPos: new Vector3().copy(currentPos), // Create once per movement
        endPos: new Vector3().copy(nextPos), // Create once per movement
        progress: 0,
        currentPathIndex: 0,
        currentRotation: this.dummyEuler.y,
        targetRotation: this.dummyEuler.y,
      });
    } else {
      this.movingInstances.set(entityId, {
        startPos: new Vector3().copy(currentPos), // Create once per movement
        endPos: new Vector3().copy(nextPos), // Create once per movement
        progress: 0,
        currentPathIndex: 0,
        currentRotation: 0,
        targetRotation: 0,
      });
    }
  }

  public updateMovements(deltaTime: number): void {
    // Monitor memory usage when processing multiple army movements
    if (this.movingInstances.size > 5) {
      this.memoryMonitor?.getCurrentStats(`updateMovements-bulk-${this.movingInstances.size}`);
    }

    this.movingInstances.forEach((movement, entityId) => {
      const instanceData = this.instanceData.get(entityId);
      if (!instanceData) {
        this.stopMovement(entityId);
        return;
      }

      // Single source of truth for the instance slot. instanceData.matrixIndex is
      // updated synchronously by every slot reassignment (compaction / re-add), so
      // reading it each frame keeps the model on the live slot. Reading a cached
      // copy here is what produced ghosting (model written to a stale slot while
      // the label, keyed by entityId, stayed correct).
      const matrixIndex = instanceData.matrixIndex;
      if (matrixIndex === undefined) {
        // The slot was reassigned away without removing this movement entry.
        // Tear the movement down directly: there is no live slot to finish it on.
        this.clearMovementState(entityId);
        return;
      }

      // Use spline movement if available
      const splineData = this.splineMovingInstances.get(entityId);
      if (splineData) {
        this.updateSplineMovement(splineData, entityId, instanceData, matrixIndex, deltaTime);
        return;
      }

      this.updateMovingInstance(movement, entityId, instanceData, matrixIndex, deltaTime);
    });
  }

  private updateMovingInstance(
    movement: MovementData,
    entityId: number,
    instanceData: ArmyInstanceData,
    matrixIndex: number,
    deltaTime: number,
  ): void {
    this.updateRotation(movement, deltaTime);
    this.updateMovementProgress(movement, instanceData, deltaTime);

    if (instanceData.category && instanceData.tier) {
      this.updateModelTypeForPosition(entityId, instanceData.position, instanceData.category, instanceData.tier);
    }

    this.updateInstance(
      entityId,
      matrixIndex,
      instanceData.position,
      instanceData.scale,
      this.dummyObject.rotation,
      instanceData.color,
    );
  }

  private getSplineEasingType(_tier: TroopTier): EasingType {
    // All tiers use journey easing for smooth whole-path movement
    return EasingType.EaseJourney;
  }

  private static readonly ANTICIPATION_DURATION = 0.15;
  private static readonly SETTLEMENT_DURATION = 0.25;
  private static readonly OVERSHOOT_DISTANCE = 0.05;
  private static readonly MAX_BANK_RADIANS = 0.15;
  private static readonly SPEED_MULTIPLIER_LERP_RATE = 5.0;
  private static readonly LEAN_FREQUENCY = 1.8;
  private static readonly ARRIVAL_SLAM_DURATION = 0.2;
  // Pre-allocated vectors for spline sampling (avoid GC pressure)
  private readonly splinePositionTarget: Vector3 = new Vector3();
  private readonly splineTangentTarget: Vector3 = new Vector3();

  private updateSplineMovement(
    splineData: SplineMovementData,
    entityId: number,
    instanceData: ArmyInstanceData,
    matrixIndex: number,
    deltaTime: number,
  ): void {
    const modelType = this.entityModelMap.get(entityId);
    const isShip = isShipModel(modelType);

    // Track elapsed time for the rhythmic lean
    splineData.elapsedTime += deltaTime;

    // Anticipation — squash before launch
    if (splineData.isAnticipating) {
      splineData.anticipationTimer += deltaTime;
      const scale = resolveAnticipationScale(splineData.anticipationTimer, ArmyModel.ANTICIPATION_DURATION);
      instanceData.scale.set(scale.x, scale.y, scale.z);

      if (splineData.anticipationTimer >= ArmyModel.ANTICIPATION_DURATION) {
        splineData.isAnticipating = false;
        instanceData.scale.copy(this.normalScale);
      }

      // During anticipation, don't advance progress — just render squash
      this.updateInstance(
        entityId,
        matrixIndex,
        instanceData.position,
        instanceData.scale,
        this.dummyObject.rotation,
        instanceData.color,
      );
      return;
    }

    // Terrain speed variation — sample biome and lerp multiplier
    const { col, row } = getHexForWorldPosition(instanceData.position);
    const biome = this.groundBiomeForHex(col, row);
    const targetMultiplier = resolveTerrainSpeedMultiplier(biome);
    splineData.currentSpeedMultiplier +=
      (targetMultiplier - splineData.currentSpeedMultiplier) *
      Math.min(1, ArmyModel.SPEED_MULTIPLIER_LERP_RATE * deltaTime);

    const currentSpeed = this.MOVEMENT_SPEED * splineData.currentSpeedMultiplier * ARMY_PACE_SPEED[splineData.pace];

    // Advance journey progress with terrain-adjusted speed
    const progressResult = resolveJourneyProgressUpdate({
      currentProgress: splineData.journeyProgress,
      totalLength: splineData.totalLength,
      speed: currentSpeed,
      deltaTime,
    });
    splineData.journeyProgress = progressResult.nextProgress;

    if (progressResult.isComplete) {
      // Begin settlement overshoot + arrival slam instead of stopping immediately
      if (!splineData.isSettling) {
        splineData.isSettling = true;
        splineData.settlementTimer = 0;
        splineData.isArrivalSlamming = true;
        splineData.arrivalSlamTimer = 0;
        splineData.finalTangent = resolveSplineTangent(
          splineData.spline,
          1,
          EasingType.Linear,
          this.splineTangentTarget,
        )
          .clone()
          .normalize();
        // Cache endpoint once for the entire settlement phase
        resolveSplinePosition(splineData.spline, 1, EasingType.Linear, splineData.endpointCache);
        instanceData.position.copy(splineData.endpointCache);
      }
    }

    // Settlement overshoot + arrival slam animation
    if (splineData.isSettling) {
      splineData.settlementTimer += deltaTime;

      // Arrival slam scale punch
      if (splineData.isArrivalSlamming) {
        splineData.arrivalSlamTimer += deltaTime;
        const slamScale = resolveArrivalSlamScale(splineData.arrivalSlamTimer, ArmyModel.ARRIVAL_SLAM_DURATION);
        instanceData.scale.set(slamScale.x, slamScale.y, slamScale.z);
        if (splineData.arrivalSlamTimer >= ArmyModel.ARRIVAL_SLAM_DURATION) {
          splineData.isArrivalSlamming = false;
          instanceData.scale.copy(this.normalScale);
        }
      }

      if (splineData.finalTangent) {
        const offset = resolveSettlementOffset(
          splineData.settlementTimer,
          ArmyModel.SETTLEMENT_DURATION,
          ArmyModel.OVERSHOOT_DISTANCE,
        );
        // Use cached endpoint — no recomputation
        instanceData.position.copy(splineData.endpointCache);
        instanceData.position.x += splineData.finalTangent.x * offset;
        instanceData.position.z += splineData.finalTangent.z * offset;
      }

      if (splineData.settlementTimer >= ArmyModel.SETTLEMENT_DURATION) {
        instanceData.position.copy(splineData.endpointCache);
        instanceData.scale.copy(this.normalScale);
        this.splineMovingInstances.delete(entityId);
        this.stopMovement(entityId);
        return;
      }

      // Render during settlement
      this.updateInstance(
        entityId,
        matrixIndex,
        instanceData.position,
        instanceData.scale,
        this.dummyObject.rotation,
        instanceData.color,
      );
      return;
    }

    // Sample position from spline with easing (pre-allocated target avoids GC)
    resolveSplinePosition(
      splineData.spline,
      splineData.journeyProgress,
      splineData.easingType,
      this.splinePositionTarget,
    );
    instanceData.position.copy(this.splinePositionTarget);

    // Derive rotation from tangent (pre-allocated target avoids GC)
    resolveSplineTangent(
      splineData.spline,
      splineData.journeyProgress,
      splineData.easingType,
      this.splineTangentTarget,
    );
    const targetRotation = Math.atan2(this.splineTangentTarget.x, this.splineTangentTarget.z);

    // Smooth rotation using existing system
    splineData.currentRotation = resolveRotationUpdate({
      currentRotation: splineData.currentRotation,
      targetRotation,
      rotationSpeed: this.ROTATION_SPEED,
      deltaTime,
    });

    // Banking into turns
    const bankAngle = resolvePathBankAngle(
      splineData.spline,
      Math.max(0, Math.min(1, splineData.journeyProgress)),
      ArmyModel.MAX_BANK_RADIANS,
    );

    // Rhythmic forward lean (not for boats)
    const pitchAngle = isShip
      ? 0
      : resolveRhythmicLean({
          elapsedTime: splineData.elapsedTime,
          speed: currentSpeed,
          baseFrequency: ArmyModel.LEAN_FREQUENCY,
        });
    this.dummyObject.rotation.set(pitchAngle, splineData.currentRotation, bankAngle);

    // Update model type based on current position (biome switching)
    if (instanceData.category && instanceData.tier) {
      this.updateModelTypeForPosition(entityId, instanceData.position, instanceData.category, instanceData.tier);
    }

    this.updateInstance(
      entityId,
      matrixIndex,
      instanceData.position,
      instanceData.scale,
      this.dummyObject.rotation,
      instanceData.color,
    );
  }

  private updateRotation(movement: MovementData, deltaTime: number): void {
    movement.currentRotation = resolveRotationUpdate({
      currentRotation: movement.currentRotation,
      targetRotation: movement.targetRotation,
      rotationSpeed: this.ROTATION_SPEED,
      deltaTime,
    });
    this.dummyObject.rotation.set(0, movement.currentRotation, 0);
  }

  private updateMovementProgress(movement: MovementData, instanceData: ArmyInstanceData, deltaTime: number): void {
    const distance = movement.startPos.distanceTo(movement.endPos);
    const movementProgressStep = resolveMovementProgressUpdate({
      progress: movement.progress,
      distance,
      movementSpeed: this.MOVEMENT_SPEED,
      deltaTime,
    });
    movement.progress = movementProgressStep.nextProgress;

    if (movementProgressStep.shouldCompletePath) {
      this.handlePathCompletion(movement, instanceData);
    } else {
      // Apply dynamic easing based on army type for juicy movement
      const easingType = this.getEasingTypeForMovement(instanceData.entityId, instanceData);
      const easedProgress = applyEasing(movement.progress, easingType);
      instanceData.position.copy(movement.startPos).lerp(movement.endPos, easedProgress);
    }
  }

  private handlePathCompletion(movement: MovementData, instanceData: ArmyInstanceData): void {
    instanceData.position.copy(movement.endPos);

    if (instanceData.path && movement.currentPathIndex < instanceData.path.length - 2) {
      this.moveToNextPathSegment(movement, instanceData);
    } else {
      this.stopMovement(instanceData.entityId);
    }
  }

  private moveToNextPathSegment(movement: MovementData, instanceData: ArmyInstanceData): void {
    movement.currentPathIndex++;
    const nextPos = instanceData.path![movement.currentPathIndex + 1];

    movement.startPos.copy(movement.endPos);
    movement.endPos.copy(nextPos);
    movement.progress = 0;

    this.updateInstanceDirection(instanceData.entityId, movement.startPos, movement.endPos);
  }

  private updateInstanceDirection(entityId: number, fromPos: Vector3, toPos: Vector3): void {
    const movement = this.movingInstances.get(entityId);
    if (!movement) return;

    // Use pre-allocated vector to avoid GC pressure
    this.tempVector3.subVectors(toPos, fromPos).normalize();
    const baseAngle = Math.atan2(this.tempVector3.x, this.tempVector3.z);

    movement.targetRotation = baseAngle;
    if (movement.currentRotation === 0) {
      movement.currentRotation = baseAngle;
    }
  }

  private updateModelTypeForPosition(entityId: number, position: Vector3, category: TroopType, tier: TroopTier): void {
    const { col, row } = getHexForWorldPosition(position);
    const biome = this.groundBiomeForHex(col, row);

    const modelType = this.getModelTypeForEntity(entityId, category, tier, biome);
    if (shouldSwitchModelForPosition({ currentModel: this.entityModelMap.get(entityId), resolvedModel: modelType })) {
      this.assignModelToEntity(entityId, modelType);
    }
  }

  /**
   * Determines the appropriate model type based on troop type, tier and biome
   * @param entityId - The entity ID
   * @param troopType - Type of the troop
   * @param troopTier - Tier of the troop
   * @param biome - The biome type
   * @returns The appropriate ModelType to use
   */
  public getModelTypeForEntity(
    entityId: number,
    troopType: TroopType,
    troopTier: TroopTier,
    biome: BiomeType,
  ): ModelType {
    if (isWaterBiome(biome)) {
      return resolveTroopModel(TROOP_TO_SHIP_MODEL, troopType, troopTier, entityId);
    }

    return resolveTroopModel(TROOP_TO_MODEL, troopType, troopTier, entityId);
  }

  private clearMovementState(entityId: number): void {
    const instanceData = this.instanceData.get(entityId);
    this.movingInstances.delete(entityId);
    // Tear down spline state too (parity with stopMovement/cancelMovement) so a
    // freed slot never strands an orphaned spline entry.
    this.splineMovingInstances.delete(entityId);

    if (instanceData) {
      instanceData.isMoving = false;
      instanceData.path = undefined;
    }
    this.movementCompleteCallbacks.delete(entityId);
  }

  private stopMovement(entityId: number): void {
    this.splineMovingInstances.delete(entityId);

    if (!this.movingInstances.delete(entityId)) return;

    const instanceData = this.instanceData.get(entityId);
    if (instanceData) {
      instanceData.isMoving = false;
      instanceData.path = undefined;
    }

    this.invokeMovementComplete(entityId);
  }

  /**
   * Get material sharing statistics for debugging
   */
  public getMaterialSharingStats(): {
    loadedModels: number;
    totalMeshes: number;
    materialPoolStats: any;
  } {
    let totalMeshes = 0;
    this.models.forEach((model) => {
      totalMeshes += model.instancedMeshes.length;
    });

    return {
      loadedModels: this.models.size,
      totalMeshes,
      materialPoolStats: ArmyModel.materialPool.getStats(),
    };
  }

  /**
   * Updates the current camera view
   * @param view - The new camera view
   */
  /** The far zoom band draws armies as markers only; instances keep their slots so the band change is atomic. */
  public setModelsVisible(visible: boolean): void {
    if (this.modelsVisible === visible) return;
    this.modelsVisible = visible;
    this.models.forEach((modelData) => (modelData.group.visible = visible));
    this.cosmeticModels.forEach((modelData) => (modelData.group.visible = visible));
    this.shadows.mesh.visible = visible;
  }

  public hasMovingInstances(): boolean {
    return this.movingInstances.size > 0;
  }

  public setShadowsEnabled(enabled: boolean): void {
    this.models.forEach((model) => {
      model.instancedMeshes.forEach((mesh) => {
        mesh.castShadow = enabled;
      });
    });
    this.cosmeticModels.forEach((model) => {
      model.instancedMeshes.forEach((mesh) => {
        mesh.castShadow = enabled;
      });
    });
  }

  public setMovementCompleteCallback(entityId: number, callback?: () => void): void {
    if (!callback) {
      this.movementCompleteCallbacks.delete(entityId);
      return;
    }
    this.movementCompleteCallbacks.set(entityId, callback);
  }

  public isEntityMoving(entityId: number): boolean {
    return this.movingInstances.has(entityId);
  }

  /**
   * Get the movement progress for an entity (0-1 across entire path)
   * @param entityId - The entity ID
   * @returns Progress value 0-1, or undefined if not moving
   */
  public getMovementProgress(entityId: number): number | undefined {
    const movement = this.movingInstances.get(entityId);
    if (!movement) return undefined;

    const instanceData = this.instanceData.get(entityId);
    if (!instanceData?.path || instanceData.path.length < 2) return undefined;

    // Calculate overall progress across all path segments
    const totalSegments = instanceData.path.length - 1;
    const completedSegments = movement.currentPathIndex;
    const currentSegmentProgress = movement.progress;

    return (completedSegments + currentSegmentProgress) / totalSegments;
  }

  public getEntityWorldPosition(entityId: number): Vector3 | undefined {
    const instanceData = this.instanceData.get(entityId);
    if (!instanceData) {
      return undefined;
    }

    return instanceData.position.clone();
  }

  /**
   * Hide only the instanced representation while preserving its slot,
   * movement state, and authoritative transform for an articulated actor.
   */
  public setEntityRepresentationVisible(entityId: number, visible: boolean): void {
    const visibilityChanged = visible
      ? this.hiddenEntityRepresentations.delete(entityId)
      : !this.hiddenEntityRepresentations.has(entityId);
    if (!visible) this.hiddenEntityRepresentations.add(entityId);
    if (!visibilityChanged) return;

    const instance = this.instanceData.get(entityId);
    if (instance?.matrixIndex === undefined) return;
    this.updateInstance(
      entityId,
      instance.matrixIndex,
      instance.position,
      instance.scale,
      instance.rotation,
      instance.color,
    );
  }

  /**
   * Get instance data for an entity (avoids type casting in consumers)
   * @param entityId - The entity ID
   * @returns The instance data or undefined if not found
   */
  public getInstanceData(entityId: number): ArmyInstanceData | undefined {
    return this.instanceData.get(entityId);
  }

  /**
   * Gets the appropriate easing type for an army's movement
   * @param _entityId - The entity ID (unused, kept for future extensibility)
   * @param instanceData - The army instance data
   * @returns The easing type to use
   */
  private getEasingTypeForMovement(_entityId: number, instanceData: ArmyInstanceData): EasingType {
    // Use tier-specific easing if available
    if (instanceData.tier && this.tierEasingMap.has(instanceData.tier)) {
      return this.tierEasingMap.get(instanceData.tier)!;
    }
    return this.defaultEasingType;
  }

  /**
   * Sets the default easing type for army movement
   * @param easingType - The easing type to use as default
   */
  public setDefaultEasingType(easingType: EasingType): void {
    this.defaultEasingType = easingType;
  }

  /**
   * Sets easing type for a specific troop tier
   * @param tier - The troop tier
   * @param easingType - The easing type for this tier
   */
  public setTierEasingType(tier: TroopTier, easingType: EasingType): void {
    this.tierEasingMap.set(tier, easingType);
  }

  /**
   * Gets current easing configuration for debugging
   */
  public getEasingConfig(): {
    defaultEasing: EasingType;
    tierEasing: Array<{ tier: TroopTier; easing: EasingType }>;
  } {
    return {
      defaultEasing: this.defaultEasingType,
      tierEasing: Array.from(this.tierEasingMap.entries()).map(([tier, easing]) => ({
        tier,
        easing,
      })),
    };
  }

  // Instance Count Management Methods
  public resetInstanceCounts(): void {
    this.currentVisibleCount = 0;
    this.models.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.count = 0;
      });
      modelData.activeInstances.clear();
    });

    this.cosmeticModels.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.count = 0;
      });
      modelData.activeInstances.clear();
    });
  }

  /** Queues the GPU upload of every slot written since the last flush; called once per frame and after a buffer rebuild. */
  public flushInstanceUploads(): void {
    this.models.forEach(flushArmyModelSlotUploads);
    this.cosmeticModels.forEach(flushArmyModelSlotUploads);
    this.shadows.flush();
  }

  public setVisibleSlots(slots: Iterable<number>): void {
    let maxIndex = -1;
    let activeCount = 0;

    for (const slot of slots) {
      if (slot === undefined || slot === null) continue;
      activeCount++;
      if (slot > maxIndex) {
        maxIndex = slot;
      }
    }

    this.currentVisibleCount = activeCount;
    this.guardInstanceCapacity(maxIndex >= 0 ? maxIndex + 1 : 0);
    this.shadows.setDrawCount(maxIndex + 1);

    // Set per-model draw counts based on their active instances
    // Models with no active instances get mesh.count = 0 (skip rendering/raycasting/animation)
    this.models.forEach((modelData) => {
      const modelDrawCount = this.getModelDrawCount(modelData);
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.count = modelDrawCount;
      });
    });

    // Also update cosmetic models with per-model counts
    this.cosmeticModels.forEach((modelData) => {
      const modelDrawCount = this.getModelDrawCount(modelData);
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.count = modelDrawCount;
      });
    });
  }

  /**
   * Calculate the draw count for a specific model based on its active instances.
   * Returns 0 if no active instances (model won't render/raycast/animate).
   * Returns maxSlotIndex + 1 if there are active instances.
   */
  private getModelDrawCount(modelData: ModelData): number {
    if (modelData.activeInstances.size === 0) {
      return 0;
    }

    // Find the max slot index among active instances
    let maxSlot = -1;
    for (const slot of modelData.activeInstances) {
      if (slot > maxSlot) {
        maxSlot = slot;
      }
    }

    return maxSlot + 1;
  }

  public setVisibleCount(count: number): void {
    if (count < 0) return;
    const slots: number[] = [];
    for (let i = 0; i < count; i++) {
      slots.push(i);
    }
    this.setVisibleSlots(slots);
  }

  public requestBoundsUpdate(): void {
    this.hasPendingBounds = true;
  }

  public applyPendingBounds(): void {
    if (!this.hasPendingBounds) return;
    this.computeBoundingSphere();
    this.hasPendingBounds = false;
  }

  public computeBoundingSphere(): void {
    this.models.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.computeBoundingSphere();
      });
    });

    // Also compute for cosmetic models
    this.cosmeticModels.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.computeBoundingSphere();
      });
    });
  }

  /**
   * Dispose of all resources including shared materials
   */
  public dispose(): void {
    // Dispose geometries and release materials from pool
    this.models.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        releasePooledInstancedMaterial(mesh.material);

        if (modelData.ownsGeometry) {
          mesh.geometry.dispose();
        }

        // Phase 2.5: free the instanceMatrix/instanceColor GPU buffers (via the
        // renderer 'dispose' event) and the morph DataTexture. InstancedMesh.dispose
        // does not touch geometry/material, which are handled above (material is a
        // pooled, refcounted resource released via releasePooledInstancedMaterial).
        mesh.dispose();

        // Remove from scene
        this.scene.remove(mesh);
      });

      // Remove group from scene
      this.scene.remove(modelData.group);
    });

    // Dispose cosmetic models
    this.cosmeticModels.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        releasePooledInstancedMaterial(mesh.material);
        mesh.dispose();
        this.scene.remove(mesh);
      });
      this.scene.remove(modelData.group);
    });

    this.shadows.dispose();

    // Clear all data structures
    this.models.clear();
    this.cosmeticModels.clear();
    this.entityModelMap.clear();
    this.entityCosmeticMap.clear();
    this.movingInstances.clear();
    this.instanceData.clear();
    this.hiddenEntityRepresentations.clear();
    this.matrixIndexOwners.clear();
    this.movementCompleteCallbacks.clear();
  }

  private invokeMovementComplete(entityId: number) {
    const callback = this.movementCompleteCallbacks.get(entityId);
    if (callback) {
      try {
        callback();
      } finally {
        this.movementCompleteCallbacks.delete(entityId);
      }
    }
  }
}

installArmyModelDebugHooks();
