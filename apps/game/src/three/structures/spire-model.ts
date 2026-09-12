import { BufferGeometry, InstancedBufferAttribute, Matrix4, Mesh, MeshStandardMaterial } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  attribute,
  color,
  mix,
  mx_noise_float,
  normalLocal,
  normalView,
  positionGeometry,
  positionLocal,
  positionViewDirection,
  smoothstep,
  uniform,
  vec3,
} from "three/tsl";
import InstancedModel from "../managers/instanced-model";
import { queueInstanceUpdate } from "../utils/instance-update-ranges";
import { MaterialPool } from "../utils/material-pool";
import { placedModelPhase, placedModelTime } from "../utils/placed-model-phase";
import { spireOrbitAngle } from "./spire-motion";

interface SpirePlacement {
  matrix: Matrix4;
  phase: number;
}

/** Four shared draws: fixed masonry, orbiting masonry, refined channels and the spherical portal. */
export class SpireModel extends InstancedModel {
  private readonly placements = new Map<number, SpirePlacement>();
  private readonly orbitMeshes = new Set<Mesh>();
  private readonly portalClock = uniform(0);
  private readonly portalPhases: InstancedBufferAttribute;
  private readonly orbitMatrix = new Matrix4();
  private readonly composed = new Matrix4();
  private readonly portalGeometries: Array<{ mesh: Mesh; original: BufferGeometry }> = [];
  private seconds = 0;
  private disposed = false;

  constructor(gltf: GLTF, capacity: number) {
    super(gltf, capacity, false, "Spire", "cache");
    this.setContactShadowsEnabled(false);
    this.portalPhases = new InstancedBufferAttribute(new Float32Array(Math.max(2, capacity)), 1);
    const parts = new Map<string, string>();
    gltf.scene.traverse((node) => {
      if (node instanceof Mesh) parts.set(node.geometry.uuid, node.userData.spirePart);
    });
    for (const mesh of this.instancedMeshes) {
      if (parts.get(mesh.geometry.uuid) === "orbit") this.orbitMeshes.add(mesh);
      if (parts.get(mesh.geometry.uuid) === "portal") this.preparePortal(mesh);
    }
  }

  override setMatrixAt(index: number, matrix: Matrix4): void {
    if (index < 0 || index >= this.portalPhases.count) return;
    super.setMatrixAt(index, matrix);
    if (matrix.elements[15] === 0 || matrix.determinant() === 0) {
      this.placements.delete(index);
      return;
    }
    const placement = this.placements.get(index) ?? { matrix: new Matrix4(), phase: 0 };
    placement.matrix.copy(matrix);
    placement.phase = placedModelPhase(matrix.elements[12], matrix.elements[14]);
    this.placements.set(index, placement);
    this.portalPhases.setX(index, placement.phase);
    queueInstanceUpdate(this.portalPhases, index, 1);
    this.writeObeliskPose(index, placement);
  }

  override setCount(count: number): void {
    for (const index of this.placements.keys()) if (index >= count) this.placements.delete(index);
    super.setCount(count);
  }

  override updateAnimations(delta: number): void {
    this.seconds += Math.max(0, delta);
    if (!this.getCount() || !this.group.visible) return;
    this.portalClock.value = this.seconds;
    for (const [index, placement] of this.placements) this.writeObeliskPose(index, placement);
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const { mesh, original } of this.portalGeometries) {
      mesh.geometry.dispose();
      mesh.geometry = original;
    }
    this.placements.clear();
    super.dispose();
  }

  private writeObeliskPose(index: number, placement: SpirePlacement): void {
    const localTime = placedModelTime(this.seconds, placement.phase);
    this.orbitMatrix.makeRotationY(spireOrbitAngle(localTime));
    this.orbitMatrix.elements[13] = Math.sin(localTime * 1.2) * 0.025;
    this.composed.multiplyMatrices(placement.matrix, this.orbitMatrix);
    for (const mesh of this.instancedMeshes) {
      if (!this.orbitMeshes.has(mesh)) continue;
      const offset = index * 16;
      if (
        this.composed.elements.every(
          (value, component) => Math.fround(value) === mesh.instanceMatrix.array[offset + component],
        )
      )
        continue;
      mesh.setMatrixAt(index, this.composed);
      queueInstanceUpdate(mesh.instanceMatrix, index, 1);
    }
  }

  private preparePortal(mesh: Mesh): void {
    const previous = mesh.material as MeshStandardMaterial;
    const original = mesh.geometry;
    mesh.geometry = original.clone();
    mesh.geometry.setAttribute("portalPhase", this.portalPhases);
    this.portalGeometries.push({ mesh, original });
    const material = new MeshBasicNodeMaterial();
    material.name = "Raw essence sphere";
    const phase = attribute<"float">("portalPhase", "float");
    const clock = this.portalClock.mul(phase.mul(0.2).add(0.9)).add(phase.mul(13));
    const flow = mx_noise_float(positionGeometry.mul(7).add(vec3(0, clock.mul(0.18), 0))).abs();
    const wisps = smoothstep(0.02, 0.17, flow).oneMinus();
    const rim = normalView.dot(positionViewDirection).abs().oneMinus().pow(2);
    const essence = color(previous.color);
    material.colorNode = mix(essence.mul(0.16), essence.mul(1.6), rim).add(essence.mul(wisps).mul(0.9));
    // Brief local bulges follow each portal's clock without disturbing the approved interior flow.
    const surgeField = mx_noise_float(normalLocal.mul(4.5).add(vec3(clock.mul(0.7), 0, clock.mul(0.3))));
    const surge = smoothstep(0.1, 0.38, surgeField).pow(2).mul(clock.mul(1.7).sin().max(0)).mul(0.075);
    material.positionNode = positionLocal.add(normalLocal.mul(surge));
    mesh.material = material;
    mesh.castShadow = false;
    MaterialPool.getInstance().releaseMaterial(previous);
  }
}
