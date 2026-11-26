import brandPalette from "@/brand/palette.json";
import { hasSeasonOneRealmSkinAt, SEASON_ONE_DRAWN_LEVELS } from "@bibliothecadao/eternum";
import { aspectName, aspects, type AspectId } from "@bibliothecadao/types";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import type { FlagAnchor } from "./flag-anchors";

export const SEASON_ONE_REALM_KIT_LEVELS = SEASON_ONE_DRAWN_LEVELS;

export type SeasonOneRealmKitLevel = (typeof SEASON_ONE_DRAWN_LEVELS)[number];

interface AspectKitPalette {
  readonly stone: string;
  readonly stoneShade: string;
  readonly trim: string;
  readonly roof: string;
  readonly timber: string;
  readonly accent: string;
  readonly gem: string;
  readonly emissive: string;
  readonly emissiveIntensity: number;
  readonly rail: string;
}

interface KitPart {
  readonly geometry: BufferGeometry;
  readonly color: string;
}

interface KitParts {
  readonly masonry: KitPart[];
  readonly glow: KitPart[];
  readonly anchors: FlagAnchor[];
}

interface WallSegment {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
}

const SEASON_ONE_KIT_PREFIX = "procedural:season-1-realm:";

const ASPECT_PALETTES = {
  1: {
    stone: brandPalette.aspects.prowess.stone,
    stoneShade: "#262325",
    trim: brandPalette.aspects.prowess.trim,
    roof: "#2f3540",
    timber: "#6e472b",
    accent: "#4c392c",
    gem: brandPalette.aspects.prowess.gem,
    emissive: brandPalette.aspects.prowess.gem,
    emissiveIntensity: 1.35,
    rail: brandPalette.aspects.prowess.trim,
  },
  2: {
    stone: brandPalette.aspects.luminary.stone,
    stoneShade: "#cbc3b2",
    trim: brandPalette.aspects.luminary.trim,
    roof: "#aeb8c2",
    timber: "#d7cebd",
    accent: "#8e99a5",
    gem: brandPalette.aspects.luminary.gem,
    emissive: "#d8f8f5",
    emissiveIntensity: 1.15,
    rail: brandPalette.aspects.luminary.trim,
  },
  3: {
    stone: brandPalette.aspects.havoc.stone,
    stoneShade: "#1c1a1c",
    trim: brandPalette.aspects.havoc.gem,
    roof: "#25201f",
    timber: "#4d3423",
    accent: "#7a5e42",
    gem: brandPalette.aspects.havoc.heart,
    emissive: brandPalette.aspects.havoc.heart,
    emissiveIntensity: 1.55,
    rail: "#7a5e42",
  },
  4: {
    stone: brandPalette.aspects.insight.stone,
    stoneShade: "#54657a",
    trim: brandPalette.aspects.insight.secondary,
    roof: "#344cb5",
    timber: "#8c6239",
    accent: brandPalette.brand["mark-gold"],
    gem: brandPalette.aspects.insight.gem,
    emissive: brandPalette.aspects.insight.gem,
    emissiveIntensity: 1.4,
    rail: brandPalette.brand["mark-gold"],
  },
} as const satisfies Record<AspectId, AspectKitPalette>;

type AspectKitBuilder = (parts: KitParts, palette: AspectKitPalette) => void;

const KIT_BUILDERS = {
  0: {
    1: buildProwessSettlement,
    2: buildLuminarySettlement,
    3: buildHavocSettlement,
    4: buildInsightSettlement,
  },
  1: {
    1: buildProwessCity,
    2: buildLuminaryCity,
    3: buildHavocCity,
    4: buildInsightCity,
  },
} as const satisfies Record<SeasonOneRealmKitLevel, Record<AspectId, AspectKitBuilder>>;

const SETTLEMENT_BANNER_X = 0.41;
const SETTLEMENT_BANNER_Y = 0.34;
const SETTLEMENT_BANNER_Z = 0.655;
const SETTLEMENT_BANNER_WIDTH = 0.125;

const CITY_BANNER_X = 0.44;
const CITY_BANNER_Z = 0.675;
const CITY_BANNER_WIDTH = 0.13;

const HEX_PERIMETER_POINTS: readonly (readonly [number, number])[] = [
  [-0.22, 0.62],
  [-0.6, 0.62],
  [-0.78, 0.18],
  [-0.72, -0.38],
  [-0.3, -0.72],
  [0.3, -0.72],
  [0.72, -0.38],
  [0.78, 0.18],
  [0.6, 0.62],
  [0.22, 0.62],
];

const HEX_WALL_SEGMENTS: readonly WallSegment[] = HEX_PERIMETER_POINTS.slice(0, -1).map((from, index) => ({
  from,
  to: HEX_PERIMETER_POINTS[index + 1]!,
}));

let cachedStoneGrain: DataTexture | null = null;

export function hasSeasonOneRealmKit(level: number): level is SeasonOneRealmKitLevel {
  return hasSeasonOneRealmSkinAt(level);
}

export function seasonOneRealmKitPath(aspect: AspectId, level: SeasonOneRealmKitLevel): string {
  return `${SEASON_ONE_KIT_PREFIX}${aspect}:${level}`;
}

export function isSeasonOneRealmKitPath(path: string): boolean {
  return parseSeasonOneRealmKitPath(path) !== null;
}

export function parseSeasonOneRealmKitPath(path: string): { aspect: AspectId; level: SeasonOneRealmKitLevel } | null {
  if (!path.startsWith(SEASON_ONE_KIT_PREFIX)) return null;
  const [aspectText, levelText, extra] = path.slice(SEASON_ONE_KIT_PREFIX.length).split(":");
  if (extra !== undefined || !aspectText || !levelText) return null;
  const aspectId = Number(aspectText);
  const level = Number(levelText);
  const validAspect = aspects.some(({ id }) => id === aspectId);
  if (!validAspect || !hasSeasonOneRealmKit(level)) return null;
  return { aspect: aspectId as AspectId, level };
}

export function createSeasonOneRealmKit(aspect: AspectId, level: SeasonOneRealmKitLevel): GLTF {
  const palette = ASPECT_PALETTES[aspect];
  const parts: KitParts = { masonry: [], glow: [], anchors: [] };
  KIT_BUILDERS[level][aspect](parts, palette);
  return assembleKitGltf(aspect, level, parts, palette);
}

export function resolveSeasonOneRealmKit(path: string): GLTF | null {
  const parsed = parseSeasonOneRealmKitPath(path);
  return parsed ? createSeasonOneRealmKit(parsed.aspect, parsed.level) : null;
}

function assembleKitGltf(aspect: AspectId, level: number, parts: KitParts, palette: AspectKitPalette): GLTF {
  const scene = new Group();
  scene.name = `season-1-${aspectName(aspect).toLowerCase()}-${level}`;
  const masonryMesh = new Mesh(combineParts(parts.masonry), createMasonryMaterial());
  masonryMesh.name = `${scene.name}:masonry`;
  scene.add(masonryMesh);
  if (parts.glow.length > 0) {
    const glowMesh = new Mesh(combineParts(parts.glow), createGlowMaterial(palette));
    glowMesh.name = `${scene.name}:glow`;
    scene.add(glowMesh);
  }
  scene.userData.flagAnchors = parts.anchors;
  return {
    animations: [],
    scene,
    scenes: [scene],
    cameras: [],
    asset: {},
    parser: {} as GLTF["parser"],
    userData: {},
  };
}

function buildProwessSettlement(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.37,
    thickness: 0.09,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.trim,
    trimY: 0.34,
    bandY: 0.19,
  });
  addPerimeterPilasters(parts, 0.43, 0.13, palette.timber, palette.trim, true);
  addClosedBastionGate(parts, palette);
  addWallBannerRails(parts, palette.rail, SETTLEMENT_BANNER_Y);

  addPitchedHut(parts, {
    x: -0.3,
    z: -0.1,
    width: 0.44,
    depth: 0.56,
    wallHeight: 0.42,
    roofHeight: 0.38,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    postColor: palette.timber,
    roofColor: palette.roof,
    trimColor: palette.trim,
    doorColor: palette.timber,
    glowColor: palette.gem,
    windowGlow: true,
    finial: "spear",
  });
  addPitchedHut(parts, {
    x: 0.3,
    z: -0.05,
    width: 0.4,
    depth: 0.5,
    wallHeight: 0.38,
    roofHeight: 0.35,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    postColor: palette.timber,
    roofColor: palette.roof,
    trimColor: palette.trim,
    doorColor: palette.timber,
    glowColor: palette.gem,
    windowGlow: true,
    finial: "spear",
  });

  for (const side of [-1, 1]) {
    parts.masonry.push(piece(cutStoneBlock(0.08, 0.1, 0.08), palette.stoneShade, side * 0.25, 0.24, 0.67));
    parts.glow.push(
      piece(new OctahedronGeometry(0.042, 0).scale(0.85, 1.25, 0.85), palette.gem, side * 0.25, 0.25, 0.69),
    );
  }
  parts.glow.push(piece(new OctahedronGeometry(0.052, 0).scale(0.9, 1.35, 0.7), palette.gem, 0, 0.48, 0.66));
}

function buildLuminarySettlement(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.36,
    thickness: 0.095,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.trim,
    trimY: 0.34,
    bandY: 0.12,
  });
  addPerimeterPilasters(parts, 0.42, 0.135, palette.stone, palette.trim, false);
  addArchedGatehouse(parts, palette.stone, palette.trim, palette.gem, "orb");
  addWallBannerRails(parts, palette.rail, SETTLEMENT_BANNER_Y);

  addVaultedSanctuaryHut(parts, {
    x: -0.29,
    z: -0.1,
    width: 0.43,
    depth: 0.55,
    wallHeight: 0.42,
    vaultRadius: 0.23,
    palette,
    hasLanternTop: true,
  });
  addVaultedSanctuaryHut(parts, {
    x: 0.29,
    z: -0.05,
    width: 0.39,
    depth: 0.5,
    wallHeight: 0.38,
    vaultRadius: 0.21,
    palette,
    hasLanternTop: true,
  });
}

function buildHavocSettlement(parts: KitParts, palette: AspectKitPalette): void {
  addSpikedPalisade(parts, palette);
  addOpenTimberGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.33);

  addPitchedHut(parts, {
    x: -0.31,
    z: -0.14,
    width: 0.43,
    depth: 0.52,
    wallHeight: 0.38,
    roofHeight: 0.36,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    postColor: palette.timber,
    roofColor: palette.roof,
    trimColor: palette.timber,
    doorColor: palette.stoneShade,
    glowColor: palette.gem,
    windowGlow: false,
    finial: "horns",
  });
  addPitchedHut(parts, {
    x: 0.31,
    z: -0.08,
    width: 0.4,
    depth: 0.48,
    wallHeight: 0.36,
    roofHeight: 0.34,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    postColor: palette.timber,
    roofColor: palette.roof,
    trimColor: palette.timber,
    doorColor: palette.stoneShade,
    glowColor: palette.gem,
    windowGlow: false,
    finial: "horns",
  });

  addCrystalBrazier(parts, -0.28, 0.26, palette);
  addCrystalBrazier(parts, 0.28, 0.26, palette);
  for (const side of [-1, 1]) {
    parts.masonry.push(
      piece(cutStoneBlock(0.11, 0.14, 0.04), palette.stoneShade, side * 0.56, 0.22, 0.66),
      piece(new OctahedronGeometry(0.036, 0).scale(0.8, 1.3, 0.5), palette.trim, side * 0.56, 0.22, 0.68),
    );
  }
}

function buildInsightSettlement(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.37,
    thickness: 0.095,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.trim,
    trimY: 0.34,
    bandY: 0.18,
  });
  addPerimeterPilasters(parts, 0.43, 0.13, palette.stone, palette.trim, false);
  addArchedGatehouse(parts, palette.stone, palette.trim, palette.gem, "astrolabe");
  addWallBannerRails(parts, palette.rail, SETTLEMENT_BANNER_Y);

  addPitchedHut(parts, {
    x: -0.3,
    z: -0.1,
    width: 0.44,
    depth: 0.54,
    wallHeight: 0.4,
    roofHeight: 0.38,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    postColor: palette.timber,
    roofColor: palette.roof,
    trimColor: palette.accent,
    doorColor: palette.timber,
    glowColor: palette.gem,
    windowGlow: false,
    finial: "oculus",
    oculusRingColor: palette.trim,
  });
  addPitchedHut(parts, {
    x: 0.3,
    z: -0.06,
    width: 0.4,
    depth: 0.48,
    wallHeight: 0.37,
    roofHeight: 0.35,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    postColor: palette.timber,
    roofColor: palette.roof,
    trimColor: palette.accent,
    doorColor: palette.timber,
    glowColor: palette.gem,
    windowGlow: false,
    finial: "oculus",
    oculusRingColor: palette.trim,
  });
}

function buildProwessCity(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.5,
    thickness: 0.105,
    wallColor: palette.stone,
    baseColor: palette.trim,
    trimColor: palette.trim,
    trimY: 0.48,
    bandY: 0.27,
  });
  addWallCrenelations(parts, 0.5, 0.105, palette.stone, palette.trim, "flat");
  addPerimeterPilasters(parts, 0.58, 0.16, palette.stone, palette.trim, true);
  addProwessCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.44, CITY_BANNER_Z, CITY_BANNER_X, CITY_BANNER_WIDTH);
  addProwessCrossHall(parts, palette);
}

function buildLuminaryCity(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.46,
    thickness: 0.1,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.accent,
    trimY: 0.45,
    bandY: 0.14,
  });
  addWallArcades(parts, palette.stoneShade, palette.accent);
  addPerimeterPilasters(parts, 0.53, 0.15, palette.stone, palette.accent, false);
  for (const [x, z] of HEX_PERIMETER_POINTS) {
    parts.masonry.push(
      piece(new SphereGeometry(0.068, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), palette.roof, x, 0.56, z),
    );
  }
  addLuminaryCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.41, CITY_BANNER_Z, CITY_BANNER_X, CITY_BANNER_WIDTH);
  addLuminaryCrossVault(parts, palette);
}

function buildHavocCity(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.52,
    thickness: 0.115,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.accent,
    trimY: 0.49,
    bandY: 0.25,
  });
  addWallCrenelations(parts, 0.52, 0.115, palette.stoneShade, palette.stone, "jagged");
  addWallStuds(parts, 0.36, 0.115, palette.trim);
  for (const [x, z] of HEX_PERIMETER_POINTS) {
    parts.masonry.push(
      piece(cutStoneBlock(0.17, 0.6, 0.17), palette.stone, x, 0.3, z),
      piece(cutStoneBlock(0.19, 0.055, 0.19), palette.stoneShade, x, 0.6, z),
      piece(new ConeGeometry(0.082, 0.16, 4), palette.stoneShade, x, 0.69, z, Math.PI / 4),
    );
  }
  addHavocCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.43, 0.685, CITY_BANNER_X, CITY_BANNER_WIDTH);
  addHavocCityHall(parts, palette);
}

function buildInsightCity(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.48,
    thickness: 0.105,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.trim,
    trimY: 0.46,
    bandY: 0.23,
  });
  for (const { from, to } of HEX_WALL_SEGMENTS) {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    parts.masonry.push(
      piece(
        cutStoneBlock(0.116, 0.028, length + 0.02),
        palette.accent,
        (from[0] + to[0]) / 2,
        0.37,
        (from[1] + to[1]) / 2,
        yaw,
      ),
    );
  }
  addPerimeterPilasters(parts, 0.55, 0.15, palette.trim, palette.accent, false);
  addInsightCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.42, CITY_BANNER_Z, CITY_BANNER_X, CITY_BANNER_WIDTH);
  addInsightObservatory(parts, palette);
}

function addWallCrenelations(
  parts: KitParts,
  wallHeight: number,
  thickness: number,
  merlonColor: string,
  capColor: string,
  style: "flat" | "jagged",
): void {
  for (const { from, to } of HEX_WALL_SEGMENTS) {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const count = Math.max(2, Math.round(length / 0.18));
    for (let index = 0; index < count; index++) {
      const t = (index + 0.5) / count;
      const mx = from[0] + dx * t;
      const mz = from[1] + dz * t;
      if (style === "flat") {
        parts.masonry.push(
          piece(cutStoneBlock(thickness + 0.015, 0.085, 0.095), merlonColor, mx, wallHeight + 0.045, mz, yaw),
          piece(cutStoneBlock(thickness + 0.025, 0.032, 0.105), capColor, mx, wallHeight + 0.095, mz, yaw),
        );
      } else {
        parts.masonry.push(
          piece(cutStoneBlock(thickness + 0.01, 0.08, 0.085), merlonColor, mx, wallHeight + 0.04, mz, yaw),
          piece(new ConeGeometry(0.056, 0.11, 4), capColor, mx, wallHeight + 0.125, mz, yaw + Math.PI / 4),
        );
      }
    }
  }
}

function addWallStuds(parts: KitParts, y: number, thickness: number, studColor: string): void {
  for (const { from, to } of HEX_WALL_SEGMENTS) {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const nx = dz / length;
    const nz = -dx / length;
    const sign = (from[0] + to[0]) * nx + (from[1] + to[1]) * nz >= 0 ? 1 : -1;
    const outX = nx * sign * (thickness / 2 + 0.016);
    const outZ = nz * sign * (thickness / 2 + 0.016);
    const count = Math.max(2, Math.round(length / 0.2));
    for (let index = 0; index < count; index++) {
      const t = (index + 0.5) / count;
      parts.masonry.push(
        piece(
          new OctahedronGeometry(0.032, 0).scale(0.85, 1.3, 0.7),
          studColor,
          from[0] + dx * t + outX,
          y,
          from[1] + dz * t + outZ,
        ),
      );
    }
  }
}

function addWallArcades(parts: KitParts, recessColor: string, archColor: string): void {
  for (const { from, to } of HEX_WALL_SEGMENTS) {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const cx = (from[0] + to[0]) / 2;
    const cz = (from[1] + to[1]) / 2;
    const nx = dz / length;
    const nz = -dx / length;
    const sign = cx * nx + cz * nz >= 0 ? 1 : -1;
    const out = 0.052;
    const archRadius = Math.min(0.14, length * 0.32);
    parts.masonry.push(
      piece(
        new TorusGeometry(archRadius, 0.024, 5, 12, Math.PI).rotateY(Math.PI / 2),
        archColor,
        cx + nx * sign * out,
        0.24,
        cz + nz * sign * out,
        yaw,
      ),
      piece(
        cutStoneBlock(0.03, 0.22, archRadius * 1.65),
        recessColor,
        cx + nx * sign * (out - 0.012),
        0.13,
        cz + nz * sign * (out - 0.012),
        yaw,
      ),
    );
  }
}

function addProwessCityGate(parts: KitParts, palette: AspectKitPalette): void {
  for (const side of [-1, 1]) {
    parts.masonry.push(
      piece(cutStoneBlock(0.15, 0.62, 0.16), palette.stone, side * 0.21, 0.31, 0.63),
      piece(cutStoneBlock(0.17, 0.05, 0.18), palette.trim, side * 0.21, 0.62, 0.63),
      piece(cutStoneBlock(0.165, 0.04, 0.175), palette.trim, side * 0.21, 0.32, 0.63),
      piece(cutStoneBlock(0.075, 0.095, 0.075), palette.stoneShade, side * 0.21, 0.24, 0.71),
    );
    parts.glow.push(
      piece(new OctahedronGeometry(0.038, 0).scale(0.85, 1.3, 0.85), palette.gem, side * 0.21, 0.25, 0.73),
    );
  }
  parts.masonry.push(
    piece(cutStoneBlock(0.5, 0.15, 0.16), palette.stone, 0, 0.54, 0.63),
    piece(extrudedGable(0.42, 0.22, 0.14), palette.stone, 0, 0.6, 0.63),
    piece(cutStoneBlock(0.28, 0.38, 0.06), palette.timber, 0, 0.19, 0.63),
    piece(cutStoneBlock(0.28, 0.035, 0.08), palette.stoneShade, 0, 0.14, 0.635),
    piece(cutStoneBlock(0.28, 0.035, 0.08), palette.stoneShade, 0, 0.28, 0.635),
    piece(cutStoneBlock(0.028, 0.37, 0.08), palette.stoneShade, 0, 0.19, 0.635),
  );
  for (const side of [-1, 1]) {
    const start = new Vector3(side * 0.22, 0.59, 0.67);
    const tip = new Vector3(0, 0.82, 0.67);
    parts.masonry.push(piece(beamBetween(start, tip, 0.044), palette.trim));
  }
  parts.glow.push(piece(new OctahedronGeometry(0.072, 0).scale(0.88, 1.38, 0.72), palette.gem, 0, 0.61, 0.71));
}

function addProwessCrossHall(parts: KitParts, palette: AspectKitPalette): void {
  const centerZ = -0.04;
  for (const yaw of [0, Math.PI / 2]) {
    addProwessCrossWing(parts, palette, centerZ, yaw);
  }
  parts.masonry.push(
    piece(cutStoneBlock(0.14, 0.12, 0.14), palette.trim, 0, 1.24, centerZ),
    piece(new ConeGeometry(0.055, 0.14, 4), palette.trim, 0, 1.34, centerZ, Math.PI / 4),
  );
}

function addProwessCrossWing(parts: KitParts, palette: AspectKitPalette, centerZ: number, yaw: number): void {
  const width = 0.44;
  const depth = 0.84;
  const wallHeight = 0.68;
  const roofHeight = 0.5;
  const overhangX = width / 2 + 0.055;
  const overhangZ = depth + 0.08;
  const slopeLength = Math.hypot(overhangX, roofHeight + 0.03);
  const slopeAngle = Math.atan2(roofHeight + 0.03, overhangX);
  const ridgeY = wallHeight + roofHeight + 0.025;

  const place = (geometry: BufferGeometry, color: string, lx: number, ly: number, lz: number, target: KitPart[]) => {
    geometry.translate(lx, ly, lz).rotateY(yaw).translate(0, 0, centerZ);
    target.push({ geometry, color });
  };

  place(cutStoneBlock(width, wallHeight, depth), palette.stone, 0, wallHeight / 2, 0, parts.masonry);
  place(cutStoneBlock(width + 0.04, 0.09, depth + 0.04), palette.trim, 0, 0.045, 0, parts.masonry);
  place(cutStoneBlock(width + 0.035, 0.045, depth + 0.035), palette.trim, 0, wallHeight - 0.02, 0, parts.masonry);
  place(extrudedGable(width, roofHeight, depth - 0.02), palette.stone, 0, wallHeight, 0, parts.masonry);
  place(cutStoneBlock(0.082, 0.07, overhangZ + 0.06), palette.trim, 0, ridgeY, 0, parts.masonry);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      place(
        cutStoneBlock(0.068, wallHeight + 0.02, 0.068),
        palette.trim,
        sx * (width / 2 - 0.01),
        (wallHeight + 0.02) / 2,
        sz * (depth / 2 - 0.01),
        parts.masonry,
      );
    }
    const slope = new BoxGeometry(slopeLength, 0.058, overhangZ).rotateZ(-sx * slopeAngle);
    place(slope, palette.roof, (sx * overhangX) / 2, wallHeight + (roofHeight + 0.03) / 2 - 0.01, 0, parts.masonry);
    for (const end of [-1, 1]) {
      const barge = new BoxGeometry(slopeLength + 0.03, 0.05, 0.055).rotateZ(-sx * slopeAngle);
      place(
        barge,
        palette.trim,
        (sx * overhangX) / 2,
        wallHeight + (roofHeight + 0.03) / 2 + 0.012,
        end * (overhangZ / 2 - 0.018),
        parts.masonry,
      );
    }
  }

  for (const end of [-1, 1]) {
    const start = new Vector3(0, ridgeY - 0.01, end * (overhangZ / 2 - 0.08));
    const tip = new Vector3(0, ridgeY + 0.16, end * (overhangZ / 2 + 0.06));
    place(beamBetween(start, tip, 0.068), palette.trim, 0, 0, 0, parts.masonry);
    place(
      new OctahedronGeometry(0.052, 0).scale(0.88, 1.35, 0.72),
      palette.gem,
      0,
      wallHeight + roofHeight * 0.44,
      end * (depth / 2 + 0.032),
      parts.glow,
    );
    for (const wx of [-0.095, 0.095]) {
      place(
        cutStoneBlock(0.065, 0.095, 0.035),
        palette.gem,
        wx,
        wallHeight * 0.76,
        end * (depth / 2 + 0.018),
        parts.glow,
      );
    }
  }
}

function addLuminaryCityGate(parts: KitParts, palette: AspectKitPalette): void {
  for (const side of [-1, 1]) {
    parts.masonry.push(
      piece(cutStoneBlock(0.14, 0.52, 0.16), palette.stone, side * 0.2, 0.26, 0.63),
      piece(cutStoneBlock(0.16, 0.05, 0.18), palette.accent, side * 0.2, 0.52, 0.63),
    );
  }
  parts.masonry.push(
    piece(new TorusGeometry(0.2, 0.062, 6, 14, Math.PI), palette.stone, 0, 0.44, 0.63),
    piece(new TorusGeometry(0.225, 0.025, 5, 14, Math.PI), palette.accent, 0, 0.44, 0.66),
    piece(new TorusGeometry(0.085, 0.022, 5, 14), palette.trim, 0, 0.68, 0.66),
  );
  parts.glow.push(piece(new IcosahedronGeometry(0.064, 1), palette.gem, 0, 0.68, 0.66));
}

function addLuminaryCrossVault(parts: KitParts, palette: AspectKitPalette): void {
  const centerZ = -0.04;
  const wallHeight = 0.76;
  const vaultRadius = 0.34;
  const vaultLength = 0.86;

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * 0.26;
      const pz = centerZ + sz * 0.26;
      parts.masonry.push(
        piece(cutStoneBlock(0.18, wallHeight, 0.18), palette.stone, px, wallHeight / 2, pz),
        piece(cutStoneBlock(0.21, 0.08, 0.21), palette.stoneShade, px, 0.04, pz),
        piece(cutStoneBlock(0.21, 0.05, 0.21), palette.accent, px, wallHeight, pz),
      );
    }
  }

  for (const yaw of [0, Math.PI / 2]) {
    const place = (geometry: BufferGeometry, color: string, lx: number, ly: number, lz: number, target: KitPart[]) => {
      geometry.translate(lx, ly, lz).rotateY(yaw).translate(0, 0, centerZ);
      target.push({ geometry, color });
    };

    const vault = new CylinderGeometry(vaultRadius, vaultRadius, vaultLength, 12, 1, false, 0, Math.PI)
      .rotateZ(Math.PI / 2)
      .rotateY(Math.PI / 2);
    place(vault, palette.roof, 0, wallHeight + 0.01, 0, parts.masonry);

    for (let rib = 0; rib < 5; rib++) {
      const rz = -vaultLength / 2 + (rib / 4) * vaultLength;
      const isFace = rib === 0 || rib === 4;
      place(
        new TorusGeometry(vaultRadius + (isFace ? 0.02 : 0.014), isFace ? 0.036 : 0.022, 6, 14, Math.PI),
        isFace ? palette.stone : palette.accent,
        0,
        wallHeight + 0.01,
        rz,
        parts.masonry,
      );
    }

    for (const end of [-1, 1]) {
      const faceZ = end * (vaultLength / 2 - 0.02);
      for (const side of [-1, 1]) {
        place(
          new CylinderGeometry(0.052, 0.058, wallHeight, 8),
          palette.stone,
          side * 0.34,
          wallHeight / 2,
          faceZ,
          parts.masonry,
        );
        place(cutStoneBlock(0.12, 0.045, 0.12), palette.accent, side * 0.34, wallHeight, faceZ, parts.masonry);
      }
      place(cutStoneBlock(0.62, 0.14, 0.07), palette.stone, 0, wallHeight - 0.06, faceZ - end * 0.02, parts.masonry);
      place(
        new TorusGeometry(0.128, 0.024, 5, 14),
        palette.accent,
        0,
        wallHeight + vaultRadius * 0.44,
        faceZ + end * 0.025,
        parts.masonry,
      );
      place(
        new IcosahedronGeometry(0.105, 1),
        palette.gem,
        0,
        wallHeight + vaultRadius * 0.44,
        faceZ + end * 0.025,
        parts.glow,
      );
    }
  }

  const crownY = wallHeight + vaultRadius + 0.06;
  parts.masonry.push(
    piece(new CylinderGeometry(0.16, 0.19, 0.12, 8), palette.stone, 0, crownY, centerZ),
    piece(new TorusGeometry(0.12, 0.024, 5, 14).rotateX(Math.PI / 2), palette.accent, 0, crownY + 0.07, centerZ),
  );
  parts.glow.push(piece(new IcosahedronGeometry(0.085, 1), palette.gem, 0, crownY + 0.09, centerZ));
}

function addHavocCityGate(parts: KitParts, palette: AspectKitPalette): void {
  for (const side of [-1, 1]) {
    parts.masonry.push(
      piece(cutStoneBlock(0.16, 0.6, 0.17), palette.stone, side * 0.21, 0.3, 0.63),
      piece(new ConeGeometry(0.072, 0.15, 4), palette.stoneShade, side * 0.21, 0.66, 0.63, Math.PI / 4),
      piece(new OctahedronGeometry(0.036, 0).scale(0.8, 1.35, 0.7), palette.trim, side * 0.21, 0.42, 0.72),
    );
  }
  parts.masonry.push(
    piece(cutStoneBlock(0.52, 0.15, 0.17), palette.stoneShade, 0, 0.53, 0.63),
    piece(cutStoneBlock(0.28, 0.36, 0.06), palette.timber, 0, 0.18, 0.62),
    piece(new ConeGeometry(0.075, 0.16, 4), palette.stone, 0, 0.68, 0.63, Math.PI / 4),
  );
  parts.glow.push(piece(new OctahedronGeometry(0.065, 0).scale(0.75, 1.55, 0.75), palette.gem, 0, 0.44, 0.72));
}

function addHavocCityHall(parts: KitParts, palette: AspectKitPalette): void {
  addPitchedHut(parts, {
    x: 0,
    z: -0.08,
    width: 0.62,
    depth: 0.66,
    wallHeight: 0.64,
    roofHeight: 0.54,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    postColor: palette.timber,
    roofColor: palette.roof,
    trimColor: palette.timber,
    doorColor: palette.stoneShade,
    glowColor: palette.gem,
    windowGlow: false,
    finial: "horns",
  });
  for (let spike = -2; spike <= 2; spike++) {
    parts.masonry.push(
      piece(new ConeGeometry(0.038, 0.11, 4), palette.stoneShade, 0, 1.24, -0.08 + spike * 0.13, Math.PI / 4),
    );
  }
  for (const side of [-1, 1]) {
    parts.masonry.push(
      piece(cutStoneBlock(0.11, 0.52, 0.11), palette.stoneShade, side * 0.34, 0.26, 0.12),
      piece(new ConeGeometry(0.06, 0.12, 4), palette.stoneShade, side * 0.34, 0.57, 0.12, Math.PI / 4),
    );
    parts.glow.push(
      piece(new OctahedronGeometry(0.045, 0).scale(0.78, 1.4, 0.78), palette.gem, side * 0.34, 0.38, 0.19),
    );
  }
  parts.masonry.push(
    piece(new CylinderGeometry(0.12, 0.15, 0.44, 6), palette.stone, 0, 0.22, 0.33),
    piece(new CylinderGeometry(0.15, 0.12, 0.08, 6), palette.stoneShade, 0, 0.47, 0.33),
  );
  parts.glow.push(
    piece(new OctahedronGeometry(0.09, 0).scale(0.8, 1.6, 0.8), palette.gem, 0, 0.62, 0.33),
    piece(new OctahedronGeometry(0.052, 0).scale(0.85, 1.3, 0.85).rotateZ(0.32), palette.gem, -0.055, 0.56, 0.35),
    piece(new OctahedronGeometry(0.052, 0).scale(0.85, 1.3, 0.85).rotateZ(-0.3), palette.gem, 0.055, 0.56, 0.31),
  );
}

function addInsightCityGate(parts: KitParts, palette: AspectKitPalette): void {
  for (const side of [-1, 1]) {
    parts.masonry.push(
      piece(cutStoneBlock(0.14, 0.56, 0.16), palette.stone, side * 0.2, 0.28, 0.63),
      piece(cutStoneBlock(0.06, 0.56, 0.175), palette.trim, side * 0.22, 0.28, 0.63),
      piece(cutStoneBlock(0.16, 0.05, 0.18), palette.trim, side * 0.2, 0.56, 0.63),
    );
  }
  parts.masonry.push(
    piece(cutStoneBlock(0.5, 0.12, 0.16), palette.stone, 0, 0.52, 0.63),
    piece(cutStoneBlock(0.52, 0.05, 0.18), palette.trim, 0, 0.59, 0.63),
    piece(cutStoneBlock(0.24, 0.34, 0.06), palette.timber, 0, 0.17, 0.62),
    piece(new TorusGeometry(0.17, 0.036, 5, 12, Math.PI), palette.trim, 0, 0.36, 0.66),
    piece(cutStoneBlock(0.12, 0.06, 0.07), palette.accent, 0, 0.55, 0.68),
  );
}

function addInsightObservatory(parts: KitParts, palette: AspectKitPalette): void {
  const centerZ = -0.04;
  const drumRadius = 0.41;
  const drumHeight = 0.78;
  const sides = 8;

  for (let index = 0; index < sides; index++) {
    const a0 = (index / sides) * Math.PI * 2 + Math.PI / sides;
    const a1 = ((index + 1) / sides) * Math.PI * 2 + Math.PI / sides;
    const x0 = Math.sin(a0) * drumRadius;
    const z0 = centerZ + Math.cos(a0) * drumRadius;
    const x1 = Math.sin(a1) * drumRadius;
    const z1 = centerZ + Math.cos(a1) * drumRadius;
    const dx = x1 - x0;
    const dz = z1 - z0;
    const segLen = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const midAngle = (a0 + a1) / 2;
    const outX = Math.sin(midAngle);
    const outZ = Math.cos(midAngle);

    parts.masonry.push(
      piece(cutStoneBlock(0.09, drumHeight, segLen + 0.03), palette.stone, mx, drumHeight / 2, mz, yaw),
      piece(cutStoneBlock(0.11, 0.08, segLen + 0.03), palette.stoneShade, mx, 0.04, mz, yaw),
      piece(cutStoneBlock(0.115, 0.045, segLen + 0.035), palette.accent, mx, drumHeight - 0.02, mz, yaw),
      piece(cutStoneBlock(0.08, drumHeight + 0.02, 0.08), palette.trim, x0, (drumHeight + 0.02) / 2, z0, a0),
      piece(cutStoneBlock(0.09, 0.21, 0.035), palette.accent, mx + outX * 0.038, 0.58, mz + outZ * 0.038, midAngle),
    );
    parts.glow.push(
      piece(cutStoneBlock(0.056, 0.16, 0.032), palette.gem, mx + outX * 0.048, 0.58, mz + outZ * 0.048, midAngle),
    );
  }

  parts.masonry.push(
    piece(new SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), palette.roof, 0, drumHeight, centerZ),
    piece(new TorusGeometry(0.425, 0.03, 6, 16).rotateX(Math.PI / 2), palette.trim, 0, drumHeight + 0.01, centerZ),
    piece(new CylinderGeometry(0.14, 0.17, 0.07, 8), palette.accent, 0, drumHeight + 0.42, centerZ),
    piece(new TorusGeometry(0.11, 0.022, 5, 14).rotateX(Math.PI / 2), palette.trim, 0, drumHeight + 0.46, centerZ),
  );
  for (let rib = 0; rib < 4; rib++) {
    parts.masonry.push(
      piece(
        new TorusGeometry(0.425, 0.022, 5, 14, Math.PI),
        rib % 2 === 0 ? palette.stone : palette.accent,
        0,
        drumHeight,
        centerZ,
        (rib * Math.PI) / 4,
      ),
    );
  }
  parts.glow.push(
    piece(new OctahedronGeometry(0.055, 0).scale(0.85, 1.35, 0.85), palette.gem, 0, drumHeight + 0.51, centerZ),
  );

  const gyroY = drumHeight + 0.1;
  const gyroZ = centerZ + 0.44;
  parts.masonry.push(
    piece(new TorusGeometry(0.14, 0.022, 6, 16), palette.accent, 0, gyroY, gyroZ),
    piece(new TorusGeometry(0.125, 0.018, 5, 16).rotateY(Math.PI / 3).rotateX(0.35), palette.stone, 0, gyroY, gyroZ),
    piece(new TorusGeometry(0.115, 0.016, 5, 16).rotateY(-Math.PI / 3).rotateX(-0.3), palette.accent, 0, gyroY, gyroZ),
  );
  parts.glow.push(piece(new OctahedronGeometry(0.075, 0).scale(0.82, 1.35, 0.82), palette.gem, 0, gyroY, gyroZ));
}

function addHexCurtainWall(
  parts: KitParts,
  options: {
    height: number;
    thickness: number;
    wallColor: string;
    baseColor: string;
    trimColor: string;
    trimY: number;
    bandY: number;
  },
): void {
  for (const { from, to } of HEX_WALL_SEGMENTS) {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const cx = (from[0] + to[0]) / 2;
    const cz = (from[1] + to[1]) / 2;
    parts.masonry.push(
      piece(
        cutStoneBlock(options.thickness, options.height, length + 0.03),
        options.wallColor,
        cx,
        options.height / 2,
        cz,
        yaw,
      ),
      piece(cutStoneBlock(options.thickness + 0.025, 0.08, length + 0.03), options.baseColor, cx, 0.04, cz, yaw),
      piece(
        cutStoneBlock(options.thickness + 0.022, 0.045, length + 0.03),
        options.trimColor,
        cx,
        options.trimY,
        cz,
        yaw,
      ),
      piece(
        cutStoneBlock(options.thickness + 0.014, 0.038, length + 0.02),
        options.trimColor,
        cx,
        options.bandY,
        cz,
        yaw,
      ),
    );
  }
}

function addPerimeterPilasters(
  parts: KitParts,
  height: number,
  width: number,
  bodyColor: string,
  capColor: string,
  banded: boolean,
): void {
  for (const [x, z] of HEX_PERIMETER_POINTS) {
    parts.masonry.push(
      piece(cutStoneBlock(width, height, width), bodyColor, x, height / 2, z),
      piece(cutStoneBlock(width + 0.03, 0.055, width + 0.03), capColor, x, height + 0.02, z),
    );
    if (banded) {
      parts.masonry.push(piece(cutStoneBlock(width + 0.02, 0.035, width + 0.02), capColor, x, height * 0.5, z));
    }
  }
}

function addSpikedPalisade(parts: KitParts, palette: AspectKitPalette): void {
  for (const { from, to } of HEX_WALL_SEGMENTS) {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const cx = (from[0] + to[0]) / 2;
    const cz = (from[1] + to[1]) / 2;
    parts.masonry.push(
      piece(cutStoneBlock(0.1, 0.16, length + 0.03), palette.stone, cx, 0.08, cz, yaw),
      piece(cutStoneBlock(0.085, 0.045, length + 0.02), palette.accent, cx, 0.25, cz, yaw),
    );
    const posts = Math.max(3, Math.round(length / 0.11));
    for (let index = 0; index < posts; index++) {
      const t = (index + 0.5) / posts;
      const px = from[0] + dx * t;
      const pz = from[1] + dz * t;
      const tall = index % 2 === 0;
      const postHeight = tall ? 0.38 : 0.31;
      parts.masonry.push(
        piece(
          cutStoneBlock(0.075, postHeight, 0.075),
          tall ? palette.timber : palette.stone,
          px,
          postHeight / 2,
          pz,
          yaw,
        ),
        piece(
          new ConeGeometry(0.046, tall ? 0.13 : 0.09, 4),
          tall ? palette.timber : palette.stoneShade,
          px,
          postHeight + (tall ? 0.06 : 0.04),
          pz,
          yaw + Math.PI / 4,
        ),
      );
    }
  }
  for (const [x, z] of HEX_PERIMETER_POINTS) {
    parts.masonry.push(
      piece(cutStoneBlock(0.13, 0.42, 0.13), palette.stone, x, 0.21, z),
      piece(new ConeGeometry(0.075, 0.14, 4), palette.stoneShade, x, 0.48, z, Math.PI / 4),
    );
  }
}

function addClosedBastionGate(parts: KitParts, palette: AspectKitPalette): void {
  for (const side of [-1, 1]) {
    parts.masonry.push(
      piece(cutStoneBlock(0.13, 0.46, 0.14), palette.stone, side * 0.19, 0.23, 0.62),
      piece(cutStoneBlock(0.15, 0.05, 0.16), palette.trim, side * 0.19, 0.46, 0.62),
    );
  }
  parts.masonry.push(
    piece(cutStoneBlock(0.46, 0.11, 0.14), palette.stone, 0, 0.43, 0.62),
    piece(cutStoneBlock(0.49, 0.04, 0.16), palette.trim, 0, 0.49, 0.62),
    piece(cutStoneBlock(0.28, 0.34, 0.06), palette.timber, 0, 0.17, 0.62),
    piece(cutStoneBlock(0.28, 0.035, 0.075), palette.stoneShade, 0, 0.14, 0.625),
    piece(cutStoneBlock(0.28, 0.035, 0.075), palette.stoneShade, 0, 0.26, 0.625),
    piece(cutStoneBlock(0.025, 0.33, 0.075), palette.stoneShade, 0, 0.17, 0.625),
  );
}

function addOpenTimberGate(parts: KitParts, palette: AspectKitPalette): void {
  for (const side of [-1, 1]) {
    parts.masonry.push(
      piece(cutStoneBlock(0.12, 0.14, 0.13), palette.stone, side * 0.2, 0.07, 0.62),
      piece(cutStoneBlock(0.095, 0.42, 0.1), palette.timber, side * 0.2, 0.27, 0.62),
      piece(new ConeGeometry(0.06, 0.12, 4), palette.timber, side * 0.2, 0.53, 0.62, Math.PI / 4),
    );
  }
  parts.masonry.push(
    piece(cutStoneBlock(0.54, 0.09, 0.11), palette.timber, 0, 0.42, 0.62),
    piece(cutStoneBlock(0.12, 0.12, 0.12), palette.stoneShade, 0, 0.45, 0.63),
    piece(new OctahedronGeometry(0.045, 0).scale(0.85, 1.3, 0.65), palette.trim, 0, 0.46, 0.68),
  );
}

function addArchedGatehouse(
  parts: KitParts,
  stoneColor: string,
  trimColor: string,
  gemColor: string,
  crest: "orb" | "astrolabe",
): void {
  for (const side of [-1, 1]) {
    parts.masonry.push(
      piece(cutStoneBlock(0.12, 0.4, 0.14), stoneColor, side * 0.19, 0.2, 0.62),
      piece(cutStoneBlock(0.14, 0.045, 0.16), trimColor, side * 0.19, 0.39, 0.62),
    );
  }
  parts.masonry.push(
    piece(new TorusGeometry(0.19, 0.055, 6, 12, Math.PI), stoneColor, 0, 0.35, 0.62),
    piece(new TorusGeometry(0.21, 0.022, 5, 12, Math.PI), trimColor, 0, 0.35, 0.65),
  );
  if (crest === "orb") {
    parts.masonry.push(piece(new TorusGeometry(0.075, 0.02, 5, 12), trimColor, 0, 0.56, 0.65));
    parts.glow.push(piece(new IcosahedronGeometry(0.055, 1), gemColor, 0, 0.56, 0.65));
  } else {
    addAstrolabeMedallion(parts, 0, 0.56, 0.655, 0.095, trimColor, brandPalette.brand["mark-gold"], gemColor);
  }
}

function addWallBannerRails(
  parts: KitParts,
  railColor: string,
  y: number,
  bannerZ = SETTLEMENT_BANNER_Z,
  bannerX = SETTLEMENT_BANNER_X,
  bannerWidth = SETTLEMENT_BANNER_WIDTH,
): void {
  const railLength = bannerWidth + 0.045;
  const finialOffset = railLength / 2 + 0.003;
  for (const side of [-1, 1]) {
    const x = side * bannerX;
    parts.masonry.push(
      piece(
        new CylinderGeometry(0.013, 0.013, railLength, 6).rotateZ(Math.PI / 2),
        railColor,
        x,
        y + 0.01,
        bannerZ + 0.015,
      ),
      piece(new SphereGeometry(0.02, 6, 5), railColor, x - finialOffset, y + 0.01, bannerZ + 0.015),
      piece(new SphereGeometry(0.02, 6, 5), railColor, x + finialOffset, y + 0.01, bannerZ + 0.015),
    );
    parts.anchors.push({
      top: [x, y, bannerZ + 0.032],
      width: bannerWidth,
      facing: 0,
    });
  }
}

function addPitchedHut(
  parts: KitParts,
  options: {
    x: number;
    z: number;
    width: number;
    depth: number;
    wallHeight: number;
    roofHeight: number;
    wallColor: string;
    baseColor: string;
    postColor: string;
    roofColor: string;
    trimColor: string;
    doorColor: string;
    glowColor: string;
    windowGlow: boolean;
    finial: "spear" | "horns" | "oculus";
    oculusRingColor?: string;
  },
): void {
  const { x, z, width, depth, wallHeight, roofHeight } = options;
  parts.masonry.push(
    piece(cutStoneBlock(width, wallHeight, depth), options.wallColor, x, wallHeight / 2, z),
    piece(cutStoneBlock(width + 0.03, 0.09, depth + 0.03), options.baseColor, x, 0.045, z),
    piece(cutStoneBlock(0.11, 0.2, 0.04), options.doorColor, x, 0.1, z + depth / 2 + 0.008),
  );
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.masonry.push(
        piece(
          cutStoneBlock(0.055, wallHeight + 0.02, 0.055),
          options.postColor,
          x + sx * (width / 2 - 0.01),
          (wallHeight + 0.02) / 2,
          z + sz * (depth / 2 - 0.01),
        ),
      );
    }
  }
  const gable = extrudedGable(width, roofHeight, depth - 0.02);
  parts.masonry.push(piece(gable, options.wallColor, x, wallHeight, z));

  const overhangX = width / 2 + 0.055;
  const overhangZ = depth + 0.08;
  const slopeLength = Math.hypot(overhangX, roofHeight + 0.03);
  const slopeAngle = Math.atan2(roofHeight + 0.03, overhangX);
  for (const side of [-1, 1]) {
    const slope = new BoxGeometry(slopeLength, 0.055, overhangZ);
    slope.rotateZ(-side * slopeAngle);
    parts.masonry.push(
      piece(slope, options.roofColor, x + (side * overhangX) / 2, wallHeight + (roofHeight + 0.03) / 2 - 0.01, z),
    );
    const barge = new BoxGeometry(slopeLength + 0.02, 0.045, 0.05);
    barge.rotateZ(-side * slopeAngle);
    parts.masonry.push(
      piece(
        barge,
        options.trimColor,
        x + (side * overhangX) / 2,
        wallHeight + (roofHeight + 0.03) / 2 + 0.01,
        z + overhangZ / 2 - 0.015,
      ),
    );
  }
  const ridgeY = wallHeight + roofHeight + 0.025;
  parts.masonry.push(piece(cutStoneBlock(0.075, 0.065, overhangZ + 0.02), options.trimColor, x, ridgeY, z));

  if (options.windowGlow) {
    parts.glow.push(
      piece(cutStoneBlock(0.085, 0.085, 0.03), options.glowColor, x, wallHeight * 0.72, z + depth / 2 + 0.015),
    );
  }
  if (options.finial === "spear") {
    parts.masonry.push(
      piece(
        new ConeGeometry(0.032, 0.12, 4),
        options.trimColor,
        x,
        ridgeY + 0.075,
        z + overhangZ / 2 - 0.04,
        Math.PI / 4,
      ),
    );
  } else if (options.finial === "horns") {
    for (const endZ of [z + overhangZ / 2 - 0.02, z - overhangZ / 2 + 0.02]) {
      for (const side of [-1, 1]) {
        const foot = new Vector3(x + side * 0.05, ridgeY - 0.03, endZ);
        const tip = new Vector3(x - side * 0.09, ridgeY + 0.14, endZ);
        parts.masonry.push(piece(beamBetween(foot, tip, 0.038), options.postColor));
      }
    }
  } else if (options.finial === "oculus") {
    addAstrolabeMedallion(
      parts,
      x,
      wallHeight + roofHeight * 0.42,
      z + depth / 2 + 0.025,
      0.068,
      options.oculusRingColor ?? options.trimColor,
      options.trimColor,
      options.glowColor,
    );
  }
}

function addVaultedSanctuaryHut(
  parts: KitParts,
  options: {
    x: number;
    z: number;
    width: number;
    depth: number;
    wallHeight: number;
    vaultRadius: number;
    palette: AspectKitPalette;
    hasLanternTop: boolean;
  },
): void {
  const { x, z, width, depth, wallHeight, vaultRadius, palette } = options;
  parts.masonry.push(
    piece(cutStoneBlock(width, wallHeight, depth), palette.stone, x, wallHeight / 2, z),
    piece(cutStoneBlock(width + 0.03, 0.08, depth + 0.03), palette.stoneShade, x, 0.04, z),
    piece(cutStoneBlock(width + 0.035, 0.045, depth + 0.035), palette.trim, x, wallHeight, z),
    piece(cutStoneBlock(0.1, 0.19, 0.04), palette.accent, x, 0.095, z + depth / 2 + 0.008),
  );
  const vault = new CylinderGeometry(vaultRadius, vaultRadius, depth + 0.04, 10, 1, false, 0, Math.PI)
    .rotateZ(Math.PI / 2)
    .rotateY(Math.PI / 2);
  parts.masonry.push(piece(vault, palette.roof, x, wallHeight + 0.01, z));

  for (let rib = 0; rib < 4; rib++) {
    const rz = z - depth / 2 + (rib / 3) * depth;
    const arch = new TorusGeometry(vaultRadius + 0.012, 0.022, 5, 12, Math.PI);
    parts.masonry.push(piece(arch, rib === 0 || rib === 3 ? palette.stone : palette.trim, x, wallHeight + 0.01, rz));
  }

  parts.masonry.push(
    piece(
      new TorusGeometry(0.072, 0.018, 5, 12),
      palette.trim,
      x,
      wallHeight + vaultRadius * 0.48,
      z + depth / 2 + 0.025,
    ),
  );
  parts.glow.push(
    piece(new IcosahedronGeometry(0.056, 1), palette.gem, x, wallHeight + vaultRadius * 0.48, z + depth / 2 + 0.025),
  );

  if (options.hasLanternTop) {
    const lanternY = wallHeight + vaultRadius + 0.055;
    parts.masonry.push(
      piece(cutStoneBlock(0.14, 0.12, 0.16), palette.stone, x, lanternY, z - 0.02),
      piece(cutStoneBlock(0.17, 0.04, 0.19), palette.trim, x, lanternY + 0.075, z - 0.02),
    );
  }
}

function addCrystalBrazier(parts: KitParts, x: number, z: number, palette: AspectKitPalette): void {
  parts.masonry.push(
    piece(new CylinderGeometry(0.08, 0.1, 0.11, 6), palette.stone, x, 0.055, z),
    piece(new CylinderGeometry(0.105, 0.082, 0.06, 6), palette.stoneShade, x, 0.135, z),
  );
  parts.glow.push(
    piece(new OctahedronGeometry(0.065, 0).scale(0.82, 1.55, 0.82), palette.gem, x, 0.23, z),
    piece(new OctahedronGeometry(0.04, 0).scale(0.85, 1.25, 0.85).rotateZ(0.3), palette.gem, x - 0.035, 0.19, z + 0.02),
    piece(
      new OctahedronGeometry(0.04, 0).scale(0.85, 1.25, 0.85).rotateZ(-0.28),
      palette.gem,
      x + 0.035,
      0.19,
      z - 0.015,
    ),
  );
}

function addAstrolabeMedallion(
  parts: KitParts,
  x: number,
  y: number,
  z: number,
  radius: number,
  ringColor: string,
  brassColor: string,
  gemColor: string,
): void {
  parts.masonry.push(
    piece(new TorusGeometry(radius, radius * 0.22, 5, 14), ringColor, x, y, z),
    piece(new TorusGeometry(radius * 0.72, radius * 0.12, 5, 12), brassColor, x, y, z + 0.008),
  );
  parts.glow.push(piece(new OctahedronGeometry(radius * 0.56, 0).scale(0.75, 1.25, 0.75), gemColor, x, y, z + 0.01));
}

function extrudedGable(width: number, height: number, depth: number): BufferGeometry {
  const half = width / 2;
  const shape = new Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(0, height);
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 }).translate(0, 0, -depth / 2);
}

function cutStoneBlock(width: number, height: number, depth: number): BufferGeometry {
  const bevel = Math.min(width, height, depth) * 0.12;
  const x = width / 2 - bevel;
  const y = height / 2 - bevel;
  const outline = new Shape();
  outline.moveTo(-x, -y);
  outline.lineTo(x, -y);
  outline.lineTo(x, y);
  outline.lineTo(-x, y);
  outline.closePath();
  return new ExtrudeGeometry(outline, {
    depth: depth - 2 * bevel,
    steps: 1,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
    curveSegments: 1,
  }).translate(0, 0, -depth / 2 + bevel);
}

function beamBetween(start: Vector3, end: Vector3, width: number): BufferGeometry {
  const direction = end.clone().sub(start);
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize());
  const center = start.clone().add(end).multiplyScalar(0.5);
  return new BoxGeometry(width, direction.length(), width)
    .applyQuaternion(rotation)
    .translate(center.x, center.y, center.z);
}

function piece(geometry: BufferGeometry, color: string, x = 0, y = 0, z = 0, yaw = 0): KitPart {
  geometry.rotateY(yaw).translate(x, y, z);
  return { geometry, color };
}

function combineParts(parts: KitPart[]): BufferGeometry {
  const geometries = parts.map(({ geometry, color }, partIndex) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (!flat.getAttribute("normal")) flat.computeVertexNormals();
    const positions = flat.getAttribute("position");
    if (!flat.getAttribute("uv")) {
      flat.setAttribute("uv", new Float32BufferAttribute(new Float32Array(positions.count * 2), 2));
    }
    const tint = new Color(color);
    tint.offsetHSL(0, 0, Math.sin(partIndex * 17.13) * 0.02);
    const normal = flat.getAttribute("normal");
    const faceTint = new Color();
    const colors = new Float32Array(positions.count * 3);
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const wear = Math.max(0, normal.getY(vertex)) * 0.04;
      faceTint
        .copy(tint)
        .offsetHSL(0, 0, wear)
        .toArray(colors, vertex * 3);
    }
    flat.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return flat;
  });
  const merged = mergeGeometries(geometries)!;
  for (const geometry of new Set([...geometries, ...parts.map((part) => part.geometry)])) geometry.dispose();
  const indexed = mergeVertices(merged, 1e-6);
  merged.dispose();
  indexed.computeBoundingBox();
  indexed.computeBoundingSphere();
  return indexed;
}

function createMasonryMaterial(): MeshStandardMaterial {
  const grain = sharedStoneGrain();
  return new MeshStandardMaterial({
    vertexColors: true,
    map: grain,
    bumpMap: grain,
    roughnessMap: grain,
    bumpScale: 0.005,
    roughness: 0.78,
    metalness: 0.16,
    flatShading: true,
  });
}

function createGlowMaterial(palette: AspectKitPalette): MeshStandardMaterial {
  return new MeshStandardMaterial({
    vertexColors: true,
    emissive: palette.emissive,
    emissiveIntensity: palette.emissiveIntensity,
    roughness: 0.22,
    metalness: 0.2,
    flatShading: true,
  });
}

function sharedStoneGrain(): DataTexture {
  if (cachedStoneGrain) return cachedStoneGrain;
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const hash = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
      const grain = ((hash ^ (hash >>> 13)) >>> 0) % 35;
      const value = 212 + grain;
      const offset = (y * size + x) * 4;
      data.set([value, value, value, 255], offset);
    }
  const texture = new DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.userData.eternumContentHash = "season-1-realm-kit-stone-grain-v1";
  texture.needsUpdate = true;
  cachedStoneGrain = texture;
  return texture;
}
