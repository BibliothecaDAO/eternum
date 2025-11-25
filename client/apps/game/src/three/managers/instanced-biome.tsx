import { PREVIEW_BUILD_COLOR_INVALID } from "@/three/constants";
import { LAND_NAME } from "@/three/managers/instanced-model";
import { GRAPHICS_SETTING, GraphicsSettings } from "@/ui/config";
import * as THREE from "three";
import { AnimationClip, AnimationMixer } from "three";
import { AnimationVisibilityContext } from "../types/animation";
import { InstancedMatrixAttributePool } from "../utils/instanced-matrix-attribute-pool";

const zeroScaledMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
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

  // Pre-allocated buffer for morph animation optimization
  // Reused every frame to avoid allocations in the hot path
  private bucketWeightsBuffer: Float32Array | null = null;

  constructor(gltf: any, count: number, enableRaycast: boolean = false, name: string = "") {
    this.group = new THREE.Group();
    this.count = count;

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

  updateAnimations(_deltaTime: number, visibility?: AnimationVisibilityContext) {
    if (!this.shouldAnimate(visibility)) {
      return;
    }
    if (GRAPHICS_SETTING === GraphicsSettings.LOW) {
      return;
    }

    if (this.mixer && this.animation) {
      const now = performance.now();

      if (now - this.lastAnimationUpdate < this.animationUpdateInterval) {
        return;
      }

      const time = now * 0.001;
      let needsUpdate = false;

      this.instancedMeshes.forEach((mesh, meshIndex) => {
        // Skip if no instances to animate
        if (mesh.count === 0) {
          return;
        }

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
        for (let b = 0; b < this.ANIMATION_BUCKETS; b++) {
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
          // morphTexture.image.data is a Float32Array for morph target textures
          const textureData = morphTexture.image.data as unknown as Float32Array;
          const textureWidth = morphTexture.image.width;

          // Each row in the morph texture corresponds to one instance
          // Each column corresponds to one morph target influence
          for (let i = 0; i < mesh.count; i++) {
            const bucket = this.animationBuckets[i];
            const srcOffset = bucket * morphCount;
            const dstOffset = i * textureWidth;

            // Copy morph weights for this instance from the bucket
            for (let m = 0; m < morphCount; m++) {
              textureData[dstOffset + m] = this.bucketWeightsBuffer[srcOffset + m];
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

    // Clear pre-allocated buffer
    this.bucketWeightsBuffer = null;

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
