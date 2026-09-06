import { NormalRGPacking } from "three";
import type Node from "three/src/nodes/core/Node.js";
import type UniformNode from "three/src/nodes/core/UniformNode.js";
import {
  Fn,
  If,
  attribute,
  color,
  float,
  fwidth,
  int,
  mix,
  normalMap,
  positionLocal,
  positionViewDirection,
  smoothstep,
  step,
  texture,
  transformNormalToView,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { MeshPhysicalNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";

import { terrainHexEdgeDistance } from "./terrain-hex-node";
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
  groundMotion: UniformNode<"float", number>;
}

export function createTerrainMaterials(): TerrainMaterials {
  const flatLand = createVertexColorMaterial("terrain-land-flat", 0.95);
  const waterMotion = uniform(1, "float");
  return {
    flatLand,
    land: flatLand,
    water: createTerrainWaterMaterial(waterMotion),
    waterMotion,
    groundMotion: uniform(1, "float"),
  };
}

function createTerrainWaterMaterial(waterMotion: UniformNode<"float", number>): MeshStandardNodeMaterial {
  const material = new MeshPhysicalNodeMaterial({ metalness: 0, roughness: 0.38, ior: 1.333, specularIntensity: 0.55 });
  material.name = "terrain-water";
  const shore = attribute<"float">("terrainShore", "float");
  const waterDepth = attribute<"float">("terrainWaterDepth", "float").max(TERRAIN_MIN_RENDERED_WATER_DEPTH);
  // Exponential absorption avoids flat shallow/deep bands while retaining readable bathymetry.
  const depthBlend = waterDepth.div(TERRAIN_DEEP_WATER_DEPTH).mul(-1.6).exp().oneMinus();
  const shallowEdge = smoothstep(TERRAIN_MIN_RENDERED_WATER_DEPTH, TERRAIN_SHALLOW_WATER_DEPTH, waterDepth).oneMinus();
  const depthMotion = smoothstep(TERRAIN_MIN_RENDERED_WATER_DEPTH, TERRAIN_SHALLOW_WATER_DEPTH, waterDepth)
    .mul(0.75)
    .add(0.25);
  const waves = createTerrainWaterWaves(depthMotion, waterMotion);
  material.positionNode = positionLocal.add(vec3(0, waves.height, 0));
  // Analytic slopes are in terrain object space, independent of the water mesh UV tangent basis.
  const waveNormalView = transformNormalToView(waves.normal);
  material.normalNode = waveNormalView;

  const bathymetryColor = mix(color("#437e77"), color("#102e41"), depthBlend);
  const shorelineColor = mix(bathymetryColor, color("#819c83"), shore.mul(shallowEdge).mul(0.1));
  const fresnel = waveNormalView.dot(positionViewDirection).clamp(0, 1).oneMinus().pow(4).mul(depthMotion);
  const reflectiveColor = mix(shorelineColor, color("#b6d8e2"), fresnel.mul(0.22));
  const foamEdge = smoothstep(0.006, 0.038, waterDepth).oneMinus();
  const foam = createTerrainWaterFoam(shore, foamEdge, waterMotion);
  material.colorNode = shadeTerrainHexBoundary(mix(reflectiveColor, color("#d9e1d7"), foam.mul(0.78)));
  const waterRoughness = mix(0.5, 0.38, depthBlend).add(shore.mul(shallowEdge).mul(0.08));
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
  const ripplePhase = positionLocal.x.mul(4.3).add(positionLocal.z.mul(2.7)).sub(time.mul(1.1));
  const height = primaryPhase
    .sin()
    .mul(0.014)
    .add(crossPhase.sin().mul(0.008))
    .add(ripplePhase.sin().mul(0.003))
    .mul(motion);
  // Fine ripples affect highlights without moving tile edges or requiring a denser water mesh.
  const rippleWarp = positionLocal.x.mul(1.7).add(positionLocal.z.mul(2.1)).sin().mul(1.4);
  const capillaryPhase = positionLocal.x.mul(16.3).add(positionLocal.z.mul(-10.7)).add(rippleWarp).sub(time.mul(1.9));
  const capillaryFilter = smoothstep(0.7, 2.4, fwidth(capillaryPhase)).oneMinus();
  const capillarySlope = capillaryPhase.cos().mul(capillaryFilter).mul(0.00065);
  const crossRipplePhase = positionLocal.x.mul(11.7).add(positionLocal.z.mul(18.9)).sub(rippleWarp).add(time.mul(1.3));
  const crossRippleFilter = smoothstep(0.7, 2.4, fwidth(crossRipplePhase)).oneMinus();
  const crossRippleSlope = crossRipplePhase.cos().mul(crossRippleFilter).mul(0.0005);
  const slopeX = primaryPhase
    .cos()
    .mul(0.014 * 0.54)
    .add(crossPhase.cos().mul(0.008 * -0.31))
    .add(ripplePhase.cos().mul(0.003 * 4.3))
    .add(capillarySlope.mul(16.3))
    .add(crossRippleSlope.mul(11.7))
    .mul(motion);
  const slopeZ = primaryPhase
    .cos()
    .mul(0.014 * 0.39)
    .add(crossPhase.cos().mul(0.008 * 0.47))
    .add(ripplePhase.cos().mul(0.003 * 2.7))
    .add(capillarySlope.mul(-10.7))
    .add(crossRippleSlope.mul(18.9))
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

export function createTerrainGroundMaterial(
  textures: TerrainGroundTextures,
  groundMotion: UniformNode<"float", number>,
): MeshStandardNodeMaterial {
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
  const detail = createGroundSurfaceDetail(groundWeights0, groundWeights1, groundMotion);
  const groundColor = mix(sampledAlbedo.mul(terrainTint), terrainColor, 0.34).mul(detail.shade);
  const volcanic = createScorchedSurface(
    sampledAlbedo,
    mix(secondaryAlbedoHeight.a, primaryAlbedoHeight.a, primaryBlend),
    groundMotion,
  );
  const ashCoverage = smoothstep(0.05, 0.5, groundWeights1.w);
  material.colorNode = shadeTerrainHexBoundary(mix(groundColor, volcanic.color, ashCoverage));
  material.emissiveNode = volcanic.embers.mul(ashCoverage);
  const sampledNormalMaterial = mix(secondaryNormalMaterial, primaryNormalMaterial, primaryBlend);
  material.roughnessNode = sampledNormalMaterial.b.mul(attribute<"float">("terrainRoughness", "float")).clamp(0.45, 1);
  material.aoNode = mix(1, sampledNormalMaterial.a, 0.35);
  const detailedNormal = normalMap(
    vec3(sampledNormalMaterial.rg.add(detail.rippleNormal), sampledNormalMaterial.b),
    vec2(0.34),
  );
  detailedNormal.unpackNormalMode = NormalRGPacking;
  material.normalNode = detailedNormal;
  return material;
}

// The lava network stays fixed in world space; only heat and cooling crust travel through it.
// Lava is a ground treatment, so it does not alter buildability or army movement space.
function createScorchedSurface(
  albedo: Node<"vec3">,
  height: Node<"float">,
  motion: UniformNode<"float", number>,
): { color: Node<"vec3">; embers: Node<"vec3"> } {
  const ground = positionLocal.xz;
  const broadWarp = ground.x.mul(0.27).add(ground.y.mul(0.18)).sin().mul(1.5);
  const veinPhase = ground.x.mul(0.85).add(ground.y.mul(0.75).sin().mul(1.2)).add(broadWarp);
  const branchPhase = ground.y.mul(0.9).add(ground.x.mul(0.68).sin().mul(1.6)).sub(broadWarp);
  const veinDistance = veinPhase.sin().abs();
  const branchDistance = branchPhase.sin().abs().add(0.035);
  const junction = float(0.08).sub(veinDistance.sub(branchDistance).abs()).max(0).div(0.08);
  const channelDistance = veinDistance.min(branchDistance).sub(junction.mul(junction).mul(0.02));
  const edgeWidth = fwidth(channelDistance).max(0.01);
  const molten = smoothstep(float(0.065).sub(edgeWidth), edgeWidth.add(0.065), channelDistance).oneMinus();
  const bank = smoothstep(0.065, 0.12, channelDistance).oneMinus();
  const ashDrift = ground.x.mul(0.72).add(ground.y.mul(0.41)).add(broadWarp).sin();
  const ash = smoothstep(0.5, 0.95, ashDrift).mul(smoothstep(0.4, 0.75, height));
  const mineral = mix(color("#222930"), color("#68716f"), ash);
  const grain = albedo
    .dot(vec3(0.2126, 0.7152, 0.0722))
    .mul(1.1)
    .add(0.6);
  const magmaTime = time.mul(4).mul(step(0.001, motion));
  const flow = ground.x.mul(7.8).add(ground.y.mul(3.3)).add(broadWarp).add(height.mul(8)).sub(magmaTime);
  const heat = flow.sin().mul(0.5).add(0.5);
  const driftingCrust = smoothstep(0.25, 0.75, flow.mul(0.43).add(height.mul(8)).sin());
  const coolingCrust = smoothstep(0.4, 0.78, height).mul(0.32).add(driftingCrust.mul(0.62));
  const lavaColor = mix(color("#922009"), color("#ffac25"), heat);
  const banks = mix(mineral.mul(grain), color("#151a1d"), bank.mul(0.5));
  return {
    color: mix(banks, color("#582317"), molten),
    embers: lavaColor.mul(molten).mul(coolingCrust.oneMinus()).mul(1.5),
  };
}

// Wind ripples and derivative filtering adapted from James Addison’s Inkwell WebGPU Sand (MIT).
// See inkwell-LICENSE. World-space signals stay continuous across page and biome boundaries.
function createGroundSurfaceDetail(
  weights0: Node<"vec4">,
  weights1: Node<"vec4">,
  motion: UniformNode<"float", number>,
): { shade: Node<"float">; rippleNormal: Node<"vec2"> } {
  const ground = positionLocal.xz;
  const wind = vec2(0.93, 0.37).normalize();
  const warp = ground.x.mul(0.27).sin().add(ground.y.mul(0.19).sin()).mul(0.7);
  const phase = ground.dot(wind).mul(17).add(warp);
  const confidence = smoothstep(0.42, 1.36, fwidth(phase)).oneMinus();
  const looseGround = weights0.x.add(weights1.z.mul(0.65)).clamp(0, 1);
  const ripples = phase.sin().mul(confidence).mul(looseGround);
  const gust = ground.dot(vec2(0.72, 0.28)).mul(0.8).sub(time.mul(0.55));
  const meadowShade = gust.sin().mul(0.025).mul(weights0.w).mul(motion);
  return {
    shade: float(1).add(ripples.mul(0.08)).add(meadowShade),
    rippleNormal: wind.mul(phase.cos().mul(confidence).mul(looseGround).mul(0.045)),
  };
}

// Two offset rectangular lattices describe the same point-up hexes as terrainHexToWorld.
// Drawing the border in the surface shader keeps it on the actual terrain and water heights.
function shadeTerrainHexBoundary(surfaceColor: Node<"vec3">): Node<"vec3"> {
  const edgeDistance = terrainHexEdgeDistance(positionLocal.xz);
  const pixelWidth = fwidth(edgeDistance).max(0.001);
  const border = smoothstep(0.008, pixelWidth.mul(1.2).add(0.008), edgeDistance).oneMinus();
  const luminance = surfaceColor.dot(vec3(0.2126, 0.7152, 0.0722));
  const darkSurface = smoothstep(0.025, 0.12, luminance).oneMinus();
  const borderColor = mix(surfaceColor.mul(0.45), vec3(0.14), darkSurface);
  return mix(surfaceColor, borderColor, border.mul(0.42));
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
  material.colorNode = shadeTerrainHexBoundary(attribute("terrainColor", "vec3"));
  material.roughnessNode = attribute("terrainRoughness", "float");
  return material;
}
