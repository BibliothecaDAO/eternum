import type { GroundLights } from "./ground-lights";
import { applyEndgameFrost } from "../effects/endgame/field";
import { mapAnimationTime as time } from "../effects/endgame/state";
import type { Texture } from "three";
import type Node from "three/src/nodes/core/Node.js";
import type UniformNode from "three/src/nodes/core/UniformNode.js";
import {
  Fn,
  If,
  attribute,
  color,
  float,
  fwidth,
  mix,
  normalLocal,
  output,
  positionLocal,
  positionWorld,
  positionViewDirection,
  smoothstep,
  texture,
  transformNormalToView,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { MeshPhysicalNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";

import { createBasaltSurface } from "./terrain-ethereal-material";
import { terrainHexEdgeDistance } from "./terrain-hex-node";
import { terrainDetailTile, terrainWaveTile } from "./terrain-detail-tile";
import { groundSurface } from "./terrain-ground-node";
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
  const waves = createTerrainWaterWaves(waterDepth, depthMotion, waterMotion);
  material.positionNode = positionLocal.add(vec3(0, waves.height, 0));
  // Analytic slopes are in terrain object space, independent of the water mesh UV tangent basis; ripples from the
  // detail tile ride on them, so the sea catches the light in small facets as the approved water does.
  const waveNormalView = transformNormalToView(waves.normal.add(createRippleSlope(waterMotion)).normalize());
  material.normalNode = waveNormalView;

  // Emerald shelf water and blue offshore water remain identifiable without relying on sun glare.
  const shelfColor = mix(color("#709b90"), color("#377d88"), smoothstep(0.005, 0.1, waterDepth));
  const bathymetryColor = mix(shelfColor, color("#24435c"), smoothstep(0.12, 0.31, waterDepth));
  const shorelineColor = mix(bathymetryColor, color("#819c83"), shore.mul(shallowEdge).mul(0.1));
  const fresnel = waveNormalView.dot(positionViewDirection).clamp(0, 1).oneMinus().pow(4).mul(depthMotion);
  const reflectiveColor = mix(shorelineColor, color("#b6d8e2"), fresnel.mul(0.14));
  const foam = createTerrainWaterFoam(shore, waterDepth, waterMotion);
  const lit = reflectiveColor.add(createShallowBedLight(waterDepth, waterMotion));
  material.colorNode = shadeTerrainSurface(mix(lit, color("#dce8de"), foam.mul(0.7)));
  const waterRoughness = mix(0.5, 0.42, depthBlend).add(shore.mul(shallowEdge).mul(0.08));
  material.roughnessNode = mix(waterRoughness, 0.78, foam).clamp(0.18, 0.78);
  return material;
}

function createTerrainWaterWaves(
  waterDepth: Node<"float">,
  depthMotion: Node<"float">,
  waterMotion: UniformNode<"float", number>,
): { height: Node<"float">; normal: Node<"vec3"> } {
  const waterTime = time.mul(waterMotion);
  // Broad crossing swells are resolved by the existing three subdivisions per hex.
  // Crests stay at the gameplay water level; troughs use at most 80% of the available
  // depth, keeping both the seabed and the static selection outline unobstructed.
  const amplitude = waterDepth
    .mul(0.4)
    .min(0.12)
    .mul(smoothstep(0.06, 0.2, waterDepth))
    .mul(waterMotion);
  const primaryPhase = positionLocal.x.mul(1.45).add(positionLocal.z.mul(0.58)).sub(waterTime.mul(1.05));
  const crossPhase = positionLocal.x.mul(-0.63).add(positionLocal.z.mul(1.22)).sub(waterTime.mul(0.83));
  const ripplePhase = positionLocal.x.mul(1.96).add(positionLocal.z.mul(-1.1)).sub(waterTime.mul(1.31));
  const height = primaryPhase
    .sin()
    .mul(0.62)
    .add(crossPhase.sin().mul(0.28))
    .add(ripplePhase.sin().mul(0.1))
    .sub(1)
    .mul(amplitude);
  // Fine crossed ripples bend with the swell without painting bands into the albedo.
  const rippleWarp = primaryPhase.sin().mul(1.6).add(crossPhase.sin().mul(1.1));
  const capillaryPhase = positionLocal.x.mul(7.1).add(positionLocal.z.mul(5.3)).add(rippleWarp).sub(waterTime.mul(0.9));
  const capillaryFilter = smoothstep(0.7, 2.4, fwidth(capillaryPhase)).oneMinus();
  const capillarySlope = capillaryPhase.cos().mul(capillaryFilter).mul(0.0004).mul(depthMotion).mul(waterMotion);
  const crossRipplePhase = positionLocal.x
    .mul(-5.8)
    .add(positionLocal.z.mul(8.9))
    .sub(rippleWarp)
    .add(waterTime.mul(0.7));
  const crossRippleFilter = smoothstep(0.7, 2.4, fwidth(crossRipplePhase)).oneMinus();
  const crossRippleSlope = crossRipplePhase.cos().mul(crossRippleFilter).mul(0.0003).mul(depthMotion).mul(waterMotion);
  const slopeX = primaryPhase
    .cos()
    .mul(0.62 * 1.45)
    .add(crossPhase.cos().mul(0.28 * -0.63))
    .add(ripplePhase.cos().mul(0.1 * 1.96))
    .mul(amplitude)
    .add(capillarySlope.mul(7.1))
    .add(crossRippleSlope.mul(-5.8));
  const slopeZ = primaryPhase
    .cos()
    .mul(0.62 * 0.58)
    .add(crossPhase.cos().mul(0.28 * 1.22))
    .add(ripplePhase.cos().mul(0.1 * -1.1))
    .mul(amplitude)
    .add(capillarySlope.mul(5.3))
    .add(crossRippleSlope.mul(8.9));
  return { height, normal: vec3(slopeX.negate(), 1, slopeZ.negate()).normalize() };
}

/** Small ripples drifting two ways, as a slope to add to the waves' normal, from the wave tile. */
function createRippleSlope(waterMotion: UniformNode<"float", number>): Node<"vec3"> {
  const drift = time.mul(waterMotion);
  const at = positionLocal.xz;
  const one = texture(terrainWaveTile(), at.mul(0.23).add(vec2(drift.mul(0.021), drift.mul(0.013)))).rg.sub(0.5);
  const two = texture(terrainWaveTile(), at.yx.mul(0.37).sub(vec2(drift.mul(0.017), drift.mul(-0.024)))).rg.sub(0.5);
  const ripple = one.add(two).mul(waterMotion.mul(0.5).add(0.5));
  return vec3(ripple.x.mul(-0.5), 0, ripple.y.mul(-0.5));
}

/**
 * The bright net light casts on a shallow bed (the approved water's): two nets of the wave tile drifting apart,
 * bright only where both cross, fading out as the water deepens.
 */
function createShallowBedLight(waterDepth: Node<"float">, waterMotion: UniformNode<"float", number>): Node<"vec3"> {
  const drift = time.mul(waterMotion);
  const net = (scale: number, flow: Node<"vec2">) =>
    texture(terrainWaveTile(), positionLocal.xz.mul(scale).add(flow)).a;
  const crossing = net(0.23, vec2(drift.mul(0.021), drift.mul(0.013))).mul(
    net(0.37, vec2(drift.mul(-0.017), drift.mul(0.024))),
  );
  const shallow = smoothstep(TERRAIN_DEEP_WATER_DEPTH, TERRAIN_MIN_RENDERED_WATER_DEPTH, waterDepth);
  return vec3(0.3, 0.38, 0.26).mul(crossing).mul(shallow.mul(shallow)).mul(1.4);
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

/** A pool of light keeps something of its own hue on any ground: on yellow grass a pink light would read orange. */
const LIGHT_HUE_KEPT = 0.15;

/**
 * The light a fire or an orb throws on the ground, added to the lit ground as it is drawn. It stays out of the glow the
 * finish blooms: a pool lies on the ground instead of spreading into a haze over everything round it.
 */
function groundLightPool(albedo: Node<"vec3">, light: Node<"vec3">): Node<"vec3"> {
  return albedo.add(LIGHT_HUE_KEPT).mul(light);
}

/**
 * The land's ground: each biome painted by its own rules, its frontiers wandering off the hexes' edges and carrying
 * something of each side across (`groundSurface`), read from the biome of every hex the terrain draws.
 */
export function createTerrainGroundMaterial(
  biomeMap: Texture,
  groundLights: GroundLights,
  groundMotion: UniformNode<"float", number>,
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.95 });
  material.name = "terrain-land-ground";
  const surface = groundSurface({
    biomeMap,
    detail: terrainDetailTile(),
    at: positionLocal.xz,
    world: positionWorld,
    meshColour: attribute<"vec3">("terrainColor", "vec3"),
    top: smoothstep(0.55, 0.9, normalLocal.y),
    shore: attribute<"float">("terrainShore", "float"),
    time: time.mul(groundMotion),
  });
  const notBasalt = attribute<"float">("terrainBasaltWeight", "float").oneMinus();
  const albedo = surface.get("albedo") as Node<"vec3">;
  const gloss = surface.get("gloss") as Node<"float">;
  const glow = surface.get("glow") as Node<"vec3">;
  const slope = (surface.get("slope") as Node<"vec2">).mul(notBasalt);
  // The ground is painted to be read as it is: the lift that keeps flat vertex colour readable would flatten it.
  material.colorNode = withSurfaceBasalt(drawHexGrid(albedo));
  material.roughnessNode = mix(attribute<"float">("terrainRoughness", "float").clamp(0.7, 1), 0.35, gloss);
  material.emissiveNode = glow.mul(notBasalt);
  material.outputNode = output.add(vec4(groundLightPool(albedo, groundLights.at(positionWorld)), 0));
  material.normalNode = transformNormalToView(normalLocal.add(vec3(slope.x.negate(), 0, slope.y.negate())).normalize());
  return material;
}

// Two offset rectangular lattices describe the same point-up hexes as terrainHexToWorld.
// Drawing the border in the surface shader keeps it on the actual terrain and water heights.
function shadeTerrainSurface(baseColor: Node<"vec3">): Node<"vec3"> {
  return drawHexGrid(liftDarkSurface(baseColor));
}

// Lift dark albedo across land and water while retaining hue and bright snow/sand highlights.
// This keeps explored ground readable against unlit fog without flattening directional shadows.
function liftDarkSurface(baseColor: Node<"vec3">): Node<"vec3"> {
  const baseLuminance = baseColor.dot(vec3(0.2126, 0.7152, 0.0722)).clamp(0.001, 1);
  return baseColor.mul(baseLuminance.pow(-0.3));
}

// The hex grid, drawn on the surface itself so it lies on the actual terrain and water heights.
function drawHexGrid(surfaceColor: Node<"vec3">): Node<"vec3"> {
  const edgeDistance = terrainHexEdgeDistance(positionLocal.xz);
  const pixelWidth = fwidth(edgeDistance).max(0.001);
  const border = smoothstep(0.008, pixelWidth.mul(1.2).add(0.008), edgeDistance).oneMinus();
  const luminance = surfaceColor.dot(vec3(0.2126, 0.7152, 0.0722));
  const darkSurface = smoothstep(0.025, 0.12, luminance).oneMinus();
  const borderColor = mix(surfaceColor.mul(0.45), vec3(0.14), darkSurface);
  return applyEndgameFrost(mix(surfaceColor, borderColor, border.mul(0.42).mul(normalLocal.y.abs())));
}

function createVertexColorMaterial(name: string, fallbackRoughness: number): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: fallbackRoughness });
  material.name = name;
  material.colorNode = withSurfaceBasalt(shadeTerrainSurface(attribute("terrainColor", "vec3")));
  material.roughnessNode = attribute("terrainRoughness", "float");
  return material;
}

/** A finished surface colour with the Ethereal's basalt laid over it where a tile carries it. */
function withSurfaceBasalt(surface: Node<"vec3">): Node<"vec3"> {
  return Fn(() => {
    const result = surface.toVar();
    const weight = attribute<"float">("terrainBasaltWeight", "float");
    If(weight.greaterThan(0), () => {
      const basalt = createBasaltSurface(positionWorld.xz);
      const coverage = weight.mul(mix(basalt.softEdge, 1, smoothstep(0.55, 1, weight)));
      result.assign(mix(result, applyEndgameFrost(basalt.color), coverage));
    });
    return result;
  })();
}
