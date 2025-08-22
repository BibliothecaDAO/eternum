import { PREVIEW_BUILD_COLOR_INVALID } from "@/three/constants";
import { LAND_NAME } from "@/three/managers/instanced-model";
import { GRAPHICS_SETTING, GraphicsSettings } from "@/ui/config";
import * as THREE from "three";
import { AnimationClip, AnimationMixer } from "three";

const zeroScaledMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
export default class InstancedModel {
  public group: THREE.Group;
  public instancedMeshes: THREE.InstancedMesh[] = [];
  private biomeMeshes: any[] = [];
  private count: number = 0;
  private mixer: AnimationMixer | null = null;
  private animation: AnimationClip | null = null;
  private animationActions: Map<number, THREE.AnimationAction> = new Map();
  timeOffsets: Float32Array;

  constructor(gltf: any, count: number, enableRaycast: boolean = false, name: string = "") {
    this.group = new THREE.Group();
    this.count = count;

    this.timeOffsets = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.timeOffsets[i] = Math.random() * 3;
    }
    let renderOrder = 0;
    gltf.scene.traverse((child: any) => {
      if (child instanceof THREE.Mesh) {
        const isAlt = name.toLowerCase().includes("alt");
        if (name.toLowerCase().includes("deepocean") && child.material) {
          child.material.transparent = false;
        }
        // hack for models materials, need to be removed after the models are updated
        if (child?.material?.name?.includes("opacity")) {
          child.material.roughness = 1;
          child.material.normalMap = null;
        }
        if (!child.material.depthWrite) {
          child.material.depthWrite = true;
          child.material.alphaTest = 0.075;
          renderOrder = 3;
        } else {
          renderOrder = 2;
        }
        if (child?.material?.emissiveIntensity > 1 && !isAlt) {
          child.material.emissiveIntensity = 3;
        }
        const tmp = new THREE.InstancedMesh(child.geometry, child.material, count);
        const biomeMesh = child;
        if (gltf.animations.length > 0) {
          for (let i = 0; i < count; i++) {
            tmp.setMorphAt(i, biomeMesh as any);
          }
          tmp.morphTexture!.needsUpdate = true;
        }

        if (name !== "Outline" && !name.toLowerCase().includes("ocean")) {
          tmp.castShadow = true;
          tmp.receiveShadow = true;
          tmp.renderOrder = renderOrder;
        }
        if (name === "Outline") {
          tmp.renderOrder = 4;
          child.material.color.setHex(0xffffff);
          child.material.opacity = 0.075;
          child.material.transparent = true;
        }
        if (name.toLowerCase().includes("ocean")) {
          tmp.renderOrder = 1;
        }
        tmp.userData.isInstanceModel = true;

        if (!enableRaycast) {
          tmp.raycast = () => {};
        }

        this.mixer = new AnimationMixer(gltf.scene);
        this.animation = gltf.animations[0];

        tmp.count = 0;
        this.group.add(tmp);
        this.instancedMeshes.push(tmp);
        this.biomeMeshes.push(biomeMesh);
      }
    });
  }

  getCount(): number {
    return this.count;
  }

  getLandColor() {
    const land = this.group.children.find((child) => child.name === LAND_NAME);
    if (land instanceof THREE.InstancedMesh) {
      return (land.material as THREE.MeshStandardMaterial).color;
    }
    return new THREE.Color(PREVIEW_BUILD_COLOR_INVALID);
  }

  getMatricesAndCount() {
    return {
      matrices: (this.group.children[0] as THREE.InstancedMesh).instanceMatrix.clone(),
      count: (this.group.children[0] as THREE.InstancedMesh).count,
    };
  }

  setMatricesAndCount(matrices: THREE.InstancedBufferAttribute, count: number) {
    this.group.children.forEach((child) => {
      if (child instanceof THREE.InstancedMesh) {
        child.instanceMatrix.copy(matrices);
        child.count = count;
        child.instanceMatrix.needsUpdate = true;
      }
    });
  }

  setMatrixAt(index: number, matrix: THREE.Matrix4) {
    this.group.children.forEach((child) => {
      if (child instanceof THREE.InstancedMesh) {
        child.setMatrixAt(index, matrix);
      }
    });
  }

  setColorAt(index: number, color: THREE.Color) {
    this.group.children.forEach((child) => {
      if (child instanceof THREE.InstancedMesh) {
        child.setColorAt(index, color);
      }
    });
  }

  setCount(count: number) {
    this.count = count;
    this.group.children.forEach((child) => {
      if (child instanceof THREE.InstancedMesh) {
        child.count = count;
      }
    });
    this.needsUpdate();
  }

  removeInstance(index: number) {
    this.setMatrixAt(index, zeroScaledMatrix);
    this.needsUpdate();
  }

  needsUpdate() {
    this.group.children.forEach((child) => {
      if (child instanceof THREE.InstancedMesh) {
        child.instanceMatrix.needsUpdate = true;
        child.computeBoundingSphere();
        child.frustumCulled = false;
      }
    });
  }

  clone() {
    return this.group.clone();
  }

  scaleModel(scale: THREE.Vector3) {
    this.group.scale.copy(scale);
    this.group.updateMatrixWorld(true);
  }

  updateAnimations(deltaTime: number) {
    if (GRAPHICS_SETTING === GraphicsSettings.LOW) {
      return;
    }

    if (this.mixer && this.animation) {
      const time = performance.now() * 0.001;
      this.instancedMeshes.forEach((mesh, meshIndex) => {
        // Create a single action for each mesh if it doesn't exist
        if (!this.animationActions.has(meshIndex)) {
          const action = this.mixer!.clipAction(this.animation!);
          this.animationActions.set(meshIndex, action);
        }

        const action = this.animationActions.get(meshIndex)!;
        action.play();

        for (let i = 0; i < mesh.count; i++) {
          this.mixer!.setTime(time + this.timeOffsets[i]);
          mesh.setMorphAt(i, this.biomeMeshes[meshIndex]);
        }
        mesh.morphTexture!.needsUpdate = true;
      });
    }
  }

  public dispose(): void {
    // Dispose of animation mixer
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = null;
    }

    // Dispose of animation actions
    this.animationActions.clear();

    // Dispose of instanced meshes and their resources
    this.instancedMeshes.forEach((mesh) => {
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => mat.dispose());
        } else {
          mesh.material.dispose();
        }
      }
      if (mesh.morphTexture) {
        mesh.morphTexture.dispose();
      }
      // Remove from parent
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
    });
    this.instancedMeshes = [];

    // Clear biome meshes array
    this.biomeMeshes = [];

    // Dispose of the group
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    this.group.clear();

    console.log(`InstancedBiome: Disposed and cleaned up`);
  }
}
