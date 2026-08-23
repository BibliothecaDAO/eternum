import { NormalRGPacking } from "three";
import type Node from "three/src/nodes/core/Node.js";
import {
  Fn,
  If,
  attribute,
  color,
  float,
  int,
  mix,
  normalMap,
  positionLocal,
  smoothstep,
  texture,
  time,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";

import type { TerrainGroundTextures } from "./terrain-ground-textures";

export interface TerrainMaterials {
  flatLand: MeshStandardNodeMaterial;
  land: MeshStandardNodeMaterial;
  water: MeshStandardNodeMaterial;
}

export function createTerrainMaterials(): TerrainMaterials {
  const flatLand = createVertexColorMaterial("terrain-land-flat", 0.95);
  return {
    flatLand,
    land: flatLand,
    water: createTerrainWaterMaterial(),
  };
}

function createTerrainWaterMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0.08, roughness: 0.24 });
  material.name = "terrain-water";
  const shore = attribute<"float">("terrainShore", "float");
  material.colorNode = mix(color("#12384a"), color("#2f7a82"), shore.mul(0.72));
  material.roughnessNode = mix(0.2, 0.42, shore);
  const phase = time.mul(0.68).add(positionLocal.x.mul(0.54)).add(positionLocal.z.mul(0.39));
  const crossPhase = time.mul(0.43).add(positionLocal.x.mul(-0.31)).add(positionLocal.z.mul(0.47));
  const wave = phase.sin().mul(0.0045).add(crossPhase.sin().mul(0.0025));
  material.positionNode = positionLocal.add(vec3(0, wave, 0));
  return material;
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
