import { AnimationMixer, Box3, Camera, Group, Matrix4, Mesh, Sphere } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import InstancedModel from "../managers/instanced-model";
import type { AnimationVisibilityContext } from "../types/animation";
import { queueInstanceUpdate } from "../utils/instance-update-ranges";
import { placedModelPhase } from "../utils/placed-model-phase";
import { isPortalSurface, sortSpirePortals, SpirePortalMaterials } from "./spire-portal";
import { LocalEmissiveGlow } from "./local-emissive-glow";

interface SpirePlacement {
  matrix: Matrix4;
  phase: number;
  portal: ReturnType<SpirePortalMaterials["create"]>;
}

function prepareSpire(gltf: GLTF) {
  // The loader cache remains immutable, including its animated transforms.
  const evaluator = gltf.scene.clone(true);
  const solids: Mesh[] = [];
  const portals: Mesh[] = [];
  evaluator.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    // A multi-material glTF primitive inherits semantic extras from its mesh group.
    for (let parent = node.parent; !node.userData.spirePart && parent; parent = parent.parent)
      if (parent.userData.spirePart) node.userData.spirePart = parent.userData.spirePart;
    (isPortalSurface(node) ? portals : solids).push(node);
  });
  const flat = new Group();
  for (const source of solids) flat.add(new Mesh(source.geometry, source.material));
  const core = portals.find((mesh) => mesh.userData.trueSphereRadius > 0);
  if (!core) throw new Error("Spire asset is missing its spherical portal metadata");
  if (gltf.animations.length !== 1 || gltf.animations[0].duration <= 0)
    throw new Error("Spire asset requires its authored animation loop");
  return { evaluator, solids, portals, core, flat };
}

/** Shared stone draws and authored hierarchy motion; translucent portals compose independently per placement. */
export class SpireModel extends InstancedModel {
  private readonly placements = new Map<number, SpirePlacement>();
  private readonly prepared: ReturnType<typeof prepareSpire>;
  private readonly clipMixer: AnimationMixer;
  private readonly portalMaterials: SpirePortalMaterials;
  private readonly veins: LocalEmissiveGlow;
  private readonly composed = new Matrix4();
  private readonly clipDuration: number;
  private readonly sweptBounds: Sphere[];
  private seconds = 0;
  private disposed = false;
  readonly labelHeight: number;

  constructor(
    gltf: GLTF,
    private readonly placementCapacity: number,
  ) {
    const prepared = prepareSpire(gltf);
    // InstancedModel handles pooled solid materials/buffers. Its morph-only animation path must not bind this clip.
    super({ scene: prepared.flat, animations: [] }, placementCapacity, false, "Spire", "cache");
    this.prepared = prepared;
    this.setContactShadowsEnabled(false);
    this.clipMixer = new AnimationMixer(prepared.evaluator);
    this.clipMixer.clipAction(gltf.animations[0]).play();
    this.clipDuration = gltf.animations[0].duration;
    this.sweptBounds = this.measureSweptBounds();
    this.portalMaterials = new SpirePortalMaterials(prepared.core.userData.trueSphereRadius);
    prepared.evaluator.updateMatrixWorld(true);
    this.labelHeight = new Box3().setFromObject(prepared.evaluator).max.y + 0.25;
    this.group.name = "Spires";
    this.instancedMeshes.forEach((mesh, index) => {
      mesh.name = prepared.solids[index].name;
      mesh.userData.spirePart = prepared.solids[index].userData.spirePart;
      mesh.frustumCulled = true;
    });
    this.veins = new LocalEmissiveGlow(this.instancedMeshes, this.group);
  }

  override setMatrixAt(index: number, matrix: Matrix4): void {
    if (index < 0 || index >= this.placementCapacity) return;
    if (matrix.determinant() === 0) {
      const removed = this.placements.get(index);
      if (removed) this.group.remove(removed.portal.group);
      this.placements.delete(index);
      super.setMatrixAt(index, matrix);
      return;
    }
    let placement = this.placements.get(index);
    if (!placement) {
      placement = { matrix: matrix.clone(), phase: 0, portal: this.portalMaterials.create(this.prepared.portals) };
      this.placements.set(index, placement);
      this.group.add(placement.portal.group);
    }
    placement.matrix.copy(matrix);
    placement.phase = placedModelPhase(matrix.elements[12], matrix.elements[14]);
    placement.portal.group.matrixAutoUpdate = false;
    placement.portal.group.matrix.copy(matrix);
    placement.portal.group.matrixWorldNeedsUpdate = true;
    this.writePose(index, placement);
  }

  override removeInstance(index: number): void {
    this.setMatrixAt(index, new Matrix4().makeScale(0, 0, 0));
    this.needsUpdate();
  }

  override setCount(count: number): void {
    const resolved = Math.max(0, Math.min(count, this.placementCapacity));
    for (const [index, placement] of this.placements) {
      if (index < resolved) continue;
      this.group.remove(placement.portal.group);
      this.placements.delete(index);
    }
    super.setCount(resolved);
  }

  override updateAnimations(delta: number, context?: AnimationVisibilityContext & { camera?: Camera }): void {
    this.seconds += Number.isFinite(delta) ? Math.max(0, delta) : 0;
    if (!this.getCount() || !this.group.visible) return;
    for (const [index, placement] of this.placements) this.writePose(index, placement);
    if (context?.camera)
      sortSpirePortals(
        Array.from(this.placements.values(), (placement) => placement.portal.group),
        context.camera,
      );
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clipMixer.stopAllAction();
    this.clipMixer.uncacheRoot(this.prepared.evaluator);
    this.portalMaterials.dispose();
    this.veins.dispose();
    this.placements.clear();
    super.dispose();
  }

  override needsUpdate(): void {
    super.needsUpdate();
    if (!this.sweptBounds) return;
    const transformed = new Sphere();
    this.instancedMeshes.forEach((mesh, part) => {
      const bounds = new Sphere().makeEmpty();
      for (const placement of this.placements.values())
        bounds.union(transformed.copy(this.sweptBounds[part]).applyMatrix4(placement.matrix));
      mesh.boundingSphere = bounds;
    });
    this.veins?.updateBoundsAndCount();
  }

  private measureSweptBounds(): Sphere[] {
    const boxes = this.prepared.solids.map(() => new Box3());
    const transformed = new Box3();
    // Include every authored 30 Hz sample, then a small interpolation margin for compressed clips.
    const samples = Math.ceil(this.clipDuration * 30);
    for (const mesh of this.prepared.solids) mesh.geometry.computeBoundingBox();
    for (let sample = 0; sample <= samples; sample++) {
      this.clipMixer.setTime((sample / samples) * this.clipDuration);
      this.prepared.evaluator.updateMatrixWorld(true);
      this.prepared.solids.forEach((mesh, index) => {
        boxes[index].union(transformed.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld));
      });
    }
    this.clipMixer.setTime(0);
    this.prepared.evaluator.updateMatrixWorld(true);
    return boxes.map((box) => box.expandByScalar(0.01).getBoundingSphere(new Sphere()));
  }

  private writePose(index: number, placement: SpirePlacement): void {
    // Each placement keeps a stable phase without changing the authored eight-second speed or hidden wisp resets.
    this.clipMixer.setTime(this.seconds + placement.phase * this.clipDuration);
    this.prepared.evaluator.updateMatrixWorld(true);
    this.instancedMeshes.forEach((mesh, part) => {
      this.composed.multiplyMatrices(placement.matrix, this.prepared.solids[part].matrixWorld);
      mesh.setMatrixAt(index, this.composed);
      queueInstanceUpdate(mesh.instanceMatrix, index, 1);
    });
    placement.portal.surfaces.forEach((mesh, part) => {
      mesh.matrix.copy(this.prepared.portals[part].matrixWorld);
      mesh.matrixWorldNeedsUpdate = true;
    });
    this.group.updateWorldMatrix(true, false);
    placement.portal.state.inverseCore
      .copy(this.group.matrixWorld)
      .multiply(placement.matrix)
      .multiply(this.prepared.core.matrixWorld)
      .invert();
  }
}
