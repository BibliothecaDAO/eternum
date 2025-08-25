import { CameraView } from "@/three/scenes/hexagon-scene";
import { gltfLoader } from "@/three/utils/utils";
import { GRAPHICS_SETTING, GraphicsSettings } from "@/ui/config";
import { getCharacterModel } from "@/utils/agent";
import { Biome } from "@bibliothecadao/eternum";
import { BiomeType, FELT_CENTER, TroopTier, TroopType } from "@bibliothecadao/types";
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

export class ArmyModel {
  // Core properties
  private readonly scene: Scene;
  private readonly dummyObject: Object3D;
  public readonly loadPromise: Promise<void>;

  // Model and instance management
  private readonly models: Map<ModelType, ModelData> = new Map();
  private readonly entityModelMap: Map<number, ModelType> = new Map();
  private readonly movingInstances: Map<number, MovementData> = new Map();
  private readonly instanceData: Map<number, ArmyInstanceData> = new Map();
  private readonly labels: Map<number, { label: CSS2DObject; entityId: number }> = new Map();
  private readonly labelsGroup: Group;
  private currentCameraView: CameraView = CameraView.Medium;

  // Reusable objects for matrix operations and memory optimization
  private readonly dummyMatrix: Matrix4 = new Matrix4();
  private readonly dummyEuler: Euler = new Euler();
  private readonly tempVector1: Vector3 = new Vector3();
  private readonly tempVector2: Vector3 = new Vector3();
  private readonly tempVector3: Vector3 = new Vector3();

  // Animation and state management
  private readonly animationStates: Float32Array;
  private readonly timeOffsets: Float32Array;
  private instanceCount = 0;
  private currentVisibleCount: number = 0;

  // Configuration constants
  private readonly SCALE_TRANSITION_SPEED = 5.0;
  // Faster base movement for snappier feel
  private readonly MOVEMENT_SPEED = 2.1;
  private readonly FLOAT_HEIGHT = 0.5;
  private readonly FLOAT_TRANSITION_SPEED = 3.6;
  private readonly ROTATION_SPEED = 8.0;
  private readonly zeroScale = new Vector3(0, 0, 0);
  private readonly normalScale = new Vector3(1, 1, 1);
  private readonly boatScale = new Vector3(1, 1, 1);
  private readonly agentScale = new Vector3(2, 2, 2);

  // agent
  private isAgent: boolean = false;

  // Memory monitoring
  private memoryMonitor: MemoryMonitor;

  // Material sharing
  private static materialPool = MaterialPool.getInstance();

  // Movement easing configuration
  private defaultEasingType: EasingType = EasingType.EaseOut;
  private tierEasingMap: Map<TroopTier, EasingType> = new Map([
    ["T1" as TroopTier, EasingType.EaseOutCubic],
    ["T2" as TroopTier, EasingType.EaseOutQuart],
    ["T3" as TroopTier, EasingType.EaseOutQuart],
  ]);

  constructor(scene: Scene, labelsGroup?: Group, cameraView?: CameraView) {
    this.scene = scene;
    this.dummyObject = new Object3D();
    this.loadPromise = this.loadModels();
    this.labelsGroup = labelsGroup || new Group();
    this.currentCameraView = cameraView || CameraView.Medium;

    // Initialize memory monitor for army model operations
    this.memoryMonitor = new MemoryMonitor({
      spikeThresholdMB: 20, // Lower threshold for model operations
      onMemorySpike: (spike) => {
        console.warn(`🪖  Army Model Memory Spike: +${spike.increaseMB.toFixed(1)}MB in ${spike.context}`);
      },
    });

    // Initialize animation arrays
    this.timeOffsets = new Float32Array(MAX_INSTANCES);
    this.animationStates = new Float32Array(MAX_INSTANCES);
    this.initializeAnimationArrays();
  }

  // Initialization methods
  private initializeAnimationArrays(): void {
    for (let i = 0; i < MAX_INSTANCES; i++) {
      this.timeOffsets[i] = Math.random() * 3;
      this.animationStates[i] = ANIMATION_STATE_IDLE;
    }
  }

  private async loadModels(): Promise<void> {
    const modelTypes = Object.entries(MODEL_TYPE_TO_FILE);
    const loadPromises = modelTypes.map(([type, fileName]) => this.loadSingleModel(type as ModelType, fileName));
    await Promise.all(loadPromises);
  }

  private async loadSingleModel(modelType: ModelType, fileName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      gltfLoader.load(
        `models/${fileName}`,
        (gltf) => {
          // if (modelType === ModelType.Paladin2) {
          //   console.log("Paladin", gltf.scene);
          // }
          const modelData = this.createModelData(gltf);
          this.models.set(modelType, modelData);
          resolve();
        },
        undefined,
        reject,
      );
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
    // Share source geometry to avoid duplicate GPU/heap allocations
    // Geometry is owned by the GLTF scene; we must not dispose it here.
    const geometry = mesh.geometry;

    // Handle both single material and material array cases
    const sourceMaterial = Array.isArray(mesh.material) ? (mesh.material as any[])[0] : (mesh.material as any);
    const needsOpacityOverride = sourceMaterial?.name?.includes("stand");
    let material = sourceMaterial as any;
    if (needsOpacityOverride) {
      // Clone to safely adjust transparency without affecting the original
      material = sourceMaterial.clone();
      material.transparent = true;
      material.opacity = 0.9;
    }
    const instancedMesh = new InstancedMesh(geometry, material, MAX_INSTANCES) as AnimatedInstancedMesh;

    instancedMesh.frustumCulled = true;
    instancedMesh.castShadow = true;
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.renderOrder = 10 + meshIndex;
    // @ts-ignore
    if (mesh.material.name.includes("stand")) {
      // Use Float32 colors for correctness with setColorAt
      instancedMesh.instanceColor = new InstancedBufferAttribute(new Float32Array(MAX_INSTANCES * 3), 3);
    }

    if (animations.length > 0) {
      this.setupMeshAnimation(instancedMesh, mesh, animations);
    }

    // Track morph initialization progress
    (instancedMesh.userData as any).morphInitCount = 0;
    instancedMesh.count = 0;
    return instancedMesh;
  }

  // Dispose instanced resources (materials via pool, morph textures) and detach from scene
  public dispose(): void {
    try {
      this.models.forEach((modelData) => {
        // Remove group from scene
        if (modelData.group.parent) {
          modelData.group.parent.remove(modelData.group);
        }

        // Release instanced mesh resources
        modelData.instancedMeshes.forEach((mesh) => {
          // Release pooled materials (handle arrays defensively)
          const material = mesh.material as any;
          if (Array.isArray(material)) {
            material.forEach((m) => {
              if (!ArmyModel.materialPool.releaseMaterial(m)) m.dispose();
            });
          } else if (material) {
            if (!ArmyModel.materialPool.releaseMaterial(material)) material.dispose();
          }

          // Morph textures are created per-instanced mesh
          if ((mesh as any).morphTexture) {
            (mesh as any).morphTexture.dispose();
          }
        });

        // Stop animations and clear references
        try {
          modelData.animationActions.clear();
          modelData.mixer.stopAllAction();
        } catch {}
      });

      this.models.clear();
      this.entityModelMap.clear();
      this.movingInstances.clear();
      this.instanceData.clear();
      this.labels.clear();
      this.instanceCount = 0;
      this.currentVisibleCount = 0;
    } catch (e) {
      console.warn("ArmyModel.dispose error", e);
    }
  }

  private setupMeshAnimation(instancedMesh: AnimatedInstancedMesh, mesh: Mesh, animations: any[]): void {
    const hasAnimation = animations[0].tracks.find((track: any) => track.name.split(".")[0] === mesh.name);

    if (hasAnimation) {
      // Mark as animated, but defer morph initialization until instances become visible.
      instancedMesh.animated = true;
      (instancedMesh.userData as any).baseMeshRef = mesh;
    }
  }

  // Instance Management Methods
  public assignModelToEntity(entityId: number, modelType: ModelType): void {
    const oldModelType = this.entityModelMap.get(entityId);
    if (oldModelType === modelType) return;
    this.entityModelMap.set(entityId, modelType);
  }

  public getModelForEntity(entityId: number): ModelData | undefined {
    const modelType = this.entityModelMap.get(entityId);
    if (!modelType) return undefined;
    return this.models.get(modelType);
  }

  public updateInstance(
    entityId: number,
    index: number,
    position: Vector3,
    scale: Vector3,
    rotation?: Euler,
    color?: Color,
  ): void {
    this.models.forEach((modelData, modelType) => {
      const isActiveModel = modelType === this.entityModelMap.get(entityId);
      let targetScale = this.zeroScale;

      if (isActiveModel) {
        if (modelType === ModelType.Boat) {
          targetScale = this.boatScale;
        } else if (modelType === ModelType.AgentIstarai || modelType === ModelType.AgentElisa) {
          targetScale = this.agentScale;
        } else {
          targetScale = this.normalScale;
        }
      }

      this.updateInstanceTransform(position, targetScale, rotation);
      this.updateInstanceMeshes(modelData, index, color);
    });
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

  private updateInstanceMeshes(modelData: ModelData, index: number, color?: Color): void {
    modelData.instancedMeshes.forEach((mesh) => {
      const capacity = ((mesh.instanceMatrix as any).count ?? 0) as number;
      if (index < capacity) {
        mesh.setMatrixAt(index, this.dummyObject.matrix);
        mesh.instanceMatrix.needsUpdate = true;
      } else {
        // Out of capacity; skip safely
        return;
      }

      if (color && mesh.instanceColor) {
        try {
          mesh.setColorAt(index, color);
          mesh.instanceColor.needsUpdate = true;
        } catch {}
      }

      mesh.userData.entityIdMap = mesh.userData.entityIdMap || new Map();
      mesh.userData.entityIdMap.set(index, index);
    });
  }

  

  // Animation Methods
  public updateAnimations(deltaTime: number): void {
    if (GRAPHICS_SETTING === GraphicsSettings.LOW) return;

    const time = performance.now() * 0.001;

    this.models.forEach((modelData) => {
      this.updateModelAnimations(modelData, time);
    });
  }

  private updateModelAnimations(modelData: ModelData, time: number): void {
    modelData.instancedMeshes.forEach((mesh, meshIndex) => {
      if (!mesh.animated) return;

      for (let i = 0; i < mesh.count; i++) {
        this.updateInstanceAnimation(modelData, mesh, meshIndex, i, time);
      }

      if (mesh.morphTexture) {
        mesh.morphTexture.needsUpdate = true;
      }
    });
  }

  private updateInstanceAnimation(
    modelData: ModelData,
    mesh: AnimatedInstancedMesh,
    meshIndex: number,
    instanceIndex: number,
    time: number,
  ): void {
    const animationState = this.animationStates[instanceIndex];

    if (this.shouldSkipAnimation(animationState)) return;

    const actions = this.getOrCreateAnimationActions(modelData, instanceIndex);
    this.updateAnimationState(actions, animationState);

    modelData.mixer.setTime(time + this.timeOffsets[instanceIndex]);
    mesh.setMorphAt(instanceIndex, modelData.baseMeshes[meshIndex] as any);
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
    this.memoryMonitor.getCurrentStats(`startMovement-${entityId}`);

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
      this.memoryMonitor.getCurrentStats(`updateMovements-bulk-${this.movingInstances.size}`);
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

    // Smoothly restore scale back to normal during descent
    const instanceScale = instanceData.scale;
    const restoreSpeed = 8.0 * deltaTime;
    instanceScale.x += (1.0 - instanceScale.x) * restoreSpeed;
    instanceScale.y += (1.0 - instanceScale.y) * restoreSpeed;
    instanceScale.z += (1.0 - instanceScale.z) * restoreSpeed;

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
    const distance = movement.startPos.distanceTo(movement.endPos);
    const travelTime = distance / this.MOVEMENT_SPEED;
    movement.progress += deltaTime / travelTime;

    if (movement.progress >= 1) {
      this.handlePathCompletion(movement, instanceData);
    } else {
      // Apply dynamic easing based on army type for juicy movement
      const easingType = this.getEasingTypeForMovement(instanceData.entityId, instanceData);
      const easedProgress = applyEasing(movement.progress, easingType);
      // Add squash-and-stretch for juice (skip for boats)
      const modelType = this.entityModelMap.get(instanceData.entityId);
      const isBoat = modelType === ModelType.Boat;
      if (!isBoat) {
        this.applyJuicyScale(instanceData, movement.progress);
      }
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

  // Squash and stretch: early stretch, late squash, then normalize
  private applyJuicyScale(instanceData: ArmyInstanceData, linearProgress: number): void {
    // Base normal
    const sx0 = 1.0, sy0 = 1.0, sz0 = 1.0;
    let sx = sx0, sy = sy0, sz = sz0;

    // Anticipation/stretch for first 15% of movement
    if (linearProgress < 0.15) {
      const t = linearProgress / 0.15; // 0..1
      // Stretch up, thin horizontally
      sy = 1.0 + 0.15 * (1.0 - (1.0 - t) * (1.0 - t)); // easeOut
      sx = 1.0 - 0.08 * (1.0 - t);
      sz = sx;
    }
    // Squash right before arrival (last 15%)
    else if (linearProgress > 0.85) {
      const t = (linearProgress - 0.85) / 0.15; // 0..1
      // Squash down, widen horizontally
      sy = 1.0 - 0.10 * t;
      sx = 1.0 + 0.06 * t;
      sz = sx;
    }

    instanceData.scale.set(sx, sy, sz);
  }

  private updateInstanceDirection(entityId: number, fromPos: Vector3, toPos: Vector3): void {
    const movement = this.movingInstances.get(entityId);
    if (!movement) return;

    const direction = new Vector3().subVectors(toPos, fromPos).normalize();
    const baseAngle = Math.atan2(direction.x, direction.z);

    movement.targetRotation = baseAngle;
    if (movement.currentRotation === 0) {
      movement.currentRotation = baseAngle;
    }
  }

  private updateModelTypeForPosition(entityId: number, position: Vector3, category: TroopType, tier: TroopTier): void {
    const { col, row } = getHexForWorldPosition(position);
    const biome = Biome.getBiome(col + FELT_CENTER, row + FELT_CENTER);

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

    // For land biomes, return the appropriate model based on troop type and tier
    return TROOP_TO_MODEL[troopType][troopTier];
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
  }

  public setVisibleCount(count: number): void {
    if (count === this.currentVisibleCount) return;

    let clampedVisible = count;
    this.models.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh, meshIndex) => {
        const capacity = ((mesh.instanceMatrix as any).count ?? MAX_INSTANCES) as number;
        const target = Math.min(count, capacity);
        // Ensure morphs are initialized for new indices (handles LOW setting too)
        const baseMesh = modelData.baseMeshes[meshIndex];
        this.ensureMorphInitialized(mesh, baseMesh, target);
        mesh.count = target;
        if (target < clampedVisible) clampedVisible = target;
      });
    });
    this.currentVisibleCount = clampedVisible;
  }

  private ensureMorphInitialized(mesh: AnimatedInstancedMesh, baseMesh: Mesh, targetCount: number) {
    try {
      if (!mesh.animated) return;
      if (!baseMesh) return;
      const capacity = ((mesh.instanceMatrix as any).count ?? MAX_INSTANCES) as number;
      const initCount: number = (mesh.userData as any).morphInitCount || 0;
      const target = Math.min(targetCount, capacity);
      if (target <= initCount) return;
      for (let i = initCount; i < target; i++) {
        mesh.setMorphAt(i, baseMesh as any);
      }
      if ((mesh as any).morphTexture) {
        (mesh as any).morphTexture.needsUpdate = true;
      }
      (mesh.userData as any).morphInitCount = target;
    } catch (e) {
      console.warn('[ArmyModel] ensureMorphInitialized error', e);
    }
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

  // (duplicate dispose removed; see unified dispose above)
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
