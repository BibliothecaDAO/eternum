import type Node from "three/src/nodes/core/Node.js";
import { Box3, InstancedMesh, MeshStandardMaterial } from "three";
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
import { createBeastMotionNode } from "@/three/structures/beast-motion";
import {
  createBeastEmberGeometry,
  createBeastEmberMaterial,
  createBeastPhoenixGlow,
} from "@/three/structures/frontier-model";
import { BEAST_MOTION_CYCLE_SECONDS, BEAST_MOTION_SPECIES } from "./beast-motion-model";

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
): FrostedStandardNodeMaterial {
  const phaseOffset = float(instanceIndex).mul(2.399963).mul(float(uniforms.phaseSpread));
  const material = buildBaseBeastMaterial(source, uniforms, phaseOffset);
  material.positionNode = positionLocal.add(createBeastMotionNode(BEAST_MOTION_SPECIES, float(uniforms.time)));
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
): FrostedStandardNodeMaterial {
  const material = buildBaseBeastMaterial(source, uniforms, float(0));

  const phase = float(uniforms.time).div(BEAST_MOTION_CYCLE_SECONDS).fract().mul(TAU);
  const gx = positionGeometry.x;
  const gy = positionGeometry.y;
  const gz = positionGeometry.z;
  const absX = abs(gx);

  const planted = smoothstep(0.08, 0.3, gy);
  const wingTip = smoothstep(0.2, 0.34, absX)
    .mul(smoothstep(0.24, 0.44, gy))
    .mul(smoothstep(0.18, 0.0, gz));
  const tailMask = smoothstep(-0.14, -0.26, gz).mul(smoothstep(0.42, 0.22, gy));
  const chestMask = smoothstep(0.24, 0.52, gy)
    .mul(smoothstep(0.7, 0.48, gy))
    .mul(smoothstep(0.24, 0.1, absX));

  const alive = select(
    float(uniforms.actionIndex).greaterThan(3.5),
    smoothstep(0.5, 0.08, float(uniforms.time).div(BEAST_MOTION_CYCLE_SECONDS).fract()),
    float(1),
  );
  const breath = sin(phase.mul(2)).mul(0.5).add(0.5);
  const wingFlutter = sin(phase.mul(2).add(0.3).add(absX.mul(4.5)));
  const tailWave = sin(phase.mul(2).sub(1.2).add(gz.mul(6))).mul(0.11);
  const noise = mx_noise_float(vec3(gx.mul(4), gy.mul(4), float(uniforms.time).mul(1.6))).mul(0.01);

  const secDx = gx.mul(breath.mul(0.075)).mul(chestMask).add(tailWave.mul(tailMask)).add(noise.mul(planted)).mul(alive);
  const secDy = breath.mul(0.032).mul(planted).add(wingFlutter.mul(0.16).mul(wingTip)).mul(alive);
  const secDz = breath.mul(0.025).mul(chestMask).add(wingFlutter.mul(0.08).mul(wingTip)).mul(alive);

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
