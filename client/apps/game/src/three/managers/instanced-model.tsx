import { MinesMaterialsParams, PREVIEW_BUILD_COLOR_INVALID } from "@/three/constants";
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
import { getContactShadowResources } from "../utils/contact-shadow";
import { InstancedMatrixAttributePool } from "../utils/instanced-matrix-attribute-pool";
import { MaterialPool } from "../utils/material-pool";
import { writeMorphWeightsIfChanged } from "./morph-texture-dirty-state";

const BIG_DETAILS_NAME = "big_details";
const BUILDING_NAME = "building";
export const LAND_NAME = "land";
export const SMALL_DETAILS_NAME = "small_details";
const CONTACT_SHADOW_Y_OFFSET = 0.02;
const ANIMATION_INSTANCE_THRESHOLD_MEDIUM = 500;
const ANIMATION_INSTANCE_THRESHOLD_LARGE = 1000;
const ANIMATION_BUCKET_STRIDE_MEDIUM = 2;
const ANIMATION_BUCKET_STRIDE_LARGE = 4;
const ANIMATION_INTERVAL_MULTIPLIER_MEDIUM = 2;
const ANIMATION_INTERVAL_MULTIPLIER_LARGE = 3;

// Reusable matrices for instance transformations
const instanceMatrix = new Matrix4();
const rotationMatrix = new Matrix4();
const zeroMatrix = new Matrix4().makeScale(0, 0, 0);
// Fixed per-instance buffer capacity when the consumer does not size one
// (single-instance previews and the like). Buffers never grow — see
// isWithinCapacity — so real fleets (structures, chests) pass their own cap.
const DEFAULT_INSTANCE_CAPACITY = 32;
const MORPH_TEXTURE_RENDER_COUNT_FLOOR = 2;

function hasInstancedMorphTexture(mesh: InstancedMesh): boolean {
  return mesh.morphTexture !== null && mesh.morphTexture !== undefined;
}

function resolveRenderedInstanceCount(mesh: InstancedMesh, logicalCount: number): number {
  return hasInstancedMorphTexture(mesh) ? Math.max(logicalCount, MORPH_TEXTURE_RENDER_COUNT_FLOOR) : logicalCount;
}

function hideUnusedRenderedInstances(mesh: InstancedMesh, logicalCount: number, renderedCount: number): void {
  for (let index = logicalCount; index < renderedCount; index++) {
    mesh.setMatrixAt(index, zeroMatrix);
  }
}

function applyRenderedInstanceCount(mesh: InstancedMesh, logicalCount: number): void {
  const renderedCount = resolveRenderedInstanceCount(mesh, logicalCount);
  hideUnusedRenderedInstances(mesh, logicalCount, renderedCount);
  mesh.count = renderedCount;
}

function shouldApplyStructureAlphaCutoutFallback(material: MeshStandardMaterial): boolean {
  return !material.depthWrite && !material.transparent;
}

function applyStructureMaterialOverrides(material: MeshStandardMaterial, modelName: string): void {
  if (modelName.includes("Quest") || modelName.includes("Chest")) {
    if (shouldApplyStructureAlphaCutoutFallback(material)) {
      material.depthWrite = true;
      material.alphaTest = 0.075;
    }
    if (material.emissiveIntensity > 1) {
      material.emissiveIntensity = 1.5;
    }
  }

  if (modelName.includes("FragmentMine") && material.emissiveIntensity > 1) {
    material.emissiveIntensity = 15;
  }
}

interface AnimatedInstancedMesh extends InstancedMesh {
  animated: boolean;
}

function createAnimatedInstancedMesh(geometry: Mesh["geometry"], material: MeshStandardMaterial, capacity: number) {
  const mesh = Object.assign(new InstancedMesh(geometry, material, capacity), {
    animated: false,
  }) as AnimatedInstancedMesh;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// Number of time offset buckets for batched animation updates
const ANIMATION_BUCKETS = 16;

export default class InstancedModel {
  private static readonly materialPool = MaterialPool.getInstance();
  public group: Group;
  public instancedMeshes: AnimatedInstancedMesh[] = [];
  private biomeMeshes: Mesh[] = [];
  private count: number = 0;
  private capacity: number;
  private hasWarnedCapacityOverflow = false;
  private mixer: AnimationMixer | null = null;
  private animation: AnimationClip | null = null;
  private animationActions: Map<number, AnimationAction> = new Map();
  private name: string;
  private worldBounds?: { box: Box3; sphere: Sphere };
  timeOffsets: Float32Array;
  private contactShadowMesh?: InstancedMesh;
  private contactShadowScale = 1;
  private readonly contactShadowMatrix = new Matrix4();
  private readonly contactShadowPosition = new Vector3();

  // Animation optimization
  private lastAnimationUpdate = 0;
  private animationUpdateInterval = 1000 / 20; // 20 FPS for animations
  private lastWonderUpdate = 0;
  private wonderUpdateInterval = 1000 / 30; // 30 FPS for wonder rotation
  private animationFrameOffset = 0;
  private lastBucketStride = 1;

  // Batched animation optimization: group instances by time offset bucket
  private animationBuckets: Uint8Array | null = null;
  private bucketToIndices: Map<number, Uint16Array> = new Map();
  private bucketWeightsBuffer: Float32Array | null = null;
  private bucketIndicesBuilt: boolean = false;

  constructor(
    gltf: any,
    capacity: number = DEFAULT_INSTANCE_CAPACITY,
    enableRaycast: boolean = false,
    name: string = "",
    private readonly sourceAssetOwnership: "cache" | "consumer" = "consumer",
  ) {
    this.name = name;
    this.group = new Group();
    this.count = 0;
    this.capacity = Math.max(capacity, MORPH_TEXTURE_RENDER_COUNT_FLOOR);

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
        let material = child.material as MeshStandardMaterial;
        if (this.sourceAssetOwnership === "cache") {
          material = material.clone();
        }
        applyStructureMaterialOverrides(material, name);
        if (name === StructureType[StructureType.FragmentMine] && child.material.name.includes("crystal")) {
          material = new MeshStandardMaterial(MinesMaterialsParams[ResourcesIds.AncientFragment]);
        }
        material = InstancedModel.materialPool.getStandardMaterial(material);
        const tmp = createAnimatedInstancedMesh(child.geometry, material, this.capacity);
        tmp.renderOrder = 10;
        const biomeMesh = child;
        if (gltf.animations.length > 0) {
          if (
            gltf.animations[0].tracks.find((track: any) => track.name.split(".")[0] === child.name) &&
            name !== StructureType[StructureType.FragmentMine] &&
            name !== "wonder"
          ) {
            tmp.animated = true;
            for (let i = 0; i < this.capacity; i++) {
              tmp.setMorphAt(i, biomeMesh as any);
            }
            tmp.morphTexture!.name = `structure-morph:${name || "unnamed"}:${child.name || this.instancedMeshes.length}`;
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

        applyRenderedInstanceCount(tmp, 0);
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

    this.createContactShadowMesh(gltf);
  }

  private createContactShadowMesh(gltf: any): void {
    const { geometry, material } = getContactShadowResources();
    this.contactShadowMesh = new InstancedMesh(geometry, material, this.capacity);
    this.contactShadowMesh.renderOrder = 9;
    this.contactShadowMesh.castShadow = false;
    this.contactShadowMesh.receiveShadow = false;
    this.contactShadowMesh.count = 0;
    this.contactShadowMesh.raycast = () => {};
    this.contactShadowMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.contactShadowMesh);
    this.applyWorldBounds(this.contactShadowMesh);

    try {
      gltf.scene.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(gltf.scene);
      const size = new Vector3();
      bounds.getSize(size);
      const footprint = Math.max(size.x, size.z);
      this.contactShadowScale = Math.max(0.75, footprint * 1.1);
    } catch (error) {
      console.warn(`[InstancedModel "${this.name}"] Failed to compute contact shadow bounds`, error);
      this.contactShadowScale = 1;
    }
  }

  public setContactShadowsEnabled(enabled: boolean): void {
    if (!this.contactShadowMesh) {
      return;
    }
    this.contactShadowMesh.visible = enabled;
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
    const count = this.count;
    const pool = InstancedMatrixAttributePool.getInstance();
    const snapshot = pool.acquire(count);
    const requiredFloats = count * snapshot.itemSize;

    snapshot.array.set((mesh.instanceMatrix.array as Float32Array).subarray(0, requiredFloats));

    return { matrices: snapshot, count };
  }

  setMatricesAndCount(matrices: InstancedBufferAttribute, count: number) {
    // The per-mesh copy below already clamps to each buffer's capacity; the
    // guard only makes an oversized restore loud.
    this.isWithinCapacity(Math.max(count, matrices.count));
    let resolvedCount = count;
    this.instancedMeshes.forEach((mesh) => {
      const targetArray = mesh.instanceMatrix.array as Float32Array;
      const sourceArray = matrices.array as Float32Array;
      const maxInstances = Math.floor(targetArray.length / mesh.instanceMatrix.itemSize);
      const finalCount = Math.min(count, maxInstances);
      const floatsToCopy = Math.min(finalCount * mesh.instanceMatrix.itemSize, sourceArray.length, targetArray.length);
      if (floatsToCopy > 0) {
        targetArray.set(sourceArray.subarray(0, floatsToCopy));
      }
      applyRenderedInstanceCount(mesh, finalCount);
      mesh.instanceMatrix.needsUpdate = true;
      resolvedCount = Math.min(resolvedCount, finalCount);
    });
    this.count = resolvedCount;
  }

  setMatrixAt(index: number, matrix: Matrix4) {
    if (!this.isWithinCapacity(index + 1)) {
      return;
    }
    this.instancedMeshes.forEach((child) => {
      child.setMatrixAt(index, matrix);
      child.instanceMatrix.needsUpdate = true;
    });

    if (this.contactShadowMesh) {
      if (matrix === zeroMatrix) {
        this.contactShadowMesh.setMatrixAt(index, zeroMatrix);
      } else {
        this.contactShadowPosition.setFromMatrixPosition(matrix);
        this.contactShadowMatrix.makeScale(this.contactShadowScale, this.contactShadowScale, this.contactShadowScale);
        this.contactShadowMatrix.setPosition(
          this.contactShadowPosition.x,
          this.contactShadowPosition.y + CONTACT_SHADOW_Y_OFFSET,
          this.contactShadowPosition.z,
        );
        this.contactShadowMesh.setMatrixAt(index, this.contactShadowMatrix);
      }
      this.contactShadowMesh.instanceMatrix.needsUpdate = true;
    }
  }

  setColorAt(index: number, color: Color) {
    if (!this.isWithinCapacity(index + 1)) {
      return;
    }
    this.instancedMeshes.forEach((mesh) => {
      mesh.setColorAt(index, color);
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    });
  }

  setCount(count: number) {
    const drawCount = this.isWithinCapacity(count) ? count : this.capacity;
    this.count = drawCount;
    this.instancedMeshes.forEach((mesh) => {
      applyRenderedInstanceCount(mesh, drawCount);
    });
    if (this.contactShadowMesh) {
      this.contactShadowMesh.count = drawCount;
    }
    this.needsUpdate();
  }

  removeInstance(index: number) {
    this.setMatrixAt(index, zeroMatrix);
    this.refreshBounds();
  }

  needsUpdate() {
    this.instancedMeshes.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
    });

    if (this.contactShadowMesh) {
      this.contactShadowMesh.instanceMatrix.needsUpdate = true;
    }

    this.refreshBounds();
  }

  private refreshBounds(): void {
    this.instancedMeshes.forEach((mesh) => {
      if (this.worldBounds) {
        this.applyWorldBounds(mesh);
        return;
      }
      mesh.computeBoundingSphere();
      this.applyWorldBounds(mesh);
    });

    if (this.contactShadowMesh) {
      if (this.worldBounds) {
        this.applyWorldBounds(this.contactShadowMesh);
        return;
      }
      this.contactShadowMesh.computeBoundingSphere();
      this.applyWorldBounds(this.contactShadowMesh);
    }
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

  private getMaxInstanceCount(): number {
    let maxCount = 0;
    this.instancedMeshes.forEach((mesh) => {
      if (mesh.count > maxCount) {
        maxCount = mesh.count;
      }
    });
    return maxCount;
  }

  private getAnimationUpdateIntervalMs(instanceCount: number): number {
    if (instanceCount >= ANIMATION_INSTANCE_THRESHOLD_LARGE) {
      return this.animationUpdateInterval * ANIMATION_INTERVAL_MULTIPLIER_LARGE;
    }
    if (instanceCount >= ANIMATION_INSTANCE_THRESHOLD_MEDIUM) {
      return this.animationUpdateInterval * ANIMATION_INTERVAL_MULTIPLIER_MEDIUM;
    }
    return this.animationUpdateInterval;
  }

  private getBucketStride(instanceCount: number): number {
    if (instanceCount >= ANIMATION_INSTANCE_THRESHOLD_LARGE) {
      return ANIMATION_BUCKET_STRIDE_LARGE;
    }
    if (instanceCount >= ANIMATION_INSTANCE_THRESHOLD_MEDIUM) {
      return ANIMATION_BUCKET_STRIDE_MEDIUM;
    }
    return 1;
  }

  updateAnimations(deltaTime: number, visibility?: AnimationVisibilityContext) {
    if (!this.shouldAnimate(visibility)) {
      return;
    }
    const now = performance.now();
    const maxInstanceCount = this.getMaxInstanceCount();
    const interval = this.getAnimationUpdateIntervalMs(maxInstanceCount);
    const bucketStride = this.getBucketStride(maxInstanceCount);

    // Frame limit animation updates to reduce GPU load
    if (now - this.lastAnimationUpdate < interval) {
      return;
    }

    if (bucketStride !== this.lastBucketStride) {
      this.animationFrameOffset = 0;
      this.lastBucketStride = bucketStride;
    }
    const bucketOffset = this.animationFrameOffset;
    this.animationFrameOffset = (this.animationFrameOffset + 1) % bucketStride;

    if (this.mixer && this.animation) {
      const time = now * 0.001;
      let completedAnimationPass = false;

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
        for (let b = bucketOffset; b < ANIMATION_BUCKETS; b += bucketStride) {
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
          completedAnimationPass = true;
          const textureData = morphTexture.image.data as unknown as Float32Array;
          const textureWidth = morphTexture.image.width;
          let textureChanged = false;

          // OPTIMIZED: Batch by bucket for cache locality
          for (let bucket = bucketOffset; bucket < ANIMATION_BUCKETS; bucket += bucketStride) {
            const indices = this.bucketToIndices.get(bucket);
            if (!indices || indices.length === 0) continue;

            const srcOffset = bucket * morphCount;

            for (let idx = 0; idx < indices.length; idx++) {
              const i = indices[idx];
              if (i >= instanceCount) continue;
              textureChanged =
                writeMorphWeightsIfChanged(
                  textureData,
                  i * textureWidth,
                  this.bucketWeightsBuffer,
                  srcOffset,
                  morphCount,
                ) || textureChanged;
            }
          }

          if (textureChanged) {
            morphTexture.needsUpdate = true;
          }
        }
      });

      if (completedAnimationPass) {
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

        mesh.instanceMatrix.needsUpdate = true;
      });

      this.lastWonderUpdate = now;
    }
  }

  // Buffers are never grown: the renderer's node pipeline captures
  // instanceMatrix/instanceColor at the mesh's first draw and uploads from the
  // captured objects forever (three r184 InstanceNode) — replacing an attribute
  // to "grow" it permanently freezes the mesh on the GPU while CPU reads stay
  // correct. Capacity is fixed at construction; an overflow is a sizing bug at
  // the consumer and must be loud, not a silent resize.
  private isWithinCapacity(requiredCount: number): boolean {
    if (requiredCount <= this.capacity) {
      return true;
    }
    if (!this.hasWarnedCapacityOverflow) {
      this.hasWarnedCapacityOverflow = true;
      console.error(
        `[InstancedModel "${this.name}"] instance count ${requiredCount} exceeds the fixed capacity ${this.capacity}; extra instances are dropped`,
      );
    }
    return false;
  }

  private applyWorldBounds(mesh: InstancedMesh) {
    if (this.worldBounds) {
      mesh.frustumCulled = true;
      // Three frustum checks InstancedMesh bounds before geometry bounds.
      mesh.boundingSphere = mesh.boundingSphere ?? new Sphere();
      mesh.boundingSphere.copy(this.worldBounds.sphere);
      mesh.boundingBox = mesh.boundingBox ?? new Box3();
      mesh.boundingBox.copy(this.worldBounds.box);

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
    if (this.contactShadowMesh) {
      this.applyWorldBounds(this.contactShadowMesh);
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

    // Clear animation optimization buffers
    this.bucketWeightsBuffer = null;
    this.bucketToIndices.clear();
    this.animationBuckets = null;
    this.bucketIndicesBuilt = false;

    // Dispose of instanced meshes and their resources
    this.instancedMeshes.forEach((mesh) => {
      if (mesh.geometry && this.sourceAssetOwnership === "consumer") {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) =>
            InstancedModel.materialPool.isManagedMaterial(mat)
              ? InstancedModel.materialPool.releaseMaterial(mat)
              : mat.dispose(),
          );
        } else {
          InstancedModel.materialPool.isManagedMaterial(mesh.material)
            ? InstancedModel.materialPool.releaseMaterial(mesh.material)
            : mesh.material.dispose();
        }
      }
      // Phase 2.5: dispose the InstancedMesh itself to free the instanceMatrix/
      // instanceColor GPU buffers (via the renderer 'dispose' event) and the morph
      // DataTexture. This subsumes the explicit morphTexture.dispose() and does not
      // touch geometry/material (disposed above).
      mesh.dispose();
      // Remove from parent
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
    });
    this.instancedMeshes = [];

    // Phase 2.5: free the contact-shadow instance buffers. Its geometry/material are
    // shared via getContactShadowResources, so dispose only the mesh, not those.
    if (this.contactShadowMesh) {
      this.contactShadowMesh.dispose();
      this.contactShadowMesh = undefined;
    }

    // Clear biome meshes array
    this.biomeMeshes = [];

    // Dispose of the group
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    this.group.clear();
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
