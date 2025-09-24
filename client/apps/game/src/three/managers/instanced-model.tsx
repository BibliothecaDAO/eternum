import { MinesMaterialsParams, PREVIEW_BUILD_COLOR_INVALID } from "@/three/constants";
import { GRAPHICS_SETTING, GraphicsSettings } from "@/ui/config";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";

const BIG_DETAILS_NAME = "big_details";
const BUILDING_NAME = "building";
export const LAND_NAME = "land";
export const SMALL_DETAILS_NAME = "small_details";

// Reusable matrices for instance transformations
const instanceMatrix = new Matrix4();
const rotationMatrix = new Matrix4();
const zeroMatrix = new Matrix4().makeScale(0, 0, 0);
const DEFAULT_INITIAL_CAPACITY = 32;

interface AnimatedInstancedMesh extends InstancedMesh {
  animated: boolean;
}

export default class InstancedModel {
  public group: Group;
  public instancedMeshes: AnimatedInstancedMesh[] = [];
  private biomeMeshes: any[] = [];
  private count: number = 0;
  private capacity: number;
  private mixer: AnimationMixer | null = null;
  private animation: AnimationClip | null = null;
  private animationActions: Map<number, AnimationAction> = new Map();
  private name: string;
  timeOffsets: Float32Array;

  // Animation optimization
  private lastAnimationUpdate = 0;
  private animationUpdateInterval = 1000 / 20; // 20 FPS for animations
  private lastWonderUpdate = 0;
  private wonderUpdateInterval = 1000 / 30; // 30 FPS for wonder rotation

  constructor(gltf: any, initialCapacity: number = DEFAULT_INITIAL_CAPACITY, enableRaycast: boolean = false, name: string = "") {
    this.name = name;
    this.group = new Group();
    this.count = 0;
    this.capacity = Math.max(initialCapacity, 1);

    this.timeOffsets = new Float32Array(this.capacity);
    for (let i = 0; i < this.capacity; i++) {
      this.timeOffsets[i] = Math.random() * 3;
    }

    gltf.scene.traverse((child: any) => {
      if (child instanceof Mesh) {
        if (child.scale.x !== 1) {
          return;
        }
        let material = child.material;
        if (name.includes("Quest") || name.includes("Chest")) {
          if (!material.depthWrite) {
            material.depthWrite = true;
            material.alphaTest = 0.075;
          }
          if (material.emissiveIntensity > 1) {
            material.emissiveIntensity = 1.5;
          }
        }
        //name.includes("FragmentMine")
        if (name.includes("FragmentMine")) {
          if (material.emissiveIntensity > 1) {
            material.emissiveIntensity = 15;
          }
        }
        if (name === StructureType[StructureType.FragmentMine] && child.material.name.includes("crystal")) {
          material = new MeshStandardMaterial(MinesMaterialsParams[ResourcesIds.AncientFragment]);
        }
        const tmp = new InstancedMesh(child.geometry, material, this.capacity) as AnimatedInstancedMesh;
        tmp.renderOrder = 10;
        const biomeMesh = child;
        if (gltf.animations.length > 0) {
          if (
            gltf.animations[0].tracks.find((track: any) => track.name.split(".")[0] === child.name) &&
            name !== StructureType[StructureType.FragmentMine] &&
            name !== "wonder"
          ) {
            console.log("animated", gltf.animations[0]);
            tmp.animated = true;
            for (let i = 0; i < this.capacity; i++) {
              tmp.setMorphAt(i, biomeMesh as any);
            }
            tmp.morphTexture!.needsUpdate = true;
          }
        }

        if (child.name.includes(BIG_DETAILS_NAME) || child.parent?.name.includes(BIG_DETAILS_NAME)) {
          tmp.castShadow = true;
          tmp.name = BIG_DETAILS_NAME;
        }

        if (child.name.includes(BUILDING_NAME) || child.parent?.name.includes(BUILDING_NAME)) {
          tmp.castShadow = true;
          tmp.name = BUILDING_NAME;
        }

        if (child.name.includes(LAND_NAME) || child.parent?.name.includes(LAND_NAME)) {
          tmp.receiveShadow = true;
          tmp.name = LAND_NAME;
        }

        tmp.userData.isInstanceModel = true;

        if (!enableRaycast) {
          tmp.raycast = () => {};
        }

        tmp.count = 0;
        this.group.add(tmp);
        this.instancedMeshes.push(tmp);
        this.biomeMeshes.push(biomeMesh);
      }
    });

    // Create mixer once, outside the loop to prevent memory leaks
    if (gltf.animations.length > 0) {
      this.mixer = new AnimationMixer(gltf.scene);
      this.animation = gltf.animations[0];
    }
  }

  getCount(): number {
    return this.count;
  }

  getLandColor() {
    const land = this.group.children.find((child) => child.name === LAND_NAME);
    if (land instanceof InstancedMesh) {
      return (land.material as MeshStandardMaterial).color;
    }
    return new Color(PREVIEW_BUILD_COLOR_INVALID);
  }

  getMatricesAndCount() {
    return {
      matrices: (this.group.children[0] as InstancedMesh).instanceMatrix.clone(),
      count: (this.group.children[0] as InstancedMesh).count,
    };
  }

  setMatricesAndCount(matrices: InstancedBufferAttribute, count: number) {
    const required = Math.max(count, matrices.count);
    this.ensureCapacity(required);
    this.group.children.forEach((child) => {
      if (child instanceof InstancedMesh) {
        child.instanceMatrix.array.set(matrices.array as Float32Array);
        child.count = count;
        child.instanceMatrix.needsUpdate = true;
      }
    });
    this.count = count;
  }

  setMatrixAt(index: number, matrix: Matrix4) {
    this.ensureCapacity(index + 1);
    this.group.children.forEach((child) => {
      if (child instanceof InstancedMesh) {
        child.setMatrixAt(index, matrix);
      }
    });
  }

  setColorAt(index: number, color: Color) {
    this.ensureCapacity(index + 1);
    this.group.children.forEach((child) => {
      if (child instanceof InstancedMesh) {
        child.setColorAt(index, color);
      }
    });
  }

  setCount(count: number) {
    this.ensureCapacity(count);
    this.count = count;
    this.group.children.forEach((child) => {
      if (child instanceof InstancedMesh) {
        child.count = count;
      }
    });
    this.needsUpdate();
  }

  removeInstance(index: number) {
    this.ensureCapacity(index + 1);
    this.setMatrixAt(index, zeroMatrix);
    this.needsUpdate();
  }

  needsUpdate() {
    this.group.children.forEach((child) => {
      if (child instanceof InstancedMesh) {
        child.instanceMatrix.needsUpdate = true;
        child.computeBoundingSphere();
        child.frustumCulled = false;
      }
    });
  }

  clone() {
    return this.group.clone();
  }

  scaleModel(scale: Vector3) {
    this.group.scale.copy(scale);
    this.group.updateMatrixWorld(true);
  }

  updateAnimations(deltaTime: number) {
    if (GRAPHICS_SETTING === GraphicsSettings.LOW) {
      return;
    }

    const now = performance.now();

    // Frame limit animation updates to reduce GPU load
    if (now - this.lastAnimationUpdate < this.animationUpdateInterval) {
      return;
    }

    if (this.mixer && this.animation) {
      const time = now * 0.001;
      let needsUpdate = false;

      this.instancedMeshes.forEach((mesh, meshIndex) => {
        if (!mesh.animated) return;
        if (!this.animationActions.has(meshIndex)) {
          const action = this.mixer!.clipAction(this.animation!);
          this.animationActions.set(meshIndex, action);
        }

        const action = this.animationActions.get(meshIndex)!;
        action.play();

        // Batch morph updates instead of doing them individually
        for (let i = 0; i < mesh.count; i++) {
          this.mixer!.setTime(time + this.timeOffsets[i]);
          mesh.setMorphAt(i, this.biomeMeshes[meshIndex]);
        }

        // Only set needsUpdate once per mesh instead of every frame
        mesh.morphTexture!.needsUpdate = true;
        needsUpdate = true;
      });

      if (needsUpdate) {
        this.lastAnimationUpdate = now;
      }
    }

    // Wonder rotation with its own frame limiting
    if (this.name === "wonder" && now - this.lastWonderUpdate >= this.wonderUpdateInterval) {
      const rotationSpeed = 1; // Adjust speed as needed

      this.instancedMeshes.forEach((mesh) => {
        for (let i = 0; i < mesh.count; i++) {
          // Get the current instance matrix
          mesh.getMatrixAt(i, instanceMatrix);

          // Create a rotation matrix around Y axis
          rotationMatrix.makeRotationY(rotationSpeed * deltaTime);

          // Apply rotation to the instance matrix
          instanceMatrix.multiply(rotationMatrix);

          // Set the updated matrix back to the instance
          mesh.setMatrixAt(i, instanceMatrix);
        }

        // Update the instance matrix
        mesh.instanceMatrix.needsUpdate = true;
      });

      this.lastWonderUpdate = now;
    }
  }

  private ensureCapacity(requiredCount: number) {
    if (requiredCount <= this.capacity) {
      return;
    }

    let newCapacity = this.capacity || 1;
    while (newCapacity < requiredCount) {
      newCapacity *= 2;
    }

    this.instancedMeshes.forEach((mesh, meshIndex) => {
      const matrixArray = mesh.instanceMatrix.array as Float32Array;
      const resizedMatrixArray = new Float32Array(newCapacity * 16);
      resizedMatrixArray.set(matrixArray.subarray(0, this.capacity * 16));
      mesh.instanceMatrix = new InstancedBufferAttribute(resizedMatrixArray, 16);
      mesh.instanceMatrix.needsUpdate = true;

      if (mesh.instanceColor) {
        const colorArray = mesh.instanceColor.array as Float32Array;
        const resizedColorArray = new Float32Array(newCapacity * 3);
        resizedColorArray.set(colorArray.subarray(0, this.capacity * 3));
        mesh.instanceColor = new InstancedBufferAttribute(resizedColorArray, 3);
        mesh.instanceColor.needsUpdate = true;
      }

      mesh.count = Math.min(mesh.count, newCapacity);

      for (let i = this.capacity; i < newCapacity; i++) {
        mesh.setMatrixAt(i, zeroMatrix);
        if (mesh.morphTexture) {
          mesh.setMorphAt(i, this.biomeMeshes[meshIndex]);
        }
      }

      if (mesh.morphTexture) {
        mesh.morphTexture.needsUpdate = true;
      }
    });

    const updatedOffsets = new Float32Array(newCapacity);
    updatedOffsets.set(this.timeOffsets);
    for (let i = this.capacity; i < newCapacity; i++) {
      updatedOffsets[i] = Math.random() * 3;
    }
    this.timeOffsets = updatedOffsets;
    this.capacity = newCapacity;
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

    console.log(`InstancedModel "${this.name}": Disposed and cleaned up`);
  }
}
