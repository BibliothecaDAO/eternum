import { BiomeType } from "@bibliothecadao/types";
import { BufferAttribute, BufferGeometry, Group, Mesh, type BatchedMesh } from "three";
import {
  attribute,
  color,
  float,
  fwidth,
  mix,
  mx_noise_float,
  mx_worley_noise_vec2,
  normalLocal,
  positionLocal,
  positionWorld,
  sin,
  smoothstep,
  step,
  time,
  vec2,
  vec3,
} from "three/tsl";
import type Node from "three/src/nodes/core/Node.js";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { findNearestTerrainHex, terrainHexToWorld } from "../../../terrain/terrain-coordinates";
import { terrainHexEdgeDistance } from "../../../terrain/terrain-hex-node";
import type { TerrainPropArchetypeId } from "../../../terrain/terrain-prop-catalog";
import { drawStudyProps, type StudyProp } from "../study-props";
import { SURFACES, type BiomeWorld } from "./biome-world";

/** Production-like density: about 9 vertices across a hex's flat. */
const GRID_STEP = 0.12;

export interface BuiltTerrain {
  group: Group;
  triangles: number;
  props: number;
  /** Draws the ground needs, whatever the number of biomes: land, water, props. */
  batches: number;
}

/** The whole field as one continuous heightfield: every biome's ground in one shader, water in another. */
/** `occupied` hexes (structures) carry no props, as the game keeps a structure's hex clear today. */
export async function buildBiomeTerrain(world: BiomeWorld, occupied: ReadonlySet<string>): Promise<BuiltTerrain> {
  const land = buildLandGeometry(world);
  const water = buildWaterGeometry(world);
  const landMesh = new Mesh(land, createGroundMaterial());
  landMesh.castShadow = landMesh.receiveShadow = true;
  const waterMesh = new Mesh(water, createWaterMaterial());
  const props = placeProps(world, occupied);
  const batch: BatchedMesh = await drawStudyProps(props, (x, z) => world.heightAt(x, z));
  const group = new Group();
  group.add(landMesh, waterMesh, batch);
  return {
    group,
    triangles: land.index!.count / 3 + water.index!.count / 3,
    props: props.length,
    batches: 3,
  };
}

function gridOver(world: BiomeWorld, visit: (index: number, x: number, z: number) => void) {
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const columns = Math.ceil((maxX - minX) / GRID_STEP) + 1;
  const rows = Math.ceil((maxZ - minZ) / GRID_STEP) + 1;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      visit(row * columns + column, minX + column * GRID_STEP, minZ + row * GRID_STEP);
    }
  }
  const indices: number[] = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const a = row * columns + column;
      indices.push(a, a + columns, a + 1, a + 1, a + columns, a + columns + 1);
    }
  }
  return { count: columns * rows, indices };
}

function buildLandGeometry(world: BiomeWorld): BufferGeometry {
  const positions: number[] = [];
  const weights = [0, 1, 2].map(() => [] as number[]);
  const { indices } = gridOver(world, (_, x, z) => {
    positions.push(x, Math.max(world.heightAt(x, z), -0.6), z);
    const surfaces = world.surfacesAt(x, z);
    for (let slot = 0; slot < 12; slot++) weights[Math.floor(slot / 4)].push(surfaces[slot] ?? 0);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  weights.forEach((list, group) =>
    geometry.setAttribute(`surface${group}`, new BufferAttribute(new Float32Array(list), 4)),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildWaterGeometry(world: BiomeWorld): BufferGeometry {
  const positions: number[] = [];
  const depths: number[] = [];
  const { indices } = gridOver(world, (_, x, z) => {
    positions.push(x, 0, z);
    depths.push(Math.max(0, -world.heightAt(x, z)));
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("waterDepth", new BufferAttribute(new Float32Array(depths), 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Every biome's ground from shared noise: each surface is a few lines, blended by the vertex's surface weights. */
function createGroundMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0 });
  const p = positionLocal.xz;
  const y = positionLocal.y;
  const broad = mx_noise_float(p.mul(0.45)).mul(0.5).add(0.5);
  const mid = mx_noise_float(p.mul(1.7)).mul(0.5).add(0.5);
  const fine = mx_noise_float(p.mul(6.0)).mul(0.5).add(0.5);
  const cells = mx_worley_noise_vec2(p.mul(1.6));
  const crack = smoothstep(0.0, 0.06, cells.y.sub(cells.x)).oneMinus();
  const flatness = normalLocal.y.clamp(0, 1);
  const polygons = mx_worley_noise_vec2(p.mul(0.9));
  const ripplePhase = p.dot(vec2(0.86, 0.5)).mul(26).add(mid.mul(4));
  const ripple = sin(ripplePhase).mul(smoothstep(0.6, 2.2, fwidth(ripplePhase)).oneMinus());
  const tone = (dark: string, light: string, by: Node<"float">) => mix(color(dark), color(light), by);

  const weight = (index: number) => {
    const group = attribute<"vec4">(`surface${Math.floor(index / 4)}`, "vec4");
    return [group.x, group.y, group.z, group.w][index % 4];
  };
  const surfaces = {
    sand: {
      colour: tone("#c49a5e", "#e6cb92", broad.mul(0.6).add(flatness.mul(0.4))).mul(ripple.mul(0.07).add(1)),
      roughness: 0.92,
    },
    clay: {
      colour: tone("#9c5636", "#c98a5a", broad)
        .mul(float(1).sub(crack.mul(0.45)))
        .mul(mix(vec3(1), vec3(0.85, 0.95, 0.7), step(0.82, fine))),
      roughness: 0.9,
    },
    grass: {
      colour: tone("#5f7f32", "#9cb455", broad)
        .mul(smoothstep(0.55, 0.85, fine).mul(0.22).add(0.92))
        .mul(
          sin(p.x.mul(0.6).add(p.y.mul(0.3)).sub(time.mul(0.6)))
            .mul(0.04)
            .add(1),
        ),
      roughness: 0.95,
    },
    forest: {
      colour: mix(tone("#4f3f26", "#7a6438", mid), color("#4b6630"), smoothstep(0.45, 0.7, broad)).mul(
        fine.sub(0.5).mul(0.35).add(1),
      ),
      roughness: 0.95,
    },
    jungle: {
      colour: tone("#244a22", "#4d7d34", mid).mul(mix(float(0.72), float(1), smoothstep(0.25, 0.4, broad))),
      roughness: 0.8,
    },
    needles: {
      colour: mix(
        mix(tone("#33291b", "#4f4630", fine), color("#3f5a32"), smoothstep(0.5, 0.75, mid)),
        color("#e4ecf1"),
        smoothstep(0.7, 0.76, broad)
          .mul(0.85)
          .mul(smoothstep(0.6, 0.95, weight(SURFACES.indexOf("needles")))),
      ),
      roughness: 0.95,
    },
    tundra: {
      colour: mix(
        tone("#6f7350", "#9c9a6a", broad)
          .mul(float(1).sub(smoothstep(0.0, 0.05, polygons.y.sub(polygons.x)).oneMinus().mul(0.35)))
          .mul(mix(vec3(1), vec3(1.25, 0.95, 0.7), step(0.85, fine))),
        color("#e4ecf1"),
        smoothstep(0.74, 0.8, broad).mul(0.8),
      ),
      roughness: 0.95,
    },
    rock: {
      colour: tone("#5d6166", "#9a9ea2", broad)
        .mul(float(1).sub(crack.mul(0.5)))
        .mul(
          sin(y.mul(40).add(mid.mul(2)))
            .mul(0.08)
            .mul(flatness.oneMinus())
            .add(1),
        ),
      roughness: 0.85,
    },
    snow: {
      colour: mix(
        mix(color("#bcd2e6"), color("#f1f6fa"), broad.mul(0.7).add(0.3)).mul(ripple.mul(0.03).add(1)),
        tone("#5d6166", "#858a90", fine).mul(float(1).sub(crack.mul(0.4))),
        smoothstep(0.2, 0.27, broad).oneMinus().mul(0.75),
      ),
      roughness: 0.7,
    },
    lava: { colour: tone("#231b1a", "#4a3028", mid), roughness: 0.9 },
    seabed: { colour: tone("#7a6a4c", "#a08a5e", broad), roughness: 1 },
  };
  const layers = SURFACES.map((name, index) => ({ ...surfaces[name], share: weight(index) }));
  const colour = layers
    .slice(1)
    .reduce((sum, layer) => sum.add(layer.colour.mul(layer.share)), layers[0].colour.mul(layers[0].share));
  const roughness = layers
    .slice(1)
    .reduce((sum, layer) => sum.add(layer.share.mul(layer.roughness)), layers[0].share.mul(layers[0].roughness));
  const wet = smoothstep(0.0, 0.07, y).oneMinus().mul(step(-0.02, y));
  const hexLine = smoothstep(
    0.012,
    fwidth(terrainHexEdgeDistance(positionWorld.xz)).mul(1.2).add(0.012),
    terrainHexEdgeDistance(positionWorld.xz),
  ).oneMinus();
  material.colorNode = mix(
    mix(colour, colour.mul(vec3(0.62, 0.66, 0.68)), wet),
    vec3(0.2, 0.18, 0.15),
    hexLine.mul(0.2),
  );
  material.roughnessNode = mix(roughness, float(0.35), wet);
  const lavaWeight = weight(SURFACES.indexOf("lava"));
  const veinPhase = p.x
    .mul(1.7)
    .add(sin(p.y.mul(1.5)).mul(1.2))
    .add(sin(p.x.mul(0.54).add(p.y.mul(0.36))).mul(1.5));
  const vein = smoothstep(0.03, 0.1, sin(veinPhase).abs()).oneMinus();
  const pulse = sin(p.x.mul(3).add(p.y.mul(1.3)).sub(time.mul(1.5)))
    .mul(0.3)
    .add(0.7);
  material.emissiveNode = color("#ff7a1f").mul(vein).mul(pulse).mul(lavaWeight).mul(1.6);
  return material;
}

/** Approach 1's water: depth-coloured, moving, with a foam line and surf at the shore. */
function createWaterMaterial(): MeshStandardNodeMaterial {
  const water = new MeshStandardNodeMaterial({ roughness: 0.18, metalness: 0, transparent: true });
  const depth = attribute<"float">("waterDepth", "float");
  const waves = sin(positionLocal.x.mul(1.7).add(time.mul(1.1)))
    .add(sin(positionLocal.z.mul(2.3).sub(time.mul(0.9))))
    .mul(0.012);
  water.positionNode = positionLocal.add(vec3(0, waves.mul(smoothstep(0, 0.08, depth)), 0));
  const shade = mix(
    mix(color("#63d2c4"), color("#2f9bb0"), smoothstep(0.0, 0.18, depth)),
    color("#1a4a78"),
    smoothstep(0.18, 0.55, depth),
  );
  const surf = sin(depth.mul(90).sub(time.mul(2.2)))
    .mul(0.5)
    .add(0.5);
  const foam = smoothstep(0.0, 0.035, depth)
    .oneMinus()
    .max(step(0.82, surf).mul(smoothstep(0.02, 0.09, depth).oneMinus()));
  const edge = terrainHexEdgeDistance(positionWorld.xz);
  const hexLine = smoothstep(0.012, fwidth(edge).mul(1.2).add(0.012), edge).oneMinus();
  water.colorNode = mix(mix(shade, color("#f4f7f2"), foam), vec3(0.1, 0.18, 0.24), hexLine.mul(0.18));
  water.opacityNode = smoothstep(0.0, 0.006, depth).mul(0.94);
  return water;
}

/** Each biome's props: few, small, and never on a hex's middle where an army or a structure stands. */
const BIOME_PROPS: Partial<
  Record<BiomeType, { kinds: TerrainPropArchetypeId[]; chance: number; tint?: [number, number, number] }>
> = {
  [BiomeType.Beach]: { kinds: ["palm"], chance: 0.03 },
  [BiomeType.SubtropicalDesert]: { kinds: ["cactus"], chance: 0.08 },
  [BiomeType.TemperateDesert]: { kinds: ["shrub", "boulder", "dead-tree"], chance: 0.08 },
  [BiomeType.Shrubland]: { kinds: ["shrub", "wildflower"], chance: 0.16 },
  [BiomeType.Grassland]: { kinds: ["grass-tuft", "wildflower", "broadleaf"], chance: 0.1 },
  [BiomeType.TemperateDeciduousForest]: { kinds: ["broadleaf", "broadleaf", "birch", "fern"], chance: 0.3 },
  [BiomeType.TemperateRainForest]: { kinds: ["conifer", "fern", "broadleaf"], chance: 0.32 },
  [BiomeType.TropicalSeasonalForest]: { kinds: ["broadleaf", "shrub", "cycad"], chance: 0.24, tint: [1.15, 1, 0.75] },
  [BiomeType.TropicalRainForest]: { kinds: ["rainforest-canopy", "cycad", "fern"], chance: 0.34 },
  [BiomeType.Taiga]: { kinds: ["conifer"], chance: 0.28 },
  [BiomeType.Tundra]: { kinds: ["shrub", "boulder"], chance: 0.06 },
  [BiomeType.Snow]: { kinds: ["boulder", "conifer"], chance: 0.03, tint: [1.2, 1.25, 1.3] },
  [BiomeType.Bare]: { kinds: ["boulder"], chance: 0.08 },
  [BiomeType.Scorched]: { kinds: ["dead-tree"], chance: 0.06, tint: [0.3, 0.28, 0.28] },
};
const PROP_SPACING = 0.7;
const PROP_SCALE = 0.62;

function placeProps(world: BiomeWorld, occupied: ReadonlySet<string>): StudyProp[] {
  const props: StudyProp[] = [];
  const { minX, maxX, minZ, maxZ } = world.bounds;
  for (let z = minZ; z <= maxZ; z += PROP_SPACING) {
    for (let x = minX; x <= maxX; x += PROP_SPACING) {
      const px = x + (unit(x, z, 1) - 0.5) * PROP_SPACING;
      const pz = z + (unit(x, z, 2) - 0.5) * PROP_SPACING;
      const rule = BIOME_PROPS[world.biomeAt(px, pz)];
      if (!rule || unit(x, z, 3) > rule.chance || world.heightAt(px, pz) < 0.04) continue;
      const hex = findNearestTerrainHex(px, pz);
      const centre = terrainHexToWorld(hex.col, hex.row);
      if (occupied.has(`${hex.col}:${hex.row}`) || Math.hypot(px - centre.x, pz - centre.z) < 0.5) continue;
      const size = PROP_SCALE * (0.85 + unit(x, z, 4) * 0.3);
      props.push({
        archetype: rule.kinds[Math.floor(unit(x, z, 5) * rule.kinds.length)],
        x: px,
        z: pz,
        width: size,
        height: size,
        yaw: unit(x, z, 6) * Math.PI * 2,
        tint: rule.tint ?? [1, 1, 1],
      });
    }
  }
  return props;
}

function unit(x: number, z: number, salt: number): number {
  let hash =
    Math.imul(Math.round(x * 1000) | 0, 374761393) ^
    Math.imul(Math.round(z * 1000) | 0, 668265263) ^
    Math.imul(salt, 2246822519);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}
