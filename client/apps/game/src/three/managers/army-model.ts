import { CameraView } from "@/three/scenes/hexagon-scene";
import { gltfLoader } from "@/three/utils/utils";
import { FELT_CENTER, GRAPHICS_SETTING, GraphicsSettings } from "@/ui/config";
import { getCharacterModel } from "@/utils/agent";
import { Biome } from "@bibliothecadao/eternum";
import { BiomeType, TroopTier, TroopType } from "@bibliothecadao/types";
import {
  AnimationAction,
  AnimationMixer,
  Color,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Raycaster,
  Scene,
  Vector3,
} from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { env } from "../../../env";
import {
  ANIMATION_STATE_IDLE,
  ANIMATION_STATE_MOVING,
  MAX_INSTANCES,
  MODEL_TYPE_TO_FILE,
  TROOP_TO_MODEL,
} from "../constants";
import { AnimatedInstancedMesh, ArmyInstanceData, ModelData, ModelType, MovementData } from "../types/army";
import { getHexForWorldPosition } from "../utils";
import { applyEasing, EasingType } from "../utils/easing";
import { MaterialPool } from "../utils/material-pool";
import { MemoryMonitor } from "../utils/memory-monitor";

const MEMORY_MONITORING_ENABLED = env.VITE_PUBLIC_ENABLE_MEMORY_MONITORING;

export class ArmyModel {
  // Core properties
  private readonly scene: Scene;
  private readonly dummyObject: Object3D;
  public readonly loadPromise: Promise<void>;

  // Model and instance management
  private readonly models: Map<ModelType, ModelData> = new Map();
  private readonly pendingModelLoads: Map<ModelType, Promise<ModelData>> = new Map();
  private readonly entityModelMap: Map<number, ModelType> = new Map();
  private readonly activeBaseModelByEntity: Map<number, ModelType | null> = new Map();
  private readonly movingInstances: Map<number, MovementData> = new Map();
  private readonly instanceData: Map<number, ArmyInstanceData> = new Map();
  private readonly matrixIndexOwners: Map<number, number> = new Map();
  private readonly labels: Map<number, { label: CSS2DObject; entityId: number }> = new Map();
  private readonly labelsGroup: Group;
  private currentCameraView: CameraView = CameraView.Medium;
  private movementCompleteCallbacks: Map<number, () => void> = new Map();

  // Cosmetic model management
  private readonly cosmeticModels: Map<string, ModelData> = new Map();
  private readonly pendingCosmeticModelLoads: Map<string, Promise<ModelData>> = new Map();
  private readonly entityCosmeticMap: Map<number, string> = new Map(); // entityId -> cosmeticId
  private readonly activeCosmeticByEntity: Map<number, string | null> = new Map(); // entityId -> active cosmeticId

  // Reusable objects for matrix operations and memory optimization
  private readonly dummyMatrix: Matrix4 = new Matrix4();
  private readonly dummyEuler: Euler = new Euler();
  private readonly tempVector1: Vector3 = new Vector3();
  private readonly tempVector2: Vector3 = new Vector3();
  private readonly tempVector3: Vector3 = new Vector3();

  // Animation and state management
  private readonly animationStates: Float32Array;
  private readonly animationBuckets: Uint8Array;
  private instanceCount = 0;
  private currentVisibleCount: number = 0;
  private readonly ANIMATION_BUCKETS = 20;
  private readonly freeSlots: number[] = [];
  private readonly freeSlotSet: Set<number> = new Set();
  private nextInstanceIndex = 0;

  // Configuration constants
  private readonly SCALE_TRANSITION_SPEED = 5.0;
  private readonly MOVEMENT_SPEED = 1.25;
  private readonly FLOAT_HEIGHT = 0.5;
  private readonly FLOAT_TRANSITION_SPEED = 3.0;
  private readonly ROTATION_SPEED = 5.0;
  private readonly zeroScale = new Vector3(0, 0, 0);
  private readonly normalScale = new Vector3(1, 1, 1);
  private readonly boatScale = new Vector3(1, 1, 1);
  private readonly agentScale = new Vector3(2, 2, 2);
  private readonly zeroInstanceMatrix = new Matrix4().makeScale(0, 0, 0);
  private readonly MODEL_ANIMATION_UPDATE_INTERVAL = 1000 / 20; // 20 FPS per model
  private readonly INITIAL_INSTANCE_CAPACITY = 64;

  // agent
  private isAgent: boolean = false;

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

  constructor(scene: Scene, labelsGroup?: Group, cameraView?: CameraView) {
    this.scene = scene;
    this.dummyObject = new Object3D();
    this.loadPromise = Promise.resolve();
    this.labelsGroup = labelsGroup || new Group();
    this.currentCameraView = cameraView || CameraView.Medium;

    // Initialize memory monitor for army model operations
    if (MEMORY_MONITORING_ENABLED) {
      this.memoryMonitor = new MemoryMonitor({
        spikeThresholdMB: 20, // Lower threshold for model operations
        onMemorySpike: (spike) => {
          console.warn(`🪖  Army Model Memory Spike: +${spike.increaseMB.toFixed(1)}MB in ${spike.context}`);
        },
      });
    }

    // Initialize animation arrays
    // this.timeOffsets = new Float32Array(0); // Unused, keep for API compatibility if referenced elsewhere, otherwise can be removed
    this.animationBuckets = new Uint8Array(MAX_INSTANCES);
    this.animationStates = new Float32Array(MAX_INSTANCES);
    this.initializeAnimationArrays();
  }

  // Initialization methods
  private initializeAnimationArrays(): void {
    for (let i = 0; i < MAX_INSTANCES; i++) {
      this.animationBuckets[i] = Math.floor(Math.random() * this.ANIMATION_BUCKETS);
      this.animationStates[i] = ANIMATION_STATE_IDLE;
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

    const fileName = MODEL_TYPE_TO_FILE[modelType];
    if (!fileName) {
      throw new Error(`Missing model file for ${modelType}`);
    }

    pending = new Promise<ModelData>((resolve, reject) => {
      gltfLoader.load(
        `models/${fileName}`,
        (gltf) => {
          try {
            const modelData = this.createModelData(gltf);
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
  private async ensureCosmeticModel(cosmeticId: string, assetPath: string): Promise<ModelData> {
    if (this.cosmeticModels.has(cosmeticId)) {
      return this.cosmeticModels.get(cosmeticId)!;
    }

    let pending = this.pendingCosmeticModelLoads.get(cosmeticId);
    if (pending) {
      return pending;
    }

    pending = new Promise<ModelData>((resolve, reject) => {
      gltfLoader.load(
        assetPath,
        (gltf) => {
          try {
            const modelData = this.createModelData(gltf);
            this.cosmeticModels.set(cosmeticId, modelData);
            this.reapplyInstancesForCosmeticModel(cosmeticId, modelData);
            resolve(modelData);
          } catch (error) {
            reject(error as Error);
          }
        },
        undefined,
        (error) => {
          console.error(`[ArmyModel] Failed to load cosmetic model ${cosmeticId} from ${assetPath}:`, error);
          reject(error);
        },
      );
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
  }

  private createModelData(gltf: any): ModelData {
    const group = new Group();
    const instancedMeshes: AnimatedInstancedMesh[] = [];
    const baseMeshes: Mesh[] = [];

    this.processGLTFScene(gltf, group, instancedMeshes, baseMeshes);
    this.scene.add(group);

    const mixer = new AnimationMixer(gltf.scene);

    return {
      group,
      instancedMeshes,
      baseMeshes,
      mixer,
      animations: {
        idle: gltf.animations[0],
        moving: gltf.animations[1] || gltf.animations[0]?.clone(),
      },
      animationActions: new Map(),
      activeInstances: new Set(),
      targetScales: new Map(),
      currentScales: new Map(),
      lastAnimationUpdate: 0,
      animationUpdateInterval: this.MODEL_ANIMATION_UPDATE_INTERVAL,
    };
  }

  private processGLTFScene(
    gltf: any,
    group: Group,
    instancedMeshes: AnimatedInstancedMesh[],
    baseMeshes: Mesh[],
  ): void {
    let meshIndex = 0;

    gltf.scene.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        const instancedMesh = this.createInstancedMesh(child, gltf.animations, meshIndex);
        group.add(instancedMesh);
        instancedMeshes.push(instancedMesh);
        baseMeshes.push(child);
        meshIndex++;
      }
    });
  }

  private createInstancedMesh(mesh: Mesh, animations: any[], meshIndex: number): AnimatedInstancedMesh {
    const geometry = mesh.geometry;

    // Handle both single material and material array cases
    const sourceMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const overrides = sourceMaterial.name?.includes("stand") ? { opacity: 0.9 } : {};
    const material = ArmyModel.materialPool.getBasicMaterial(sourceMaterial, overrides);
    const instancedMesh = new InstancedMesh(
      geometry,
      material,
      this.INITIAL_INSTANCE_CAPACITY,
    ) as AnimatedInstancedMesh;

    instancedMesh.frustumCulled = true;
    instancedMesh.castShadow = true;
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.renderOrder = 10 + meshIndex;
    // @ts-ignore
    if (mesh.material.name.includes("stand")) {
      instancedMesh.instanceColor = new InstancedBufferAttribute(
        new Float32Array(this.INITIAL_INSTANCE_CAPACITY * 3),
        3,
      );
    }

    if (animations.length > 0) {
      this.setupMeshAnimation(instancedMesh, mesh, animations);
    }

    instancedMesh.count = 0;
    return instancedMesh;
  }

  private ensureModelCapacity(modelData: ModelData, requiredCount: number): void {
    modelData.instancedMeshes.forEach((mesh, meshIndex) => {
      const capacity = mesh.instanceMatrix.count;
      if (requiredCount <= capacity) {
        return;
      }

      let newCapacity = capacity || 1;
      while (newCapacity < requiredCount) {
        newCapacity *= 2;
      }

      const matrixArray = mesh.instanceMatrix.array as Float32Array;
      const resizedMatrixArray = new Float32Array(newCapacity * 16);
      resizedMatrixArray.set(matrixArray.subarray(0, capacity * 16));
      mesh.instanceMatrix = new InstancedBufferAttribute(resizedMatrixArray, 16);
      mesh.instanceMatrix.needsUpdate = true;

      if (mesh.instanceColor) {
        const colorArray = mesh.instanceColor.array as Float32Array;
        const resizedColorArray = new Float32Array(newCapacity * 3);
        resizedColorArray.set(colorArray.subarray(0, capacity * 3));
        mesh.instanceColor = new InstancedBufferAttribute(resizedColorArray, 3);
        mesh.instanceColor.needsUpdate = true;
      }

      const baseMesh = modelData.baseMeshes[meshIndex];
      for (let i = capacity; i < newCapacity; i++) {
        mesh.setMatrixAt(i, this.zeroInstanceMatrix);
        if (mesh.morphTexture) {
          mesh.setMorphAt(i, baseMesh as any);
        }
      }

      if (mesh.morphTexture) {
        mesh.morphTexture.needsUpdate = true;
      }
    });
  }

  private setupMeshAnimation(instancedMesh: AnimatedInstancedMesh, mesh: Mesh, animations: any[]): void {
    const hasAnimation = animations[0].tracks.find((track: any) => track.name.split(".")[0] === mesh.name);

    if (hasAnimation) {
      instancedMesh.animated = true;
      for (let i = 0; i < this.INITIAL_INSTANCE_CAPACITY; i++) {
        instancedMesh.setMorphAt(i, mesh as any);
      }
      instancedMesh.morphTexture!.needsUpdate = true;
    }
  }

  private clearInstanceSlot(matrixIndex: number): void {
    this.models.forEach((modelData) => {
      this.ensureModelCapacity(modelData, matrixIndex + 1);
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.setMatrixAt(matrixIndex, this.zeroInstanceMatrix);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.userData.entityIdMap?.delete(matrixIndex);
      });
    });
    // Also clear from cosmetic models
    this.cosmeticModels.forEach((modelData) => {
      this.ensureModelCapacity(modelData, matrixIndex + 1);
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.setMatrixAt(matrixIndex, this.zeroInstanceMatrix);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.userData.entityIdMap?.delete(matrixIndex);
      });
    });
    this.setAnimationState(matrixIndex, false);
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
  public async preloadCosmeticModel(cosmeticId: string, assetPath: string): Promise<void> {
    try {
      await this.ensureCosmeticModel(cosmeticId, assetPath);
    } catch (error) {
      console.error(`Failed to preload cosmetic model ${cosmeticId}`, error);
    }
  }

  /**
   * Assigns a cosmetic model to an entity. This takes precedence over the base ModelType.
   */
  public assignCosmeticToEntity(entityId: number, cosmeticId: string, assetPath: string): void {
    const oldCosmeticId = this.entityCosmeticMap.get(entityId);
    if (oldCosmeticId === cosmeticId) return;
    this.entityCosmeticMap.set(entityId, cosmeticId);
    void this.ensureCosmeticModel(cosmeticId, assetPath).catch((error) => {
      console.error(`Failed to load cosmetic model ${cosmeticId}`, error);
    });
  }

  /**
   * Clears cosmetic assignment for an entity, falling back to base ModelType.
   */
  public clearCosmeticForEntity(entityId: number): void {
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

    if (this.freeSlotSet.has(resolvedSlot)) return;

    this.freeSlotSet.add(resolvedSlot);
    this.freeSlots.push(resolvedSlot);

    if (instanceData) {
      instanceData.matrixIndex = undefined;
    }
  }

  public rebindInstanceSlot(entityId: number, newSlot: number): void {
    const instanceData = this.instanceData.get(entityId);
    if (instanceData) {
      instanceData.matrixIndex = newSlot;
    }
    this.matrixIndexOwners.set(newSlot, entityId);
    this.rebindMovementMatrixIndex(entityId, newSlot);
  }

  private getScaleForModelType(modelType: ModelType): Vector3 {
    if (modelType === ModelType.Boat) {
      return this.boatScale;
    }
    if (modelType === ModelType.AgentIstarai || modelType === ModelType.AgentElisa) {
      return this.agentScale;
    }
    return this.normalScale;
  }

  public updateInstance(
    entityId: number,
    index: number,
    position: Vector3,
    scale: Vector3,
    rotation?: Euler,
    color?: Color,
  ): void {
    const previousOwner = this.matrixIndexOwners.get(index);
    if (import.meta.env?.DEV && previousOwner !== undefined && previousOwner !== entityId) {
      console.warn(`[ArmyModel] Matrix slot ${index} reassigned from entity ${previousOwner} to ${entityId}.`);
    }
    this.matrixIndexOwners.set(index, entityId);

    const state = this.storeInstanceState(entityId, index, position, scale, rotation, color);

    const desiredModelType = this.entityModelMap.get(entityId) ?? null;
    const desiredCosmeticId = this.entityCosmeticMap.get(entityId);
    const hasActiveCosmetic = desiredCosmeticId !== undefined && this.cosmeticModels.has(desiredCosmeticId);

    const activeBaseModel = hasActiveCosmetic ? null : desiredModelType;
    const activeCosmetic = hasActiveCosmetic ? desiredCosmeticId! : null;

    const prevActiveBaseModel = this.activeBaseModelByEntity.get(entityId) ?? null;
    const prevActiveCosmetic = this.activeCosmeticByEntity.get(entityId) ?? null;

    if (prevActiveBaseModel !== activeBaseModel) {
      if (prevActiveBaseModel) {
        const prevModelData = this.models.get(prevActiveBaseModel);
        if (prevModelData) {
          this.ensureModelCapacity(prevModelData, index + 1);
          this.updateInstanceTransform(state.position, this.zeroScale, state.rotation);
          this.updateInstanceMeshes(prevModelData, index, entityId, state.color);
        }
      }
      this.activeBaseModelByEntity.set(entityId, activeBaseModel);
    }

    if (prevActiveCosmetic !== activeCosmetic) {
      if (prevActiveCosmetic) {
        const prevCosmeticData = this.cosmeticModels.get(prevActiveCosmetic);
        if (prevCosmeticData) {
          this.ensureModelCapacity(prevCosmeticData, index + 1);
          this.updateInstanceTransform(state.position, this.zeroScale, state.rotation);
          this.updateInstanceMeshes(prevCosmeticData, index, entityId, state.color);
        }
      }
      this.activeCosmeticByEntity.set(entityId, activeCosmetic);
    }

    if (activeBaseModel) {
      const modelData = this.models.get(activeBaseModel);
      if (modelData) {
        const targetScale = this.getScaleForModelType(activeBaseModel);
        this.ensureModelCapacity(modelData, index + 1);
        this.updateInstanceTransform(state.position, targetScale, state.rotation);
        this.updateInstanceMeshes(modelData, index, entityId, state.color);
      }
    }

    if (activeCosmetic) {
      const cosmeticData = this.cosmeticModels.get(activeCosmetic);
      if (cosmeticData) {
        this.ensureModelCapacity(cosmeticData, index + 1);
        this.updateInstanceTransform(state.position, this.normalScale, state.rotation);
        this.updateInstanceMeshes(cosmeticData, index, entityId, state.color);
      }
    }
  }

  public releaseEntity(entityId: number, freedSlot?: number): void {
    this.freeInstanceSlot(entityId, freedSlot);
    this.instanceData.delete(entityId);
    this.entityModelMap.delete(entityId);
    this.entityCosmeticMap.delete(entityId);
    this.activeBaseModelByEntity.delete(entityId);
    this.activeCosmeticByEntity.delete(entityId);
    this.movementCompleteCallbacks.delete(entityId);
    this.removeLabel(entityId);
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
    this.dummyObject.position.y += 0.15;
    this.dummyObject.scale.copy(scale);
    if (rotation) {
      this.dummyObject.rotation.copy(rotation);
    }
    this.dummyObject.updateMatrix();
  }

  private updateInstanceMeshes(modelData: ModelData, index: number, entityId: number, color?: Color): void {
    modelData.instancedMeshes.forEach((mesh) => {
      mesh.setMatrixAt(index, this.dummyObject.matrix);
      mesh.instanceMatrix.needsUpdate = true;

      if (color && mesh.instanceColor) {
        mesh.setColorAt(index, color);
        mesh.instanceColor.needsUpdate = true;
      }

      mesh.userData.entityIdMap = mesh.userData.entityIdMap || new Map<number, number>();
      mesh.userData.entityIdMap.set(index, entityId);
    });
  }

  // Animation Methods
  public updateAnimations(_deltaTime: number): void {
    if (GRAPHICS_SETTING === GraphicsSettings.LOW) return;

    const now = performance.now();
    const time = now * 0.001;

    this.models.forEach((modelData) => {
      this.updateModelAnimations(modelData, time, now);
    });

    // Also update cosmetic model animations
    this.cosmeticModels.forEach((modelData) => {
      this.updateModelAnimations(modelData, time, now);
    });
  }

  private updateModelAnimations(modelData: ModelData, time: number, now: number): void {
    // Throttling: Calculate update frequency based on camera distance
    // We sample the position of the first active instance as a proxy for the group
    let updateFrequency = 1;

    if (modelData.instancedMeshes.length > 0 && modelData.instancedMeshes[0].count > 0) {
      // Get position of first instance
      modelData.instancedMeshes[0].getMatrixAt(0, this.dummyMatrix);
      this.tempVector1.setFromMatrixPosition(this.dummyMatrix);

      // Assuming camera position is available (or pass it in)
      // Since we don't have easy access to camera position here without coupling,
      // we can use a simple frame-based throttling based on instance count
      // More instances = more throttling to maintain FPS
      const totalInstances = modelData.instancedMeshes[0].count;
      if (totalInstances > 100) updateFrequency = 2;
      if (totalInstances > 300) updateFrequency = 3;
      if (totalInstances > 500) updateFrequency = 4;
    }

    // Skip update if throttled
    // Use a deterministic frame counter simulation based on time
    const frameCounter = Math.floor(now / 16.66); // Approx 60fps frames
    if (frameCounter % updateFrequency !== 0) {
      return;
    }

    if (now - modelData.lastAnimationUpdate < modelData.animationUpdateInterval) {
      return;
    }

    let performedUpdate = false;
    let hasAnimatedInstances = false;

    modelData.instancedMeshes.forEach((mesh, meshIndex) => {
      if (!mesh.animated) return;
      if (mesh.count === 0) return;
      hasAnimatedInstances = true;

      // Pre-calculate weights for all buckets and states
      // This significantly reduces CPU load by batching mixer updates
      const idleWeights: number[][] = [];
      const movingWeights: number[][] = [];
      const actions = this.getOrCreateAnimationActions(modelData, 0); // Shared actions

      // 1. Sample Idle Weights
      this.updateAnimationState(actions, ANIMATION_STATE_IDLE);
      for (let b = 0; b < this.ANIMATION_BUCKETS; b++) {
        const t = time + (b * 3.0) / this.ANIMATION_BUCKETS;
        modelData.mixer.setTime(t);
        idleWeights[b] = [...(modelData.baseMeshes[meshIndex].morphTargetInfluences || [])];
      }

      // 2. Sample Moving Weights
      this.updateAnimationState(actions, ANIMATION_STATE_MOVING);
      for (let b = 0; b < this.ANIMATION_BUCKETS; b++) {
        const t = time + (b * 3.0) / this.ANIMATION_BUCKETS;
        modelData.mixer.setTime(t);
        movingWeights[b] = [...(modelData.baseMeshes[meshIndex].morphTargetInfluences || [])];
      }

      // 3. Apply to instances
      for (let i = 0; i < mesh.count; i++) {
        this.updateInstanceAnimationOptimized(mesh, i, idleWeights, movingWeights);
      }

      if (mesh.morphTexture) {
        mesh.morphTexture.needsUpdate = true;
        performedUpdate = true;
      }
    });

    if (performedUpdate || !hasAnimatedInstances) {
      modelData.lastAnimationUpdate = now;
    }
  }

  private updateInstanceAnimationOptimized(
    mesh: AnimatedInstancedMesh,
    instanceIndex: number,
    idleWeights: number[][],
    movingWeights: number[][],
  ): void {
    const animationState = this.animationStates[instanceIndex];

    if (this.shouldSkipAnimation(animationState)) return;

    const bucket = this.animationBuckets[instanceIndex];
    const weights = animationState === ANIMATION_STATE_MOVING ? movingWeights[bucket] : idleWeights[bucket];

    mesh.setMorphAt(instanceIndex, { morphTargetInfluences: weights } as any);
  }

  private updateInstanceAnimation(
    modelData: ModelData,
    mesh: AnimatedInstancedMesh,
    meshIndex: number,
    instanceIndex: number,
    time: number,
  ): void {
    // Deprecated in favor of updateInstanceAnimationOptimized
  }

  private shouldSkipAnimation(animationState: number): boolean {
    return (
      (GRAPHICS_SETTING === GraphicsSettings.MID && animationState === ANIMATION_STATE_IDLE) ||
      GRAPHICS_SETTING === GraphicsSettings.LOW
    );
  }

  private getOrCreateAnimationActions(modelData: ModelData, instanceIndex: number) {
    if (!modelData.animationActions.has(instanceIndex)) {
      const idleAction = modelData.mixer.clipAction(modelData.animations.idle);
      const movingAction = modelData.mixer.clipAction(modelData.animations.moving);
      modelData.animationActions.set(instanceIndex, { idle: idleAction, moving: movingAction });
    }
    return modelData.animationActions.get(instanceIndex)!;
  }

  private updateAnimationState(actions: { idle: AnimationAction; moving: AnimationAction }, state: number): void {
    if (state === ANIMATION_STATE_IDLE) {
      actions.idle.setEffectiveTimeScale(1);
      actions.moving.setEffectiveTimeScale(0);
    } else if (state === ANIMATION_STATE_MOVING) {
      actions.idle.setEffectiveTimeScale(0);
      actions.moving.setEffectiveTimeScale(1);
    }
    actions.idle.play();
    actions.moving.play();
  }

  // Movement Methods
  public startMovement(
    entityId: number,
    path: Vector3[],
    matrixIndex: number,
    category: TroopType,
    tier: TroopTier,
  ): void {
    if (path.length < 2) return;

    // Monitor memory usage before starting movement
    this.memoryMonitor?.getCurrentStats(`startMovement-${entityId}`);

    // Log material sharing stats periodically (every 10th movement)
    if (entityId % 10 === 0) {
      ArmyModel.materialPool.logSharingStats();
    }

    this.stopMovement(entityId);
    const [currentPos, nextPos] = [path[0], path[1]];

    this.initializeMovement(entityId, currentPos, nextPos, path, matrixIndex, category, tier);
    this.setAnimationState(matrixIndex, true);
    this.updateInstanceDirection(entityId, currentPos, nextPos);
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

    const segmentDistance = currentPos.distanceTo(nextPos);
    const invTravelTime = segmentDistance > 0 ? this.MOVEMENT_SPEED / segmentDistance : Infinity;

    // Get current instance rotation using the reusable matrix
    const model = this.getModelForEntity(entityId);
    if (model && model.instancedMeshes.length > 0) {
      model.instancedMeshes[0].getMatrixAt(matrixIndex, this.dummyMatrix);
      this.dummyEuler.setFromRotationMatrix(this.dummyMatrix);

      this.movingInstances.set(entityId, {
        startPos: new Vector3().copy(currentPos), // Create once per movement
        endPos: new Vector3().copy(nextPos), // Create once per movement
        progress: 0,
        segmentDistance,
        invTravelTime,
        matrixIndex,
        currentPathIndex: 0,
        floatingHeight: 0,
        currentRotation: this.dummyEuler.y,
        targetRotation: this.dummyEuler.y,
      });
    } else {
      this.movingInstances.set(entityId, {
        startPos: new Vector3().copy(currentPos), // Create once per movement
        endPos: new Vector3().copy(nextPos), // Create once per movement
        progress: 0,
        segmentDistance,
        invTravelTime,
        matrixIndex,
        currentPathIndex: 0,
        floatingHeight: 0,
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

      if (movement.currentPathIndex === -1) {
        this.handleDescent(movement, entityId, instanceData, deltaTime);
        return;
      }

      this.updateMovingInstance(movement, entityId, instanceData, deltaTime);
    });
  }

  private handleDescent(
    movement: MovementData,
    entityId: number,
    instanceData: ArmyInstanceData,
    deltaTime: number,
  ): void {
    const modelType = this.entityModelMap.get(entityId);
    const isBoat = modelType === ModelType.Boat;

    if (!isBoat) {
      movement.floatingHeight = Math.max(0, movement.floatingHeight - deltaTime * this.FLOAT_TRANSITION_SPEED);
    }

    // Use reusable vector instead of cloning
    this.tempVector1.copy(movement.startPos);
    if (!isBoat) {
      this.tempVector1.y += movement.floatingHeight;
    }

    this.updateRotation(movement, deltaTime);
    this.updateInstance(
      entityId,
      movement.matrixIndex,
      this.tempVector1,
      instanceData.scale,
      this.dummyObject.rotation,
      instanceData.color,
    );

    this.updateLabelPosition(entityId, this.tempVector1);

    if (movement.floatingHeight <= 0 || isBoat) {
      this.movingInstances.delete(entityId);
    }
  }

  private updateMovingInstance(
    movement: MovementData,
    entityId: number,
    instanceData: ArmyInstanceData,
    deltaTime: number,
  ): void {
    const modelType = this.entityModelMap.get(entityId);
    const isBoat = modelType === ModelType.Boat;

    if (!isBoat) {
      movement.floatingHeight = Math.min(
        this.FLOAT_HEIGHT,
        movement.floatingHeight + deltaTime * this.FLOAT_TRANSITION_SPEED,
      );
    }

    this.updateRotation(movement, deltaTime);
    this.updateMovementProgress(movement, instanceData, deltaTime);

    if (instanceData.category && instanceData.tier) {
      this.updateModelTypeForPosition(entityId, instanceData.position, instanceData.category, instanceData.tier);
    }

    // Use reusable vector instead of cloning
    this.tempVector2.copy(instanceData.position);
    if (!isBoat) {
      this.tempVector2.y += movement.floatingHeight;
    }

    this.updateInstance(
      entityId,
      movement.matrixIndex,
      this.tempVector2,
      instanceData.scale,
      this.dummyObject.rotation,
      instanceData.color,
    );

    this.updateLabelPosition(entityId, this.tempVector2);
  }

  private updateRotation(movement: MovementData, deltaTime: number): void {
    const rotationDiff = movement.targetRotation - movement.currentRotation;
    const normalizedDiff = Math.atan2(Math.sin(rotationDiff), Math.cos(rotationDiff));
    movement.currentRotation += normalizedDiff * this.ROTATION_SPEED * deltaTime;
    this.dummyObject.rotation.set(0, movement.currentRotation, 0);
  }

  private updateMovementProgress(movement: MovementData, instanceData: ArmyInstanceData, deltaTime: number): void {
    if (!Number.isFinite(movement.invTravelTime) || movement.invTravelTime === Infinity) {
      movement.progress = 1;
    } else {
      movement.progress += deltaTime * movement.invTravelTime;
    }

    if (movement.progress >= 1) {
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
    movement.segmentDistance = movement.startPos.distanceTo(movement.endPos);
    movement.invTravelTime =
      movement.segmentDistance > 0 ? this.MOVEMENT_SPEED / movement.segmentDistance : Infinity;

    this.updateInstanceDirection(instanceData.entityId, movement.startPos, movement.endPos);
  }

  private updateInstanceDirection(entityId: number, fromPos: Vector3, toPos: Vector3): void {
    const movement = this.movingInstances.get(entityId);
    if (!movement) return;

    const direction = this.tempVector3.subVectors(toPos, fromPos).normalize();
    const baseAngle = Math.atan2(direction.x, direction.z);

    movement.targetRotation = baseAngle;
    if (movement.currentRotation === 0) {
      movement.currentRotation = baseAngle;
    }
  }

  private updateModelTypeForPosition(entityId: number, position: Vector3, category: TroopType, tier: TroopTier): void {
    const { col, row } = getHexForWorldPosition(position);
    const biome = Biome.getBiome(col + FELT_CENTER(), row + FELT_CENTER());

    const modelType = this.getModelTypeForEntity(entityId, category, tier, biome);
    if (this.entityModelMap.get(entityId) !== modelType) {
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
    // For water biomes, always return boat model regardless of troop type
    if (biome === BiomeType.Ocean || biome === BiomeType.DeepOcean) {
      return ModelType.Boat;
    }

    if (this.isAgent) {
      if (getCharacterModel(troopTier, troopType, entityId) !== undefined) {
        return getCharacterModel(troopTier, troopType, entityId)!;
      }
    }

    const troopModels = TROOP_TO_MODEL[troopType];
    if (!troopModels) {
      console.warn(
        `[ArmyModel] Unknown troop type "${troopType}" for entity ${entityId}; falling back to ${ModelType.Knight1}.`,
      );
      return ModelType.Knight1;
    }

    const modelForTier = troopModels[troopTier];
    if (modelForTier) {
      return modelForTier;
    }

    const fallbackModel =
      troopModels[TroopTier.T1] ?? troopModels[TroopTier.T2] ?? troopModels[TroopTier.T3] ?? ModelType.Knight1;

    console.warn(
      `[ArmyModel] Unknown troop tier "${troopTier}" for type ${troopType} on entity ${entityId}; using ${fallbackModel}.`,
    );
    return fallbackModel;
  }

  private clearMovementState(entityId: number): void {
    const movement = this.movingInstances.get(entityId);
    if (movement) {
      this.setAnimationState(movement.matrixIndex, false);
      this.movingInstances.delete(entityId);
    }

    const instanceData = this.instanceData.get(entityId);
    if (instanceData) {
      instanceData.isMoving = false;
      instanceData.path = undefined;
    }
    this.movementCompleteCallbacks.delete(entityId);
  }

  private stopMovement(entityId: number): void {
    const movement = this.movingInstances.get(entityId);
    if (!movement) return;

    this.setAnimationState(movement.matrixIndex, false);

    if (movement.floatingHeight > 0) {
      this.initializeDescentAnimation(entityId, movement);
    } else {
      this.movingInstances.delete(entityId);
    }

    const instanceData = this.instanceData.get(entityId);
    if (instanceData) {
      instanceData.isMoving = false;
      instanceData.path = undefined;
    }

    this.invokeMovementComplete(entityId);
  }

  private initializeDescentAnimation(entityId: number, movement: MovementData): void {
    const instanceData = this.instanceData.get(entityId);
    if (!instanceData) {
      this.movingInstances.delete(entityId);
      return;
    }

    this.movingInstances.set(entityId, {
      startPos: new Vector3().copy(instanceData.position), // Create once for descent
      endPos: new Vector3().copy(instanceData.position), // Create once for descent
      progress: 0,
      segmentDistance: 0,
      invTravelTime: Infinity,
      matrixIndex: movement.matrixIndex,
      currentPathIndex: -1,
      floatingHeight: movement.floatingHeight,
      currentRotation: movement.currentRotation,
      targetRotation: movement.currentRotation,
    });
  }

  /**
   * Sets the isAgent flag
   * @param isAgent - Whether the entity is an agent
   */
  public setIsAgent(isAgent: boolean): void {
    this.isAgent = isAgent;
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
  public setCurrentCameraView(view: CameraView): void {
    this.currentCameraView = view;
  }

  public setMovementCompleteCallback(entityId: number, callback?: () => void): void {
    if (!callback) {
      this.movementCompleteCallbacks.delete(entityId);
      return;
    }
    this.movementCompleteCallbacks.set(entityId, callback);
  }

  public rebindMovementMatrixIndex(entityId: number, newMatrixIndex: number): void {
    const movement = this.movingInstances.get(entityId);
    if (!movement) return;

    const previousIndex = movement.matrixIndex;
    if (previousIndex === newMatrixIndex) {
      return;
    }

    // Reset animation state for the old slot so it no longer appears active
    this.setAnimationState(previousIndex, false);

    movement.matrixIndex = newMatrixIndex;

    const instanceData = this.instanceData.get(entityId);
    if (instanceData) {
      instanceData.matrixIndex = newMatrixIndex;
    }

    const isMoving = movement.currentPathIndex !== -1 || movement.floatingHeight > 0;
    this.setAnimationState(newMatrixIndex, isMoving);
  }

  public isEntityMoving(entityId: number): boolean {
    return this.movingInstances.has(entityId);
  }

  public getEntityWorldPosition(entityId: number): Vector3 | undefined {
    const instanceData = this.instanceData.get(entityId);
    if (!instanceData) {
      return undefined;
    }

    return instanceData.position.clone();
  }

  /**
   * Gets the appropriate easing type for an army's movement
   * @param entityId - The entity ID
   * @param instanceData - The army instance data
   * @returns The easing type to use
   */
  private getEasingTypeForMovement(entityId: number, instanceData: ArmyInstanceData): EasingType {
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

  // Label Management Methods
  public addLabel(entityId: number, label: CSS2DObject): void {
    this.removeLabel(entityId);
    this.labels.set(entityId, { label, entityId });
    this.labelsGroup.add(label);
  }

  public removeLabel(entityId: number): void {
    const labelData = this.labels.get(entityId);
    if (labelData) {
      this.labelsGroup.remove(labelData.label);
      if (labelData.label.element && labelData.label.element.parentNode) {
        labelData.label.element.parentNode.removeChild(labelData.label.element);
      }
      this.labels.delete(entityId);
    }
  }

  private updateLabelPosition(entityId: number, position: Vector3): void {
    const labelData = this.labels.get(entityId);
    if (labelData) {
      labelData.label.position.copy(position);
      labelData.label.position.y += 1.5;
    }
  }

  public removeLabelsFromScene(): void {
    this.labels.forEach((labelData) => {
      this.labelsGroup.remove(labelData.label);
    });
  }

  public removeLabelsExcept(entityId?: number): void {
    this.labels.forEach((labelData) => {
      if (labelData.entityId !== entityId) {
        this.labelsGroup.remove(labelData.label);
      }
    });
  }

  public addLabelsToScene(): void {
    this.labels.forEach((labelData) => {
      if (!this.labelsGroup.children.includes(labelData.label)) {
        this.labelsGroup.add(labelData.label);
      }
    });
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
  }

  public updateAllInstances(): void {
    this.models.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
          mesh.instanceColor.needsUpdate = true;
        }
      });
    });

    // Also update cosmetic models
    this.cosmeticModels.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
          mesh.instanceColor.needsUpdate = true;
        }
      });
    });
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
    const drawCount = maxIndex >= 0 ? maxIndex + 1 : 0;

    this.models.forEach((modelData) => {
      this.ensureModelCapacity(modelData, drawCount);
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.count = drawCount;
      });
    });

    // Also update cosmetic models
    this.cosmeticModels.forEach((modelData) => {
      this.ensureModelCapacity(modelData, drawCount);
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.count = drawCount;
      });
    });
  }

  public setVisibleCount(count: number): void {
    if (count < 0) return;
    const slots: number[] = [];
    for (let i = 0; i < count; i++) {
      slots.push(i);
    }
    this.setVisibleSlots(slots);
  }

  public setAnimationState(index: number, isWalking: boolean): void {
    this.animationStates[index] = isWalking ? ANIMATION_STATE_MOVING : ANIMATION_STATE_IDLE;
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

  public raycastAll(raycaster: Raycaster): Array<{ instanceId: number | undefined; mesh: InstancedMesh }> {
    const results: Array<{ instanceId: number | undefined; mesh: InstancedMesh }> = [];

    this.models.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        const intersects = raycaster.intersectObject(mesh);
        if (intersects.length > 0) {
          results.push({
            instanceId: intersects[0].instanceId,
            mesh: mesh,
          });
        }
      });
    });

    return this.sortRaycastResults(results, raycaster);
  }

  private sortRaycastResults(
    results: Array<{ instanceId: number | undefined; mesh: InstancedMesh }>,
    raycaster: Raycaster,
  ): Array<{ instanceId: number | undefined; mesh: InstancedMesh }> {
    return results.sort((a, b) => {
      const intersectsA = raycaster.intersectObject(a.mesh);
      const intersectsB = raycaster.intersectObject(b.mesh);
      return intersectsA[0].distance - intersectsB[0].distance;
    });
  }

  /**
   * Dispose of all resources including shared materials
   */
  public dispose(): void {
    // Dispose geometries and release materials from pool
    this.models.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        // Release material from pool (handle both single and array materials)
        const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        ArmyModel.materialPool.releaseMaterial(material);

        // Dispose geometry
        mesh.geometry.dispose();

        // Remove from scene
        this.scene.remove(mesh);
      });

      // Dispose animations
      modelData.mixer.stopAllAction();

      // Remove group from scene
      this.scene.remove(modelData.group);
    });

    // Dispose cosmetic models
    this.cosmeticModels.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        ArmyModel.materialPool.releaseMaterial(material);
        mesh.geometry.dispose();
        this.scene.remove(mesh);
      });
      modelData.mixer.stopAllAction();
      this.scene.remove(modelData.group);
    });

    // Clear all data structures
    this.models.clear();
    this.cosmeticModels.clear();
    this.entityModelMap.clear();
    this.entityCosmeticMap.clear();
    this.activeBaseModelByEntity.clear();
    this.activeCosmeticByEntity.clear();
    this.movingInstances.clear();
    this.instanceData.clear();
    this.matrixIndexOwners.clear();
    this.labels.clear();
    this.movementCompleteCallbacks.clear();

    console.log("ArmyModel: Disposed all resources");
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

// Global debug functions for testing easing in armies
(window as any).setArmyEasing = (easingType: EasingType) => {
  console.log(`🎮 Setting army default easing to: ${easingType}`);
  // Note: This requires access to ArmyModel instance - implement in army manager if needed
};

(window as any).setTierEasing = (tier: TroopTier, easingType: EasingType) => {
  console.log(`🎮 Setting tier ${tier} easing to: ${easingType}`);
  // Note: This requires access to ArmyModel instance - implement in army manager if needed
};
