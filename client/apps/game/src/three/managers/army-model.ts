import { gltfLoader } from "@/three/helpers/utils";
import { GRAPHICS_SETTING, GraphicsSettings } from "@/ui/config";
import { Biome } from "@bibliothecadao/eternum";
import { BiomeType, FELT_CENTER, TroopTier, TroopType } from "@bibliothecadao/types";
import * as THREE from "three";
import { AnimationMixer } from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import {
  ANIMATION_STATE_IDLE,
  ANIMATION_STATE_MOVING,
  MAX_INSTANCES,
  MODEL_TYPE_TO_FILE,
  TROOP_TO_MODEL,
} from "../constants/army.constants";
import { AnimatedInstancedMesh, ArmyInstanceData, ModelData, ModelType, MovementData } from "../types/army.types";
import { getHexForWorldPosition } from "../utils";

export class ArmyModel {
  // Core properties
  private readonly scene: THREE.Scene;
  private readonly dummyObject: THREE.Object3D;
  public readonly loadPromise: Promise<void>;

  // Model and instance management
  private readonly models: Map<ModelType, ModelData> = new Map();
  private readonly entityModelMap: Map<number, ModelType> = new Map();
  private readonly movingInstances: Map<number, MovementData> = new Map();
  private readonly instanceData: Map<number, ArmyInstanceData> = new Map();
  private readonly labels: Map<number, { label: CSS2DObject; entityId: number }> = new Map();
  private readonly labelsGroup: THREE.Group;

  // Reusable objects for matrix operations
  private readonly dummyMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private readonly dummyEuler: THREE.Euler = new THREE.Euler();

  // Animation and state management
  private readonly animationStates: Float32Array;
  private readonly timeOffsets: Float32Array;
  private instanceCount = 0;
  private currentVisibleCount: number = 0;

  // Configuration constants
  private readonly SCALE_TRANSITION_SPEED = 5.0;
  private readonly MOVEMENT_SPEED = 1.25;
  private readonly FLOAT_HEIGHT = 0.5;
  private readonly FLOAT_TRANSITION_SPEED = 3.0;
  private readonly ROTATION_SPEED = 5.0;
  private readonly zeroScale = new THREE.Vector3(0, 0, 0);
  private readonly normalScale = new THREE.Vector3(1, 1, 1);
  private readonly boatScale = new THREE.Vector3(1, 1, 1);

  constructor(scene: THREE.Scene, labelsGroup?: THREE.Group) {
    this.scene = scene;
    this.dummyObject = new THREE.Object3D();
    this.loadPromise = this.loadModels();
    this.labelsGroup = labelsGroup || new THREE.Group();

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
        `models/units/${fileName}.glb`,
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
    const group = new THREE.Group();
    const instancedMeshes: AnimatedInstancedMesh[] = [];
    const baseMeshes: THREE.Mesh[] = [];

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
    group: THREE.Group,
    instancedMeshes: AnimatedInstancedMesh[],
    baseMeshes: THREE.Mesh[],
  ): void {
    let meshIndex = 0;

    gltf.scene.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        const instancedMesh = this.createInstancedMesh(child, gltf.animations, meshIndex);
        group.add(instancedMesh);
        instancedMeshes.push(instancedMesh);
        baseMeshes.push(child);
        meshIndex++;
      }
    });
  }

  private createInstancedMesh(mesh: THREE.Mesh, animations: any[], meshIndex: number): AnimatedInstancedMesh {
    const geometry = mesh.geometry.clone();
    const material = new THREE.MeshBasicMaterial({
      map: (mesh.material as THREE.MeshStandardMaterial).map,
      transparent: (mesh.material as THREE.MeshStandardMaterial).transparent,
      side: (mesh.material as THREE.MeshStandardMaterial).side,
    });
    // @ts-ignore
    if (mesh.material.name.includes("stand")) {
      // @ts-ignore
      material.opacity = 0.9;
    }
    const instancedMesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES) as AnimatedInstancedMesh;

    instancedMesh.frustumCulled = true;
    instancedMesh.castShadow = true;
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.renderOrder = 10 + meshIndex;
    // @ts-ignore
    if (mesh.material.name.includes("stand")) {
      instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES * 3), 3);
    }

    if (animations.length > 0) {
      this.setupMeshAnimation(instancedMesh, mesh, animations);
    }

    instancedMesh.count = 0;
    return instancedMesh;
  }

  private setupMeshAnimation(instancedMesh: AnimatedInstancedMesh, mesh: THREE.Mesh, animations: any[]): void {
    const hasAnimation = animations[0].tracks.find((track: any) => track.name.split(".")[0] === mesh.name);

    if (hasAnimation) {
      instancedMesh.animated = true;
      for (let i = 0; i < MAX_INSTANCES; i++) {
        instancedMesh.setMorphAt(i, mesh as any);
      }
      instancedMesh.morphTexture!.needsUpdate = true;
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
    position: THREE.Vector3,
    scale: THREE.Vector3,
    rotation?: THREE.Euler,
    color?: THREE.Color,
  ): void {
    this.models.forEach((modelData, modelType) => {
      const isActiveModel = modelType === this.entityModelMap.get(entityId);
      const targetScale = isActiveModel
        ? modelType === ModelType.Boat
          ? this.boatScale
          : this.normalScale
        : this.zeroScale;

      this.updateInstanceTransform(position, targetScale, rotation);
      this.updateInstanceMeshes(modelData, index, color);
    });
  }

  private updateInstanceTransform(position: THREE.Vector3, scale: THREE.Vector3, rotation?: THREE.Euler): void {
    this.dummyObject.position.copy(position);
    this.dummyObject.position.y += 0.15;
    this.dummyObject.scale.copy(scale);
    if (rotation) {
      this.dummyObject.rotation.copy(rotation);
    }
    this.dummyObject.updateMatrix();
  }

  private updateInstanceMeshes(modelData: ModelData, index: number, color?: THREE.Color): void {
    modelData.instancedMeshes.forEach((mesh) => {
      mesh.setMatrixAt(index, this.dummyObject.matrix);
      mesh.instanceMatrix.needsUpdate = true;

      if (color && mesh.instanceColor) {
        mesh.setColorAt(index, color);
        mesh.instanceColor.needsUpdate = true;
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

  private updateAnimationState(
    actions: { idle: THREE.AnimationAction; moving: THREE.AnimationAction },
    state: number,
  ): void {
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
    path: THREE.Vector3[],
    matrixIndex: number,
    category: TroopType,
    tier: TroopTier,
  ): void {
    if (path.length < 2) return;

    this.stopMovement(entityId);
    const [currentPos, nextPos] = [path[0], path[1]];

    this.initializeMovement(entityId, currentPos, nextPos, path, matrixIndex, category, tier);
    this.setAnimationState(matrixIndex, true);
    this.updateInstanceDirection(entityId, currentPos, nextPos);
  }

  private initializeMovement(
    entityId: number,
    currentPos: THREE.Vector3,
    nextPos: THREE.Vector3,
    path: THREE.Vector3[],
    matrixIndex: number,
    category: TroopType,
    tier: TroopTier,
  ): void {
    this.instanceData.set(entityId, {
      entityId,
      position: currentPos.clone(),
      scale: this.normalScale.clone(),
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
        startPos: currentPos.clone(),
        endPos: nextPos.clone(),
        progress: 0,
        matrixIndex,
        currentPathIndex: 0,
        floatingHeight: 0,
        currentRotation: this.dummyEuler.y,
        targetRotation: this.dummyEuler.y,
      });
    } else {
      this.movingInstances.set(entityId, {
        startPos: currentPos.clone(),
        endPos: nextPos.clone(),
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

    const displayPosition = movement.startPos.clone();
    if (!isBoat) {
      displayPosition.y += movement.floatingHeight;
    }

    this.updateRotation(movement, deltaTime);
    this.updateInstance(
      entityId,
      movement.matrixIndex,
      displayPosition,
      instanceData.scale,
      this.dummyObject.rotation,
      instanceData.color,
    );

    this.updateLabelPosition(entityId, displayPosition);

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

    const displayPosition = instanceData.position.clone();
    if (!isBoat) {
      displayPosition.y += movement.floatingHeight;
    }

    this.updateInstance(
      entityId,
      movement.matrixIndex,
      displayPosition,
      instanceData.scale,
      this.dummyObject.rotation,
      instanceData.color,
    );

    this.updateLabelPosition(entityId, displayPosition);
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
      instanceData.position.copy(movement.startPos).lerp(movement.endPos, movement.progress);
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

  private updateInstanceDirection(entityId: number, fromPos: THREE.Vector3, toPos: THREE.Vector3): void {
    const movement = this.movingInstances.get(entityId);
    if (!movement) return;

    const direction = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
    const baseAngle = Math.atan2(direction.x, direction.z);

    movement.targetRotation = baseAngle;
    if (movement.currentRotation === 0) {
      movement.currentRotation = baseAngle;
    }
  }

  private updateModelTypeForPosition(
    entityId: number,
    position: THREE.Vector3,
    category: TroopType,
    tier: TroopTier,
  ): void {
    const { col, row } = getHexForWorldPosition(position);
    const biome = Biome.getBiome(col + FELT_CENTER, row + FELT_CENTER);

    const modelType =
      biome === BiomeType.Ocean || biome === BiomeType.DeepOcean ? ModelType.Boat : TROOP_TO_MODEL[category][tier];

    if (this.entityModelMap.get(entityId) !== modelType) {
      this.assignModelToEntity(entityId, modelType);
    }
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
      startPos: instanceData.position.clone(),
      endPos: instanceData.position.clone(),
      progress: 0,
      matrixIndex: movement.matrixIndex,
      currentPathIndex: -1,
      floatingHeight: movement.floatingHeight,
      currentRotation: movement.currentRotation,
      targetRotation: movement.currentRotation,
    });
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

  public updateLabelVisibility(entityId: number, isCompact: boolean): void {
    const labelData = this.labels.get(entityId);
    if (labelData?.label.element) {
      const textContainer = labelData.label.element.querySelector(".flex.flex-col");
      if (textContainer) {
        if (isCompact) {
          textContainer.classList.add("max-w-0", "ml-0");
          textContainer.classList.remove("max-w-[250px]", "ml-2");
        } else {
          textContainer.classList.remove("max-w-0", "ml-0");
          textContainer.classList.add("max-w-[250px]", "ml-2");
        }
      }
    }
  }

  private updateLabelPosition(entityId: number, position: THREE.Vector3): void {
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

    this.currentVisibleCount = count;
    this.models.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.count = count;
      });
    });
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

  public raycastAll(raycaster: THREE.Raycaster): Array<{ instanceId: number | undefined; mesh: THREE.InstancedMesh }> {
    const results: Array<{ instanceId: number | undefined; mesh: THREE.InstancedMesh }> = [];

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
    results: Array<{ instanceId: number | undefined; mesh: THREE.InstancedMesh }>,
    raycaster: THREE.Raycaster,
  ): Array<{ instanceId: number | undefined; mesh: THREE.InstancedMesh }> {
    return results.sort((a, b) => {
      const intersectsA = raycaster.intersectObject(a.mesh);
      const intersectsB = raycaster.intersectObject(b.mesh);
      return intersectsA[0].distance - intersectsB[0].distance;
    });
  }
}
