import type { TerrainPropArchetypeId } from "../../../terrain/terrain-prop-catalog";

export type BiomeStudyId = "forest" | "taiga" | "desert" | "scorched";

/** One prop the study places: which mesh, where on the ground plane, how big, turned and tinted. */
export interface StudyProp {
  archetype: TerrainPropArchetypeId;
  x: number;
  z: number;
  /** Width and height scale; a mesa is wide and low, a spire narrow and tall. */
  width: number;
  height: number;
  yaw: number;
  tint: readonly [number, number, number];
}

/** A layer fills the ground where its mass field is above `threshold`, one try every `spacing` world units. */
interface StudyLayer {
  archetypes: readonly TerrainPropArchetypeId[];
  spacing: number;
  /** The mass field's cut: higher means rarer, tighter masses. */
  threshold: number;
  /** Size of the masses in world units: forests in big stands, scrub in small patches. */
  massSize: number;
  /** Place where the field is below the cut instead: clearings, the open between stands. */
  inverse?: boolean;
  scale: readonly [number, number];
  tint: readonly [number, number, number];
}

/** A landmark is a few props built into one place: a tor, a mesa, an ancient tree. */
interface StudyLandmark {
  x: number;
  z: number;
  parts: ReadonlyArray<{
    archetype: TerrainPropArchetypeId;
    dx: number;
    dz: number;
    width: number;
    height: number;
    yaw: number;
  }>;
  tint: readonly [number, number, number];
}

interface BiomeTarget {
  label: string;
  layers: readonly StudyLayer[];
  landmarks: readonly StudyLandmark[];
}

const MOSS: readonly [number, number, number] = [0.82, 1.02, 0.78];
const CHAR: readonly [number, number, number] = [0.32, 0.3, 0.3];
const SANDSTONE: readonly [number, number, number] = [1.45, 1.05, 0.72];

/** What each studied biome should read as at play zoom, built from today's meshes only. */
export const BIOME_TARGETS: Readonly<Record<BiomeStudyId, BiomeTarget>> = {
  forest: {
    label: "Temperate forest: old stands, glades",
    layers: [
      { archetypes: ["broadleaf"], spacing: 0.62, threshold: 0.56, massSize: 5, scale: [1.2, 1.9], tint: [1, 1, 1] },
      { archetypes: ["birch"], spacing: 0.85, threshold: 0.5, massSize: 5, scale: [1.0, 1.5], tint: [1.05, 1, 0.9] },
      { archetypes: ["shrub", "fern"], spacing: 0.45, threshold: 0.52, massSize: 5, scale: [0.9, 1.4], tint: MOSS },
      {
        archetypes: ["wildflower", "grass-tuft", "mushroom"],
        spacing: 0.6,
        threshold: 0.42,
        massSize: 5,
        inverse: true,
        scale: [0.9, 1.3],
        tint: [1, 1, 1],
      },
      { archetypes: ["fallen-log"], spacing: 1.6, threshold: 0.55, massSize: 5, scale: [1, 1.4], tint: MOSS },
    ],
    landmarks: [
      {
        x: 1.6,
        z: 1.4,
        tint: [1, 1, 1],
        parts: [{ archetype: "broadleaf", dx: 0, dz: 0, width: 2.4, height: 2.7, yaw: 0.4 }],
      },
      {
        x: -3.6,
        z: -0.2,
        tint: MOSS,
        parts: [
          { archetype: "boulder", dx: 0, dz: 0, width: 4.2, height: 3.2, yaw: 0.3 },
          { archetype: "boulder", dx: 0.5, dz: 0.3, width: 2.6, height: 2.2, yaw: 1.4 },
          { archetype: "boulder", dx: -0.45, dz: 0.35, width: 2.2, height: 1.6, yaw: 2.2 },
        ],
      },
    ],
  },
  taiga: {
    label: "Taiga: dark pine walls, mossy tors",
    layers: [
      {
        archetypes: ["conifer"],
        spacing: 0.5,
        threshold: 0.52,
        massSize: 6,
        scale: [1.2, 2.5],
        tint: [0.86, 0.94, 0.9],
      },
      { archetypes: ["birch"], spacing: 1.1, threshold: 0.46, massSize: 6, scale: [1, 1.4], tint: [1, 1, 1] },
      { archetypes: ["fern", "shrub"], spacing: 0.6, threshold: 0.52, massSize: 6, scale: [0.8, 1.2], tint: MOSS },
      {
        archetypes: ["boulder"],
        spacing: 1.3,
        threshold: 0.38,
        massSize: 3,
        inverse: true,
        scale: [1.2, 2.4],
        tint: MOSS,
      },
      {
        archetypes: ["fallen-log"],
        spacing: 1.4,
        threshold: 0.56,
        massSize: 6,
        scale: [1, 1.5],
        tint: [0.8, 0.8, 0.8],
      },
    ],
    landmarks: [
      {
        x: 2.2,
        z: 0.8,
        tint: MOSS,
        parts: [
          { archetype: "boulder", dx: 0, dz: 0, width: 2.4, height: 4.6, yaw: 0.2 },
          { archetype: "boulder", dx: 0.35, dz: 0.2, width: 1.8, height: 3.2, yaw: 1.1 },
          { archetype: "boulder", dx: -0.3, dz: 0.25, width: 1.6, height: 2.2, yaw: 2.6 },
        ],
      },
    ],
  },
  desert: {
    label: "Desert: mesas, cactus flats, an oasis",
    layers: [
      { archetypes: ["cactus"], spacing: 0.95, threshold: 0.6, massSize: 2.5, scale: [1.1, 1.8], tint: [1, 1, 1] },
      {
        archetypes: ["shrub", "dead-tree"],
        spacing: 1.3,
        threshold: 0.62,
        massSize: 2.5,
        scale: [0.8, 1.2],
        tint: [1.2, 1.05, 0.75],
      },
      {
        archetypes: ["boulder"],
        spacing: 1.6,
        threshold: 0.34,
        massSize: 4,
        inverse: true,
        scale: [1, 2],
        tint: SANDSTONE,
      },
    ],
    landmarks: [
      {
        x: -3.2,
        z: -1.2,
        tint: SANDSTONE,
        parts: [
          { archetype: "boulder", dx: 0, dz: 0, width: 6.5, height: 2.6, yaw: 0.1 },
          { archetype: "boulder", dx: 0.9, dz: 0.2, width: 4.8, height: 2.1, yaw: 1.3 },
          { archetype: "boulder", dx: -0.8, dz: 0.4, width: 4.2, height: 1.8, yaw: 2.4 },
        ],
      },
      {
        x: 2.4,
        z: 1.2,
        tint: [1, 1, 1],
        parts: [
          { archetype: "palm", dx: 0, dz: -0.35, width: 1.6, height: 1.7, yaw: 0 },
          { archetype: "palm", dx: 0.45, dz: 0.1, width: 1.4, height: 1.5, yaw: 1.7 },
          { archetype: "palm", dx: -0.4, dz: 0.2, width: 1.5, height: 1.9, yaw: 3.1 },
          { archetype: "cycad", dx: 0.15, dz: 0.45, width: 1.5, height: 1.4, yaw: 0.6 },
          { archetype: "cycad", dx: -0.2, dz: -0.15, width: 1.3, height: 1.2, yaw: 2.2 },
          { archetype: "grass-tuft", dx: 0.4, dz: -0.3, width: 1.8, height: 1.6, yaw: 0.2 },
        ],
      },
    ],
  },
  scorched: {
    label: "Scorched: burnt stands, black tors",
    layers: [
      { archetypes: ["dead-tree"], spacing: 0.62, threshold: 0.55, massSize: 4, scale: [1.2, 2], tint: CHAR },
      { archetypes: ["fallen-log"], spacing: 1.1, threshold: 0.52, massSize: 4, scale: [1, 1.5], tint: CHAR },
      {
        archetypes: ["boulder"],
        spacing: 0.95,
        threshold: 0.4,
        massSize: 3,
        inverse: true,
        scale: [1, 2.2],
        tint: [0.45, 0.4, 0.4],
      },
    ],
    landmarks: [
      {
        x: 1.8,
        z: -0.6,
        tint: [0.38, 0.34, 0.34],
        parts: [
          { archetype: "boulder", dx: 0, dz: 0, width: 2.2, height: 5, yaw: 0.4 },
          { archetype: "boulder", dx: 0.45, dz: 0.1, width: 1.6, height: 3.6, yaw: 1.9 },
          { archetype: "boulder", dx: -0.35, dz: 0.3, width: 1.5, height: 3, yaw: 2.9 },
          { archetype: "boulder", dx: 0.1, dz: -0.45, width: 1.4, height: 2.6, yaw: 4.1 },
        ],
      },
    ],
  },
};

const HALF_EXTENT = 9;

/** Seeded and repeatable: the same biome always lays out the same patch. */
export function composeBiomeTarget(id: BiomeStudyId, isArmySpaceClear: (x: number, z: number) => boolean): StudyProp[] {
  const target = BIOME_TARGETS[id];
  const props: StudyProp[] = [];
  target.layers.forEach((layer, layerIndex) => {
    for (let z = -HALF_EXTENT; z <= HALF_EXTENT; z += layer.spacing) {
      for (let x = -HALF_EXTENT; x <= HALF_EXTENT; x += layer.spacing) {
        const seed = layerIndex * 7919;
        const px = x + (hash(x, z, seed + 1) - 0.5) * layer.spacing;
        const pz = z + (hash(x, z, seed + 2) - 0.5) * layer.spacing;
        const mass = massField(px / layer.massSize, pz / layer.massSize, id.length);
        const inside = layer.inverse ? mass < layer.threshold : mass > layer.threshold;
        if (!inside || hash(x, z, seed + 3) > 0.85 || !isArmySpaceClear(px, pz)) continue;
        const size = layer.scale[0] + hash(x, z, seed + 4) * (layer.scale[1] - layer.scale[0]);
        const shade = 0.88 + hash(x, z, seed + 6) * 0.24;
        props.push({
          archetype: layer.archetypes[Math.floor(hash(x, z, seed + 5) * layer.archetypes.length)],
          x: px,
          z: pz,
          width: size,
          height: size * (0.9 + hash(x, z, seed + 7) * 0.25),
          yaw: hash(x, z, seed + 8) * Math.PI * 2,
          tint: [layer.tint[0] * shade, layer.tint[1] * shade, layer.tint[2] * shade],
        });
      }
    }
  });
  const landmarkClear = (x: number, z: number) =>
    target.landmarks.every((landmark) => Math.hypot(landmark.x - x, landmark.z - z) > 1.2);
  const placed = props.filter((prop) => landmarkClear(prop.x, prop.z));
  for (const landmark of target.landmarks) {
    for (const part of landmark.parts) {
      placed.push({
        archetype: part.archetype,
        x: landmark.x + part.dx,
        z: landmark.z + part.dz,
        width: part.width,
        height: part.height,
        yaw: part.yaw,
        tint: landmark.tint,
      });
    }
  }
  return placed;
}

/** Two octaves of smooth value noise: masses with ragged edges, never perfect circles. */
function massField(x: number, z: number, seed: number): number {
  return valueNoise(x, z, seed) * 0.7 + valueNoise(x * 2.3, z * 2.3, seed + 31) * 0.3;
}

function valueNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x),
    z0 = Math.floor(z);
  const fx = smooth(x - x0),
    fz = smooth(z - z0);
  const corner = (cx: number, cz: number) => hash(cx, cz, seed * 101);
  const top = corner(x0, z0) * (1 - fx) + corner(x0 + 1, z0) * fx;
  const bottom = corner(x0, z0 + 1) * (1 - fx) + corner(x0 + 1, z0 + 1) * fx;
  return top * (1 - fz) + bottom * fz;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function hash(x: number, z: number, seed: number): number {
  let h = Math.imul(Math.round(x * 1000) | 0, 374761393) ^ Math.imul(Math.round(z * 1000) | 0, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
