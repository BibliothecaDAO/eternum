import { GRAPHICS_SETTING, GraphicsSettings } from "@/ui/config";
import * as THREE from "three";
import { AnimationClip, AnimationMixer } from "three";
import { gltfLoader } from "../helpers/utils";

const MAX_INSTANCES = 1000;
const ANIMATION_STATE_IDLE = 0;
const ANIMATION_STATE_WALKING = 1;

interface ModelData {
  mesh: THREE.InstancedMesh;
  baseMesh: THREE.Object3D;
  mixer: AnimationMixer;
  animations: {
    idle: AnimationClip;
    walk: AnimationClip;
  };
  animationActions: Map<
    number,
    {
      idle: THREE.AnimationAction;
      walk: THREE.AnimationAction;
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
  private models: Map<string, ModelData> = new Map();
  private entityModelMap: Map<number, string> = new Map(); // Maps entity IDs to model types
  animationStates: Float32Array;
  timeOffsets: Float32Array;
  private zeroScale = new THREE.Vector3(0, 0, 0);
  private normalScale = new THREE.Vector3(0.3, 0.3, 0.3);
  private instanceCount = 0;
  private currentVisibleCount: number = 0;
  private readonly SCALE_TRANSITION_SPEED = 5.0; // Adjust this value to control transition speed

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
    // Load all model variants
    const modelTypes = ["knight", "boat"]; // Add more model types as needed
    const loadPromises = modelTypes.map((type) => this.loadSingleModel(type));
    await Promise.all(loadPromises);
  }

  private async loadSingleModel(modelType: string): Promise<void> {
    const loader = gltfLoader;
    return new Promise((resolve, reject) => {
      loader.load(
        `models/${modelType}.glb`,
        (gltf) => {
          const baseMesh = gltf.scene.children[0];
          const geometry = (baseMesh as THREE.Mesh).geometry.clone();
          const material = (baseMesh as THREE.Mesh).material;
          const instancedMesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
          instancedMesh.frustumCulled = true;
          instancedMesh.castShadow = true;
          instancedMesh.instanceMatrix.needsUpdate = true;
          this.scene.add(instancedMesh);

          for (let i = 0; i < MAX_INSTANCES; i++) {
            instancedMesh.setMorphAt(i, baseMesh as any);
          }
          instancedMesh.count = 0; // Always keep max count

          const mixer = new AnimationMixer(gltf.scene);

          this.models.set(modelType, {
            mesh: instancedMesh,
            baseMesh,
            mixer,
            animations: {
              idle: gltf.animations[0],
              walk: gltf.animations[1] || gltf.animations[0].clone(),
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

  assignModelToEntity(entityId: number, modelType: string) {
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

      // modelData.targetScales.set(index, targetScale.clone());
      // if (!modelData.currentScales.has(index)) {
      //   modelData.currentScales.set(index, targetScale.clone());
      // }

      // const currentScale = modelData.currentScales.get(index)!;
      this.dummyObject.position.copy(position);
      this.dummyObject.position.y += 0.15;
      this.dummyObject.scale.copy(targetScale);
      if (rotation) {
        this.dummyObject.rotation.copy(rotation);
      }

      if (color) {
        modelData.mesh.setColorAt(index, color);
        modelData.mesh.instanceColor!.needsUpdate = true;
      }
      this.dummyObject.updateMatrix();
      modelData.mesh.setMatrixAt(index, this.dummyObject.matrix);
      modelData.mesh.instanceMatrix.needsUpdate = true;
      modelData.mesh.userData.entityIdMap = modelData.mesh.userData.entityIdMap || new Map();
      modelData.mesh.userData.entityIdMap.set(index, entityId);
    });
  }

  updateAnimations(deltaTime: number) {
    const time = performance.now() * 0.001;

    // if (GRAPHICS_SETTING === GraphicsSettings.LOW) {
    //   return;
    // }

    this.models.forEach((modelData) => {
      let needsMatrixUpdate = false;

      // modelData.targetScales.forEach((targetScale, index) => {
      //   const currentScale = modelData.currentScales.get(index)!;
      //   const matrix = new THREE.Matrix4();
      //   modelData.mesh.getMatrixAt(index, matrix);

      //   // Interpolate scale
      //   currentScale.lerp(targetScale, deltaTime * this.SCALE_TRANSITION_SPEED);
      //   if (!currentScale.equals(targetScale)) {
      //     this.dummyObject.matrix.copy(matrix);
      //     this.dummyObject.scale.copy(currentScale);
      //     this.dummyObject.updateMatrix();
      //     modelData.mesh.setMatrixAt(index, this.dummyObject.matrix);
      //     needsMatrixUpdate = true;
      //   }
      // });

      if (needsMatrixUpdate) {
        modelData.mesh.instanceMatrix.needsUpdate = true;
      }

      for (let i = 0; i < modelData.mesh.count; i++) {
        const animationState = this.animationStates[i];
        if (
          (GRAPHICS_SETTING === GraphicsSettings.MID && animationState === ANIMATION_STATE_IDLE) ||
          GRAPHICS_SETTING === GraphicsSettings.LOW
        ) {
          continue;
        }

        if (!modelData.animationActions.has(i)) {
          const idleAction = modelData.mixer.clipAction(modelData.animations.idle);
          const walkAction = modelData.mixer.clipAction(modelData.animations.walk);
          modelData.animationActions.set(i, { idle: idleAction, walk: walkAction });
        }

        const actions = modelData.animationActions.get(i)!;
        if (animationState === ANIMATION_STATE_IDLE) {
          actions.idle.setEffectiveTimeScale(1);
          actions.walk.setEffectiveTimeScale(0);
        } else if (animationState === ANIMATION_STATE_WALKING) {
          actions.idle.setEffectiveTimeScale(0);
          actions.walk.setEffectiveTimeScale(1);
        }

        actions.idle.play();
        actions.walk.play();

        modelData.mixer.setTime(time + this.timeOffsets[i]);

        modelData.mesh.setMorphAt(i, modelData.baseMesh as any);
      }
      modelData.mesh.morphTexture!.needsUpdate = true;
    });
  }

  updateInstanceMatrix() {
    this.models.forEach((modelData) => {
      modelData.mesh.instanceMatrix.needsUpdate = true;
    });
  }

  computeBoundingSphere() {
    this.models.forEach((modelData) => {
      modelData.mesh.computeBoundingSphere();
    });
  }

  setAnimationState(index: number, isWalking: boolean) {
    this.animationStates[index] = isWalking ? ANIMATION_STATE_WALKING : ANIMATION_STATE_IDLE;
  }

  raycastAll(raycaster: THREE.Raycaster): Array<{ instanceId: number | undefined; mesh: THREE.InstancedMesh }> {
    const results: Array<{ instanceId: number | undefined; mesh: THREE.InstancedMesh }> = [];

    this.models.forEach((modelData) => {
      const intersects = raycaster.intersectObject(modelData.mesh);
      if (intersects.length > 0) {
        results.push({
          instanceId: intersects[0].instanceId,
          mesh: modelData.mesh,
        });
      }
    });

    // Sort by distance to get closest intersection first
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
      modelData.mesh.count = 0;
      modelData.activeInstances.clear();
    });
  }

  updateAllInstances() {
    this.models.forEach((modelData) => {
      modelData.mesh.instanceMatrix.needsUpdate = true;
      if (modelData.mesh.instanceColor) {
        modelData.mesh.instanceColor.needsUpdate = true;
      }
    });
  }

  setVisibleCount(count: number) {
    if (count === this.currentVisibleCount) return; // Skip if count hasn't changed

    this.currentVisibleCount = count;
    // Update all meshes to have the same count
    this.models.forEach((modelData) => {
      modelData.mesh.count = count;
    });
  }
}
