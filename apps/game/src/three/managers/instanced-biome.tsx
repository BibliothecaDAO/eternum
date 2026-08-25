import { PREVIEW_BUILD_COLOR_INVALID } from "@/three/constants";
import { LAND_NAME } from "@/three/managers/instanced-model";
import { renderProfile } from "@/three/render-profile";
import * as THREE from "three";
import { AnimationClip, AnimationMixer } from "three";
import { AnimationVisibilityContext } from "../types/animation";
import { InstancedMatrixAttributePool } from "../utils/instanced-matrix-attribute-pool";
import { MaterialPool } from "../utils/material-pool";
import { resolveBiomeMeshRenderOrder } from "./instanced-biome-render-order";
import { writeMorphWeightsIfChanged } from "./morph-texture-dirty-state";

const zeroScaledMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const NEUTRAL_INSTANCE_COLOR_COMPONENT = 1;

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
const FAR_DETAIL_INSTANCE_STRIDE = 4;

interface BiomeMeshPart {
  geometry: THREE.BufferGeometry;
  isFarDetail: boolean;
  material: THREE.Material | THREE.Material[];
}

interface BiomeGltf {
  animations: THREE.AnimationClip[];
  scene: THREE.Group;
}

function isFarDetailMaterial(material: THREE.Material): boolean {
  return material.transparent || material.name.toLowerCase().includes("opacity");
}

function createGeometryDrawRangeView(source: THREE.BufferGeometry, start: number, count: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(source.index);
  Object.entries(source.attributes).forEach(([name, attribute]) => geometry.setAttribute(name, attribute));
  geometry.morphAttributes = source.morphAttributes;
  geometry.morphTargetsRelative = source.morphTargetsRelative;
  geometry.boundingBox = source.boundingBox?.clone() ?? null;
  geometry.boundingSphere = source.boundingSphere?.clone() ?? null;
  geometry.setDrawRange(start, count);
  return geometry;
}

function resolveBiomeMeshParts(mesh: THREE.Mesh): BiomeMeshPart[] {
  const materials = mesh.material;
  if (!Array.isArray(materials) || mesh.geometry.groups.length < 2) {
    return [{ geometry: mesh.geometry, isFarDetail: false, material: mesh.material }];
  }

  const groupedParts = mesh.geometry.groups.flatMap((group) => {
    const material = materials[group.materialIndex ?? 0];
    if (!material) {
      return [];
    }
    return [
      {
        geometry: createGeometryDrawRangeView(mesh.geometry, group.start, group.count),
        isFarDetail: isFarDetailMaterial(material),
        material,
      },
    ];
  });
  const hasTerrainBase = groupedParts.some((part) => !part.isFarDetail);
  return hasTerrainBase ? groupedParts : groupedParts.map((part) => ({ ...part, isFarDetail: false }));
}

export default class InstancedModel {
  private static readonly materialPool = MaterialPool.getInstance();
  public group: THREE.Group;
  public instancedMeshes: THREE.InstancedMesh[] = [];
  private biomeMeshes: THREE.Mesh[] = [];
  private count: number = 0;
  private mixer: AnimationMixer | null = null;
  private animation: AnimationClip | null = null;
  private animationActions: Map<number, THREE.AnimationAction> = new Map();
  private worldBounds?: { box: THREE.Box3; sphere: THREE.Sphere };
  private canonicalMatrices = new Float32Array(0);
  private farDetailEnabled = false;
  private readonly farDetailMeshes = new Set<THREE.InstancedMesh>();
  private readonly farDetailOffset: number;
  animationBuckets: Uint8Array;
  // Animation throttling to reduce morph texture uploads
  private lastAnimationUpdate = 0;
  private animationUpdateInterval = 1000 / 20; // 20 FPS
  private readonly ANIMATION_BUCKETS = 20;
  private animationFrameOffset = 0;
  private lastBucketStride = 1;
  private distantAnimationSamplingEnabled = false;

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

  constructor(gltf: BiomeGltf, count: number, enableRaycast: boolean = false, name: string = "") {
    this.group = new THREE.Group();
    this.count = 0;
    this.biomeName = name;
    this.farDetailOffset = this.resolveFarDetailOffset(name);

    const lowerName = name.toLowerCase();
    this.isStaticBiome = STATIC_BIOMES.has(lowerName);
    this.canCastShadows = !NO_SHADOW_BIOMES.has(lowerName);
    this.hasAnimations = gltf.animations.length > 0 && !this.isStaticBiome;
    this.animationBuckets = this.createAnimationBuckets(count);

    const sourceScene = this.resolveBiomeSourceScene(gltf);
    this.animation = gltf.animations[0] ?? null;
    this.mixer = this.animation ? new AnimationMixer(sourceScene) : null;
    this.prepareBiomeSourceMaterials(sourceScene, name);
    sourceScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        this.addBiomeSourceMesh(child, count, enableRaycast, name, gltf.animations.length > 0);
      }
    });
  }

  private createAnimationBuckets(count: number): Uint8Array {
    const buckets = new Uint8Array(count);
    for (let index = 0; index < count; index += 1) {
      buckets[index] = Math.floor(Math.random() * this.ANIMATION_BUCKETS);
    }
    return buckets;
  }

  private resolveBiomeSourceScene(gltf: BiomeGltf): THREE.Group {
    if (gltf.animations.length === 0) {
      return gltf.scene;
    }

    // The GLTF is shared across scenes, while AnimationMixer mutates morph weights.
    // Animated biomes need their own object graph; geometry, materials, and textures
    // remain shared by reference through the clone.
    return gltf.scene.clone();
  }

  private addBiomeSourceMesh(
    sourceMesh: THREE.Mesh,
    capacity: number,
    enableRaycast: boolean,
    biomeName: string,
    isAnimated: boolean,
  ): void {
    const meshParts = isAnimated
      ? [{ geometry: sourceMesh.geometry, isFarDetail: false, material: sourceMesh.material }]
      : resolveBiomeMeshParts(sourceMesh);

    meshParts.forEach((part) => {
      const instancedMesh = this.createBiomeInstancedMesh(sourceMesh, part, capacity, biomeName, isAnimated);
      this.registerBiomeInstancedMesh(instancedMesh, sourceMesh, part, enableRaycast, biomeName);
    });
  }

  private createBiomeInstancedMesh(
    sourceMesh: THREE.Mesh,
    part: BiomeMeshPart,
    capacity: number,
    biomeName: string,
    isAnimated: boolean,
  ): THREE.InstancedMesh {
    const renderOrder = this.resolveConfiguredBiomeRenderOrder(part.material);
    const isLand = this.isLandMesh(sourceMesh);
    const material = this.poolBiomeMaterial(part.material);
    const instancedMesh = new THREE.InstancedMesh(part.geometry, material, capacity);
    instancedMesh.instanceMatrix.needsUpdate = true;
    if (isLand) {
      instancedMesh.instanceColor = this.createNeutralLandColorAttribute(capacity);
    }
    this.configureBiomeMorphTargets(instancedMesh, sourceMesh, capacity, biomeName, isAnimated);
    this.configureBiomeMeshAppearance(instancedMesh, isLand, biomeName, renderOrder);
    return instancedMesh;
  }

  private createNeutralLandColorAttribute(capacity: number): THREE.InstancedBufferAttribute {
    const colors = new Float32Array(capacity * 3);
    colors.fill(NEUTRAL_INSTANCE_COLOR_COMPONENT);
    const attribute = new THREE.InstancedBufferAttribute(colors, 3);
    attribute.needsUpdate = true;
    return attribute;
  }

  private prepareBiomeSourceMaterials(sourceScene: THREE.Group, biomeName: string): void {
    sourceScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        this.configureBiomeMaterial(material, biomeName);
        this.configureBiomeMeshMaterial(child, material, biomeName);
      });
    });
  }

  private resolveConfiguredBiomeRenderOrder(material: THREE.Material | THREE.Material[]): number {
    return Array.isArray(material) ? 0 : resolveBiomeMeshRenderOrder(material).renderOrder;
  }

  private poolBiomeMaterial(material: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
    const pool = (entry: THREE.Material): THREE.Material => {
      if (entry instanceof THREE.MeshStandardMaterial) return InstancedModel.materialPool.getStandardMaterial(entry);
      if (entry instanceof THREE.MeshBasicMaterial) return InstancedModel.materialPool.getBasicMaterial(entry);
      return entry;
    };
    return Array.isArray(material) ? material.map(pool) : pool(material);
  }

  private configureBiomeMaterial(material: THREE.Material | THREE.Material[], biomeName: string): number {
    if (Array.isArray(material)) {
      return 0;
    }

    if (biomeName.toLowerCase().includes("deepocean")) {
      material.transparent = false;
    }
    // Compatibility for legacy assets. Remove when their materials are corrected.
    if (material.name.includes("opacity") && material instanceof THREE.MeshStandardMaterial) {
      material.roughness = 1;
      material.normalMap = null;
    }

    // Shared biome materials must resolve the same draw order after depthWrite is mutated.
    const biomeRenderOrder = resolveBiomeMeshRenderOrder(material);
    if (biomeRenderOrder.applyTransparentDepthWrite) {
      material.depthWrite = true;
      material.alphaTest = 0.075;
    }
    if (
      material instanceof THREE.MeshStandardMaterial &&
      material.emissiveIntensity > 1 &&
      !biomeName.toLowerCase().includes("alt")
    ) {
      material.emissiveIntensity = 3;
    }
    return biomeRenderOrder.renderOrder;
  }

  private configureBiomeMorphTargets(
    instancedMesh: THREE.InstancedMesh,
    sourceMesh: THREE.Mesh,
    capacity: number,
    biomeName: string,
    isAnimated: boolean,
  ): void {
    if (!isAnimated) {
      return;
    }

    for (let index = 0; index < capacity; index += 1) {
      instancedMesh.setMorphAt(index, sourceMesh);
    }
    instancedMesh.morphTexture!.name = `biome-morph:${biomeName || "unnamed"}:${sourceMesh.name || this.instancedMeshes.length}`;
    instancedMesh.morphTexture!.needsUpdate = true;
  }

  private configureBiomeMeshMaterial(sourceMesh: THREE.Mesh, material: THREE.Material, biomeName: string): void {
    if (this.isLandMesh(sourceMesh) && material instanceof THREE.MeshStandardMaterial) {
      material.vertexColors = true;
      material.needsUpdate = true;
    }
    if (biomeName === "Outline" && material instanceof THREE.MeshStandardMaterial) {
      material.color.setHex(0xffffff);
      material.opacity = 0.075;
      material.transparent = true;
    }
  }

  private isLandMesh(sourceMesh: THREE.Mesh): boolean {
    return sourceMesh.name.includes(LAND_NAME) || Boolean(sourceMesh.parent?.name?.includes(LAND_NAME));
  }

  private configureBiomeMeshAppearance(
    instancedMesh: THREE.InstancedMesh,
    isLand: boolean,
    biomeName: string,
    renderOrder: number,
  ): void {
    const lowerName = biomeName.toLowerCase();
    if (isLand) instancedMesh.name = LAND_NAME;
    if (biomeName !== "Outline" && !lowerName.includes("ocean")) {
      instancedMesh.castShadow = !isLand;
      instancedMesh.receiveShadow = true;
      instancedMesh.renderOrder = renderOrder;
    }
    if (biomeName === "Outline") instancedMesh.renderOrder = 4;
    if (lowerName.includes("ocean")) {
      instancedMesh.renderOrder = 1;
    }
  }

  private registerBiomeInstancedMesh(
    instancedMesh: THREE.InstancedMesh,
    sourceMesh: THREE.Mesh,
    part: BiomeMeshPart,
    enableRaycast: boolean,
    biomeName: string,
  ): void {
    const lowerName = biomeName.toLowerCase();
    const isFarBiomeDetail = part.isFarDetail && !lowerName.includes("ocean") && biomeName !== "Outline";
    instancedMesh.userData.isInstanceModel = true;
    instancedMesh.userData.isFarBiomeDetail = isFarBiomeDetail;
    if (isFarBiomeDetail) {
      this.farDetailMeshes.add(instancedMesh);
    }
    if (!enableRaycast) {
      instancedMesh.raycast = () => {};
    }

    instancedMesh.count = 0;
    this.group.add(instancedMesh);
    this.instancedMeshes.push(instancedMesh);
    this.biomeMeshes.push(sourceMesh);
  }

  public setAnimationFPS(fps: number): void {
    const resolved = Math.max(1, fps);
    this.animationUpdateInterval = 1000 / resolved;
  }

  public setDistantAnimationSamplingEnabled(enabled: boolean): void {
    this.distantAnimationSamplingEnabled = enabled;
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
    const profileMultiplier = this.distantAnimationSamplingEnabled
      ? renderProfile.animation.distantIntervalMultiplier
      : 1;
    if (instanceCount >= ANIMATION_INSTANCE_THRESHOLD_LARGE) {
      return this.animationUpdateInterval * ANIMATION_INTERVAL_MULTIPLIER_LARGE * profileMultiplier;
    }
    if (instanceCount >= ANIMATION_INSTANCE_THRESHOLD_MEDIUM) {
      return this.animationUpdateInterval * ANIMATION_INTERVAL_MULTIPLIER_MEDIUM * profileMultiplier;
    }
    return this.animationUpdateInterval * profileMultiplier;
  }

  private getBucketStride(instanceCount: number): number {
    let bucketStride = 1;
    if (instanceCount >= ANIMATION_INSTANCE_THRESHOLD_LARGE) {
      bucketStride = ANIMATION_BUCKET_STRIDE_LARGE;
    } else if (instanceCount >= ANIMATION_INSTANCE_THRESHOLD_MEDIUM) {
      bucketStride = ANIMATION_BUCKET_STRIDE_MEDIUM;
    }
    const profileMultiplier = this.distantAnimationSamplingEnabled
      ? renderProfile.animation.distantBucketStrideMultiplier
      : 1;
    return Math.min(this.ANIMATION_BUCKETS, bucketStride * profileMultiplier);
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

  public setFarDetailEnabled(enabled: boolean): void {
    if (this.farDetailEnabled === enabled) {
      return;
    }

    this.farDetailEnabled = enabled;
    this.applyInstanceDetailPolicy();
    this.updateMeshVisibility();
  }

  getLandColor() {
    const land = this.group.children.find((child) => child.name === LAND_NAME);
    if (land instanceof THREE.InstancedMesh) {
      return (land.material as THREE.MeshStandardMaterial).color;
    }
    return new THREE.Color(PREVIEW_BUILD_COLOR_INVALID);
  }

  getMatricesAndCount() {
    const count = this.count;
    const pool = InstancedMatrixAttributePool.getInstance();
    const snapshot = pool.acquire(count);
    const requiredFloats = count * snapshot.itemSize;

    snapshot.array.set(this.canonicalMatrices.subarray(0, requiredFloats));

    return { matrices: snapshot, count };
  }

  setMatricesAndCount(matrices: THREE.InstancedBufferAttribute, count: number) {
    const sourceArray = matrices.array as Float32Array;
    this.count = Math.min(count, this.resolveMaxInstanceCapacity());
    const requiredFloats = this.count * matrices.itemSize;
    this.ensureCanonicalMatrixCapacity(requiredFloats);
    this.canonicalMatrices.set(sourceArray.subarray(0, requiredFloats), 0);
    this.applyInstanceDetailPolicy();
  }

  setMatrixAt(index: number, matrix: THREE.Matrix4) {
    const matrixOffset = index * 16;
    this.ensureCanonicalMatrixCapacity(matrixOffset + 16);
    this.canonicalMatrices.set(matrix.elements, matrixOffset);

    this.instancedMeshes.forEach((mesh) => {
      if (!this.farDetailEnabled || !this.farDetailMeshes.has(mesh)) {
        mesh.setMatrixAt(index, matrix);
        mesh.instanceMatrix.needsUpdate = true;
        return;
      }

      const detailIndex = this.resolveFarDetailIndex(index);
      if (detailIndex !== null) {
        mesh.setMatrixAt(detailIndex, matrix);
        mesh.instanceMatrix.needsUpdate = true;
      }
    });
  }

  setLandColors(landColors: Float32Array, count: number): void {
    const requiredComponents = count * 3;
    if (landColors.length !== requiredComponents) {
      throw new Error(`Expected ${requiredComponents} land color components, received ${landColors.length}`);
    }

    const landMeshes = this.instancedMeshes.filter((mesh) => mesh.name === LAND_NAME);
    if (landMeshes.length === 0) {
      throw new Error(`Biome ${this.biomeName || "unnamed"} is missing its land mesh`);
    }

    landMeshes.forEach((mesh) => {
      if (!mesh.instanceColor) {
        throw new Error("Land mesh is missing its creation-owned instance color attribute");
      }
      if (requiredComponents > mesh.instanceColor.array.length) {
        throw new Error(`Land color count ${count} exceeds the mesh's fixed capacity ${mesh.instanceColor.count}`);
      }

      (mesh.instanceColor.array as Float32Array).set(landColors);
      mesh.instanceColor.needsUpdate = true;
    });
  }

  setCount(count: number) {
    this.count = Math.min(count, this.resolveMaxInstanceCapacity());
    this.ensureCanonicalMatrixCapacity(this.count * 16);
    this.applyInstanceDetailPolicy();
    this.updateMeshVisibility();
  }

  removeInstance(index: number) {
    const matrixOffset = index * 16;
    this.ensureCanonicalMatrixCapacity(matrixOffset + 16);
    this.canonicalMatrices.set(zeroScaledMatrix.elements, matrixOffset);

    this.instancedMeshes.forEach((mesh) => {
      const renderedIndex =
        this.farDetailEnabled && this.farDetailMeshes.has(mesh) ? this.resolveFarDetailIndex(index) : index;
      if (renderedIndex === null) {
        return;
      }

      mesh.setMatrixAt(renderedIndex, zeroScaledMatrix);
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  private resolveMaxInstanceCapacity(): number {
    const capacity = this.instancedMeshes.reduce(
      (capacity, mesh) => Math.min(capacity, mesh.instanceMatrix.count),
      Number.POSITIVE_INFINITY,
    );
    return Number.isFinite(capacity) ? capacity : 0;
  }

  private ensureCanonicalMatrixCapacity(requiredFloats: number): void {
    if (this.canonicalMatrices.length >= requiredFloats) {
      return;
    }

    const nextCapacity = Math.max(requiredFloats, Math.max(16, this.canonicalMatrices.length * 2));
    const nextMatrices = new Float32Array(nextCapacity);
    nextMatrices.set(this.canonicalMatrices);
    this.canonicalMatrices = nextMatrices;
  }

  private applyInstanceDetailPolicy(): void {
    this.instancedMeshes.forEach((mesh) => {
      const renderedCount =
        this.farDetailEnabled && this.farDetailMeshes.has(mesh)
          ? this.copyFarDetailMatrices(mesh.instanceMatrix.array as Float32Array)
          : this.copyFullDetailMatrices(mesh.instanceMatrix.array as Float32Array);
      mesh.count = renderedCount;
      mesh.instanceMatrix.needsUpdate = true;
      if (this.worldBounds) {
        this.applyWorldBounds(mesh);
      } else {
        mesh.computeBoundingSphere();
        this.applyWorldBounds(mesh);
      }
    });
  }

  private copyFullDetailMatrices(target: Float32Array): number {
    const renderedCount = Math.min(this.count, Math.floor(target.length / 16));
    target.set(this.canonicalMatrices.subarray(0, renderedCount * 16), 0);
    return renderedCount;
  }

  private copyFarDetailMatrices(target: Float32Array): number {
    let targetIndex = 0;
    for (let sourceIndex = this.farDetailOffset; sourceIndex < this.count; sourceIndex += FAR_DETAIL_INSTANCE_STRIDE) {
      const sourceOffset = sourceIndex * 16;
      target.set(this.canonicalMatrices.subarray(sourceOffset, sourceOffset + 16), targetIndex * 16);
      targetIndex += 1;
    }
    return targetIndex;
  }

  private resolveFarDetailIndex(sourceIndex: number): number | null {
    if (sourceIndex < this.farDetailOffset || (sourceIndex - this.farDetailOffset) % FAR_DETAIL_INSTANCE_STRIDE !== 0) {
      return null;
    }
    return (sourceIndex - this.farDetailOffset) / FAR_DETAIL_INSTANCE_STRIDE;
  }

  private resolveFarDetailOffset(name: string): number {
    let hash = 0;
    for (let index = 0; index < name.length; index += 1) {
      hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
    }
    return hash % FAR_DETAIL_INSTANCE_STRIDE;
  }

  needsUpdate() {
    this.group.children.forEach((child) => {
      if (child instanceof THREE.InstancedMesh) {
        child.instanceMatrix.needsUpdate = true;
        if (this.worldBounds) {
          this.applyWorldBounds(child);
          return;
        }
        child.computeBoundingSphere();
        this.applyWorldBounds(child);
      }
    });
  }

  private applyWorldBounds(mesh: THREE.InstancedMesh) {
    if (this.worldBounds) {
      mesh.frustumCulled = true;
      // Three frustum checks InstancedMesh bounds before geometry bounds.
      mesh.boundingSphere = mesh.boundingSphere ?? new THREE.Sphere();
      mesh.boundingSphere.copy(this.worldBounds.sphere);
      mesh.boundingBox = mesh.boundingBox ?? new THREE.Box3();
      mesh.boundingBox.copy(this.worldBounds.box);

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
      let completedAnimationPass = false;

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
          completedAnimationPass = true;
          const textureData = morphTexture.image.data as unknown as Float32Array;
          const textureWidth = morphTexture.image.width;
          let textureChanged = false;

          // OPTIMIZED: Batch by bucket for cache locality
          // Process all instances in the same bucket together, using TypedArray.set()
          // for bulk copies when morphCount is small enough
          for (let bucket = bucketOffset; bucket < this.ANIMATION_BUCKETS; bucket += bucketStride) {
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
    this.canonicalMatrices = new Float32Array(0);
    this.farDetailMeshes.clear();

    // Dispose of instanced meshes and their resources
    this.instancedMeshes.forEach((mesh) => {
      if (mesh.geometry) {
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
