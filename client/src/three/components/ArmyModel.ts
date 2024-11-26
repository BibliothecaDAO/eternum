import { IS_LOW_GRAPHICS_ENABLED } from "@/ui/config";
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
}

export class ArmyModel {
  private scene: THREE.Scene;
  dummyObject: THREE.Object3D;
  loadPromise: Promise<void>;
  private models: Map<string, ModelData> = new Map();
  private entityModelMap: Map<number, string> = new Map(); // Maps entity IDs to model types
  animationStates: Float32Array;
  timeOffsets: Float32Array;

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
    const modelTypes = ["knight"]; // Add more model types as needed
    const loadPromises = modelTypes.map((type) => this.loadSingleModel(type));
    await Promise.all(loadPromises);
  }

  private async loadSingleModel(modelType: string): Promise<void> {
    const loader = gltfLoader;
    return new Promise((resolve, reject) => {
      loader.load(
        `models/${modelType}-opt.glb`,
        (gltf) => {
          const baseMesh = gltf.scene.children[0];
          const geometry = (baseMesh as THREE.Mesh).geometry;
          const material = (baseMesh as THREE.Mesh).material;

          const instancedMesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
          instancedMesh.frustumCulled = true;
          instancedMesh.castShadow = true;
          instancedMesh.instanceMatrix.needsUpdate = true;
          this.scene.add(instancedMesh);

          // Initialize morphs
          for (let i = 0; i < MAX_INSTANCES; i++) {
            instancedMesh.setMorphAt(i, baseMesh as any);
          }
          instancedMesh.morphTexture!.needsUpdate = true;
          instancedMesh.count = 0;

          const mixer = new AnimationMixer(gltf.scene);

          this.models.set(modelType, {
            mesh: instancedMesh,
            baseMesh,
            mixer,
            animations: {
              idle: gltf.animations[0],
              walk: gltf.animations[1],
            },
            animationActions: new Map(),
          });

          resolve();
        },
        undefined,
        reject,
      );
    });
  }

  assignModelToEntity(entityId: number, modelType: string) {
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
  ) {
    const modelData = this.getModelForEntity(entityId);
    if (!modelData) return;

    this.dummyObject.position.copy(position);
    this.dummyObject.position.y += 0.15;
    this.dummyObject.scale.copy(scale);
    if (rotation) {
      this.dummyObject.rotation.copy(rotation);
    }
    this.dummyObject.updateMatrix();
    modelData.mesh.setMatrixAt(index, this.dummyObject.matrix);
  }

  updateAnimations(deltaTime: number) {
    const time = performance.now() * 0.001;

    this.models.forEach((modelData) => {
      for (let i = 0; i < modelData.mesh.count; i++) {
        const animationState = this.animationStates[i];
        if (IS_LOW_GRAPHICS_ENABLED && animationState === ANIMATION_STATE_IDLE) {
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
    this.models.forEach((modelData) => {
      modelData.mesh.count = 0;
    });
  }

  updateAllInstances() {
    this.models.forEach((modelData) => {
      modelData.mesh.instanceMatrix.needsUpdate = true;
      if (modelData.mesh.instanceColor) {
        modelData.mesh.instanceColor.needsUpdate = true;
      }
      modelData.mesh.computeBoundingSphere();
    });
  }
}
