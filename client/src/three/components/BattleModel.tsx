import { GRAPHICS_SETTING, GraphicsSettings } from "@/ui/config";
import * as THREE from "three";
import { AnimationClip, AnimationMixer } from "three";
import { gltfLoader } from "../helpers/utils";

const MAX_INSTANCES = 1000;

export class BattleModel {
  private scene: THREE.Scene;
  private battleMesh: any;
  dummyObject: THREE.Object3D;
  loadPromise: Promise<void>;
  mesh!: THREE.InstancedMesh;
  private mixer: AnimationMixer | null = null;
  private animation: AnimationClip | null = null;
  private animationActions: Map<number, THREE.AnimationAction> = new Map();
  timeOffsets: Float32Array;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.battleMesh = new THREE.Object3D();
    this.dummyObject = new THREE.Object3D();
    this.loadPromise = this.loadModel();
    this.timeOffsets = new Float32Array(MAX_INSTANCES);
    for (let i = 0; i < MAX_INSTANCES; i++) {
      this.timeOffsets[i] = Math.random() * 3;
    }
  }

  private async loadModel(): Promise<void> {
    const loader = gltfLoader;
    return new Promise((resolve, reject) => {
      loader.load(
        "models/battle.glb",
        (gltf) => {
          this.battleMesh = gltf.scene.children[0];
          const geometry = (this.battleMesh as THREE.Mesh).geometry;
          const material = (this.battleMesh as THREE.Mesh).material;

          this.mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
          this.mesh.frustumCulled = true;
          this.mesh.castShadow = true;
          this.mesh.instanceMatrix.needsUpdate = true;
          this.scene.add(this.mesh);

          // Set initial morphs for all instances
          for (let i = 0; i < MAX_INSTANCES; i++) {
            this.mesh.setMorphAt(i, this.battleMesh);
          }
          this.mesh.morphTexture!.needsUpdate = true;

          // Set count to 0 after initializing morphs
          this.mesh.count = 0;

          // Set up animation
          this.mixer = new AnimationMixer(gltf.scene);
          this.animation = gltf.animations[0];

          resolve();
        },
        undefined,
        reject,
      );
    });
  }

  updateInstance(index: number, position: THREE.Vector3, rotation?: THREE.Euler) {
    this.dummyObject.position.copy(position);
    this.dummyObject.scale.copy(new THREE.Vector3(0.35, 0.025, 0.35));
    if (rotation) {
      this.dummyObject.rotation.copy(rotation);
    }
    this.dummyObject.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummyObject.matrix);
  }

  updateAnimations(deltaTime: number) {
    if (GRAPHICS_SETTING === GraphicsSettings.LOW) {
      return;
    }

    if (this.mixer && this.mesh && this.animation) {
      const time = performance.now() * 0.001;
      for (let i = 0; i < this.mesh.count; i++) {
        if (!this.animationActions.has(i)) {
          const action = this.mixer.clipAction(this.animation);
          this.animationActions.set(i, action);
        }

        const action = this.animationActions.get(i)!;
        action.play();

        this.mixer.setTime(time + this.timeOffsets[i]);
        this.mesh.setMorphAt(i, this.battleMesh);
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
