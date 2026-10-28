import type Node from "three/src/nodes/core/Node.js";
import {
  float,
  mix,
  mx_noise_float,
  mx_worley_noise_vec2,
  positionLocal,
  smoothstep,
  uniform,
  vec2,
  vec3,
} from "three/tsl";
import { nearestHexLocalPosition } from "./terrain-hex-node";
import { TERRAIN_WATER_LEVEL } from "./terrain-water";

/** Study: 0 is the shipped ground, 1 gives each biome's ground its own surface. One uniform, no new material. */
export const tileSurfaceStrength = uniform(0);

/**
 * Each ground layer gets a surface a player can name without props: forest litter mottled with moss, grass in tufts,
 * dry earth in mud cracks, stone in fractured plates, sand in dune bands, snow with cold hollows. Every hex also takes
 * a small shade of its own, so the board reads as tiles. Weights: (sand, dry earth, soil, grass), (litter, stone, snow,
 * ash), as the ground recipe packs them.
 */
export function applyTileSurface(
  groundColor: Node<"vec3">,
  weights0: Node<"vec4">,
  weights1: Node<"vec4">,
): Node<"vec3"> {
  const ground = positionLocal.xz;
  const tileCenter = ground.sub(nearestHexLocalPosition(ground));
  const tileShade = tileCenter.dot(vec2(12.9898, 78.233)).sin().mul(43758.5453).fract().sub(0.5).mul(0.18).add(1);

  const cells = mx_worley_noise_vec2(ground.mul(1.9));
  const crack = smoothstep(0, 0.1, cells.y.sub(cells.x)).oneMinus();
  const cracked = crack.mul(weights0.y.mul(0.9).add(weights1.y.mul(0.8))).clamp(0, 1);

  const patches = mx_noise_float(ground.mul(0.75)).mul(0.5).add(0.5);
  const mottling = mx_noise_float(ground.mul(3.1)).mul(0.5).add(0.5);
  const forestFloor = weights1.x.add(weights0.z.mul(0.6)).clamp(0, 1);
  const litter = forestFloor.mul(smoothstep(0.42, 0.7, patches));
  const mossColor = mix(vec3(1), vec3(0.45, 0.82, 0.32), litter.clamp(0, 1));
  const roots = mottling.sub(0.5).mul(0.55).mul(forestFloor).add(1);

  const tufts = smoothstep(0.32, 0.05, cells.x).mul(weights0.w).mul(0.5).add(1);
  const dunes = ground.dot(vec2(0.86, 0.5)).mul(1.4).add(patches.mul(3)).sin().mul(weights0.x.mul(0.25)).add(1);
  const snowHollow = mix(vec3(1), vec3(0.72, 0.84, 1.12), smoothstep(0.55, 0.3, patches).mul(weights1.z));

  const signed = groundColor
    .mul(mossColor)
    .mul(roots)
    .mul(tufts)
    .mul(dunes)
    .mul(snowHollow)
    .mul(float(1).sub(cracked.mul(0.75)))
    .mul(tileShade);
  // Ground just above the water line is wet (the mesh already uses every vertex buffer WebGPU allows: read the height
  // from the position, never a new attribute): darker and cooler, a band that follows the coast's contour.
  const wet = smoothstep(TERRAIN_WATER_LEVEL + 0.07, TERRAIN_WATER_LEVEL + 0.005, positionLocal.y);
  const shore = mix(signed, signed.mul(vec3(0.62, 0.68, 0.7)), wet);
  return mix(groundColor, shore, tileSurfaceStrength);
}
