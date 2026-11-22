import type { GroundLights } from "./ground-lights";
import { applyEndgameFrost } from "../effects/endgame/field";
import { mapAnimationTime as time } from "../effects/endgame/state";
import { Vector4, type Texture } from "three";
import type Node from "three/src/nodes/core/Node.js";
import type UniformNode from "three/src/nodes/core/UniformNode.js";
import {
  Fn,
  If,
  attribute,
  color,
  float,
  fwidth,
  max,
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

import { MAP_MARKS } from "../map-marks";
import { spireStone } from "./layer-floor-material";
import { terrainHexEdgeDistance } from "./terrain-hex-node";
import { terrainDetailTile, terrainWaveTile } from "./terrain-detail-tile";
import { groundSurface } from "./terrain-ground-node";
import {
  TERRAIN_DEEP_WATER_DEPTH,
  TERRAIN_MIN_RENDERED_WATER_DEPTH,
  TERRAIN_SHALLOW_WATER_DEPTH,
} from "./terrain-water";

export interface TerrainGrid {
  rest: UniformNode<"float", number>;
  focus: UniformNode<"vec4", Vector4>;
}

export const TERRAIN_GRID_NO_FOCUS = 1e6;

export interface TerrainMaterials {
  grid: TerrainGrid;
  flatLand: MeshStandardNodeMaterial;
  land: MeshStandardNodeMaterial;
  water: MeshStandardNodeMaterial;
  waterMotion: UniformNode<"float", number>;
  groundMotion: UniformNode<"float", number>;
}

export function createTerrainMaterials(): TerrainMaterials {
  const grid: TerrainGrid = {
    rest: uniform(MAP_MARKS.grid.deepAtRest, "float"),
    focus: uniform(new Vector4().setScalar(TERRAIN_GRID_NO_FOCUS), "vec4"),
  };
  const flatLand = createVertexColorMaterial("terrain-land-flat", 0.95, grid);
  const waterMotion = uniform(1, "float");
  return {
    grid,
    flatLand,
    land: flatLand,
    water: createTerrainWaterMaterial(waterMotion, grid),
    waterMotion,
    groundMotion: uniform(1, "float"),
  };
}

function createTerrainWaterMaterial(
  waterMotion: UniformNode<"float", number>,
  grid: TerrainGrid,
): MeshStandardNodeMaterial {
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
  material.colorNode = shadeTerrainSurface(mix(lit, color("#dce8de"), foam.mul(0.7)), grid);
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

function createRippleSlope(waterMotion: UniformNode<"float", number>): Node<"vec3"> {
  const drift = time.mul(waterMotion);
  const at = positionLocal.xz;
  const one = texture(terrainWaveTile(), at.mul(0.23).add(vec2(drift.mul(0.021), drift.mul(0.013)))).rg.sub(0.5);
  const two = texture(terrainWaveTile(), at.yx.mul(0.37).sub(vec2(drift.mul(0.017), drift.mul(-0.024)))).rg.sub(0.5);
  const ripple = one.add(two).mul(waterMotion.mul(0.5).add(0.5));
  return vec3(ripple.x.mul(-0.5), 0, ripple.y.mul(-0.5));
}

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

const LIGHT_HUE_KEPT = 0.06;

function groundLightPool(albedo: Node<"vec3">, light: Node<"vec3">): Node<"vec3"> {
  return albedo.add(LIGHT_HUE_KEPT).mul(light);
}

export function createTerrainGroundMaterial(
  biomeMap: Texture,
  groundLights: GroundLights,
  groundMotion: UniformNode<"float", number>,
  grid: TerrainGrid,
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.95 });
  material.name = "terrain-land-ground";
  const surface = groundSurface({
    biomeMap,
    detail: terrainDetailTile(),
    at: positionLocal.xz,
    world: positionWorld,
    meshColour: attribute<"vec3">("terrainColor", "vec3"),
    meshTint: attribute<"vec3">("terrainTint", "vec3"),
    top: smoothstep(0.45, 0.72, normalLocal.y),
    climate: attribute<"vec3">("terrainClimate", "vec3"),
    time: time.mul(groundMotion),
  });
  const notBasalt = attribute<"float">("terrainBasaltWeight", "float").oneMinus();
  const albedo = surface.get("albedo") as Node<"vec3">;
  const gloss = surface.get("gloss") as Node<"float">;
  const glow = surface.get("glow") as Node<"vec3">;
  const slope = (surface.get("slope") as Node<"vec2">).mul(notBasalt);
  material.colorNode = withSpireStone(drawHexGrid(albedo, grid), (stone) => applyEndgameFrost(stone.colour));
  material.roughnessNode = mix(attribute<"float">("terrainRoughness", "float").clamp(0.7, 1), 0.35, gloss);
  material.emissiveNode = withSpireStone(glow, (stone) => stone.glow);
  material.outputNode = output.add(vec4(groundLightPool(albedo, groundLights.at(positionWorld)), 0));
  material.normalNode = transformNormalToView(normalLocal.add(vec3(slope.x.negate(), 0, slope.y.negate())).normalize());
  return material;
}

function shadeTerrainSurface(baseColor: Node<"vec3">, grid: TerrainGrid): Node<"vec3"> {
  return drawHexGrid(liftDarkSurface(baseColor), grid);
}

function liftDarkSurface(baseColor: Node<"vec3">): Node<"vec3"> {
  const baseLuminance = baseColor.dot(vec3(0.2126, 0.7152, 0.0722)).clamp(0.001, 1);
  return baseColor.mul(baseLuminance.pow(-0.3));
}

function drawHexGrid(surfaceColor: Node<"vec3">, grid: TerrainGrid): Node<"vec3"> {
  const edgeDistance = terrainHexEdgeDistance(positionLocal.xz);
  const pixelWidth = fwidth(edgeDistance).max(0.001);
  const border = smoothstep(0.004, pixelWidth.mul(MAP_MARKS.grid.widthPixels).add(0.004), edgeDistance).oneMinus();
  const luminance = surfaceColor.dot(vec3(0.2126, 0.7152, 0.0722));
  const darkSurface = smoothstep(0.1, 0.03, luminance);
  const borderColor = mix(
    surfaceColor.mul(MAP_MARKS.grid.darkLine),
    mix(surfaceColor, vec3(1), MAP_MARKS.grid.lightLine),
    darkSurface,
  );
  const near = (point: Node<"vec2">) =>
    smoothstep(MAP_MARKS.grid.focusOuter, MAP_MARKS.grid.focusInner, positionWorld.xz.distance(point));
  const strength = mix(grid.rest, 1, max(near(grid.focus.xy), near(grid.focus.zw)));
  return applyEndgameFrost(mix(surfaceColor, borderColor, border.mul(strength).mul(normalLocal.y.abs())));
}

function createVertexColorMaterial(
  name: string,
  fallbackRoughness: number,
  grid: TerrainGrid,
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: fallbackRoughness });
  material.name = name;
  material.colorNode = withSpireStone(shadeTerrainSurface(attribute("terrainColor", "vec3"), grid), (stone) =>
    applyEndgameFrost(stone.colour),
  );
  material.roughnessNode = attribute("terrainRoughness", "float");
  return material;
}

function withSpireStone(
  ground: Node<"vec3">,
  stonePart: (stone: ReturnType<typeof spireStone>) => Node<"vec3">,
): Node<"vec3"> {
  return Fn(() => {
    const result = ground.toVar();
    const weight = attribute<"float">("terrainBasaltWeight", "float");
    If(weight.greaterThan(0), () => {
      const stone = spireStone(positionWorld.xz, weight);
      result.assign(mix(result, stonePart(stone), stone.coverage));
    });
    return result;
  })();
}
