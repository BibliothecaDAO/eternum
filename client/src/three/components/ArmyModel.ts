import * as THREE from "three";
import { AnimationClip, AnimationMixer } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

const MAX_INSTANCES = 1000;

export class ArmyModel {
  private scene: THREE.Scene;
  private dummy: any;
  loadPromise: Promise<void>;
  mesh!: THREE.InstancedMesh;
  private mixer: AnimationMixer | null = null;
  private animationClip: AnimationClip | null = null;
  timeOffsets: Float32Array;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.dummy = new THREE.Object3D();
    this.loadPromise = this.loadModel();
    this.timeOffsets = new Float32Array(MAX_INSTANCES);
    for (let i = 0; i < MAX_INSTANCES; i++) {
      this.timeOffsets[i] = Math.random() * 3;
    }
  }

  private async loadModel(): Promise<void> {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        "models/knight3.glb",
        (gltf) => {
          this.dummy = gltf.scene.children[0];
          const geometry = (this.dummy as THREE.Mesh).geometry;
          const material = (this.dummy as THREE.Mesh).material;

          this.mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
          this.mesh.castShadow = true;
          this.mesh.count = 0;
          this.mesh.instanceMatrix.needsUpdate = true;
          this.scene.add(this.mesh);

          // Set up animation
          this.mixer = new AnimationMixer(gltf.scene);
          this.animationClip = gltf.animations[0];
          if (this.animationClip) {
            const action = this.mixer.clipAction(this.animationClip);
            action.play();
          }

          resolve();
        },
        undefined,
        reject,
      );
    });
  }

  updateInstance(index: number, position: THREE.Vector3, scale: THREE.Vector3, rotation?: THREE.Euler) {
    this.dummy.position.copy(position);
    this.dummy.scale.copy(scale);
    if (rotation) {
      this.dummy.rotation.copy(rotation);
    }
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
  }

  updateAnimations(deltaTime: number) {
    if (this.mixer && this.mesh) {
      const time = performance.now() * 0.001;
      for (let i = 0; i < this.mesh.count; i++) {
        this.mixer.setTime(time + this.timeOffsets[i]);
        this.mesh.setMorphAt(i, this.dummy);
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
}
