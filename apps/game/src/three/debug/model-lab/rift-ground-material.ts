import {
  color,
  float,
  fwidth,
  mix,
  mx_noise_float,
  positionWorld,
  smoothstep,
  Fn,
  If,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type Node from "three/src/nodes/core/Node.js";
import type { MeshStandardNodeMaterial } from "three/webgpu";

/** Lab proposal: the existing ground owns the rift, with the same geometry, normals and biome textures. */
export function createRiftGroundMaterial(source: MeshStandardNodeMaterial) {
  if (!source.colorNode) throw new Error("Rift ground requires the terrain's textured color");
  const material = source.clone();
  material.name = "lab-rift-ground";
  const ground = positionWorld.xz;
  const local = ground.abs();
  const edge = float(Math.sqrt(3) / 2).sub(local.x.max(local.dot(vec2(0.5, Math.sqrt(3) / 2))));
  const baseColor = vec3(source.colorNode as Node<"vec3">);
  const surface = Fn(() => {
    const result = vec4(baseColor, 0).toVar();
    If(edge.greaterThan(-0.035), () => {
      const grain = mx_noise_float(vec3(ground.mul(18), 0))
        .mul(0.5)
        .add(0.5);
      const warp = mx_noise_float(vec3(ground.mul(4.5), 0));
      // The whole hex is stained; only the narrow verge returns to its neighboring biome.
      const coverage = smoothstep(0, 0.17, edge.add(warp.mul(0.035)));
      const trunk = ground.x.add(ground.y.mul(5).sin().mul(0.09)).add(warp.mul(0.1)).abs();
      const branch = ground.y
        .add(ground.x.mul(1.5))
        .add(ground.x.mul(8).sin().mul(0.1))
        .add(warp.mul(0.12))
        .sin()
        .abs();
      const fineRoots = ground.x.mul(6).add(ground.y.mul(9)).add(warp.mul(1.5)).sin().abs();
      const channel = trunk.min(branch.mul(0.8).add(0.012)).add(grain.sub(0.5).mul(0.055));
      const width = fwidth(channel).max(0.004);
      const opening = smoothstep(float(0.024).sub(width), float(0.024).add(width), channel).oneMinus();
      const bank = smoothstep(0.024, 0.105, channel).oneMinus();
      const roots = smoothstep(0.035, 0.11, fineRoots).oneMinus().mul(0.28);
      const soil = baseColor.mul(vec3(0.46, 0.3, 0.48)).mul(grain.mul(0.25).add(0.8));
      const bruised = mix(soil, color("#342238"), bank.mul(0.75).add(roots).clamp(0, 1));
      const seam = mix(color("#712268"), color("#c58cdb"), opening);
      result.assign(
        vec4(
          mix(baseColor, mix(bruised, seam.mul(grain.mul(0.5).add(0.65)), opening.mul(0.8)), coverage),
          opening.mul(0.48).add(roots.mul(0.12)).mul(coverage),
        ),
      );
    });
    return result;
  })();
  material.colorNode = surface.rgb;
  material.emissiveNode = vec3((source.emissiveNode as Node<"vec3"> | null) ?? vec3(0)).add(
    color("#b45acb").mul(surface.a),
  );
  return material;
}
