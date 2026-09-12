import { NormalRGPacking } from "three";
import type Node from "three/src/nodes/core/Node.js";
import type UniformNode from "three/src/nodes/core/UniformNode.js";
import {
  color,
  fwidth,
  int,
  mix,
  mx_noise_float,
  normalMap,
  positionWorld,
  smoothstep,
  texture,
  time,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";

import { createEtherealSurfacePalette } from "./ethereal-surface-palette";
import { terrainHexEdgeDistance } from "./terrain-hex-node";
import { TERRAIN_GROUND_SURFACE_IDS } from "./terrain-ground-profile";
import type { TerrainGroundTextures } from "./terrain-ground-textures";

const STONE_LAYER = TERRAIN_GROUND_SURFACE_IDS.indexOf("stone");
const DUST_LAYER = TERRAIN_GROUND_SURFACE_IDS.indexOf("dry-earth");

/** The alternate layer changes terrain presentation without inventing a gameplay biome. */
export function createEtherealTerrainMaterial(
  textures: TerrainGroundTextures,
  groundMotion: UniformNode<"float", number>,
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 1 });
  material.name = "terrain-ethereal";
  const palette = createEtherealSurfacePalette();
  const ground = positionWorld.xz;
  const drift = time.mul(groundMotion);
  const cloud = mx_noise_float(vec3(ground.mul(0.38), 0))
    .mul(0.5)
    .add(0.5);
  const stoneUv = uv().mul(0.52);
  const dustUv = uv().mul(0.31).add(vec2(0.37, 0.61));
  const stone = texture(textures.albedoHeight, stoneUv).depth(int(STONE_LAYER));
  const dust = texture(textures.albedoHeight, dustUv).depth(int(DUST_LAYER));
  const stoneMaterial = texture(textures.normalMaterial, stoneUv).depth(int(STONE_LAYER));
  const dustMaterial = texture(textures.normalMaterial, dustUv).depth(int(DUST_LAYER));
  // Pale mineral dust settles in the recesses; the existing stone atlas supplies real relief and grain.
  const dustCover = smoothstep(0.25, 0.72, cloud.sub(stone.a.sub(0.5).mul(0.45)));
  const stoneColor = stone.rgb.mul(color("#8b91b0"));
  const dustColor = dust.rgb.mul(color("#8994b5"));
  const base = mix(stoneColor, dustColor, dustCover.mul(0.72));
  const flowingCloud = mx_noise_float(vec3(ground.mul(0.26), drift.mul(0.035)))
    .mul(0.5)
    .add(0.5);
  const energy = createEtherealEnergy(ground, drift, flowingCloud);
  const edgeDistance = terrainHexEdgeDistance(ground);
  const border = smoothstep(0.006, fwidth(edgeDistance).max(0.001).add(0.006), edgeDistance).oneMinus();
  material.colorNode = base;
  // Emission keeps the void's identity through the day cycle without specular glare.
  material.emissiveNode = base.mul(0.16).add(energy.mul(0.38)).add(color(palette.glowColor).mul(border).mul(0.035));
  const surfaceMaterial = mix(stoneMaterial, dustMaterial, dustCover.mul(0.72));
  const surfaceNormal = normalMap(vec3(surfaceMaterial.rg, 1), vec2(0.6));
  surfaceNormal.unpackNormalMode = NormalRGPacking;
  material.normalNode = surfaceNormal;
  material.roughnessNode = surfaceMaterial.b.clamp(0.84, 1);
  material.aoNode = mix(1, surfaceMaterial.a, 0.4);
  return material;
}

/** Reuse the existing cloud field in fog: no extra noise samples, geometry, or hidden world data. */
export function createEtherealEnergy(ground: Node<"vec2">, drift: Node<"float">, cloud: Node<"float">): Node<"vec3"> {
  const palette = createEtherealSurfacePalette();
  const contour = cloud.sub(0.51).abs();
  const pixelWidth = fwidth(cloud).max(0.001);
  const thread = smoothstep(0.003, pixelWidth.add(0.009), contour).oneMinus();
  const halo = smoothstep(0.008, 0.065, contour).oneMinus().mul(0.13);
  const pulse = ground.x.mul(0.7).add(ground.y.mul(0.43)).sub(drift.mul(0.42)).sin().mul(0.5).add(0.5);
  const flowingLight = smoothstep(0.35, 0.94, pulse).mul(0.8).add(0.2);
  return mix(color(palette.edgeColor), color(palette.glowColor), pulse).mul(thread.add(halo)).mul(flowingLight);
}
