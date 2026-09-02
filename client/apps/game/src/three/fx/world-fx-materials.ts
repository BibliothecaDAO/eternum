import { AdditiveBlending, DoubleSide, NormalBlending } from "three";
import type { Blending } from "three";
import * as ThreeWebGPU from "three/webgpu";
import { attribute, color, mix, smoothstep, time, uv } from "three/tsl";
import type MeshBasicNodeMaterial from "three/src/materials/nodes/MeshBasicNodeMaterial.js";
import type Node from "three/src/nodes/core/Node.js";

export const WORLD_FX_PARTICLE_ATTRIBUTE = "worldFxParticle";

const MeshBasicNodeMaterialConstructor = (
  ThreeWebGPU as unknown as { MeshBasicNodeMaterial: new () => MeshBasicNodeMaterial }
).MeshBasicNodeMaterial;

export function createWorldFxAdditiveMaterial(): MeshBasicNodeMaterial {
  const material = createTransparentMaterial("world-fx-additive", AdditiveBlending);
  const particle = attribute<"vec4">(WORLD_FX_PARTICLE_ATTRIBUTE, "vec4").clamp(0, 1);
  const coordinatesUv = uv();
  const coordinates = coordinatesUv.sub(0.5).mul(2);
  const vertical = coordinatesUv.y.clamp(0, 1);
  const flamePhase = particle.z.mul(17.3).add(time.mul(5.4));
  const flameSway = flamePhase.add(vertical.mul(9.2)).sin().mul(vertical.mul(0.11).add(0.025));
  const taperedWidth = vertical.oneMinus().mul(0.68).add(0.14);
  const taperedDistance = coordinates.x.add(flameSway).abs().div(taperedWidth);
  const flameSides = smoothstep(0.48, 1, taperedDistance).oneMinus();
  const flameBase = smoothstep(0, 0.1, vertical);
  const flameTip = smoothstep(0.72, 1, vertical).oneMinus();
  const flameLobes = coordinates.x.mul(7.1).add(vertical.mul(11.7)).add(flamePhase).sin().mul(0.1).add(0.9);
  const flameMask = flameSides.mul(flameBase).mul(flameTip).mul(flameLobes);
  const flameCore = smoothstep(0.08, 0.54, taperedDistance)
    .oneMinus()
    .mul(smoothstep(0.02, 0.18, vertical))
    .mul(smoothstep(0.56, 0.88, vertical).oneMinus());
  const sparkWidth = smoothstep(0.06, 0.36, coordinates.x.abs()).oneMinus();
  const sparkLength = smoothstep(0.62, 1, coordinates.y.abs()).oneMinus();
  const sparkMask = sparkWidth.mul(sparkLength);
  const flashDistance = coordinates.length();
  const energyBody = smoothstep(0.12, 1, flashDistance).oneMinus();
  const energyBreakup = coordinates.x
    .mul(10.3)
    .add(coordinates.y.mul(7.9))
    .add(particle.y.mul(13.7))
    .add(time.mul(2.1))
    .sin()
    .mul(0.13)
    .add(0.87);
  const energyMask = energyBody.mul(energyBreakup);
  const flashBody = smoothstep(0.16, 0.94, flashDistance).oneMinus();
  const flashBreakup = coordinates.x
    .mul(8.3)
    .add(coordinates.y.mul(11.9))
    .add(particle.y.mul(9.1))
    .sin()
    .mul(0.12)
    .add(0.88);
  const flashMask = flashBody.mul(flashBreakup);
  const energyWeight = smoothstep(0.16, 0.3, particle.w)
    .mul(smoothstep(0.42, 0.52, particle.w).oneMinus())
    .clamp(0, 1);
  const flashWeight = smoothstep(0.5, 0.63, particle.w)
    .mul(smoothstep(0.76, 0.86, particle.w).oneMinus())
    .clamp(0, 1);
  const sparkWeight = smoothstep(0.84, 0.98, particle.w);
  const flameWeight = energyWeight.add(flashWeight).add(sparkWeight).clamp(0, 1).oneMinus();
  const opacity = flameMask
    .mul(flameWeight)
    .add(energyMask.mul(energyWeight))
    .add(flashMask.mul(flashWeight))
    .add(sparkMask.mul(sparkWeight))
    .mul(particle.x)
    .clamp(0, 0.9);
  const heat = flameCore.mul(0.78).add(vertical.oneMinus().mul(0.22)).clamp(0, 1);
  const flameColor = mix(color("#c52c08"), color("#ffd37a"), heat);
  const energyColor = createEnergyColor(particle.z);

  const shapedColor = mix(energyColor, flameColor, flameWeight);
  material.colorNode = mix(shapedColor, color("#fff0d2"), flashWeight.mul(0.82));
  material.opacityNode = opacity;
  return material;
}

export function createWorldFxSmokeMaterial(): MeshBasicNodeMaterial {
  const material = createTransparentMaterial("world-fx-smoke", NormalBlending);
  const particle = attribute<"vec4">(WORLD_FX_PARTICLE_ATTRIBUTE, "vec4").clamp(0, 1);
  const coordinates = uv().sub(0.5).mul(2);
  const phase = particle.z.mul(19.1).add(time.mul(0.65));
  const warpedX = coordinates.x.add(coordinates.y.mul(5.4).add(phase).sin().mul(0.13));
  const warpedY = coordinates.y.add(coordinates.x.mul(4.7).sub(phase.mul(0.73)).sin().mul(0.1));
  const cloudDistance = warpedX.mul(warpedX).add(warpedY.mul(warpedY).mul(0.72));
  const cloud = smoothstep(0.22, 1, cloudDistance).oneMinus();
  const billow = warpedX.mul(6.2).add(warpedY.mul(7.7)).add(phase).sin().mul(0.18).add(0.82);

  material.colorNode = mix(color("#302a27"), color("#8a7567"), particle.z.mul(0.72));
  material.opacityNode = cloud.mul(billow).mul(particle.x).mul(0.66).clamp(0, 0.52);
  return material;
}

export function createWorldFxRingMaterial(): MeshBasicNodeMaterial {
  const material = createTransparentMaterial("world-fx-ring", AdditiveBlending);
  const particle = attribute<"vec4">(WORLD_FX_PARTICLE_ATTRIBUTE, "vec4").clamp(0, 1);
  const coordinates = uv().sub(0.5).mul(2);
  const radiusDistortion = coordinates.x
    .mul(9.3)
    .add(coordinates.y.mul(13.1))
    .add(particle.z.mul(7.7))
    .sin()
    .mul(0.018);
  const radius = coordinates.length().add(radiusDistortion);
  const leadingDistance = radius.sub(0.7).abs();
  const leadingEdge = smoothstep(0.015, 0.06, leadingDistance).oneMinus();
  const trailingDistance = radius.sub(0.57).abs();
  const trailingWake = smoothstep(0.04, 0.17, trailingDistance).oneMinus().mul(0.12);
  const breakupPhase = coordinates.x
    .mul(12.7)
    .add(coordinates.y.mul(17.3))
    .add(particle.y.mul(16.1))
    .add(particle.z.mul(5.9));
  const breakup = breakupPhase.sin().mul(0.16).add(0.84);
  const ring = leadingEdge.add(trailingWake).mul(breakup);

  material.colorNode = createEnergyColor(particle.z);
  material.opacityNode = ring.mul(particle.x).clamp(0, 0.68);
  return material;
}

function createEnergyColor(tone: Node<"float">): Node<"vec3"> {
  const physicalToFire = mix(color("#ffc45e"), color("#ff641c"), smoothstep(0, 0.28, tone));
  const healingToArcane = mix(color("#6ff2a4"), color("#9a8cff"), smoothstep(0.62, 1, tone));
  return mix(physicalToFire, healingToArcane, smoothstep(0.34, 0.58, tone));
}

function createTransparentMaterial(name: string, blending: Blending): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterialConstructor();
  material.name = name;
  material.blending = blending;
  material.depthTest = true;
  material.depthWrite = false;
  material.side = DoubleSide;
  material.transparent = true;
  return material;
}
