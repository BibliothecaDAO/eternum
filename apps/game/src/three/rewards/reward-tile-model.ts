import {
  AnimationMixer,
  Box3,
  Group,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Sphere,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { AnimationVisibilityContext } from "../types/animation";
import { createInstancedMesh } from "../utils/create-instanced-mesh";
import { disposeSkinnedSceneTemplates } from "../characters/skinned-asset-resources";
import { createArcaneStoneMaterial, createRuneFlameMaterials } from "./reward-summoning-effects";
import { ChestPresentation } from "./chest-presentation";

/** Keeps the authored hierarchy and morph animation while batching visible reward tiles. */
export class RewardTileModel {
  readonly group = new Group();
  readonly instancedMeshes: InstancedMesh[] = [];
  readonly template: GLTF;
  time = 1;
  private readonly pose: Group;
  private readonly mixer: AnimationMixer;
  private readonly sources: Mesh[] = [];
  private readonly placements = new Map<number, Matrix4>();
  private readonly composed = new Matrix4();
  private readonly hidden = new Matrix4().makeScale(0, 0, 0);
  private readonly energy = createRuneFlameMaterials();
  private readonly ownedMaterials = new Set<Material>();
  private bounds?: { box: Box3; sphere: Sphere };
  private count = 0;
  private readonly chest?: ChestPresentation;
  private readonly cameraPosition = new Vector3(0, 0, 1);

  constructor(
    gltf: GLTF,
    private readonly capacity: number,
  ) {
    this.template = gltf;
    this.pose = gltf.scene.clone(true);
    if (this.pose.getObjectByName("ChestBody")) this.chest = new ChestPresentation(this.pose);
    this.mixer = new AnimationMixer(this.pose);
    gltf.animations.forEach((clip) => this.mixer.clipAction(clip).play());
    this.energy.glyphStrength.value = 0.8;
    const materials = new Map<Material, Material>();
    this.pose.traverse((source) => {
      if (!(source instanceof Mesh)) return;
      this.addInstancedPart(source, materials);
    });
    this.samplePose();
  }

  setMatrixAt(index: number, matrix: Matrix4): void {
    if (index < 0 || index >= this.capacity)
      throw new RangeError(`Reward tile instance ${index} exceeds ${this.capacity}`);
    const placement = this.placements.get(index) ?? new Matrix4();
    placement.copy(matrix);
    this.placements.set(index, placement);
    this.writePose(index, placement);
  }

  removeInstance(index: number): void {
    this.placements.delete(index);
    for (const mesh of this.instancedMeshes) {
      mesh.setMatrixAt(index, this.hidden);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  setCount(count: number): void {
    this.count = count;
    for (const index of this.placements.keys()) if (index >= count) this.removeInstance(index);
    for (const mesh of this.instancedMeshes) {
      mesh.count = mesh.morphTexture ? Math.max(2, count) : count;
      mesh.visible = count > 0;
    }
  }

  setWorldBounds(bounds?: { box: Box3; sphere: Sphere }): void {
    this.bounds = bounds;
    for (const mesh of this.instancedMeshes) {
      mesh.boundingBox = bounds?.box.clone() ?? null;
      mesh.boundingSphere = bounds?.sphere.clone() ?? null;
      mesh.frustumCulled = Boolean(bounds);
    }
  }

  setContactShadowsEnabled(_enabled: boolean): void {
    // The solid stone basin/altar is already grounded; no floating contact plane is needed.
  }

  updateAnimations(delta: number, visibility?: AnimationVisibilityContext): void {
    this.time += delta;
    if (!this.count || !this.group.visible || !this.isNearCamera(visibility)) return;
    this.energy.clock.value = this.time;
    // Sample once per frame for all visible instances, keeping rings and spray smooth.
    this.samplePose();
    for (const [index, placement] of this.placements) this.writePose(index, placement);
  }

  updateChestPresentation(cameraPosition: Vector3, nightAmount: number): void {
    this.cameraPosition.copy(cameraPosition);
    this.chest?.setNightAmount(nightAmount);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.pose);
    this.instancedMeshes.forEach((mesh) => mesh.dispose());
    this.ownedMaterials.forEach((material) => material.dispose());
    this.chest?.dispose();
    this.energy.glyph.dispose();
    this.energy.flame.dispose();
    disposeSkinnedSceneTemplates([this.template.scene]);
    this.placements.clear();
  }

  private addInstancedPart(source: Mesh, materials: Map<Material, Material>): void {
    const original = Array.isArray(source.material) ? source.material : [source.material];
    const replacements = original.map((material) => {
      if (!materials.has(material)) materials.set(material, this.prepareMaterial(material));
      return materials.get(material)!;
    });
    const mesh = createInstancedMesh(
      source.geometry,
      Array.isArray(source.material) ? replacements : replacements[0],
      Math.max(2, this.capacity),
    );
    mesh.name = source.name;
    mesh.receiveShadow = true;
    // Allocate the morph texture at capacity before the first shader compilation.
    if (source.morphTargetInfluences?.length) {
      mesh.setMorphAt(Math.max(2, this.capacity) - 1, source);
    }
    // Three's node morph shader selects its instanced path only above one.
    // The spare slot remains a zero-scale matrix, including for a single rift.
    mesh.count = source.morphTargetInfluences?.length ? 2 : 0;
    mesh.frustumCulled = false;
    this.sources.push(source);
    this.instancedMeshes.push(mesh);
    this.group.add(mesh);
  }

  private prepareMaterial(material: Material): Material {
    if (/^(Ritual violet|Carved rune face)/.test(material.name)) return this.energy.glyph;
    if (material instanceof MeshStandardMaterial && material.name.startsWith("Ritual stone")) {
      const stone = createArcaneStoneMaterial(material, this.energy);
      this.ownedMaterials.add(stone);
      return stone;
    }
    return material;
  }

  private samplePose(): void {
    this.mixer.setTime(this.time);
    for (let index = 0; index < 2; index++) {
      const ring = this.pose.getObjectByName(`ArcaneSealRing${index}`);
      if (ring) ring.rotation.y = this.time * (index === 0 ? 0.24 : -0.32);
    }
    this.pose.updateMatrixWorld(true);
  }

  private writePose(index: number, placement: Matrix4): void {
    this.chest?.faceCamera(this.cameraPosition, placement);
    this.instancedMeshes.forEach((mesh, part) => {
      const source = this.sources[part];
      this.composed.multiplyMatrices(placement, source.matrixWorld);
      mesh.setMatrixAt(index, this.composed);
      mesh.instanceMatrix.needsUpdate = true;
      if (source.morphTargetInfluences?.length) {
        mesh.setMorphAt(index, source);
        mesh.morphTexture!.needsUpdate = true;
      }
    });
  }

  private isNearCamera(visibility?: AnimationVisibilityContext): boolean {
    if (!this.bounds || !visibility?.cameraPosition || !visibility.maxDistance) return true;
    return this.bounds.sphere.distanceToPoint(visibility.cameraPosition) <= visibility.maxDistance;
  }
}
