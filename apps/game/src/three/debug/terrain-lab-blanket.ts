import { BiomeType } from "@bibliothecadao/types/terrain";
import type Node from "three/src/nodes/core/Node.js";
import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, Mesh, type InstancedMesh } from "three";
import {
  attribute,
  cameraPosition,
  color,
  dot,
  float,
  hash,
  instanceIndex,
  mix,
  normalLocal,
  positionLocal,
  positionWorld,
  smoothstep,
  step,
  time,
  transformNormalToView,
  vec2,
  vec3,
} from "three/tsl";
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";

import type { ProceduralTerrain } from "../terrain/procedural-terrain";
import { terrainCellKey, terrainHexToWorld, terrainNeighborCoordinates } from "../terrain/terrain-coordinates";
import { terrainBiomeTones } from "../terrain/terrain-palette";
import { TERRAIN_WATER_LEVEL } from "../terrain/terrain-water";
import { TERRAIN_LAB_DRESSING, type GroundDressing } from "./terrain-lab-dressing";
import { createScatter, TILE_APOTHEM, type GroundTile } from "./terrain-lab-trials";

type BlanketKind = Exclude<GroundDressing["blanket"], "none">;

interface Swell {
  /** The surface's shape from 0 to 1 at a point. */
  rise: number;
  /** How far into a crack between two slabs the point lies, from 0 to 1. */
  seam: number;
}

interface Blanket {
  /** How deep it lies at the least, and how much higher its swells rise. */
  depth: number;
  swell: number;
  swellAt: (x: number, z: number) => Swell;
  /** How finely a tile's fan is cut: broken rock needs far more than a snow drift. */
  rings: number;
  spokes: number;
  material: () => MeshStandardNodeMaterial;
}

interface Point {
  x: number;
  z: number;
}

const BLANKETS: Record<BlanketKind, Blanket> = {
  snow: { depth: 0.1, swell: 0.16, swellAt: snowDriftAt, rings: 12, spokes: 36, material: createSnowMaterial },
  dunes: { depth: 0.03, swell: 0.3, swellAt: duneAt, rings: 26, spokes: 84, material: createDuneMaterial },
  beach: { depth: 0.012, swell: 0.045, swellAt: beachAt, rings: 12, spokes: 36, material: createBeachMaterial },
  rock: { depth: 0.035, swell: 0.15, swellAt: rockAt, rings: 26, spokes: 84, material: createRockMaterial },
  crag: { depth: 0.03, swell: 0.36, swellAt: cragAt, rings: 26, spokes: 84, material: createRockMaterial },
  earth: { depth: 0.02, swell: 0.16, swellAt: earthAt, rings: 16, spokes: 48, material: createEarthMaterial },
};
const BLANKET_LIFT = 0.012;
/** Slabs of rock: how wide, how wide and deep the cracks between them, how far a slab may tilt. */
const SLAB = { size: 0.82, seam: 0.05, crack: 0.5, tilt: 0.22 };
const EMBER = vec3(2.8, 0.75, 0.12);
/** Bare rock steps down in this many ledges, and this much of its slope is cut into them. */
const CRAG = { ledges: 6, stepped: 0.6 };
/** Bare ground shows this far in from a tile that has no blanket, and the blanket is whole this far past it. */
const THAW = { from: 0.93, over: 0.5 };
const FLAKES = { perTile: 90, ceiling: 2.2, fall: 0.22, drift: 0.09, size: 0.016 };
const SLOPE_STEP = 0.012;
const DUNE_WIND = { x: 0.8, z: 0.6 };
/** Where along a dune its crest stands: the long windward rise before it, the short lee face after. */
const DUNE = { crest: 0.74 };

export interface Blankets {
  meshes: Mesh[];
  /** The height of the ground once the blankets lie on it. */
  heightAt: (x: number, z: number) => number;
}

/** Every surface with depth the tiles ask for: snow, dunes, broken rock. */
export function createBlankets(terrain: ProceduralTerrain, tiles: readonly GroundTile[]): Blankets {
  const laid = BLANKET_KINDS.map((kind) => layBlanket(kind, terrain, tiles)).filter((blanket) => blanket !== null);
  return {
    meshes: laid.map((blanket) => blanket.mesh),
    heightAt: (x, z) =>
      laid.reduce((height, blanket) => Math.max(height, blanket.heightAt(x, z).height), terrain.sampleHeight(x, z)),
  };
}

const BLANKET_KINDS = ["snow", "dunes", "beach", "rock", "crag", "earth"] as const satisfies readonly BlanketKind[];

function layBlanket(kind: BlanketKind, terrain: ProceduralTerrain, tiles: readonly GroundTile[]) {
  const covered = tiles.filter((tile) => TERRAIN_LAB_DRESSING[tile.biome].blanket === kind);
  if (covered.length === 0) return null;
  const blanket = BLANKETS[kind];
  const heightAt = blanketHeightOver(blanket, terrain, covered);
  const mesh = new Mesh(createBlanketGeometry(blanket, covered, heightAt), blanket.material());
  mesh.name = `terrain-lab-${kind}`;
  mesh.receiveShadow = true;
  return { mesh, heightAt };
}

/** Flakes over the snow: each starts under a ceiling and falls to the ground again and again, on its own beat. */
export function createSnowFlakes(
  terrain: ProceduralTerrain,
  tiles: readonly GroundTile[],
  heightAt: Blankets["heightAt"],
): InstancedMesh | null {
  return createScatter({
    name: "terrain-lab-snow-flakes",
    geometry: new IcosahedronGeometry(FLAKES.size, 0),
    material: createFlakeMaterial(),
    terrain,
    heightAt,
    tiles,
    seed: 0x27d4eb2f,
    countOf: (biome) => (TERRAIN_LAB_DRESSING[biome].blanket === "snow" ? FLAKES.perTile : 0),
    place: (flake, colour, spot) => {
      flake.position.set(spot.x, spot.y + FLAKES.ceiling, spot.z);
      colour.setScalar(1);
    },
  });
}

type BlanketHeight = (x: number, z: number) => { height: number; depth: number } & Swell;

/**
 * How high the blanket lies at a point. It thins to nothing toward any tile without it, by distance alone, so two
 * neighbouring tiles agree along the edge they share.
 */
function blanketHeightOver(
  blanket: Blanket,
  terrain: ProceduralTerrain,
  covered: readonly GroundTile[],
): BlanketHeight {
  const bare = bareTilesBeside(covered);
  return (x, z) => {
    let nearestBare = Infinity;
    for (const tile of bare) nearestBare = Math.min(nearestBare, Math.hypot(x - tile.x, z - tile.z));
    const depth = smoothStep((nearestBare - THAW.from) / THAW.over);
    const swell = blanket.swellAt(x, z);
    const lying = depth * (blanket.depth + blanket.swell * swell.rise);
    return { height: terrain.sampleHeight(x, z) + BLANKET_LIFT + lying, depth, ...swell };
  };
}

/** The middles of the tiles within two steps of the covered ones that are not covered, the map's edge included. */
function bareTilesBeside(covered: readonly GroundTile[]): Point[] {
  const under = new Set(covered.map((tile) => terrainCellKey(tile.col, tile.row)));
  const bare = new Map<string, Point>();
  for (const tile of covered) {
    for (const beside of terrainNeighborCoordinates(tile.col, tile.row)) {
      for (const near of [beside, ...terrainNeighborCoordinates(beside.col, beside.row)]) {
        const key = terrainCellKey(near.col, near.row);
        if (!under.has(key)) bare.set(key, terrainHexToWorld(near.col, near.row));
      }
    }
  }
  return [...bare.values()];
}

/** Soft drifts: a few long swells crossing at different angles. */
function snowDriftAt(x: number, z: number): Swell {
  const swells =
    Math.sin(x * 1.9 + z * 0.6 + 1.3) * 0.5 +
    Math.sin(z * 2.3 - x * 0.8 + 0.4) * 0.35 +
    Math.sin(x * 4.1 + z * 3.3) * 0.15;
  return { rise: swells * 0.5 + 0.5, seam: 0 };
}

/** Dunes: long crests across the wind, each rising gently to windward and falling short to leeward. */
function duneAt(x: number, z: number): Swell {
  const along = x * DUNE_WIND.x + z * DUNE_WIND.z;
  const across = z * DUNE_WIND.x - x * DUNE_WIND.z;
  const phase = (along * 3.6 + Math.sin(across * 1.1) * 1.5 + Math.sin(across * 2.7 + 1.1) * 0.5) / (Math.PI * 2);
  const within = phase - Math.floor(phase);
  const lee = within > DUNE.crest ? (within - DUNE.crest) / (1 - DUNE.crest) : 0;
  const windward = Math.pow(Math.min(1, within / DUNE.crest), 1.35);
  const height = 0.6 + Math.sin(across * 0.9 + 1.7) * 0.28 + Math.sin(along * 0.5 + across * 0.3) * 0.12;
  return { rise: (lee > 0 ? 1 - Math.pow(lee, 0.55) : windward) * height, seam: lee > 0 ? 1 - lee * 0.6 : 0 };
}

/** A beach: almost flat, with long low swells. */
function beachAt(x: number, z: number): Swell {
  return { rise: Math.sin(x * 1.3 + z * 0.7) * 0.3 + Math.sin(z * 2.1 - x * 0.5 + 2) * 0.2 + 0.5, seam: 0 };
}

/** Broken rock: slabs of uneven height, each tilted its own way, with a crack down to the ground between them. */
function rockAt(x: number, z: number): Swell {
  const column = Math.floor(x / SLAB.size);
  const line = Math.floor(z / SLAB.size);
  let nearest = Infinity;
  let second = Infinity;
  let slab = { column: 0, line: 0, x: 0, z: 0 };
  for (let aside = -1; aside <= 1; aside += 1) {
    for (let ahead = -1; ahead <= 1; ahead += 1) {
      const middleX = (column + aside + 0.15 + cellRandom(column + aside, line + ahead, 1) * 0.7) * SLAB.size;
      const middleZ = (line + ahead + 0.15 + cellRandom(column + aside, line + ahead, 2) * 0.7) * SLAB.size;
      const away = Math.hypot(x - middleX, z - middleZ);
      if (away < nearest) {
        second = nearest;
        nearest = away;
        slab = { column: column + aside, line: line + ahead, x: middleX, z: middleZ };
      } else if (away < second) {
        second = away;
      }
    }
  }
  const seam = 1 - smoothStep((second - nearest) / SLAB.seam);
  const turn = cellRandom(slab.column, slab.line, 3) * Math.PI * 2;
  const tilted = ((x - slab.x) * Math.cos(turn) + (z - slab.z) * Math.sin(turn)) * SLAB.tilt;
  const top = Math.min(1, Math.max(0.2, 0.45 + cellRandom(slab.column, slab.line, 4) * 0.35 + tilted));
  return { rise: top * (1 - seam * SLAB.crack), seam };
}

/** Bare rock: sharp ridges broken into ledges, the way weathered stone steps down. */
function cragAt(x: number, z: number): Swell {
  const ridges = 1 - Math.abs(fractalNoise(x * 1.5, z * 1.5, 4, 5) * 2 - 1);
  const mass = fractalNoise(x * 0.55 + 9.1, z * 0.55, 2, 6);
  const height = Math.min(1, ridges * ridges * 0.75 + mass * 0.45);
  const ledges = Math.floor(height * CRAG.ledges) / CRAG.ledges;
  return { rise: height + (ledges - height) * CRAG.stepped, seam: 0 };
}

/** Dry earth: low rolling ground cut by a few thin gullies where water once ran. */
function earthAt(x: number, z: number): Swell {
  const roll = fractalNoise(x * 0.9, z * 0.9, 3, 7);
  const gully = Math.pow(1 - Math.abs(fractalNoise(x * 1.3 + 4.7, z * 1.3, 2, 8) * 2 - 1), 9);
  return { rise: Math.max(0, roll * 0.85 + 0.15 - gully * 0.35), seam: gully * 0.5 };
}

/** Smooth noise from 0 to 1, summed over octaves each twice as fine and half as strong as the last. */
function fractalNoise(x: number, z: number, octaves: number, salt: number): number {
  let total = 0;
  let weight = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    const scale = 2 ** octave;
    total += smoothNoise(x * scale, z * scale, salt + octave) / scale;
    weight += 1 / scale;
  }
  return total / weight;
}

function smoothNoise(x: number, z: number, salt: number): number {
  const column = Math.floor(x);
  const line = Math.floor(z);
  const across = smoothStep(x - column);
  const along = smoothStep(z - line);
  const near = cellRandom(column, line, salt) * (1 - across) + cellRandom(column + 1, line, salt) * across;
  const far = cellRandom(column, line + 1, salt) * (1 - across) + cellRandom(column + 1, line + 1, salt) * across;
  return near * (1 - along) + far * along;
}

function cellRandom(column: number, line: number, salt: number): number {
  let state = (Math.imul(column, 0x9e3779b1) ^ Math.imul(line, 0x85ebca77) ^ Math.imul(salt, 0xc2b2ae3d)) >>> 0;
  state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) >>> 0;
  return ((state ^ (state >>> 12)) >>> 0) / 4_294_967_296;
}

/** One fan of triangles per tile, its rim on the tile's own edge, every vertex lifted to the blanket's height. */
function createBlanketGeometry(
  blanket: Blanket,
  covered: readonly GroundTile[],
  blanketAt: BlanketHeight,
): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const depths: number[] = [];
  const swells: number[] = [];
  const seams: number[] = [];
  const colours: number[] = [];
  const glows: number[] = [];
  const indices: number[] = [];
  const paint = new Color();
  const light = new Color();
  const addVertex = (x: number, z: number, biome: BiomeType) => {
    const here = blanketAt(x, z);
    const east = blanketAt(x + SLOPE_STEP, z).height - here.height;
    const north = blanketAt(x, z + SLOPE_STEP).height - here.height;
    const length = Math.hypot(east, SLOPE_STEP, north);
    positions.push(x, here.height, z);
    normals.push(-east / length, SLOPE_STEP / length, -north / length);
    depths.push(here.depth);
    swells.push(here.rise);
    seams.push(here.seam);
    const tones = terrainBiomeTones(biome);
    paint
      .copy(tones.shadow)
      .lerp(light.copy(tones.light), here.rise)
      .multiplyScalar(1 - here.seam * 0.35);
    colours.push(paint.r, paint.g, paint.b);
    glows.push(biome === BiomeType.Scorched ? here.seam * here.depth : 0);
  };
  for (const tile of covered) {
    const middle = terrainHexToWorld(tile.col, tile.row);
    const first = positions.length / 3;
    addVertex(middle.x, middle.z, tile.biome);
    for (let ring = 1; ring <= blanket.rings; ring += 1) {
      for (let spoke = 0; spoke < blanket.spokes; spoke += 1) {
        const angle = (spoke / blanket.spokes) * Math.PI * 2;
        const reach = (ring / blanket.rings) * tileReachAt(angle);
        addVertex(middle.x + Math.cos(angle) * reach, middle.z + Math.sin(angle) * reach, tile.biome);
      }
    }
    addFanIndices(indices, first, blanket);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("blanketDepth", new Float32BufferAttribute(depths, 1));
  geometry.setAttribute("blanketSwell", new Float32BufferAttribute(swells, 1));
  geometry.setAttribute("blanketSeam", new Float32BufferAttribute(seams, 1));
  geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  geometry.setAttribute("blanketGlow", new Float32BufferAttribute(glows, 1));
  geometry.setIndex(indices);
  return geometry;
}

/** How far a tile reaches from its middle at an angle: to a corner at 30°, to the middle of an edge at 0°. */
function tileReachAt(angle: number): number {
  const sixth = Math.PI / 3;
  const fromEdgeMiddle = ((((angle + sixth / 2) % sixth) + sixth) % sixth) - sixth / 2;
  return TILE_APOTHEM / Math.cos(fromEdgeMiddle);
}

function addFanIndices(indices: number[], first: number, blanket: Blanket): void {
  const ringStart = (ring: number) => first + 1 + (ring - 1) * blanket.spokes;
  for (let spoke = 0; spoke < blanket.spokes; spoke += 1) {
    const next = (spoke + 1) % blanket.spokes;
    indices.push(first, ringStart(1) + next, ringStart(1) + spoke);
    for (let ring = 1; ring < blanket.rings; ring += 1) {
      const inner = ringStart(ring);
      const outer = ringStart(ring + 1);
      indices.push(inner + spoke, inner + next, outer + next, inner + spoke, outer + next, outer + spoke);
    }
  }
}

/** The blanket's colour: its biome's shadow where it is thin or low, its body on the swells. */
function blanketColour(biome: BiomeType, brightest: "body" | "light") {
  const tones = terrainBiomeTones(biome);
  const depth = attribute<"float">("blanketDepth", "float");
  const swell = attribute<"float">("blanketSwell", "float");
  const lit = mix(color(tones.shadow), color(tones[brightest]), smoothstep(0.15, 0.85, swell));
  return { depth, colour: mix(color(tones.shadow), lit, smoothstep(0.1, 0.9, depth)) };
}

function createSnowMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.55 });
  material.name = "terrain-lab-snow";
  const { depth, colour } = blanketColour(BiomeType.Snow, "body");
  material.colorNode = colour.mul(0.9);
  const grain = positionWorld.xz.mul(70).floor();
  const glint = step(0.994, hash(grain.x.mul(127.1).add(grain.y.mul(311.7))));
  const twinkle = time.mul(2.4).add(grain.x.add(grain.y)).sin().mul(0.5).add(0.5);
  const near = smoothstep(16, 6, cameraPosition.distance(positionWorld));
  material.emissiveNode = vec3(0.9, 0.95, 1).mul(glint).mul(twinkle).mul(near).mul(depth);
  return material;
}

function createDuneMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.92 });
  material.name = "terrain-lab-dunes";
  const { depth, colour } = blanketColour(BiomeType.SubtropicalDesert, "light");
  const lee = attribute<"float">("blanketSeam", "float");
  const ripples = windRipples(46, attribute<"float">("blanketSwell", "float").mul(11));
  material.colorNode = colour.mul(lee.mul(0.16).oneMinus()).mul(ripples.tone.mul(0.03).mul(depth).add(1));
  material.normalNode = rippledNormal(ripples.lean.mul(0.2).mul(depth).mul(lee.mul(0.7).oneMinus()));
  return material;
}

/** Sand by the sea: fine ripples, and darker and glossier the nearer it lies to the water. */
function createBeachMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0 });
  material.name = "terrain-lab-beach";
  const { depth, colour } = blanketColour(BiomeType.Beach, "light");
  const wet = smoothstep(TERRAIN_WATER_LEVEL + 0.16, TERRAIN_WATER_LEVEL + 0.03, positionWorld.y);
  const ripples = windRipples(64, positionWorld.x.mul(0.9).sin().mul(2.5));
  material.colorNode = colour.mul(mix(1, 0.7, wet));
  material.roughnessNode = mix(0.9, 0.3, wet);
  material.normalNode = rippledNormal(ripples.lean.mul(0.1).mul(depth).mul(wet.oneMinus()));
  return material;
}

/**
 * Wind ripples are too fine for the mesh: they are drawn as a lean of the surface, which the sun then shades, and as
 * a tone from -1 in their troughs to 1 on their backs. They show only from close: from afar sand is smooth.
 */
function windRipples(wavesPerRadius: number, bend: Node<"float">) {
  const wind = vec2(DUNE_WIND.x, DUNE_WIND.z);
  const across = dot(positionWorld.xz, vec2(-DUNE_WIND.z, DUNE_WIND.x));
  const meander = across.mul(1.7).sin().mul(2.6).add(across.mul(0.53).add(1.9).sin().mul(4.2));
  const phase = dot(positionWorld.xz, wind).mul(wavesPerRadius).add(bend).add(meander);
  const near = smoothstep(11, 5, cameraPosition.distance(positionWorld));
  return { lean: wind.mul(phase.cos()).mul(near), tone: phase.sin().mul(near) };
}

const rippledNormal = (lean: Node<"vec2">) =>
  transformNormalToView(normalLocal.add(vec3(lean.x, 0, lean.y)).normalize());

/** Rock takes each tile's own tones, painted on its vertices, and each face is lit flat, as cut stone is. */
function createRockMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({
    metalness: 0,
    roughness: 0.95,
    flatShading: true,
    vertexColors: true,
  });
  material.name = "terrain-lab-rock";
  const breathe = time.mul(0.9).add(positionWorld.x.add(positionWorld.z).mul(1.7)).sin().mul(0.3).add(0.7);
  material.emissiveNode = EMBER.mul(attribute<"float">("blanketGlow", "float")).mul(breathe);
  return material;
}

/** Earth takes each tile's own tones, painted on its vertices, and is lit smooth. */
function createEarthMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.95, vertexColors: true });
  material.name = "terrain-lab-earth";
  return material;
}

function createFlakeMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ transparent: true, opacity: 0.9 });
  material.name = "terrain-lab-snow-flakes";
  const beat = hash(instanceIndex);
  const fallen = time.mul(FLAKES.fall).add(beat.mul(FLAKES.ceiling)).mod(FLAKES.ceiling);
  const sway = time.mul(0.8).add(beat.mul(40));
  material.positionNode = positionLocal.add(
    vec3(sway.sin().mul(FLAKES.drift), fallen.negate(), sway.mul(0.7).cos().mul(FLAKES.drift)),
  );
  material.colorNode = vec3(0.62, 0.74, 0.92);
  material.opacityNode = smoothstep(0, 0.25, fallen).mul(
    smoothstep(float(FLAKES.ceiling), FLAKES.ceiling - 0.3, fallen),
  );
  return material;
}

function smoothStep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}
