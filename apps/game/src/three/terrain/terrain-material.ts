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
  normalLocal,
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
  const material = new MeshPhysicalNodeMaterial({ metalness: 0, roughness: 0.42, ior: 1.333, specularIntensity: 0.42 });
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

  // Emerald shelf water and blue offshore water remain identifiable without relying on sun glare.
  const shelfColor = mix(color("#709b90"), color("#377d88"), smoothstep(0.005, 0.1, waterDepth));
  const bathymetryColor = mix(shelfColor, color("#24435c"), smoothstep(0.12, 0.31, waterDepth));
  const shorelineColor = mix(bathymetryColor, color("#819c83"), shore.mul(shallowEdge).mul(0.1));
  const fresnel = waveNormalView.dot(positionViewDirection).clamp(0, 1).oneMinus().pow(4).mul(depthMotion);
  const reflectiveColor = mix(shorelineColor, color("#b6d8e2"), fresnel.mul(0.14));
  const foam = createTerrainWaterFoam(shore, waterDepth, waterMotion);
  material.colorNode = shadeTerrainHexBoundary(mix(reflectiveColor, color("#dce8de"), foam.mul(0.7)));
  const waterRoughness = mix(0.5, 0.42, depthBlend).add(shore.mul(shallowEdge).mul(0.08));
  material.roughnessNode = mix(waterRoughness, 0.78, foam).clamp(0.18, 0.78);
  return material;
}

function createTerrainWaterWaves(
  depthMotion: Node<"float">,
  waterMotion: UniformNode<"float", number>,
): { height: Node<"float">; normal: Node<"vec3"> } {
  const waterTime = time.mul(waterMotion);
  const primaryPhase = waterTime.mul(0.8).add(positionLocal.x.mul(1.15)).add(positionLocal.z.mul(0.64));
  const crossPhase = waterTime.mul(0.51).add(positionLocal.x.mul(-0.42)).add(positionLocal.z.mul(0.81));
  const motion = waterMotion.mul(depthMotion);
  const ripplePhase = positionLocal.x.mul(4.3).add(positionLocal.z.mul(2.7)).sub(waterTime.mul(1.1));
  const height = primaryPhase
    .sin()
    .mul(0.014)
    .add(crossPhase.sin().mul(0.008))
    .add(ripplePhase.sin().mul(0.003))
    .mul(motion);
  // Crossing wave trains bend with the swell; no repeated bright bands are painted into the water color.
  const rippleWarp = primaryPhase.sin().mul(1.6).add(crossPhase.sin().mul(1.1));
  const capillaryPhase = positionLocal.x.mul(7.1).add(positionLocal.z.mul(5.3)).add(rippleWarp).sub(waterTime.mul(0.9));
  const capillaryFilter = smoothstep(0.7, 2.4, fwidth(capillaryPhase)).oneMinus();
  const capillarySlope = capillaryPhase.cos().mul(capillaryFilter).mul(0.0004);
  const crossRipplePhase = positionLocal.x
    .mul(-5.8)
    .add(positionLocal.z.mul(8.9))
    .sub(rippleWarp)
    .add(waterTime.mul(0.7));
  const crossRippleFilter = smoothstep(0.7, 2.4, fwidth(crossRipplePhase)).oneMinus();
  const crossRippleSlope = crossRipplePhase.cos().mul(crossRippleFilter).mul(0.0003);
  const slopeX = primaryPhase
    .cos()
    .mul(0.014 * 1.15)
    .add(crossPhase.cos().mul(0.008 * -0.42))
    .add(ripplePhase.cos().mul(0.003 * 4.3))
    .add(capillarySlope.mul(7.1))
    .add(crossRippleSlope.mul(-5.8))
    .mul(motion);
  const slopeZ = primaryPhase
    .cos()
    .mul(0.014 * 0.64)
    .add(crossPhase.cos().mul(0.008 * 0.81))
    .add(ripplePhase.cos().mul(0.003 * 2.7))
    .add(capillarySlope.mul(5.3))
    .add(crossRippleSlope.mul(8.9))
    .mul(motion);
  return { height, normal: vec3(slopeX.negate(), 1, slopeZ.negate()).normalize() };
}

function createTerrainWaterFoam(
  shore: Node<"float">,
  waterDepth: Node<"float">,
  waterMotion: UniformNode<"float", number>,
): Node<"float"> {
  const waterTime = time.mul(waterMotion);
  const shoreWarp = positionLocal.x.mul(2.7).add(positionLocal.z.mul(1.8)).sin().mul(0.4);
  // Phase travels up the depth contour, so breakers approach every coast instead of cutting across it.
  const incomingPhase = waterDepth.mul(125).add(shoreWarp).add(waterTime.mul(1.25));
  const foamWidth = fwidth(incomingPhase).max(0.08);
  const breakerBand = smoothstep(float(0.8).sub(foamWidth), foamWidth.add(0.8), incomingPhase.sin());
  const breakup = positionLocal.x
    .mul(-5.4)
    .add(positionLocal.z.mul(3.7))
    .add(waterTime.mul(0.19))
    .sin()
    .mul(0.28)
    .add(0.72);
  const surfZone = smoothstep(0.012, 0.075, waterDepth).oneMinus();
  const shorelineWash = smoothstep(0.003, 0.012, waterDepth).oneMinus().mul(0.2);
  return shore.mul(surfZone.mul(breakerBand).mul(breakup).add(shorelineWash)).clamp(0, 1);
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
  // Powder buries sharp stone detail; otherwise snow reads as a pale cracked pavement.
  const snowCover = smoothstep(0.35, 0.85, groundWeights1.z);
  const groundColor = mix(sampledAlbedo.mul(terrainTint), terrainColor, snowCover.mul(0.22).add(0.12)).mul(
    detail.shade,
  );
  const volcanic = createScorchedSurface(
    sampledAlbedo,
    mix(secondaryAlbedoHeight.a, primaryAlbedoHeight.a, primaryBlend),
    groundMotion,
  );
  const ashCoverage = smoothstep(0.05, 0.5, groundWeights1.w);
  material.colorNode = shadeTerrainHexBoundary(mix(groundColor, volcanic.color, ashCoverage));
  material.emissiveNode = volcanic.embers.mul(ashCoverage);
  const sampledNormalMaterial = mix(secondaryNormalMaterial, primaryNormalMaterial, primaryBlend);
  material.roughnessNode = mix(
    sampledNormalMaterial.b.mul(attribute<"float">("terrainRoughness", "float")).clamp(0.7, 1),
    0.94,
    snowCover,
  );
  material.aoNode = mix(1, sampledNormalMaterial.a, 0.35);
  const detailedNormal = normalMap(
    vec3(sampledNormalMaterial.rg.add(detail.rippleNormal), sampledNormalMaterial.b),
    vec2(snowCover.mul(-0.3).add(0.55)),
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
  // Trace sand only where it forms the surface; a little sand mixed into hardpan must not give both deserts dunes.
  const looseSand = smoothstep(0.25, 0.7, weights0.x);
  const looseGround = looseSand.add(weights1.z.mul(0.65)).clamp(0, 1);
  const ripples = phase.sin().mul(confidence).mul(looseGround);
  const gust = ground.dot(vec2(0.72, 0.28)).mul(0.8).sub(time.mul(0.55));
  const meadowShade = gust.sin().mul(0.025).mul(weights0.w).mul(motion);
  const windblown = createWindblownGroundDetail(ground, looseSand, weights1.z, motion);
  return {
    shade: float(1).add(ripples.mul(0.08)).add(meadowShade).add(windblown.shade),
    rippleNormal: wind.mul(phase.cos().mul(confidence).mul(looseGround).mul(0.045)).add(windblown.normal),
  };
}

function createWindblownGroundDetail(
  ground: Node<"vec2">,
  sand: Node<"float">,
  snow: Node<"float">,
  motion: UniformNode<"float", number>,
): { shade: Node<"float">; normal: Node<"vec2"> } {
  // Stable wind-carved banks carry moving powder; the surface itself never slides under units.
  const looseCover = sand.add(snow).clamp(0, 1);
  const direction = vec2(0.86, 0.51);
  const acrossWind = ground.dot(direction);
  const bankPhase = acrossWind.mul(2.4).add(ground.y.mul(0.53).sin().mul(0.85));
  const bankFilter = smoothstep(0.6, 2.1, fwidth(bankPhase)).oneMinus();
  const bankShade = bankPhase
    .sin()
    .mul(sand.mul(0.075).add(snow.mul(0.035)))
    .mul(bankFilter);
  const windTime = time.mul(0.7).mul(step(0.001, motion));
  const powderPhase = acrossWind.mul(5.2).sub(windTime).add(ground.y.mul(1.7).sin());
  const powderFilter = smoothstep(0.5, 1.8, fwidth(powderPhase)).oneMinus();
  const streaks = smoothstep(0.68, 0.98, powderPhase.sin());
  const gusts = ground.x.mul(0.43).add(ground.y.mul(0.31)).sub(windTime.mul(0.3)).sin().mul(0.5).add(0.5);
  return {
    shade: bankShade.add(streaks.mul(gusts).mul(powderFilter).mul(looseCover).mul(0.045)),
    normal: direction.mul(bankPhase.cos().mul(bankFilter).mul(looseCover).mul(0.024)),
  };
}

// Two offset rectangular lattices describe the same point-up hexes as terrainHexToWorld.
// Drawing the border in the surface shader keeps it on the actual terrain and water heights.
function shadeTerrainHexBoundary(surfaceColor: Node<"vec3">): Node<"vec3"> {
  const edgeDistance = terrainHexEdgeDistance(positionLocal.xz);
  const pixelWidth = fwidth(edgeDistance).max(0.001);
  const border = smoothstep(0.008, pixelWidth.mul(1.2).add(0.008), edgeDistance).oneMinus();
  const luminance = surfaceColor.dot(vec3(0.2126, 0.7152, 0.0722));
  // Contrast follows the actual textured surface: pale sand/snow need a dark
  // boundary, while forest, basalt, and deep water need a lighter one.
  const darkSurface = smoothstep(0.1, 0.3, luminance).oneMinus();
  const borderColor = mix(vec3(0.025), vec3(0.3), darkSurface);
  return mix(surfaceColor, borderColor, border.mul(0.6).mul(normalLocal.y.abs()));
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
