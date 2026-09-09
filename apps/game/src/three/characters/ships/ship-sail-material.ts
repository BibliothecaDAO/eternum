import type { MeshBasicMaterial, MeshStandardMaterial } from "three";
import MeshBasicNodeMaterial from "three/src/materials/nodes/MeshBasicNodeMaterial.js";
import { instanceColor } from "three/src/nodes/accessors/Instance.js";
import { mix, step, texture, uv, vec3, vec4 } from "three/tsl";
import { SAIL_STRIPE_U } from "./ship-sail-print";

export function createOwnershipSailMaterial(source: MeshBasicMaterial | MeshStandardMaterial): MeshBasicNodeMaterial {
  if (!source.map) throw new Error(`Ownership sail ${source.name} has no print texture`);
  const material = new MeshBasicNodeMaterial();
  material.name = source.name;
  material.map = source.map;
  material.side = source.side;
  material.fog = source.fog;
  material.userData.ownershipColor = true;
  const print = texture(source.map);
  const stripe = step(SAIL_STRIPE_U.start, uv().x).mul(step(SAIL_STRIPE_U.end, uv().x).oneMinus());
  // A custom fragment applies the instance tint once, only inside the printed stripe.
  material.fragmentNode = vec4(print.rgb.mul(mix(vec3(1), instanceColor, stripe)), print.a);
  return material;
}
