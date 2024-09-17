import { IS_LOW_GRAPHICS_ENABLED } from "@/ui/config";
import * as THREE from "three";
import { AnimationClip, AnimationMixer } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

const MAX_INSTANCES = 1000;
const ANIMATION_STATE_IDLE = 0;
const ANIMATION_STATE_WALKING = 1;

export class ArmyModel {
  private scene: THREE.Scene;
  private armyMesh: any;
  dummyObject: THREE.Object3D;
  loadPromise: Promise<void>;
  mesh!: THREE.InstancedMesh;
  private mixer: AnimationMixer | null = null;
  private idleAnimation: AnimationClip | null = null;
  private walkAnimation: AnimationClip | null = null;
  private animationActions: Map<number, { idle: THREE.AnimationAction; walk: THREE.AnimationAction }> = new Map();
  animationStates: Float32Array;
  timeOffsets: Float32Array;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.armyMesh = new THREE.Object3D();
    this.dummyObject = new THREE.Object3D();
    this.loadPromise = this.loadModel();
    this.timeOffsets = new Float32Array(MAX_INSTANCES);
    for (let i = 0; i < MAX_INSTANCES; i++) {
      this.timeOffsets[i] = Math.random() * 3;
    }
    this.animationStates = new Float32Array(MAX_INSTANCES);
    for (let i = 0; i < MAX_INSTANCES; i++) {
      this.animationStates[i] = ANIMATION_STATE_IDLE;
    }
  }

  private async loadModel(): Promise<void> {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        "models/knight.glb",
        (gltf) => {
          this.armyMesh = gltf.scene.children[0];
          const geometry = (this.armyMesh as THREE.Mesh).geometry;
          const material = (this.armyMesh as THREE.Mesh).material;

          this.mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
          this.mesh.frustumCulled = true;
          this.mesh.castShadow = true;
          this.mesh.instanceMatrix.needsUpdate = true;
          this.scene.add(this.mesh);

          // Set initial morphs for all instances
          for (let i = 0; i < MAX_INSTANCES; i++) {
            this.mesh.setMorphAt(i, this.armyMesh);
          }
          this.mesh.morphTexture!.needsUpdate = true;

          // Set count to 0 after initializing morphs
          this.mesh.count = 0;

          // Set up animations
          this.mixer = new AnimationMixer(gltf.scene);
          this.idleAnimation = gltf.animations[0];
          this.walkAnimation = gltf.animations[1];

          resolve();
        },
        undefined,
        reject,
      );
    });
  }

  updateInstance(index: number, position: THREE.Vector3, scale: THREE.Vector3, rotation?: THREE.Euler) {
    this.dummyObject.position.copy(position);
    this.dummyObject.position.y += 0.15;
    this.dummyObject.scale.copy(scale);
    if (rotation) {
      this.dummyObject.rotation.copy(rotation);
    }
    this.dummyObject.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummyObject.matrix);
  }

  updateAnimations(deltaTime: number) {
    if (this.mixer && this.mesh && this.idleAnimation && this.walkAnimation) {
      const time = performance.now() * 0.001;
      for (let i = 0; i < this.mesh.count; i++) {
        const animationState = this.animationStates[i];
        if (IS_LOW_GRAPHICS_ENABLED && animationState === ANIMATION_STATE_IDLE) {
          continue;
        }

        if (!this.animationActions.has(i)) {
          const idleAction = this.mixer.clipAction(this.idleAnimation);
          const walkAction = this.mixer.clipAction(this.walkAnimation);
          this.animationActions.set(i, { idle: idleAction, walk: walkAction });
        }

        const actions = this.animationActions.get(i)!;
        if (animationState === ANIMATION_STATE_IDLE) {
          actions.idle.setEffectiveTimeScale(1);
          actions.walk.setEffectiveTimeScale(0);
        } else if (animationState === ANIMATION_STATE_WALKING) {
          actions.idle.setEffectiveTimeScale(0);
          actions.walk.setEffectiveTimeScale(1);
        }

        actions.idle.play();
        actions.walk.play();

        this.mixer.setTime(time + this.timeOffsets[i]);
        this.mesh.setMorphAt(i, this.armyMesh);
      }
      this.mesh.morphTexture!.needsUpdate = true;
    }
  }

  updateInstanceMatrix() {
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  computeBoundingSphere() {
    this.mesh.computeBoundingSphere();
  }

  setAnimationState(index: number, isWalking: boolean) {
    this.animationStates[index] = isWalking ? ANIMATION_STATE_WALKING : ANIMATION_STATE_IDLE;
  }
}
