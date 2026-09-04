import { NormalRGPacking } from "three";
import type Node from "three/src/nodes/core/Node.js";
import type UniformNode from "three/src/nodes/core/UniformNode.js";
import {
  Fn,
  If,
  attribute,
  color,
  float,
  int,
  mix,
  normalMap,
  normalView,
  positionLocal,
  positionViewDirection,
  smoothstep,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";

import type { TerrainGroundTextures } from "./terrain-ground-textures";
import {
  TERRAIN_DEEP_WATER_DEPTH,
  TERRAIN_MIN_RENDERED_WATER_DEPTH,
  TERRAIN_SHALLOW_WATER_DEPTH,
} from "./terrain-water";

export interface TerrainMaterials {
  flatLand: MeshStandardNodeMaterial;
  land: MeshStandardNodeMaterial;
  water: MeshStandardNodeMaterial;
  waterMotion: UniformNode<"float", number>;
}

export function createTerrainMaterials(): TerrainMaterials {
  const flatLand = createVertexColorMaterial("terrain-land-flat", 0.95);
  const waterMotion = uniform(1, "float");
  return {
    flatLand,
    land: flatLand,
    water: createTerrainWaterMaterial(waterMotion),
    waterMotion,
  };
}

function createTerrainWaterMaterial(waterMotion: UniformNode<"float", number>): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0.08, roughness: 0.24 });
  material.name = "terrain-water";
  const shore = attribute<"float">("terrainShore", "float");
  const waterDepth = attribute<"float">("terrainWaterDepth", "float").max(TERRAIN_MIN_RENDERED_WATER_DEPTH);
  const depthBlend = smoothstep(TERRAIN_SHALLOW_WATER_DEPTH, TERRAIN_DEEP_WATER_DEPTH, waterDepth);
  const shallowEdge = smoothstep(TERRAIN_MIN_RENDERED_WATER_DEPTH, TERRAIN_SHALLOW_WATER_DEPTH, waterDepth).oneMinus();
  const depthMotion = smoothstep(TERRAIN_MIN_RENDERED_WATER_DEPTH, TERRAIN_SHALLOW_WATER_DEPTH, waterDepth)
    .mul(0.75)
    .add(0.25);
  const waves = createTerrainWaterWaves(depthMotion, waterMotion);
  material.positionNode = positionLocal.add(vec3(0, waves.height, 0));
  material.normalNode = normalMap(vec3(waves.normal.x, waves.normal.z, waves.normal.y).mul(0.5).add(0.5));

  const bathymetryColor = mix(color("#3c8e88"), color("#0d3045"), depthBlend);
  const shorelineColor = mix(bathymetryColor, color("#66aaa1"), shore.mul(shallowEdge).mul(0.18));
  const fresnel = normalView.dot(positionViewDirection).clamp(0, 1).oneMinus().pow(3).mul(depthMotion);
  const reflectiveColor = mix(shorelineColor, color("#a8d1cd"), fresnel.mul(0.28));
  const foam = createTerrainWaterFoam(shore, shallowEdge, waterMotion);
  material.colorNode = mix(reflectiveColor, color("#d9e1d7"), foam.mul(0.78));
  const waterRoughness = mix(0.4, 0.2, depthBlend).add(shore.mul(shallowEdge).mul(0.08));
  material.roughnessNode = mix(waterRoughness, 0.78, foam).clamp(0.18, 0.78);
  return material;
}

function createTerrainWaterWaves(
  depthMotion: Node<"float">,
  waterMotion: UniformNode<"float", number>,
): { height: Node<"float">; normal: Node<"vec3"> } {
  const primaryPhase = time.mul(0.68).add(positionLocal.x.mul(0.54)).add(positionLocal.z.mul(0.39));
  const crossPhase = time.mul(0.43).add(positionLocal.x.mul(-0.31)).add(positionLocal.z.mul(0.47));
  const motion = waterMotion.mul(depthMotion);
  const height = primaryPhase.sin().mul(0.0045).add(crossPhase.sin().mul(0.0025)).mul(motion);
  const slopeX = primaryPhase
    .cos()
    .mul(0.0045 * 0.54)
    .add(crossPhase.cos().mul(0.0025 * -0.31))
    .mul(motion);
  const slopeZ = primaryPhase
    .cos()
    .mul(0.0045 * 0.39)
    .add(crossPhase.cos().mul(0.0025 * 0.47))
    .mul(motion);
  return { height, normal: vec3(slopeX.negate(), 1, slopeZ.negate()).normalize() };
}

function createTerrainWaterFoam(
  shore: Node<"float">,
  shallowEdge: Node<"float">,
  waterMotion: UniformNode<"float", number>,
): Node<"float"> {
  const incomingPhase = positionLocal.x.mul(1.9).add(positionLocal.z.mul(1.35)).sub(time.mul(0.55).mul(waterMotion));
  const breakupPhase = positionLocal.x.mul(-3.4).add(positionLocal.z.mul(2.7)).add(time.mul(0.23).mul(waterMotion));
  const breakerBand = smoothstep(0.58, 0.86, incomingPhase.sin().mul(0.5).add(0.5));
  const breakup = breakupPhase.sin().mul(0.5).add(0.5).mul(0.42).add(0.58);
  return shore.mul(shallowEdge).mul(breakerBand).mul(breakup).clamp(0, 1);
}

export function createTerrainGroundMaterial(textures: TerrainGroundTextures): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.95 });
  material.name = "terrain-land-ground-textured";
  const absoluteWorldUv = uv();
  const worldUv = absoluteWorldUv.mul(0.34);
  const groundWeights0 = attribute<"vec4">("terrainGroundWeights0", "vec4");
  const groundWeights1 = attribute<"vec4">("terrainGroundWeights1", "vec4");
  const pair = selectStrongestGroundPair(groundWeights0, groundWeights1);
  const primaryAlbedoHeight = texture(textures.albedoHeight, worldUv).depth(int(pair.z));
  const secondaryAlbedoHeight = texture(textures.albedoHeight, worldUv).depth(int(pair.w));
  const primaryNormalMaterial = texture(textures.normalMaterial, worldUv).depth(int(pair.z));
  const secondaryNormalMaterial = texture(textures.normalMaterial, worldUv).depth(int(pair.w));
  const primaryPriority = pair.x.add(primaryAlbedoHeight.a.sub(0.5).mul(0.18));
  const secondaryPriority = pair.y.add(secondaryAlbedoHeight.a.sub(0.5).mul(0.18));
  const primaryBlend = smoothstep(-0.12, 0.12, primaryPriority.sub(secondaryPriority));
  const sampledAlbedo = mix(secondaryAlbedoHeight.rgb, primaryAlbedoHeight.rgb, primaryBlend);
  const terrainColor = attribute<"vec3">("terrainColor", "vec3");
  const terrainTint = terrainColor.mul(1.75);
  material.colorNode = mix(sampledAlbedo.mul(terrainTint), terrainColor, 0.34);
  const sampledNormalMaterial = mix(secondaryNormalMaterial, primaryNormalMaterial, primaryBlend);
  material.roughnessNode = sampledNormalMaterial.b.mul(attribute<"float">("terrainRoughness", "float")).clamp(0.45, 1);
  material.aoNode = mix(1, sampledNormalMaterial.a, 0.35);
  const detailedNormal = normalMap(sampledNormalMaterial.rgb, vec2(0.34));
  detailedNormal.unpackNormalMode = NormalRGPacking;
  material.normalNode = detailedNormal;
  return material;
}

function selectStrongestGroundPair(weights0: Node<"vec4">, weights1: Node<"vec4">): Node<"vec4"> {
  return Fn(() => {
    const primaryWeight = float(-1).toVar("groundPrimaryWeight");
    const secondaryWeight = float(-1).toVar("groundSecondaryWeight");
    const primaryIndex = int(0).toVar("groundPrimaryIndex");
    const secondaryIndex = int(0).toVar("groundSecondaryIndex");
    const weights = [weights0.x, weights0.y, weights0.z, weights0.w, weights1.x, weights1.y, weights1.z, weights1.w];

    weights.forEach((weight, index) => {
      If(weight.greaterThan(primaryWeight), () => {
        secondaryWeight.assign(primaryWeight);
        secondaryIndex.assign(primaryIndex);
        primaryWeight.assign(weight);
        primaryIndex.assign(index);
      }).ElseIf(weight.greaterThan(secondaryWeight), () => {
        secondaryWeight.assign(weight);
        secondaryIndex.assign(index);
      });
    });

    return vec4(primaryWeight, secondaryWeight.max(0), float(primaryIndex), float(secondaryIndex));
  })();
}

function createVertexColorMaterial(name: string, fallbackRoughness: number): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: fallbackRoughness });
  material.name = name;
  material.colorNode = attribute("terrainColor", "vec3");
  material.roughnessNode = attribute("terrainRoughness", "float");
  return material;
}
