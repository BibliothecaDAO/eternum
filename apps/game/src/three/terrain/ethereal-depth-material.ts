import type { EtherealLayer } from "@bibliothecadao/eternum";
import { color, mix, positionWorld, smoothstep } from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { applyEndgameFrost } from "../effects/endgame/field";
import { createBasaltSurface } from "./terrain-ethereal-material";
import { ETHEREAL_DEPTH_LOOKS } from "./ethereal-depths";

export function createDepthMaterial(depth: EtherealLayer): MeshStandardNodeMaterial {
  const look = ETHEREAL_DEPTH_LOOKS[depth];
  const material = new MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0 });
  const ground = positionWorld.xz;
  const basalt = createBasaltSurface(ground.mul(look.scale));
  const slab = basalt.slab;
  const strata = ground.x.mul(0.63).add(ground.y.mul(0.4).sin().mul(1.7)).sin().mul(0.5).add(0.5);
  const fissure = smoothstep(0.91, 0.99, strata).mul(slab.oneMinus());
  material.colorNode = applyEndgameFrost(
    mix(color(look.shadow), color(look.stone), slab.mul(strata.mul(0.3).add(0.7))),
  );
  material.emissiveNode = color(look.energy).mul(fissure).mul(look.veins);
  return material;
}
