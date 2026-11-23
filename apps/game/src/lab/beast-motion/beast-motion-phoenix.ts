import type Node from "three/src/nodes/core/Node.js";
import { Box3, InstancedMesh, MeshStandardMaterial, Vector3 } from "three";
import {
  abs,
  color,
  float,
  instanceIndex,
  mx_noise_float,
  positionGeometry,
  positionLocal,
  select,
  sin,
  smoothstep,
  texture,
  uniform,
  vec3,
} from "three/tsl";
import { FrostedStandardNodeMaterial } from "@/three/effects/game-map-material-library";
import { createTripoModelMaterial } from "@/three/materials/tripo-model-material";
import { BEAST_MOTION_PROFILES, createBeastMotionNode } from "@/three/structures/beast-motion";
import type { FrontierSpecies } from "@/three/structures/frontier-beast";
import {
  createBeastEmberGeometry,
  createBeastEmberMaterial,
  createBeastPhoenixGlow,
} from "@/three/structures/frontier-model";
import { BEAST_MOTION_CYCLE_SECONDS } from "./beast-motion-model";

const TAU = Math.PI * 2;

export function createBeastShaderUniforms() {
  return {
    time: uniform(0),
    actionIndex: uniform(0),
    layer: uniform(2),
    phoenixEnabled: uniform(1),
    phaseSpread: uniform(0),
  };
}

export type BeastShaderUniforms = ReturnType<typeof createBeastShaderUniforms>;

function buildBaseBeastMaterial(
  source: MeshStandardMaterial,
  uniforms: BeastShaderUniforms,
  phaseOffset: Node<"float">,
): FrostedStandardNodeMaterial {
  const material = createTripoModelMaterial(source);
  const phoenix = createBeastPhoenixGlow(float(uniforms.layer), phaseOffset, float(uniforms.time)).mul(
    float(uniforms.phoenixEnabled),
  );
  const authoredGlow = material.emissiveMap
    ? texture(material.emissiveMap).rgb.mul(color(material.emissive)).mul(material.emissiveIntensity)
    : color(material.emissive).mul(material.emissiveIntensity);
  material.emissiveNode = material.emissiveIntensity > 0 ? phoenix.add(authoredGlow) : phoenix;
  return material;
}

export function createPureMathsBeastMaterial(
  source: MeshStandardMaterial,
  uniforms: BeastShaderUniforms,
  species: FrontierSpecies,
): FrostedStandardNodeMaterial {
  const phaseOffset = float(instanceIndex).mul(2.399963).mul(float(uniforms.phaseSpread));
  const material = buildBaseBeastMaterial(source, uniforms, phaseOffset);
  material.positionNode = positionLocal.add(createBeastMotionNode(species, float(uniforms.time)));
  return material;
}

export function createRigBeastMaterial(
  source: MeshStandardMaterial,
  uniforms: BeastShaderUniforms,
): FrostedStandardNodeMaterial {
  return buildBaseBeastMaterial(source, uniforms, float(0));
}

export function createHybridBeastMaterial(
  source: MeshStandardMaterial,
  uniforms: BeastShaderUniforms,
  species: FrontierSpecies,
  bounds: Box3,
): FrostedStandardNodeMaterial {
  const material = buildBaseBeastMaterial(source, uniforms, float(0));
  const profile = BEAST_MOTION_PROFILES[species];
  const size = bounds.getSize(new Vector3());
  const minY = bounds.min.y;
  const invHeight = 1 / Math.max(size.y, 0.25);
  const invHalfX = 2 / Math.max(size.x, 0.3);
  const invHalfZ = 2 / Math.max(size.z, 0.3);

  const phase = float(uniforms.time).div(BEAST_MOTION_CYCLE_SECONDS).fract().mul(TAU);
  const gx = positionGeometry.x;
  const gy = positionGeometry.y;
  const gz = positionGeometry.z;
  const nx = gx.mul(invHalfX);
  const ny = gy.sub(minY).mul(invHeight);
  const nz = gz.mul(invHalfZ);
  const absNx = abs(nx);

  const planted = smoothstep(0.08, 0.3, ny);
  const wingTip = smoothstep(0.42, 0.78, absNx)
    .mul(smoothstep(0.24, 0.44, ny))
    .mul(smoothstep(0.35, -0.05, nz));
  const tailMask = smoothstep(-0.2, -0.5, nz).mul(smoothstep(0.58, 0.22, ny));
  const chestMask = smoothstep(0.24, 0.52, ny)
    .mul(smoothstep(0.74, 0.48, ny))
    .mul(smoothstep(0.58, 0.22, absNx));

  const alive = select(
    float(uniforms.actionIndex).greaterThan(3.5),
    smoothstep(0.5, 0.08, float(uniforms.time).div(BEAST_MOTION_CYCLE_SECONDS).fract()),
    float(1),
  );
  const breath = sin(phase.mul(2)).mul(0.5).add(0.5);
  const wingFlutter = sin(phase.mul(2).add(0.3).add(absNx.mul(2.8)));
  const tailWave = sin(phase.mul(2).sub(1.2).add(nz.mul(3.4))).mul(Math.max(profile.tailAmp, 0.025));
  const noise = mx_noise_float(vec3(gx.mul(4), gy.mul(4), float(uniforms.time).mul(1.6))).mul(0.008);
  const wingAmp = profile.wingAmp * 0.65;

  const secDx = gx.mul(breath.mul(0.065)).mul(chestMask).add(tailWave.mul(tailMask)).add(noise.mul(planted)).mul(alive);
  const secDy = breath.mul(0.028).mul(planted).add(wingFlutter.mul(wingAmp).mul(wingTip)).mul(alive);
  const secDz = breath
    .mul(0.022)
    .mul(chestMask)
    .add(wingFlutter.mul(wingAmp * 0.45).mul(wingTip))
    .mul(alive);

  material.positionNode = positionLocal.add(vec3(secDx, secDy, secDz));
  return material;
}

export function createSharedEmberPool(bounds: Box3, capacity: number, uniforms: BeastShaderUniforms): InstancedMesh {
  const geometry = createBeastEmberGeometry(bounds);
  const material = createBeastEmberMaterial(
    float(uniforms.layer),
    float(uniforms.time),
    float(uniforms.phoenixEnabled),
  );
  const mesh = new InstancedMesh(geometry, material, Math.max(1, capacity));
  mesh.name = "Beast motion phoenix embers";
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.raycast = () => {};
  mesh.renderOrder = 11;
  return mesh;
}
