import { attribute, color, mix, mx_noise_float, normalView, positionWorld, vec3 } from "three/tsl";
import type Node from "three/src/nodes/core/Node.js";
import type { MeshStandardNodeMaterial } from "three/webgpu";
import { mapAnimationTime } from "../../effects/endgame/state";

/** Dark crust replaces the host biome; the pulse lives on the recessed floor, below the unlit walls. */
export function createRiftGroundMaterial(source: MeshStandardNodeMaterial) {
  if (!source.colorNode) throw new Error("Rift ground requires the terrain's textured color");
  const material = source.clone();
  material.name = "lab-rift-ground";
  const field = attribute("riftGround", "vec4");
  const coverage = field.r;
  const depth = field.g;
  const floor = field.b.smoothstep(0.65, 0.95);
  const grain = mx_noise_float(positionWorld.mul(30)).mul(0.5).add(0.5);
  const crust = mix(color("#101016"), color("#28222d"), grain).mul(depth.mul(-0.7).add(1));
  const pulse = mapAnimationTime.mul(2.6).sin().mul(0.5).add(0.5).pow(3);
  material.colorNode = mix(vec3(source.colorNode as Node<"vec3">), crust, coverage);
  material.emissiveNode = mix(
    vec3((source.emissiveNode as Node<"vec3"> | null) ?? vec3(0)),
    color("#a445c7").mul(floor).mul(pulse.mul(1.8).add(0.12)),
    coverage,
  );
  material.normalNode = mix(vec3((source.normalNode as Node<"vec3"> | null) ?? normalView), normalView, coverage);
  return material;
}
