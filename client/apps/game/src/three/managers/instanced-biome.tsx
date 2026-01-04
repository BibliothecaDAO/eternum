import { PREVIEW_BUILD_COLOR_INVALID } from "@/three/constants";
import { LAND_NAME } from "@/three/managers/instanced-model";
import { GRAPHICS_SETTING, GraphicsSettings } from "@/ui/config";
import * as THREE from "three";
import { AnimationClip, AnimationMixer } from "three";
import { AnimationVisibilityContext } from "../types/animation";
import { InstancedMatrixAttributePool } from "../utils/instanced-matrix-attribute-pool";

const zeroScaledMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

// Biomes that should never cast shadows (flat/water biomes)
const NO_SHADOW_BIOMES = new Set(["ocean", "deepocean"]);

// Biomes that don't have meaningful animations (static or flat)
const STATIC_BIOMES = new Set(["ocean", "deepocean", "outline"]);
const ANIMATION_INSTANCE_THRESHOLD_MEDIUM = 1000;
const ANIMATION_INSTANCE_THRESHOLD_LARGE = 2000;
const ANIMATION_BUCKET_STRIDE_MEDIUM = 2;
const ANIMATION_BUCKET_STRIDE_LARGE = 4;
const ANIMATION_INTERVAL_MULTIPLIER_MEDIUM = 2;
const ANIMATION_INTERVAL_MULTIPLIER_LARGE = 3;
export default class InstancedModel {
  public group: THREE.Group;
  public instancedMeshes: THREE.InstancedMesh[] = [];
  private biomeMeshes: any[] = [];
  private count: number = 0;
  private mixer: AnimationMixer | null = null;
  private animation: AnimationClip | null = null;
  private animationActions: Map<number, THREE.AnimationAction> = new Map();
  private worldBounds?: { box: THREE.Box3; sphere: THREE.Sphere };
  animationBuckets: Uint8Array;
  // Animation throttling to reduce morph texture uploads
  private lastAnimationUpdate = 0;
  private animationUpdateInterval = 1000 / 20; // 20 FPS
  private readonly ANIMATION_BUCKETS = 20;
  private animationFrameOffset = 0;
  private lastBucketStride = 1;

  // Pre-allocated buffer for morph animation optimization
  // Reused every frame to avoid allocations in the hot path
  private bucketWeightsBuffer: Float32Array | null = null;

  // Bucket-to-indices mapping for cache-friendly batch updates
  // Built once on initialization, maps bucket number to array of instance indices
  private bucketToIndices: Map<number, Uint16Array> = new Map();
  private bucketIndicesBuilt: boolean = false;

  // Biome-specific optimization flags
  private biomeName: string = "";
  private isStaticBiome: boolean = false;
  private canCastShadows: boolean = true;
  private hasAnimations: boolean = false;

  constructor(gltf: any, count: number, enableRaycast: boolean = false, name: string = "") {
    this.group = new THREE.Group();
    this.count = count;

    // Store biome name and compute optimization flags
    this.biomeName = name;
    const lowerName = name.toLowerCase();
    this.isStaticBiome = STATIC_BIOMES.has(lowerName);
    this.canCastShadows = !NO_SHADOW_BIOMES.has(lowerName);
    this.hasAnimations = gltf.animations.length > 0 && !this.isStaticBiome;

    this.animationBuckets = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      this.animationBuckets[i] = Math.floor(Math.random() * this.ANIMATION_BUCKETS);
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

        const isLand = child.name.includes(LAND_NAME) || (child.parent?.name && child.parent.name.includes(LAND_NAME));

        if (isLand && child.material) {
          // Enable per-instance vertex colors on terrain base.
          (child.material as THREE.MeshStandardMaterial).vertexColors = true;
          (child.material as THREE.MeshStandardMaterial).needsUpdate = true;
          tmp.name = LAND_NAME;
        }

        if (name !== "Outline" && !name.toLowerCase().includes("ocean")) {
          // Terrain base should receive shadows but not cast them to avoid far-view noise.
          tmp.castShadow = !isLand;
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

  public setAnimationFPS(fps: number): void {
    const resolved = Math.max(1, fps);
    this.animationUpdateInterval = 1000 / resolved;
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

  /**
   * Enable or disable shadow casting on all meshes in this biome.
   * Disabling shadows can significantly improve GPU performance.
   * Note: Ocean and DeepOcean biomes never cast shadows regardless of this setting.
   */
  public setShadowsEnabled(enabled: boolean): void {
    // Skip if this biome type can never cast shadows
    if (!this.canCastShadows) {
      return;
    }

    this.instancedMeshes.forEach((mesh) => {
      // Only toggle castShadow - receiveShadow is less expensive
      // Land meshes don't cast shadows (already set in constructor)
      if (mesh.name !== LAND_NAME) {
        mesh.castShadow = enabled;
      }
    });
  }

  /**
   * Check if this biome can cast shadows.
   */
  public getCanCastShadows(): boolean {
    return this.canCastShadows;
  }

  /**
   * Check if this biome has meaningful animations.
   */
  public getHasAnimations(): boolean {
    return this.hasAnimations;
  }

  /**
   * Get the biome name for debugging.
   */
  public getBiomeName(): string {
    return this.biomeName;
  }

  /**
   * Update mesh visibility based on instance count.
   * Meshes with 0 instances are hidden to skip draw calls entirely.
   * Call this after setCount() to optimize rendering.
   */
  public updateMeshVisibility(): void {
    this.instancedMeshes.forEach((mesh) => {
      mesh.visible = mesh.count > 0;
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
    const mesh = this.group.children[0] as THREE.InstancedMesh;
    const count = mesh.count;
    const pool = InstancedMatrixAttributePool.getInstance();
    const snapshot = pool.acquire(count);
    const requiredFloats = count * snapshot.itemSize;

    snapshot.array.set((mesh.instanceMatrix.array as Float32Array).subarray(0, requiredFloats));

    return { matrices: snapshot, count };
  }

  setMatricesAndCount(matrices: THREE.InstancedBufferAttribute, count: number) {
    let resolvedCount = count;
    this.group.children.forEach((child) => {
      if (child instanceof THREE.InstancedMesh) {
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
        this.applyWorldBounds(child);
      }
    });
  }

  private applyWorldBounds(mesh: THREE.InstancedMesh) {
    if (this.worldBounds) {
      mesh.frustumCulled = true;
      const geometry = mesh.geometry;
      geometry.boundingSphere = geometry.boundingSphere ?? new THREE.Sphere();
      geometry.boundingSphere.copy(this.worldBounds.sphere);
      geometry.boundingBox = geometry.boundingBox ?? new THREE.Box3();
      geometry.boundingBox.copy(this.worldBounds.box);
    } else {
      mesh.frustumCulled = false;
    }
  }

  public setWorldBounds(bounds?: { box: THREE.Box3; sphere: THREE.Sphere }) {
    this.worldBounds = bounds
      ? {
          box: bounds.box.clone(),
          sphere: bounds.sphere.clone(),
        }
      : undefined;
    this.instancedMeshes.forEach((mesh) => this.applyWorldBounds(mesh));
  }

  clone() {
    return this.group.clone();
  }

  scaleModel(scale: THREE.Vector3) {
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

    // Count instances per bucket
    const bucketCounts = new Uint16Array(this.ANIMATION_BUCKETS);
    for (let i = 0; i < instanceCount; i++) {
      bucketCounts[this.animationBuckets[i]]++;
    }

    // Create arrays for each bucket
    this.bucketToIndices.clear();
    const bucketCurrentIndex = new Uint16Array(this.ANIMATION_BUCKETS);

    for (let b = 0; b < this.ANIMATION_BUCKETS; b++) {
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

  updateAnimations(_deltaTime: number, visibility?: AnimationVisibilityContext) {
    // Skip animations for static biomes (ocean, deepocean, outline)
    if (!this.hasAnimations) {
      return;
    }

    if (!this.shouldAnimate(visibility)) {
      return;
    }
    if (GRAPHICS_SETTING === GraphicsSettings.LOW) {
      return;
    }

    if (this.mixer && this.animation) {
      const now = performance.now();
      const maxInstanceCount = this.getMaxInstanceCount();
      const interval = this.getAnimationUpdateIntervalMs(maxInstanceCount);
      const bucketStride = this.getBucketStride(maxInstanceCount);

      if (now - this.lastAnimationUpdate < interval) {
        return;
      }

      if (bucketStride !== this.lastBucketStride) {
        this.animationFrameOffset = 0;
        this.lastBucketStride = bucketStride;
      }
      const bucketOffset = this.animationFrameOffset;
      this.animationFrameOffset = (this.animationFrameOffset + 1) % bucketStride;

      const time = now * 0.001;
      let needsUpdate = false;

      this.instancedMeshes.forEach((mesh, meshIndex) => {
        // Skip if no instances to animate
        const instanceCount = mesh.count;
        if (instanceCount === 0) {
          return;
        }

        // Build bucket indices lazily (once per model)
        this.buildBucketIndices(instanceCount);

        // Create a single action for each mesh if it doesn't exist
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
        const requiredSize = this.ANIMATION_BUCKETS * morphCount;
        if (!this.bucketWeightsBuffer || this.bucketWeightsBuffer.length < requiredSize) {
          this.bucketWeightsBuffer = new Float32Array(requiredSize);
        }

        // Calculate weights for each bucket once, store in pre-allocated buffer
        for (let b = bucketOffset; b < this.ANIMATION_BUCKETS; b += bucketStride) {
          const t = time + (b * 3.0) / this.ANIMATION_BUCKETS;
          this.mixer!.setTime(t);
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
          // Process all instances in the same bucket together, using TypedArray.set()
          // for bulk copies when morphCount is small enough
          for (let bucket = bucketOffset; bucket < this.ANIMATION_BUCKETS; bucket += bucketStride) {
            const indices = this.bucketToIndices.get(bucket);
            if (!indices || indices.length === 0) continue;

            const srcOffset = bucket * morphCount;

            // For small morphCount (typical case: 1-4 morph targets), use subarray.set()
            // For larger morphCount, the overhead of subarray creation isn't worth it
            if (morphCount <= 8) {
              const bucketWeights = this.bucketWeightsBuffer.subarray(srcOffset, srcOffset + morphCount);
              for (let idx = 0; idx < indices.length; idx++) {
                const i = indices[idx];
                if (i >= instanceCount) continue;
                const dstOffset = i * textureWidth;
                textureData.set(bucketWeights, dstOffset);
              }
            } else {
              // Fallback for many morph targets: direct copy is still faster than setMorphAt
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

    // Clear pre-allocated buffers and bucket indices
    this.bucketWeightsBuffer = null;
    this.bucketToIndices.clear();
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

    console.log(`InstancedBiome: Disposed and cleaned up`);
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
