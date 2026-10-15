import {
  AdditiveBlending,
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  type Object3D,
} from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { attribute, positionLocal, uniform, uv, vec3 } from "three/tsl";
import { mapAnimationTime as time } from "../effects/game-end-freeze";
import { createInstancedMeshWithSharedMatrices } from "../utils/create-instanced-mesh";

const HUES = [0xffbb42, 0x35e4c5, 0xff713e];
const MOTES = 48;

/** One draw per model batch; all rising motion runs on the GPU above the complete roofline. */
export class RealmLivingAura {
  readonly mesh: Mesh;
  private readonly seeds: InstancedBufferAttribute | null;
  private readonly tints: InstancedBufferAttribute | null;
  private readonly phase = uniform(0);
  private readonly tint = uniform(new Color(HUES[0]));
  private readonly placement?: InstancedMesh;

  constructor(source: Object3D, placement?: InstancedMesh) {
    const top = new Box3().setFromObject(source).max.y;
    const geometry = auraGeometry(top);
    this.placement = placement;
    this.seeds = placement ? new InstancedBufferAttribute(new Float32Array(placement.instanceMatrix.count), 1) : null;
    this.tints = placement
      ? new InstancedBufferAttribute(new Float32Array(placement.instanceMatrix.count * 3), 3)
      : null;
    if (this.seeds && this.tints) {
      geometry.setAttribute("wonderPhase", this.seeds);
      geometry.setAttribute("wonderTint", this.tints);
    }
    const material = this.createMaterial(Boolean(placement));
    this.mesh = placement
      ? createInstancedMeshWithSharedMatrices(geometry, material, placement)
      : new Mesh(geometry, material);
    this.mesh.name = "Wonder rising aura";
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.raycast = () => {};
    this.mesh.renderOrder = 11;
  }

  setEntityAt(index: number, entityId: string | number | bigint): void {
    const seed = BigInt(entityId);
    const phase = Number(seed % 997n) / 997;
    const tint = new Color(HUES[Number(seed % 3n)]);
    if (this.seeds && this.tints) {
      this.seeds.setX(index, phase);
      this.tints.setXYZ(index, tint.r, tint.g, tint.b);
      this.seeds.needsUpdate = this.tints.needsUpdate = true;
    } else {
      this.phase.value = phase;
      this.tint.value.copy(tint);
    }
  }

  syncCount(): void {
    if (this.placement) (this.mesh as InstancedMesh).count = this.placement.count;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicNodeMaterial).dispose();
    if (this.mesh instanceof InstancedMesh) this.mesh.dispose();
  }

  private createMaterial(instanced: boolean): MeshBasicNodeMaterial {
    const material = new MeshBasicNodeMaterial({
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: DoubleSide,
      forceSinglePass: true,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const phase = instanced ? attribute<"float">("wonderPhase", "float") : this.phase;
    const tint = instanced ? attribute<"vec3">("wonderTint", "vec3") : this.tint;
    const mote = attribute<"float">("auraMote", "float");
    const seed = attribute<"float">("auraSeed", "float");
    const age = time.mul(0.105).add(seed).add(phase).fract();
    const breathing = time
      .mul(0.65)
      .add(phase.mul(Math.PI * 2))
      .sin()
      .mul(0.18)
      .add(0.82);
    const edge = uv().sub(0.5).length().mul(2).oneMinus().clamp(0, 1).pow(2);
    material.positionNode = positionLocal.add(vec3(0, age.mul(0.64).mul(mote).add(breathing.mul(0.025)), 0));
    material.colorNode = tint;
    material.opacityNode = edge.mul(breathing).mul(age.mul(Math.PI).sin().mul(mote).add(mote.oneMinus())).mul(0.58);
    return material;
  }
}

function auraGeometry(top: number): BufferGeometry {
  const positions: number[] = [],
    coordinates: number[] = [],
    seeds: number[] = [],
    motes: number[] = [],
    indices: number[] = [];
  for (let index = 0; index < MOTES + 2; index++) {
    const halo = index < 2;
    const angle = index * 2.399963;
    const radius = 0.22 + 0.4 * ((index * 0.754877666) % 1);
    const size = halo ? (1.35 - index * 0.3) / 2 : index % 4 === 0 ? 0.055 : 0.0225;
    const start = positions.length / 3;
    for (const [x, y, u, v] of [
      [-1, -1, 0, 0],
      [1, -1, 1, 0],
      [-1, 1, 0, 1],
      [1, 1, 1, 1],
    ]) {
      positions.push(
        halo ? x * size : Math.cos(angle) * radius + (index % 2 ? 0 : x * size),
        top + (halo ? 0.09 + index * 0.07 : 0.22 + y * size * 2.1),
        halo ? y * size : Math.sin(angle) * radius + (index % 2 ? x * size : 0),
      );
      coordinates.push(u, v);
      seeds.push((index * 0.61803398875) % 1);
      motes.push(halo ? 0 : 1);
    }
    indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(coordinates, 2));
  geometry.setAttribute("auraSeed", new Float32BufferAttribute(seeds, 1));
  geometry.setAttribute("auraMote", new Float32BufferAttribute(motes, 1));
  geometry.setIndex(indices);
  return geometry;
}
