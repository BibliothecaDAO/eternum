import { gltfLoader } from "@/three/helpers/utils";
import { GRAPHICS_SETTING, GraphicsSettings } from "@/ui/config";
import { TroopTier, TroopType } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { AnimationClip, AnimationMixer } from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";

interface MovementData {
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  progress: number;
  matrixIndex: number;
  currentPathIndex: number;
}

interface LabelData {
  label: CSS2DObject;
  entityId: number;
}

interface ArmyInstanceData {
  entityId: number;
  position: THREE.Vector3;
  scale: THREE.Vector3;
  rotation?: THREE.Euler;
  color?: THREE.Color;
  isMoving: boolean;
  path?: THREE.Vector3[];
}

export enum ModelType {
  Boat = "boat",
  Knight1 = "knight1",
  Knight2 = "knight2",
  Knight3 = "knight3",
  Crossbowman1 = "crossbowman1",
  Crossbowman2 = "crossbowman2",
  Crossbowman3 = "crossbowman3",
  Paladin1 = "paladin1",
  Paladin2 = "paladin2",
  Paladin3 = "paladin3",
}

export enum AnimationState {
  Idle = 0,
  Moving = 1,
}

const MAX_INSTANCES = 1000;
const ANIMATION_STATE_IDLE = AnimationState.Idle;
const ANIMATION_STATE_MOVING = AnimationState.Moving;

// Map troop type and tier to model type
export const TROOP_TO_MODEL: Record<TroopType, Record<TroopTier, ModelType>> = {
  [TroopType.Knight]: {
    [TroopTier.T1]: ModelType.Knight1,
    [TroopTier.T2]: ModelType.Knight2,
    [TroopTier.T3]: ModelType.Knight3,
  },
  [TroopType.Crossbowman]: {
    [TroopTier.T1]: ModelType.Crossbowman1,
    [TroopTier.T2]: ModelType.Crossbowman2,
    [TroopTier.T3]: ModelType.Crossbowman3,
  },
  [TroopType.Paladin]: {
    [TroopTier.T1]: ModelType.Paladin1,
    [TroopTier.T2]: ModelType.Paladin2,
    [TroopTier.T3]: ModelType.Paladin3,
  },
};

// Map model type to file name
const MODEL_TYPE_TO_FILE: Record<ModelType, string> = {
  [ModelType.Boat]: "boat",
  [ModelType.Knight1]: "knight1",
  [ModelType.Knight2]: "knight1",
  [ModelType.Knight3]: "knight1",
  [ModelType.Crossbowman1]: "knight2",
  [ModelType.Crossbowman2]: "knight2",
  [ModelType.Crossbowman3]: "knight2",
  [ModelType.Paladin1]: "knight3",
  [ModelType.Paladin2]: "knight3",
  [ModelType.Paladin3]: "knight3",
};

interface AnimatedInstancedMesh extends THREE.InstancedMesh {
  animated?: boolean;
}

interface ModelData {
  group: THREE.Group;
  instancedMeshes: AnimatedInstancedMesh[];
  biomeMeshes: THREE.Mesh[];
  mixer: AnimationMixer;
  animations: {
    idle: AnimationClip;
    moving: AnimationClip;
  };
  animationActions: Map<
    number,
    {
      idle: THREE.AnimationAction;
      moving: THREE.AnimationAction;
    }
  >;
  activeInstances: Set<number>;
  targetScales: Map<number, THREE.Vector3>;
  currentScales: Map<number, THREE.Vector3>;
}

export class ArmyModel {
  private scene: THREE.Scene;
  dummyObject: THREE.Object3D;
  loadPromise: Promise<void>;
  private models: Map<ModelType, ModelData> = new Map();
  private entityModelMap: Map<number, ModelType> = new Map();
  private movingInstances: Map<number, MovementData> = new Map();
  private labels: Map<number, LabelData> = new Map();
  private instanceData: Map<number, ArmyInstanceData> = new Map();
  animationStates: Float32Array;
  timeOffsets: Float32Array;
  private zeroScale = new THREE.Vector3(0, 0, 0);
  private normalScale = new THREE.Vector3(1, 1, 1);
  private instanceCount = 0;
  private currentVisibleCount: number = 0;
  private readonly SCALE_TRANSITION_SPEED = 5.0;
  private readonly MOVEMENT_SPEED = 1.25;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.dummyObject = new THREE.Object3D();
    this.loadPromise = this.loadModels();
    this.timeOffsets = new Float32Array(MAX_INSTANCES);
    for (let i = 0; i < MAX_INSTANCES; i++) {
      this.timeOffsets[i] = Math.random() * 3;
    }
    this.animationStates = new Float32Array(MAX_INSTANCES);
    for (let i = 0; i < MAX_INSTANCES; i++) {
      this.animationStates[i] = ANIMATION_STATE_IDLE;
    }
  }

  private async loadModels(): Promise<void> {
    const modelTypes = Object.entries(MODEL_TYPE_TO_FILE);
    const loadPromises = modelTypes.map(([type, fileName]) => this.loadSingleModel(type as ModelType, fileName));
    await Promise.all(loadPromises);
  }

  private async loadSingleModel(modelType: ModelType, fileName: string): Promise<void> {
    const loader = gltfLoader;
    return new Promise((resolve, reject) => {
      loader.load(
        `models/units/${fileName}.glb`,
        (gltf) => {
          const group = new THREE.Group();
          const instancedMeshes: AnimatedInstancedMesh[] = [];
          const biomeMeshes: THREE.Mesh[] = [];
          let meshIndex = 0;

          gltf.scene.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              const geometry = child.geometry.clone();
              const material = child.material;
              const instancedMesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES) as AnimatedInstancedMesh;

              instancedMesh.frustumCulled = true;
              instancedMesh.castShadow = true;
              instancedMesh.instanceMatrix.needsUpdate = true;

              if (meshIndex > 0) {
                instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
                  new Float32Array(MAX_INSTANCES * 3),
                  3,
                );
              }

              if (gltf.animations.length > 0) {
                const hasAnimation = gltf.animations[0].tracks.find(
                  (track: any) => track.name.split(".")[0] === child.name,
                );
                if (hasAnimation) {
                  instancedMesh.animated = true;
                  for (let i = 0; i < MAX_INSTANCES; i++) {
                    instancedMesh.setMorphAt(i, child as any);
                  }
                  instancedMesh.morphTexture!.needsUpdate = true;
                }
              }

              instancedMesh.count = 0;
              group.add(instancedMesh);
              instancedMeshes.push(instancedMesh);
              biomeMeshes.push(child);
              meshIndex++;
            }
          });

          this.scene.add(group);

          const mixer = new AnimationMixer(gltf.scene);

          this.models.set(modelType, {
            group,
            instancedMeshes,
            biomeMeshes,
            mixer,
            animations: {
              idle: gltf.animations[0],
              moving: gltf.animations[1] || gltf.animations[0]?.clone(),
            },
            animationActions: new Map(),
            activeInstances: new Set(),
            targetScales: new Map(),
            currentScales: new Map(),
          });

          resolve();
        },
        undefined,
        reject,
      );
    });
  }

  assignModelToEntity(entityId: number, modelType: ModelType) {
    const oldModelType = this.entityModelMap.get(entityId);
    if (oldModelType === modelType) return;
    this.entityModelMap.set(entityId, modelType);
  }

  getModelForEntity(entityId: number): ModelData | undefined {
    const modelType = this.entityModelMap.get(entityId);
    if (!modelType) return undefined;
    return this.models.get(modelType);
  }

  updateInstance(
    entityId: number,
    index: number,
    position: THREE.Vector3,
    scale: THREE.Vector3,
    rotation?: THREE.Euler,
    color?: THREE.Color,
  ) {
    this.models.forEach((modelData, modelType) => {
      const isActiveModel = modelType === this.entityModelMap.get(entityId);
      const targetScale = isActiveModel ? this.normalScale : this.zeroScale;

      this.dummyObject.position.copy(position);
      this.dummyObject.position.y += 0.15;
      this.dummyObject.scale.copy(targetScale);
      if (rotation) {
        this.dummyObject.rotation.copy(rotation);
      }

      this.dummyObject.updateMatrix();

      modelData.instancedMeshes.forEach((mesh) => {
        mesh.setMatrixAt(index, this.dummyObject.matrix);
        mesh.instanceMatrix.needsUpdate = true;

        if (color && mesh.instanceColor) {
          mesh.setColorAt(index, color);
          mesh.instanceColor.needsUpdate = true;
        }

        mesh.userData.entityIdMap = mesh.userData.entityIdMap || new Map();
        mesh.userData.entityIdMap.set(index, entityId);
      });
    });
  }

  updateAnimations(deltaTime: number) {
    if (GRAPHICS_SETTING === GraphicsSettings.LOW) {
      return;
    }

    const time = performance.now() * 0.001;

    this.models.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh, meshIndex) => {
        if (!mesh.animated) return;

        for (let i = 0; i < mesh.count; i++) {
          const animationState = this.animationStates[i];
          if (
            (GRAPHICS_SETTING === GraphicsSettings.MID && animationState === ANIMATION_STATE_IDLE) ||
            GRAPHICS_SETTING === GraphicsSettings.LOW
          ) {
            continue;
          }

          if (!modelData.animationActions.has(i)) {
            const idleAction = modelData.mixer.clipAction(modelData.animations.idle);
            const movingAction = modelData.mixer.clipAction(modelData.animations.moving);
            modelData.animationActions.set(i, { idle: idleAction, moving: movingAction });
          }

          const actions = modelData.animationActions.get(i)!;
          if (animationState === ANIMATION_STATE_IDLE) {
            actions.idle.setEffectiveTimeScale(1);
            actions.moving.setEffectiveTimeScale(0);
          } else if (animationState === ANIMATION_STATE_MOVING) {
            actions.idle.setEffectiveTimeScale(0);
            actions.moving.setEffectiveTimeScale(1);
          }

          actions.idle.play();
          actions.moving.play();

          modelData.mixer.setTime(time + this.timeOffsets[i]);
          mesh.setMorphAt(i, modelData.biomeMeshes[meshIndex] as any);
        }

        if (mesh.morphTexture) {
          mesh.morphTexture.needsUpdate = true;
        }
      });
    });
  }

  updateInstanceMatrix() {
    this.models.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
      });
    });
  }

  computeBoundingSphere() {
    this.models.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.computeBoundingSphere();
      });
    });
  }

  setAnimationState(index: number, isWalking: boolean) {
    this.animationStates[index] = isWalking ? ANIMATION_STATE_MOVING : ANIMATION_STATE_IDLE;
  }

  raycastAll(raycaster: THREE.Raycaster): Array<{ instanceId: number | undefined; mesh: THREE.InstancedMesh }> {
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

    results.sort((a, b) => {
      const intersectsA = raycaster.intersectObject(a.mesh);
      const intersectsB = raycaster.intersectObject(b.mesh);
      return intersectsA[0].distance - intersectsB[0].distance;
    });

    return results;
  }

  resetInstanceCounts() {
    this.currentVisibleCount = 0;
    this.models.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.count = 0;
      });
      modelData.activeInstances.clear();
    });
  }

  updateAllInstances() {
    this.models.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
          mesh.instanceColor.needsUpdate = true;
        }
      });
    });
  }

  setVisibleCount(count: number) {
    if (count === this.currentVisibleCount) return;

    this.currentVisibleCount = count;
    this.models.forEach((modelData) => {
      modelData.instancedMeshes.forEach((mesh) => {
        mesh.count = count;
      });
    });
  }

  public startMovement(entityId: number, path: THREE.Vector3[], matrixIndex: number) {
    if (path.length < 2) return;

    const currentPos = path[0];
    const nextPos = path[1];

    this.instanceData.set(entityId, {
      entityId,
      position: currentPos.clone(),
      scale: this.normalScale.clone(),
      isMoving: true,
      path: path,
    });

    this.movingInstances.set(entityId, {
      startPos: currentPos.clone(),
      endPos: nextPos.clone(),
      progress: 0,
      matrixIndex,
      currentPathIndex: 0,
    });

    this.setAnimationState(matrixIndex, true);
    this.updateInstanceDirection(entityId, currentPos, nextPos);
  }

  public updateMovements(deltaTime: number) {
    this.movingInstances.forEach((movement, entityId) => {
      const instanceData = this.instanceData.get(entityId);
      if (!instanceData) {
        this.stopMovement(entityId);
        return;
      }

      const distance = movement.startPos.distanceTo(movement.endPos);
      const travelTime = distance / this.MOVEMENT_SPEED;
      movement.progress += deltaTime / travelTime;

      if (movement.progress >= 1) {
        instanceData.position.copy(movement.endPos);

        // Check for next path segment
        if (instanceData.path && movement.currentPathIndex < instanceData.path.length - 2) {
          movement.currentPathIndex++;
          const nextPos = instanceData.path[movement.currentPathIndex + 1];

          movement.startPos.copy(movement.endPos);
          movement.endPos.copy(nextPos);
          movement.progress = 0;

          this.updateInstanceDirection(entityId, movement.startPos, movement.endPos);
        } else {
          this.stopMovement(entityId);
        }
      } else {
        instanceData.position.copy(movement.startPos).lerp(movement.endPos, movement.progress);
      }

      this.updateInstance(
        entityId,
        movement.matrixIndex,
        instanceData.position,
        instanceData.scale,
        this.dummyObject.rotation,
        instanceData.color,
      );

      this.updateLabelPosition(entityId, instanceData.position);
    });
  }

  private stopMovement(entityId: number) {
    const movement = this.movingInstances.get(entityId);
    if (movement) {
      this.setAnimationState(movement.matrixIndex, false);
      this.movingInstances.delete(entityId);

      const instanceData = this.instanceData.get(entityId);
      if (instanceData) {
        instanceData.isMoving = false;
        instanceData.path = undefined;
      }
    }
  }

  private updateInstanceDirection(entityId: number, fromPos: THREE.Vector3, toPos: THREE.Vector3) {
    const direction = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
    const angle = Math.atan2(direction.x, direction.z);
    this.dummyObject.rotation.set(0, angle + Math.PI / 6, 0);
  }

  public addLabel(entityId: number, labelElement: HTMLElement, position: THREE.Vector3) {
    const label = new CSS2DObject(labelElement);
    label.position.copy(position);
    label.position.y += 1.5;

    this.labels.set(entityId, { label, entityId });
    this.scene.add(label);
  }

  public removeLabel(entityId: number) {
    const labelData = this.labels.get(entityId);
    if (labelData) {
      this.scene.remove(labelData.label);
      this.labels.delete(entityId);
    }
  }

  private updateLabelPosition(entityId: number, position: THREE.Vector3) {
    const labelData = this.labels.get(entityId);
    if (labelData) {
      labelData.label.position.copy(position);
      labelData.label.position.y += 1.5;
    }
  }

  public removeLabelsFromScene() {
    this.labels.forEach((labelData) => {
      this.scene.remove(labelData.label);
    });
  }

  public addLabelsToScene() {
    this.labels.forEach((labelData) => {
      if (!this.scene.children.includes(labelData.label)) {
        this.scene.add(labelData.label);
      }
    });
  }
}
