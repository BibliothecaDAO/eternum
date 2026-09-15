import { AdditiveBlending, DoubleSide } from "three";
import { attribute, float, mix, smoothstep, uniform, uv } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { mapAnimationTime } from "../effects/game-end-freeze";

/** Local additive diffusion provides glow on both backends without a full-screen bloom pass. */
export function createEtherealBorderMaterial() {
  const motion = uniform(1);
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  material.name = "terrain-ethereal-gameplay-borders";
  material.toneMapped = false;
  const width = uv().y;
  const core = smoothstep(0.03, 0.2, width).oneMinus();
  const halo = float(1).sub(width).max(0).pow(2).mul(0.38);
  const flow = uv().x.mul(6.283185).sub(mapAnimationTime.mul(motion).mul(1.6)).sin().mul(0.5).add(0.5).pow(5);
  const tint = attribute<"vec3">("terrainColor", "vec3");
  material.colorNode = mix(tint, tint.mul(1.7), flow);
  material.opacityNode = core.add(halo).mul(flow.mul(0.65).add(0.45));
  return { material, motion };
}
