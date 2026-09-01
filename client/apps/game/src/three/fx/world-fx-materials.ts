import { AdditiveBlending, DoubleSide, NormalBlending } from "three";
import * as ThreeWebGPU from "three/webgpu";
import { attribute, color, mix, smoothstep, time, uv } from "three/tsl";
import type MeshBasicNodeMaterial from "three/src/materials/nodes/MeshBasicNodeMaterial.js";

export const WORLD_FX_PARTICLE_ATTRIBUTE = "worldFxParticle";

const MeshBasicNodeMaterialConstructor = (
  ThreeWebGPU as unknown as { MeshBasicNodeMaterial: new () => MeshBasicNodeMaterial }
).MeshBasicNodeMaterial;

export function createWorldFxAdditiveMaterial(): MeshBasicNodeMaterial {
  const material = createTransparentMaterial("world-fx-additive", AdditiveBlending);
  const particle = attribute<"vec4">(WORLD_FX_PARTICLE_ATTRIBUTE, "vec4").clamp(0, 1);
  const coordinates = uv().sub(0.5).mul(2);
  const radial = smoothstep(0.18, 1, coordinates.length()).oneMinus();
  const breakup = coordinates.x
    .mul(8.7)
    .add(coordinates.y.mul(5.3))
    .add(particle.y.mul(11.1))
    .add(time.mul(7.2))
    .sin()
    .mul(0.12)
    .add(0.88);

  material.colorNode = mix(color("#ff6a12"), color("#fff2a6"), particle.z);
  material.opacityNode = radial.mul(breakup).mul(particle.x).clamp(0, 1);
  return material;
}

export function createWorldFxSmokeMaterial(): MeshBasicNodeMaterial {
  const material = createTransparentMaterial("world-fx-smoke", NormalBlending);
  const particle = attribute<"vec4">(WORLD_FX_PARTICLE_ATTRIBUTE, "vec4").clamp(0, 1);
  const coordinates = uv().sub(0.5).mul(2);
  const radial = smoothstep(0.12, 1, coordinates.length()).oneMinus();
  const breakup = coordinates.x
    .mul(5.9)
    .add(coordinates.y.mul(8.1))
    .add(particle.y.mul(9.7))
    .add(time.mul(0.8))
    .sin()
    .mul(0.16)
    .add(0.84);

  material.colorNode = mix(color("#2f3033"), color("#77736c"), particle.z);
  material.opacityNode = radial.mul(breakup).mul(particle.x).mul(0.72).clamp(0, 0.68);
  return material;
}

export function createWorldFxRingMaterial(): MeshBasicNodeMaterial {
  const material = createTransparentMaterial("world-fx-ring", AdditiveBlending);
  const particle = attribute<"vec4">(WORLD_FX_PARTICLE_ATTRIBUTE, "vec4").clamp(0, 1);
  const coordinates = uv().sub(0.5).mul(2);
  const ringDistance = coordinates.length().sub(0.62).abs();
  const ring = smoothstep(0.035, 0.17, ringDistance).oneMinus();
  const breakup = coordinates.x.mul(9.2).add(coordinates.y.mul(6.8)).add(particle.y.mul(13.7)).sin().mul(0.1).add(0.9);

  material.colorNode = mix(color("#ff9a38"), color("#d8b4ff"), particle.z);
  material.opacityNode = ring.mul(breakup).mul(particle.x).clamp(0, 0.9);
  return material;
}

function createTransparentMaterial(name: string, blending: number): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterialConstructor();
  material.name = name;
  material.blending = blending;
  material.depthTest = true;
  material.depthWrite = false;
  material.side = DoubleSide;
  material.transparent = true;
  return material;
}
