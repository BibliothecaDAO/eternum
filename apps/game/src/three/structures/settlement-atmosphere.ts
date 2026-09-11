import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Vector2,
  type Object3D,
} from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { attribute, positionLocal, uniform, uv, vec3 } from "three/tsl";
import type { WeatherState } from "../managers/weather-manager";

interface Emitter {
  x: number;
  y: number;
  z: number;
  essence: boolean;
}

interface GlowingSurface {
  mesh: Mesh;
  original: MeshStandardMaterial;
  material: MeshStandardMaterial;
  essence: boolean;
}

/** Shared effects follow the authored fire and gems, with no extra scene lights. */
export class SettlementAtmosphere {
  private readonly clock = uniform(0);
  private readonly wind = uniform(new Vector2());
  private readonly effects: Mesh[] = [];
  private readonly surfaces: GlowingSurface[] = [];
  private readonly placement?: Mesh;

  constructor(source: Object3D, instances: readonly Mesh[]) {
    const emitters = this.prepareEmitters(source, instances);
    const placement = instances[0];
    if (!placement?.parent || emitters.length === 0) return;
    this.placement = placement;
    this.addEffect(buildEmitterGeometry(emitters, "motes"), this.createMoteMaterial(), "settlement-motes");
    this.addEffect(buildEmitterGeometry(emitters, "glow"), this.createGlowMaterial(), "settlement-glow");
    const fires = emitters.filter((emitter) => !emitter.essence);
    if (fires.length)
      this.addEffect(buildEmitterGeometry(fires, "smoke"), this.createSmokeMaterial(), "settlement-smoke");
  }

  private prepareEmitters(source: Object3D, instances: readonly Mesh[]): Emitter[] {
    const motions = new Map<string, string>();
    source.traverse((node) => {
      if (node instanceof Mesh) motions.set(node.geometry.uuid, node.userData.settlementMotion);
    });
    const emitters: Emitter[] = [];
    for (const mesh of instances) {
      const motion = motions.get(mesh.geometry.uuid);
      if (motion !== "spin" && motion !== "flame") continue;
      mesh.geometry.computeBoundingBox();
      const bounds = mesh.geometry.boundingBox!;
      const essence = motion === "spin";
      emitters.push({
        x: (bounds.min.x + bounds.max.x) / 2,
        y: essence ? (bounds.min.y + bounds.max.y) / 2 : bounds.min.y + (bounds.max.y - bounds.min.y) * 0.45,
        z: (bounds.min.z + bounds.max.z) / 2,
        essence,
      });
      if (mesh.material instanceof MeshStandardMaterial) {
        const original = mesh.material;
        const material = original.clone();
        if (essence) {
          material.roughness = 0.24;
          material.metalness = 0.16;
        }
        mesh.material = material;
        this.surfaces.push({ mesh, original, material, essence });
      }
    }
    return emitters;
  }

  update(seconds: number, wind: Pick<WeatherState, "windX" | "windZ">): void {
    this.clock.value = seconds;
    this.wind.value.set(wind.windX, wind.windZ);
    if (this.placement instanceof InstancedMesh) {
      for (const effect of this.effects) (effect as InstancedMesh).count = this.placement.count;
    }
    for (const surface of this.surfaces) {
      const pulse = surface.essence
        ? 1.1 + 0.28 * Math.sin(seconds * 1.6)
        : 0.85 + 0.15 * Math.sin(seconds * 9) + 0.08 * Math.sin(seconds * 17);
      surface.material.emissiveIntensity = surface.original.emissiveIntensity * pulse;
    }
  }

  dispose(): void {
    for (const effect of this.effects) {
      effect.removeFromParent();
      effect.geometry.dispose();
      (effect.material as MeshBasicNodeMaterial).dispose();
      if (effect instanceof InstancedMesh) effect.dispose();
    }
    for (const surface of this.surfaces) {
      surface.mesh.material = surface.original;
      surface.material.dispose();
    }
    this.effects.length = 0;
    this.surfaces.length = 0;
  }

  private addEffect(geometry: BufferGeometry, material: MeshBasicNodeMaterial, name: string): void {
    const placement = this.placement!;
    const effect =
      placement instanceof InstancedMesh
        ? new InstancedMesh(geometry, material, placement.instanceMatrix.count)
        : new Mesh(geometry, material);
    if (effect instanceof InstancedMesh && placement instanceof InstancedMesh) {
      effect.instanceMatrix = placement.instanceMatrix;
      effect.count = placement.count;
    }
    effect.name = name;
    effect.frustumCulled = false;
    effect.raycast = () => {};
    effect.renderOrder = 11;
    placement.parent!.add(effect);
    this.effects.push(effect);
  }

  private createMoteMaterial(): MeshBasicNodeMaterial {
    const material = glowMaterial();
    const seed = attribute<"float">("settlementSeed", "float");
    const essence = attribute<"float">("settlementEssence", "float");
    const phase = this.clock.mul(essence.mul(-0.12).add(0.36)).add(seed).fract();
    const angle = seed.mul(Math.PI * 2).add(this.clock.mul(0.7));
    const radius = essence.mul(0.065).add(0.02).mul(phase.mul(0.4).add(0.6));
    material.positionNode = positionLocal.add(
      vec3(
        angle.cos().mul(radius).add(this.wind.x.mul(phase).mul(0.035)),
        phase.mul(0.27),
        angle.sin().mul(radius).add(this.wind.y.mul(phase).mul(0.035)),
      ),
    );
    material.colorNode = attribute<"vec3">("settlementTint", "vec3").mul(1.8);
    material.opacityNode = phase.mul(Math.PI).sin().mul(0.75);
    return material;
  }

  private createGlowMaterial(): MeshBasicNodeMaterial {
    const material = glowMaterial();
    const edge = uv().sub(0.5).length().mul(2).oneMinus().clamp(0, 1).pow(2);
    const pulse = this.clock
      .mul(1.6)
      .add(attribute<"float">("settlementSeed", "float").mul(6))
      .sin()
      .mul(0.035)
      .add(0.16);
    material.colorNode = attribute<"vec3">("settlementTint", "vec3");
    material.opacityNode = edge.mul(pulse);
    return material;
  }

  private createSmokeMaterial(): MeshBasicNodeMaterial {
    const material = new MeshBasicNodeMaterial({
      color: 0x35312d,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      forceSinglePass: true,
    });
    const phase = this.clock.mul(0.22).add(attribute<"float">("settlementSeed", "float")).fract();
    const edge = uv().sub(0.5).length().mul(2).oneMinus().clamp(0, 1).pow(2);
    material.positionNode = positionLocal.add(
      vec3(this.wind.x.mul(phase).mul(0.14), phase.mul(0.42).add(0.08), this.wind.y.mul(phase).mul(0.14)),
    );
    material.opacityNode = edge.mul(phase.mul(Math.PI).sin()).mul(0.12);
    return material;
  }
}

function glowMaterial(): MeshBasicNodeMaterial {
  return new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    forceSinglePass: true,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

function buildEmitterGeometry(emitters: readonly Emitter[], effect: "motes" | "glow" | "smoke"): BufferGeometry {
  const positions: number[] = [],
    coordinates: number[] = [],
    seeds: number[] = [],
    kinds: number[] = [],
    tints: number[] = [],
    indices: number[] = [];
  for (const [index, emitter] of emitters.entries()) {
    const count = effect === "glow" ? 2 : effect === "smoke" ? 4 : 8;
    const radius = effect === "glow" ? (emitter.essence ? 0.15 : 0.11) : effect === "smoke" ? 0.045 : 0.005;
    const tint = emitter.essence ? [0.12, 1, 0.7] : [1, 0.35, 0.045];
    for (let particle = 0; particle < count; particle++) {
      const start = positions.length / 3;
      const seed = (particle / count + index * 0.381966) % 1;
      for (const [x, y, u, v] of [
        [-1, -1, 0, 0],
        [1, -1, 1, 0],
        [-1, 1, 0, 1],
        [1, 1, 1, 1],
      ]) {
        positions.push(
          emitter.x + (particle % 2 ? 0 : x * radius),
          emitter.y + y * radius,
          emitter.z + (particle % 2 ? x * radius : 0),
        );
        coordinates.push(u, v);
        seeds.push(seed);
        kinds.push(Number(emitter.essence));
        tints.push(...tint);
      }
      indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(coordinates, 2));
  geometry.setAttribute("settlementSeed", new Float32BufferAttribute(seeds, 1));
  geometry.setAttribute("settlementEssence", new Float32BufferAttribute(kinds, 1));
  geometry.setAttribute("settlementTint", new Float32BufferAttribute(tints, 3));
  geometry.setIndex(indices);
  return geometry;
}
