import { MinesMaterialsParams, PREVIEW_BUILD_COLOR_INVALID } from "@/three/constants";
import { GRAPHICS_SETTING, GraphicsSettings } from "@/ui/config";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Box3,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Sphere,
  Vector3,
} from "three";
import { AnimationVisibilityContext } from "../types/animation";
import { InstancedMatrixAttributePool } from "../utils/instanced-matrix-attribute-pool";

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

// Number of time offset buckets for batched animation updates
const ANIMATION_BUCKETS = 16;

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
  private worldBounds?: { box: Box3; sphere: Sphere };
  timeOffsets: Float32Array;

  // Animation optimization
  private lastAnimationUpdate = 0;
  private animationUpdateInterval = 1000 / 20; // 20 FPS for animations
  private lastWonderUpdate = 0;
  private wonderUpdateInterval = 1000 / 30; // 30 FPS for wonder rotation

  // Batched animation optimization: group instances by time offset bucket
  private animationBuckets: Uint8Array | null = null;
  private bucketToIndices: Map<number, Uint16Array> = new Map();
  private bucketWeightsBuffer: Float32Array | null = null;
  private bucketIndicesBuilt: boolean = false;

  constructor(
    gltf: any,
    initialCapacity: number = DEFAULT_INITIAL_CAPACITY,
    enableRaycast: boolean = false,
    name: string = "",
  ) {
    this.name = name;
    this.group = new Group();
    this.count = 0;
    this.capacity = Math.max(initialCapacity, 1);

    this.timeOffsets = new Float32Array(this.capacity);
    this.animationBuckets = new Uint8Array(this.capacity);
    for (let i = 0; i < this.capacity; i++) {
      this.timeOffsets[i] = Math.random() * 3;
      // Assign each instance to a bucket based on its time offset
      this.animationBuckets[i] = Math.floor((this.timeOffsets[i] / 3) * ANIMATION_BUCKETS) % ANIMATION_BUCKETS;
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
        this.applyWorldBounds(tmp);
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
    const mesh = this.group.children[0] as InstancedMesh;
    const count = mesh.count;
    const pool = InstancedMatrixAttributePool.getInstance();
    const snapshot = pool.acquire(count);
    const requiredFloats = count * snapshot.itemSize;

    snapshot.array.set((mesh.instanceMatrix.array as Float32Array).subarray(0, requiredFloats));

    return { matrices: snapshot, count };
  }

  setMatricesAndCount(matrices: InstancedBufferAttribute, count: number) {
    const required = Math.max(count, matrices.count);
    this.ensureCapacity(required);
    let resolvedCount = count;
    this.group.children.forEach((child) => {
      if (child instanceof InstancedMesh) {
        const targetArray = child.instanceMatrix.array as Float32Array;
        const sourceArray = matrices.array as Float32Array;
        const maxInstances = Math.floor(targetArray.length / child.instanceMatrix.itemSize);
        const finalCount = Math.min(count, maxInstances);
        const floatsToCopy = Math.min(
          finalCount * child.instanceMatrix.itemSize,
          sourceArray.length,
          targetArray.length,
        );
        if (floatsToCopy > 0) {
          targetArray.set(sourceArray.subarray(0, floatsToCopy));
        }
        child.count = finalCount;
        child.instanceMatrix.needsUpdate = true;
        resolvedCount = Math.min(resolvedCount, finalCount);
      }
    });
    this.count = resolvedCount;
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
        this.applyWorldBounds(child as any);
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

  /**
   * Builds bucket-to-indices mapping for cache-friendly batch updates.
   * Called once lazily on first animation update.
   */
  private buildBucketIndices(instanceCount: number): void {
    if (this.bucketIndicesBuilt && instanceCount <= this.count) {
      return;
    }

    if (!this.animationBuckets) return;

    // Count instances per bucket
    const bucketCounts = new Uint16Array(ANIMATION_BUCKETS);
    for (let i = 0; i < instanceCount; i++) {
      bucketCounts[this.animationBuckets[i]]++;
    }

    // Create arrays for each bucket
    this.bucketToIndices.clear();
    const bucketCurrentIndex = new Uint16Array(ANIMATION_BUCKETS);

    for (let b = 0; b < ANIMATION_BUCKETS; b++) {
      if (bucketCounts[b] > 0) {
        this.bucketToIndices.set(b, new Uint16Array(bucketCounts[b]));
      }
    }

    // Populate bucket arrays with instance indices
    for (let i = 0; i < instanceCount; i++) {
      const bucket = this.animationBuckets[i];
      const indices = this.bucketToIndices.get(bucket);
      if (indices) {
        indices[bucketCurrentIndex[bucket]++] = i;
      }
    }

    this.bucketIndicesBuilt = true;
  }

  /**
   * Computes representative time offset for each bucket.
   * Each bucket represents a range of time offsets, we use the bucket center.
   */
  private getBucketTimeOffset(bucket: number): number {
    // Map bucket back to time offset range [0, 3)
    return ((bucket + 0.5) / ANIMATION_BUCKETS) * 3;
  }

  updateAnimations(deltaTime: number, visibility?: AnimationVisibilityContext) {
    if (!this.shouldAnimate(visibility)) {
      return;
    }
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

        const instanceCount = mesh.count;
        if (instanceCount === 0) return;

        // Build bucket indices lazily (once per model)
        this.buildBucketIndices(instanceCount);

        if (!this.animationActions.has(meshIndex)) {
          const action = this.mixer!.clipAction(this.animation!);
          this.animationActions.set(meshIndex, action);
        }

        const action = this.animationActions.get(meshIndex)!;
        action.play();

        const baseMesh = this.biomeMeshes[meshIndex];
        const morphInfluences = baseMesh.morphTargetInfluences;
        if (!morphInfluences || morphInfluences.length === 0) {
          return;
        }

        const morphCount = morphInfluences.length;

        // Initialize or resize the pre-allocated buffer if needed
        const requiredSize = ANIMATION_BUCKETS * morphCount;
        if (!this.bucketWeightsBuffer || this.bucketWeightsBuffer.length < requiredSize) {
          this.bucketWeightsBuffer = new Float32Array(requiredSize);
        }

        // Calculate weights for each bucket once, store in pre-allocated buffer
        for (let b = 0; b < ANIMATION_BUCKETS; b++) {
          const bucketTime = time + this.getBucketTimeOffset(b);
          this.mixer!.setTime(bucketTime);
          const offset = b * morphCount;
          for (let m = 0; m < morphCount; m++) {
            this.bucketWeightsBuffer[offset + m] = morphInfluences[m];
          }
        }

        // Direct texture data manipulation - much faster than setMorphAt per instance
        const morphTexture = mesh.morphTexture;
        if (morphTexture && morphTexture.image && morphTexture.image.data) {
          const textureData = morphTexture.image.data as unknown as Float32Array;
          const textureWidth = morphTexture.image.width;

          // OPTIMIZED: Batch by bucket for cache locality
          for (let bucket = 0; bucket < ANIMATION_BUCKETS; bucket++) {
            const indices = this.bucketToIndices.get(bucket);
            if (!indices || indices.length === 0) continue;

            const srcOffset = bucket * morphCount;

            // For small morphCount (typical case), use subarray.set()
            if (morphCount <= 8) {
              const bucketWeights = this.bucketWeightsBuffer.subarray(srcOffset, srcOffset + morphCount);
              for (let idx = 0; idx < indices.length; idx++) {
                const i = indices[idx];
                if (i >= instanceCount) continue;
                const dstOffset = i * textureWidth;
                textureData.set(bucketWeights, dstOffset);
              }
            } else {
              // Fallback for many morph targets
              for (let idx = 0; idx < indices.length; idx++) {
                const i = indices[idx];
                if (i >= instanceCount) continue;
                const dstOffset = i * textureWidth;
                for (let m = 0; m < morphCount; m++) {
                  textureData[dstOffset + m] = this.bucketWeightsBuffer[srcOffset + m];
                }
              }
            }
          }

          morphTexture.needsUpdate = true;
          needsUpdate = true;
        }
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

    // Also resize animation buckets array
    const updatedBuckets = new Uint8Array(newCapacity);
    if (this.animationBuckets) {
      updatedBuckets.set(this.animationBuckets);
    }
    for (let i = this.capacity; i < newCapacity; i++) {
      updatedBuckets[i] = Math.floor((updatedOffsets[i] / 3) * ANIMATION_BUCKETS) % ANIMATION_BUCKETS;
    }
    this.animationBuckets = updatedBuckets;

    // Invalidate bucket indices so they get rebuilt on next animation update
    this.bucketIndicesBuilt = false;

    this.capacity = newCapacity;
  }

  private applyWorldBounds(mesh: AnimatedInstancedMesh) {
    if (this.worldBounds) {
      mesh.frustumCulled = true;
      const geometry = mesh.geometry;
      geometry.boundingSphere = geometry.boundingSphere ?? new Sphere();
      geometry.boundingSphere.copy(this.worldBounds.sphere);
      geometry.boundingBox = geometry.boundingBox ?? new Box3();
      geometry.boundingBox.copy(this.worldBounds.box);
    } else {
      mesh.frustumCulled = false;
    }
  }

  public setWorldBounds(bounds?: { box: Box3; sphere: Sphere }) {
    this.worldBounds = bounds
      ? {
          box: bounds.box.clone(),
          sphere: bounds.sphere.clone(),
        }
      : undefined;
    this.instancedMeshes.forEach((mesh) => this.applyWorldBounds(mesh));
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

    // Clear animation optimization buffers
    this.bucketWeightsBuffer = null;
    this.bucketToIndices.clear();
    this.animationBuckets = null;
    this.bucketIndicesBuilt = false;

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

  private shouldAnimate(context?: AnimationVisibilityContext): boolean {
    if (!context) {
      return true;
    }

    // Prefer centralized visibility manager for better performance (cached per-frame results)
    if (context.visibilityManager && this.worldBounds) {
      return context.visibilityManager.shouldAnimate(
        this.worldBounds.box,
        this.worldBounds.sphere?.center,
        this.worldBounds.sphere?.radius ?? 0,
      );
    }

    // Fallback to legacy frustum manager check (deprecated path)
    if (context.frustumManager && this.worldBounds?.box && !context.frustumManager.isBoxVisible(this.worldBounds.box)) {
      return false;
    }

    if (
      context.maxDistance !== undefined &&
      context.cameraPosition &&
      this.worldBounds?.sphere &&
      context.cameraPosition.distanceTo(this.worldBounds.sphere.center) >
        context.maxDistance + this.worldBounds.sphere.radius
    ) {
      return false;
    }

    return true;
  }
}
