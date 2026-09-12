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
import { queueInstanceUpdate } from "../utils/instance-update-ranges";
import { createInstancedMesh } from "../utils/create-instanced-mesh";
import { disposeSkinnedSceneTemplates } from "../characters/skinned-asset-resources";
import { createArcaneStoneMaterial, createRuneFlameMaterials } from "./reward-summoning-effects";
import { ChestPresentation } from "./chest-presentation";
import { RiftPresentation } from "./rift-presentation";
import { RewardTileBatch, resolveRewardBatchKey } from "./reward-tile-batch";
import { placedModelPhase, placedModelTime } from "../utils/placed-model-phase";

/** Keeps the authored hierarchy and morph animation while batching visible reward tiles. */
export class RewardTileModel {
  readonly group = new Group();
  readonly instancedMeshes: InstancedMesh[] = [];
  readonly template: GLTF;
  time = 1;
  private readonly pose: Group;
  private readonly mixer: AnimationMixer;
  private readonly sources: Mesh[] = [];
  private readonly batches: RewardTileBatch[] = [];
  private readonly placements = new Map<number, Matrix4>();
  private readonly composed = new Matrix4();
  private readonly hidden = new Matrix4().makeScale(0, 0, 0);
  private readonly energy = createRuneFlameMaterials();
  private readonly ownedMaterials = new Set<Material>();
  private bounds?: { box: Box3; sphere: Sphere };
  private count = 0;
  private readonly chest?: ChestPresentation;
  private readonly rift?: RiftPresentation;
  private readonly cameraPosition = new Vector3(0, 0, 1);

  constructor(
    gltf: GLTF,
    private readonly capacity: number,
  ) {
    this.template = gltf;
    this.pose = gltf.scene.clone(true);
    if (this.pose.getObjectByName("ChestBody")) this.chest = new ChestPresentation(this.pose);
    else this.rift = new RiftPresentation(this.pose);
    this.mixer = new AnimationMixer(this.pose);
    gltf.animations.forEach((clip) => this.mixer.clipAction(clip).play());
    this.energy.glyphStrength.value = 0.8;
    this.prepareParts();
    this.samplePose();
  }

  get renderMeshes() {
    return [...this.instancedMeshes, ...this.batches.map((batch) => batch.mesh)];
  }

  setMatrixAt(index: number, matrix: Matrix4): void {
    if (index < 0 || index >= this.capacity)
      throw new RangeError(`Reward tile instance ${index} exceeds ${this.capacity}`);
    const placement = this.placements.get(index) ?? new Matrix4();
    placement.copy(matrix);
    this.placements.set(index, placement);
    this.samplePlacementPose(placement);
    this.writePose(index, placement);
  }

  removeInstance(index: number): void {
    this.placements.delete(index);
    this.batches.forEach((batch) => batch.removeTile(index));
    for (const mesh of this.instancedMeshes) {
      this.writeMatrix(mesh, index, this.hidden);
    }
  }

  setCount(count: number): void {
    this.count = count;
    this.batches.forEach((batch) => {
      batch.mesh.visible = count > 0;
    });
    for (const index of this.placements.keys()) if (index >= count) this.removeInstance(index);
    for (const mesh of this.instancedMeshes) {
      mesh.count = mesh.morphTexture && count === 1 ? 2 : count;
      mesh.visible = count > 0;
    }
  }

  setWorldBounds(bounds?: { box: Box3; sphere: Sphere }): void {
    this.bounds = bounds;
    for (const mesh of this.renderMeshes) {
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
    if (!this.rift) this.samplePose();
    for (const [index, placement] of this.placements) {
      if (this.rift) this.samplePlacementPose(placement);
      this.writePose(index, placement);
    }
  }

  updatePresentation(nightAmount: number, cameraPosition?: Vector3): void {
    if (cameraPosition) this.cameraPosition.copy(cameraPosition);
    this.chest?.setNightAmount(nightAmount);
    this.rift?.setNightAmount(nightAmount);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.pose);
    this.instancedMeshes.forEach((mesh) => mesh.dispose());
    this.batches.forEach((batch) => batch.dispose());
    this.ownedMaterials.forEach((material) => material.dispose());
    this.chest?.dispose();
    this.rift?.dispose();
    this.energy.glyph.dispose();
    this.energy.flame.dispose();
    disposeSkinnedSceneTemplates([this.template.scene]);
    this.placements.clear();
  }

  private prepareParts(): void {
    const materials = new Map<Material, Material>();
    const batchCandidates = new Map<string, Mesh[]>();
    this.pose.traverse((source) => {
      if (!(source instanceof Mesh)) return;
      const key = resolveRewardBatchKey(source);
      if (!key) {
        this.addInstancedPart(source, materials);
        return;
      }
      const parts = batchCandidates.get(key) ?? [];
      parts.push(source);
      batchCandidates.set(key, parts);
    });
    for (const parts of batchCandidates.values()) {
      if (parts.length === 1) {
        this.addInstancedPart(parts[0], materials);
        continue;
      }
      const batch = new RewardTileBatch(parts, this.prepareMaterial(parts[0].material as Material));
      this.batches.push(batch);
      this.group.add(batch.mesh);
    }
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
    if (this.rift && source.morphTargetInfluences?.length) {
      // Allocate once before compilation; each placement owns one morph row while sharing the geometry.
      mesh.count = Math.max(2, this.capacity);
      mesh.setMorphAt(0, source);
      mesh.morphTexture!.needsUpdate = true;
    } else {
      mesh.morphTargetInfluences = source.morphTargetInfluences;
    }
    mesh.count = 0;
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

  private samplePlacementPose(placement: Matrix4): void {
    const phase = placedModelPhase(placement.elements[12], placement.elements[14]);
    this.samplePose(this.rift ? placedModelTime(this.time, phase) : this.time);
  }

  private samplePose(seconds = this.time): void {
    this.mixer.setTime(seconds);
    for (let index = 0; index < 2; index++) {
      const ring = this.pose.getObjectByName(`ArcaneSealRing${index}`);
      if (ring) ring.rotation.y = seconds * (index === 0 ? 0.24 : -0.32);
    }
    this.pose.updateMatrixWorld(true);
  }

  private writePose(index: number, placement: Matrix4): void {
    this.chest?.faceCamera(this.cameraPosition, placement);
    this.batches.forEach((batch) => batch.writePose(index, placement));
    this.instancedMeshes.forEach((mesh, part) => {
      const source = this.sources[part];
      this.composed.multiplyMatrices(placement, source.matrixWorld);
      this.writeMatrix(mesh, index, this.composed);
      if (mesh.morphTexture) {
        mesh.setMorphAt(index, source);
        mesh.morphTexture.needsUpdate = true;
      }
    });
  }

  private writeMatrix(mesh: InstancedMesh, index: number, matrix: Matrix4): void {
    const offset = index * 16;
    const values = mesh.instanceMatrix.array;
    // Compare in the buffer's precision so stationary parts do not become dirty
    // because their source transforms were calculated in double precision.
    const changed = matrix.elements.some((value, component) => values[offset + component] !== Math.fround(value));
    if (!changed) return;
    mesh.setMatrixAt(index, matrix);
    queueInstanceUpdate(mesh.instanceMatrix, index, 1);
  }

  private isNearCamera(visibility?: AnimationVisibilityContext): boolean {
    if (!this.bounds || !visibility?.cameraPosition || !visibility.maxDistance) return true;
    return this.bounds.sphere.distanceToPoint(visibility.cameraPosition) <= visibility.maxDistance;
  }
}
