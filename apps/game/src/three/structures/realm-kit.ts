import brandPalette from "@/brand/palette.json";
import { aspectName, aspects, RealmLevels, type AspectId } from "@bibliothecadao/types";
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

export const SEASON_ONE_REALM_KIT_LEVELS: readonly RealmLevels[] = Object.values(RealmLevels).filter(
  (level): level is RealmLevels => typeof level === "number",
);

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
  2: {
    1: buildProwessKingdom,
    2: buildLuminaryKingdom,
    3: buildHavocKingdom,
    4: buildInsightKingdom,
  },
  3: {
    1: buildProwessEmpire,
    2: buildLuminaryEmpire,
    3: buildHavocEmpire,
    4: buildInsightEmpire,
  },
} as const satisfies Record<RealmLevels, Record<AspectId, AspectKitBuilder>>;

const SETTLEMENT_BANNER_X = 0.41;
const SETTLEMENT_BANNER_Y = 0.31;
const SETTLEMENT_BANNER_Z = 0.655;
const SETTLEMENT_BANNER_WIDTH = 0.125;

const CITY_BANNER_X = 0.44;
const CITY_BANNER_Z = 0.675;
const CITY_BANNER_WIDTH = 0.13;

const KINGDOM_BANNER_X = 0.45;
const KINGDOM_BANNER_Z = 0.68;
const KINGDOM_BANNER_WIDTH = 0.135;

const EMPIRE_BANNER_X = 0.46;
const EMPIRE_BANNER_Z = 0.68;
const EMPIRE_BANNER_WIDTH = 0.14;

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

function isCatalogRealmLevel(level: number): level is RealmLevels {
  return SEASON_ONE_REALM_KIT_LEVELS.some((rank) => rank === level);
}

export function seasonOneRealmKitPath(aspect: AspectId, level: RealmLevels): string {
  return `${SEASON_ONE_KIT_PREFIX}${aspect}:${level}`;
}

export function isSeasonOneRealmKitPath(path: string): boolean {
  return parseSeasonOneRealmKitPath(path) !== null;
}

export function parseSeasonOneRealmKitPath(path: string): { aspect: AspectId; level: RealmLevels } | null {
  if (!path.startsWith(SEASON_ONE_KIT_PREFIX)) return null;
  const [aspectText, levelText, extra] = path.slice(SEASON_ONE_KIT_PREFIX.length).split(":");
  if (extra !== undefined || !aspectText || !levelText) return null;
  const aspectId = Number(aspectText);
  const level = Number(levelText);
  const validAspect = aspects.some(({ id }) => id === aspectId);
  if (!validAspect || !isCatalogRealmLevel(level)) return null;
  return { aspect: aspectId as AspectId, level };
}

export function createSeasonOneRealmKit(aspect: AspectId, level: RealmLevels): GLTF {
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
    height: 0.33,
    thickness: 0.09,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.trim,
    trimY: 0.3,
    bandY: 0.16,
  });
  addPerimeterPilasters(parts, 0.38, 0.13, palette.timber, palette.trim, true);
  addClosedBastionGate(parts, palette);
  addWallBannerRails(parts, palette.rail, SETTLEMENT_BANNER_Y);

  addPitchedHut(parts, {
    x: -0.28,
    z: -0.09,
    width: 0.48,
    depth: 0.62,
    wallHeight: 0.36,
    roofHeight: 0.27,
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
    x: 0.29,
    z: -0.04,
    width: 0.44,
    depth: 0.56,
    wallHeight: 0.33,
    roofHeight: 0.25,
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
    parts.masonry.push(piece(cutStoneBlock(0.08, 0.1, 0.08), palette.stoneShade, side * 0.25, 0.22, 0.67));
    parts.glow.push(
      piece(new OctahedronGeometry(0.042, 0).scale(0.85, 1.25, 0.85), palette.gem, side * 0.25, 0.23, 0.69),
    );
  }
  parts.glow.push(piece(new OctahedronGeometry(0.052, 0).scale(0.9, 1.35, 0.7), palette.gem, 0, 0.43, 0.66));
}

function buildLuminarySettlement(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.33,
    thickness: 0.095,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.trim,
    trimY: 0.31,
    bandY: 0.12,
  });
  addPerimeterPilasters(parts, 0.38, 0.135, palette.stone, palette.trim, false);
  addArchedGatehouse(parts, palette.stone, palette.trim, palette.gem, "orb");
  addWallBannerRails(parts, palette.rail, SETTLEMENT_BANNER_Y);

  addVaultedSanctuaryHut(parts, {
    x: -0.28,
    z: -0.09,
    width: 0.48,
    depth: 0.6,
    wallHeight: 0.35,
    vaultRadius: 0.24,
    palette,
    hasLanternTop: true,
  });
  addVaultedSanctuaryHut(parts, {
    x: 0.29,
    z: -0.04,
    width: 0.44,
    depth: 0.54,
    wallHeight: 0.32,
    vaultRadius: 0.22,
    palette,
    hasLanternTop: true,
  });
}

function buildHavocSettlement(parts: KitParts, palette: AspectKitPalette): void {
  addSpikedPalisade(parts, palette);
  addOpenTimberGate(parts, palette);
  addWallBannerRails(parts, palette.rail, SETTLEMENT_BANNER_Y);

  addPitchedHut(parts, {
    x: -0.29,
    z: -0.13,
    width: 0.48,
    depth: 0.58,
    wallHeight: 0.34,
    roofHeight: 0.27,
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
    x: 0.29,
    z: -0.07,
    width: 0.44,
    depth: 0.54,
    wallHeight: 0.32,
    roofHeight: 0.25,
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

  addCrystalBrazier(parts, -0.28, 0.27, palette);
  addCrystalBrazier(parts, 0.28, 0.27, palette);
  for (const side of [-1, 1]) {
    parts.masonry.push(
      piece(cutStoneBlock(0.11, 0.14, 0.04), palette.stoneShade, side * 0.56, 0.2, 0.66),
      piece(new OctahedronGeometry(0.036, 0).scale(0.8, 1.3, 0.5), palette.trim, side * 0.56, 0.2, 0.68),
    );
  }
}

function buildInsightSettlement(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.33,
    thickness: 0.095,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.trim,
    trimY: 0.3,
    bandY: 0.16,
  });
  addPerimeterPilasters(parts, 0.38, 0.13, palette.stone, palette.trim, false);
  addArchedGatehouse(parts, palette.stone, palette.trim, palette.gem, "astrolabe");
  addWallBannerRails(parts, palette.rail, SETTLEMENT_BANNER_Y);

  addPitchedHut(parts, {
    x: -0.28,
    z: -0.09,
    width: 0.48,
    depth: 0.6,
    wallHeight: 0.35,
    roofHeight: 0.28,
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
    x: 0.29,
    z: -0.05,
    width: 0.44,
    depth: 0.54,
    wallHeight: 0.32,
    roofHeight: 0.25,
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
    height: 0.46,
    thickness: 0.105,
    wallColor: palette.stone,
    baseColor: palette.trim,
    trimColor: palette.trim,
    trimY: 0.44,
    bandY: 0.24,
  });
  addWallCrenelations(parts, 0.46, 0.105, palette.stone, palette.trim, "flat");
  addPerimeterPilasters(parts, 0.53, 0.16, palette.stone, palette.trim, true);
  addProwessCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.41, CITY_BANNER_Z, CITY_BANNER_X, CITY_BANNER_WIDTH);
  addProwessCrossHall(parts, palette);
}

function buildLuminaryCity(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.44,
    thickness: 0.1,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.accent,
    trimY: 0.42,
    bandY: 0.14,
  });
  addWallArcades(parts, palette.stoneShade, palette.accent);
  addPerimeterPilasters(parts, 0.5, 0.15, palette.stone, palette.accent, false);
  for (const [x, z] of HEX_PERIMETER_POINTS) {
    parts.masonry.push(
      piece(new SphereGeometry(0.068, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), palette.roof, x, 0.53, z),
    );
  }
  addLuminaryCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.39, CITY_BANNER_Z, CITY_BANNER_X, CITY_BANNER_WIDTH);
  addLuminaryCrossVault(parts, palette);
}

function buildHavocCity(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.47,
    thickness: 0.115,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.accent,
    trimY: 0.44,
    bandY: 0.23,
  });
  addWallCrenelations(parts, 0.47, 0.115, palette.stoneShade, palette.stone, "jagged");
  addWallStuds(parts, 0.33, 0.115, palette.trim);
  for (const [x, z] of HEX_PERIMETER_POINTS) {
    parts.masonry.push(
      piece(cutStoneBlock(0.17, 0.54, 0.17), palette.stone, x, 0.27, z),
      piece(cutStoneBlock(0.19, 0.055, 0.19), palette.stoneShade, x, 0.54, z),
      piece(new ConeGeometry(0.08, 0.14, 4), palette.stoneShade, x, 0.62, z, Math.PI / 4),
    );
  }
  addHavocCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.4, 0.685, CITY_BANNER_X, CITY_BANNER_WIDTH);
  addHavocCityHall(parts, palette);
}

function buildInsightCity(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.44,
    thickness: 0.105,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.trim,
    trimY: 0.42,
    bandY: 0.21,
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
        0.34,
        (from[1] + to[1]) / 2,
        yaw,
      ),
    );
  }
  addPerimeterPilasters(parts, 0.5, 0.15, palette.trim, palette.accent, false);
  addInsightCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.39, CITY_BANNER_Z, CITY_BANNER_X, CITY_BANNER_WIDTH);
  addInsightObservatory(parts, palette);
}

function buildProwessKingdom(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.54,
    thickness: 0.11,
    wallColor: palette.stone,
    baseColor: palette.trim,
    trimColor: palette.trim,
    trimY: 0.52,
    bandY: 0.28,
  });
  addWallCrenelations(parts, 0.54, 0.11, palette.stone, palette.trim, "flat");
  addPerimeterPilasters(parts, 0.62, 0.16, palette.stone, palette.trim, true);
  addProwessCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.45, KINGDOM_BANNER_Z, KINGDOM_BANNER_X, KINGDOM_BANNER_WIDTH);
  addProwessTwinTowers(parts, palette);
}

function buildLuminaryKingdom(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.52,
    thickness: 0.105,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.accent,
    trimY: 0.5,
    bandY: 0.15,
  });
  addWallArcades(parts, palette.stoneShade, palette.accent);
  addPerimeterPilasters(parts, 0.58, 0.155, palette.stone, palette.accent, false);
  addLuminaryCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.43, KINGDOM_BANNER_Z, KINGDOM_BANNER_X, KINGDOM_BANNER_WIDTH);
  addLuminaryTwinTowers(parts, palette);
}

function buildHavocKingdom(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.55,
    thickness: 0.115,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.accent,
    trimY: 0.52,
    bandY: 0.27,
  });
  addWallCrenelations(parts, 0.55, 0.115, palette.stoneShade, palette.stone, "jagged");
  addWallStuds(parts, 0.37, 0.115, palette.trim);
  for (const [x, z] of HEX_PERIMETER_POINTS) {
    parts.masonry.push(
      piece(cutStoneBlock(0.17, 0.63, 0.17), palette.stone, x, 0.315, z),
      piece(cutStoneBlock(0.19, 0.055, 0.19), palette.stoneShade, x, 0.63, z),
      piece(new ConeGeometry(0.082, 0.16, 4), palette.stoneShade, x, 0.72, z, Math.PI / 4),
    );
  }
  addHavocCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.44, 0.69, KINGDOM_BANNER_X, KINGDOM_BANNER_WIDTH);
  addHavocTwinTowers(parts, palette);
}

function buildInsightKingdom(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.52,
    thickness: 0.105,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.trim,
    trimY: 0.5,
    bandY: 0.25,
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
        0.39,
        (from[1] + to[1]) / 2,
        yaw,
      ),
    );
  }
  addPerimeterPilasters(parts, 0.58, 0.15, palette.trim, palette.accent, false);
  addInsightCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.43, KINGDOM_BANNER_Z, KINGDOM_BANNER_X, KINGDOM_BANNER_WIDTH);
  addInsightTwinTowers(parts, palette);
}

function buildProwessEmpire(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.56,
    thickness: 0.115,
    wallColor: palette.stone,
    baseColor: palette.trim,
    trimColor: palette.trim,
    trimY: 0.54,
    bandY: 0.29,
  });
  addWallCrenelations(parts, 0.56, 0.115, palette.stone, palette.trim, "flat");
  addPerimeterPilasters(parts, 0.64, 0.165, palette.stone, palette.trim, true);
  addProwessCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.46, EMPIRE_BANNER_Z, EMPIRE_BANNER_X, EMPIRE_BANNER_WIDTH);
  addProwessEmpireSpire(parts, palette);
}

function buildLuminaryEmpire(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.54,
    thickness: 0.11,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.accent,
    trimY: 0.52,
    bandY: 0.16,
  });
  addWallArcades(parts, palette.stoneShade, palette.accent);
  addPerimeterPilasters(parts, 0.6, 0.16, palette.stone, palette.accent, false);
  addLuminaryCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.44, EMPIRE_BANNER_Z, EMPIRE_BANNER_X, EMPIRE_BANNER_WIDTH);
  addLuminaryEmpireSpire(parts, palette);
}

function buildHavocEmpire(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.58,
    thickness: 0.12,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.accent,
    trimY: 0.55,
    bandY: 0.28,
  });
  addWallCrenelations(parts, 0.58, 0.12, palette.stoneShade, palette.stone, "jagged");
  addWallStuds(parts, 0.39, 0.12, palette.trim);
  for (const [x, z] of HEX_PERIMETER_POINTS) {
    parts.masonry.push(
      piece(cutStoneBlock(0.18, 0.68, 0.18), palette.stone, x, 0.34, z),
      piece(cutStoneBlock(0.2, 0.055, 0.2), palette.stoneShade, x, 0.68, z),
      piece(new ConeGeometry(0.088, 0.18, 4), palette.stoneShade, x, 0.78, z, Math.PI / 4),
    );
  }
  addHavocCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.45, 0.69, EMPIRE_BANNER_X, EMPIRE_BANNER_WIDTH);
  addHavocEmpireSpire(parts, palette);
}

function buildInsightEmpire(parts: KitParts, palette: AspectKitPalette): void {
  addHexCurtainWall(parts, {
    height: 0.54,
    thickness: 0.11,
    wallColor: palette.stone,
    baseColor: palette.stoneShade,
    trimColor: palette.trim,
    trimY: 0.52,
    bandY: 0.26,
  });
  for (const { from, to } of HEX_WALL_SEGMENTS) {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    parts.masonry.push(
      piece(
        cutStoneBlock(0.122, 0.03, length + 0.02),
        palette.accent,
        (from[0] + to[0]) / 2,
        0.4,
        (from[1] + to[1]) / 2,
        yaw,
      ),
    );
  }
  addPerimeterPilasters(parts, 0.6, 0.155, palette.trim, palette.accent, false);
  addInsightCityGate(parts, palette);
  addWallBannerRails(parts, palette.rail, 0.44, EMPIRE_BANNER_Z, EMPIRE_BANNER_X, EMPIRE_BANNER_WIDTH);
  addInsightEmpireSpire(parts, palette);
}

const EMPIRE_TURRET_SLOTS: readonly (readonly [number, number, number])[] = [
  [-0.54, -0.24, 1.02],
  [0.54, -0.24, 1.02],
  [-0.38, 0.28, 0.94],
  [0.38, 0.28, 0.94],
];

function addProwessEmpireSpire(parts: KitParts, palette: AspectKitPalette): void {
  const cz = -0.08;
  const shaftHeight = 1.94;
  parts.masonry.push(
    piece(new CylinderGeometry(0.25, 0.35, shaftHeight, 8), palette.stone, 0, shaftHeight / 2, cz),
    piece(new CylinderGeometry(0.37, 0.39, 0.1, 8), palette.trim, 0, 0.05, cz),
    piece(new CylinderGeometry(0.34, 0.35, 0.055, 8), palette.trim, 0, 0.68, cz),
    piece(new CylinderGeometry(0.31, 0.32, 0.055, 8), palette.trim, 0, 1.28, cz),
    piece(new CylinderGeometry(0.32, 0.27, 0.16, 8), palette.trim, 0, shaftHeight + 0.04, cz),
    piece(new ConeGeometry(0.29, 0.72, 8), palette.roof, 0, shaftHeight + 0.46, cz),
    piece(new CylinderGeometry(0.06, 0.09, 0.07, 8), palette.trim, 0, shaftHeight + 0.82, cz),
  );
  for (let rib = 0; rib < 8; rib++) {
    const angle = (rib / 8) * Math.PI * 2 + Math.PI / 8;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    parts.masonry.push(
      piece(
        beamBetween(
          new Vector3(sin * 0.35, 0.06, cz + cos * 0.35),
          new Vector3(sin * 0.26, shaftHeight, cz + cos * 0.26),
          0.042,
        ),
        palette.trim,
      ),
      piece(
        beamBetween(
          new Vector3(sin * 0.28, shaftHeight + 0.12, cz + cos * 0.28),
          new Vector3(0, shaftHeight + 0.82, cz),
          0.032,
        ),
        palette.trim,
      ),
      piece(
        new ConeGeometry(0.052, 0.26, 4),
        palette.trim,
        sin * 0.31,
        shaftHeight + 0.23,
        cz + cos * 0.31,
        angle + Math.PI / 4,
      ),
    );
  }
  parts.glow.push(
    piece(new OctahedronGeometry(0.115, 0).scale(0.84, 1.48, 0.84), palette.gem, 0, shaftHeight + 0.96, cz),
    piece(new OctahedronGeometry(0.068, 0).scale(0.88, 1.35, 0.72), palette.gem, 0, 1.02, cz + 0.33),
  );

  for (const [tx, tz, height] of EMPIRE_TURRET_SLOTS) {
    parts.masonry.push(
      piece(new CylinderGeometry(0.145, 0.165, height, 8), palette.stone, tx, height / 2, tz),
      piece(new CylinderGeometry(0.175, 0.18, 0.06, 8), palette.trim, tx, 0.03, tz),
      piece(new CylinderGeometry(0.17, 0.17, 0.05, 8), palette.trim, tx, height, tz),
      piece(new ConeGeometry(0.165, 0.38, 8), palette.roof, tx, height + 0.21, tz),
    );
    for (let rib = 0; rib < 4; rib++) {
      const a = (rib / 4) * Math.PI * 2;
      parts.masonry.push(
        piece(
          beamBetween(
            new Vector3(tx + Math.sin(a) * 0.16, height + 0.02, tz + Math.cos(a) * 0.16),
            new Vector3(tx, height + 0.4, tz),
            0.024,
          ),
          palette.trim,
        ),
      );
    }
    parts.glow.push(
      piece(new OctahedronGeometry(0.042, 0).scale(0.85, 1.35, 0.85), palette.gem, tx, height + 0.45, tz),
    );
  }
}

function addLuminaryEmpireSpire(parts: KitParts, palette: AspectKitPalette): void {
  const cz = -0.08;
  const shaftHeight = 1.98;
  parts.masonry.push(
    piece(new CylinderGeometry(0.24, 0.32, shaftHeight, 8), palette.stone, 0, shaftHeight / 2, cz),
    piece(new CylinderGeometry(0.35, 0.38, 0.09, 8), palette.stoneShade, 0, 0.045, cz),
    piece(new CylinderGeometry(0.33, 0.34, 0.055, 8), palette.accent, 0, 0.72, cz),
    piece(new CylinderGeometry(0.3, 0.31, 0.055, 8), palette.accent, 0, 1.36, cz),
    piece(new CylinderGeometry(0.29, 0.27, 0.07, 8), palette.accent, 0, shaftHeight, cz),
    piece(new ConeGeometry(0.27, 0.46, 8), palette.roof, 0, shaftHeight + 0.26, cz),
    piece(new TorusGeometry(0.26, 0.042, 6, 18), palette.stone, 0, shaftHeight + 0.68, cz),
    piece(new TorusGeometry(0.275, 0.018, 5, 18), palette.accent, 0, shaftHeight + 0.68, cz),
  );
  for (let fin = 0; fin < 4; fin++) {
    const angle = (fin / 4) * Math.PI * 2 + Math.PI / 4;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    parts.masonry.push(
      piece(
        beamBetween(
          new Vector3(sin * 0.48, 0.05, cz + cos * 0.48),
          new Vector3(sin * 0.28, 0.96, cz + cos * 0.28),
          0.085,
        ),
        palette.stone,
      ),
    );
    parts.glow.push(
      piece(cutStoneBlock(0.055, 0.24, 0.032), palette.gem, sin * 0.28, 1.56, cz + cos * 0.28, angle),
      piece(cutStoneBlock(0.055, 0.24, 0.032), palette.gem, sin * 0.31, 1.02, cz + cos * 0.31, angle),
    );
  }
  parts.glow.push(piece(new IcosahedronGeometry(0.145, 2), palette.gem, 0, shaftHeight + 0.68, cz));

  for (const [tx, tz, height] of EMPIRE_TURRET_SLOTS) {
    parts.masonry.push(
      piece(cutStoneBlock(0.25, height + 0.14, 0.25), palette.stone, tx, (height + 0.14) / 2, tz),
      piece(cutStoneBlock(0.28, 0.06, 0.28), palette.stoneShade, tx, 0.03, tz),
      piece(cutStoneBlock(0.29, 0.05, 0.29), palette.accent, tx, height + 0.14, tz),
      piece(new ConeGeometry(0.18, 0.38, 4), palette.roof, tx, height + 0.35, tz, Math.PI / 4),
    );
    parts.glow.push(
      piece(new IcosahedronGeometry(0.04, 1), palette.gem, tx, height + 0.56, tz),
      piece(cutStoneBlock(0.055, 0.16, 0.028), palette.gem, tx, height - 0.06, tz + 0.13),
    );
  }
}

function addHavocEmpireSpire(parts: KitParts, palette: AspectKitPalette): void {
  const cz = -0.08;
  const shaftHeight = 2.08;
  parts.masonry.push(
    piece(new CylinderGeometry(0.2, 0.35, shaftHeight, 6), palette.stone, 0, shaftHeight / 2, cz),
    piece(new CylinderGeometry(0.38, 0.42, 0.12, 6), palette.stoneShade, 0, 0.06, cz),
    piece(new CylinderGeometry(0.32, 0.35, 0.07, 6), palette.accent, 0, 0.78, cz),
    piece(new CylinderGeometry(0.26, 0.28, 0.065, 6), palette.accent, 0, 1.48, cz),
    piece(new CylinderGeometry(0.26, 0.21, 0.18, 6), palette.stoneShade, 0, shaftHeight + 0.04, cz),
  );
  for (let side = 0; side < 4; side++) {
    const angle = (side / 4) * Math.PI * 2 + Math.PI / 4;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    parts.masonry.push(
      piece(
        beamBetween(new Vector3(sin * 0.48, 0.06, cz + cos * 0.48), new Vector3(sin * 0.3, 0.92, cz + cos * 0.3), 0.1),
        palette.stoneShade,
      ),
      piece(
        beamBetween(
          new Vector3(sin * 0.22, shaftHeight - 0.04, cz + cos * 0.22),
          new Vector3(sin * 0.34, shaftHeight + 0.46, cz + cos * 0.34),
          0.095,
        ),
        palette.stone,
      ),
      piece(
        beamBetween(
          new Vector3(sin * 0.34, shaftHeight + 0.44, cz + cos * 0.34),
          new Vector3(sin * 0.17, shaftHeight + 0.92, cz + cos * 0.17),
          0.072,
        ),
        palette.stoneShade,
      ),
      piece(new OctahedronGeometry(0.052, 0).scale(0.8, 1.4, 0.7), palette.trim, sin * 0.33, 1.16, cz + cos * 0.33),
    );
    parts.glow.push(
      piece(new OctahedronGeometry(0.095, 0).scale(0.75, 2.0, 0.75), palette.gem, sin * 0.34, 0.96, cz + cos * 0.34),
      piece(
        new OctahedronGeometry(0.058, 0).scale(0.8, 1.4, 0.8),
        palette.gem,
        sin * 0.22,
        shaftHeight + 0.22,
        cz + cos * 0.22,
      ),
    );
  }
  parts.glow.push(
    piece(new OctahedronGeometry(0.155, 0).scale(0.75, 2.35, 0.75), palette.gem, 0, shaftHeight + 0.56, cz),
  );

  for (const [tx, tz, height] of EMPIRE_TURRET_SLOTS) {
    parts.masonry.push(
      piece(cutStoneBlock(0.28, height, 0.28), palette.stone, tx, height / 2, tz),
      piece(cutStoneBlock(0.32, 0.065, 0.32), palette.stoneShade, tx, height, tz),
      piece(new ConeGeometry(0.085, 0.24, 4), palette.stoneShade, tx, height + 0.15, tz, Math.PI / 4),
      piece(new OctahedronGeometry(0.045, 0).scale(0.8, 1.4, 0.7), palette.trim, tx, height * 0.65, tz + 0.15),
    );
  }
}

function addInsightEmpireSpire(parts: KitParts, palette: AspectKitPalette): void {
  const cz = -0.08;
  const shaftHeight = 1.96;
  parts.masonry.push(
    piece(new CylinderGeometry(0.25, 0.34, shaftHeight, 8), palette.stone, 0, shaftHeight / 2, cz),
    piece(new CylinderGeometry(0.37, 0.39, 0.09, 8), palette.stoneShade, 0, 0.045, cz),
    piece(new CylinderGeometry(0.34, 0.35, 0.05, 8), palette.accent, 0, 0.7, cz),
    piece(new CylinderGeometry(0.31, 0.32, 0.05, 8), palette.accent, 0, 1.34, cz),
    piece(new CylinderGeometry(0.32, 0.26, 0.14, 8), palette.trim, 0, shaftHeight + 0.05, cz),
    piece(new TorusGeometry(0.33, 0.028, 6, 18).rotateX(Math.PI / 2), palette.accent, 0, shaftHeight + 0.14, cz),
    piece(new TorusGeometry(0.34, 0.03, 6, 18).rotateX(Math.PI / 2 + 0.22), palette.trim, 0, shaftHeight + 0.44, cz),
    piece(
      new TorusGeometry(0.27, 0.024, 6, 18).rotateY(Math.PI / 4).rotateX(0.32),
      palette.accent,
      0,
      shaftHeight + 0.62,
      cz,
    ),
    piece(
      new TorusGeometry(0.27, 0.024, 6, 18).rotateY(-Math.PI / 4).rotateX(-0.28),
      palette.accent,
      0,
      shaftHeight + 0.62,
      cz,
    ),
  );
  for (const side of [-1, 1]) {
    parts.masonry.push(
      piece(
        beamBetween(
          new Vector3(side * 0.25, shaftHeight + 0.08, cz),
          new Vector3(side * 0.34, shaftHeight + 0.56, cz),
          0.075,
        ),
        palette.stone,
      ),
      piece(
        beamBetween(
          new Vector3(side * 0.34, shaftHeight + 0.54, cz),
          new Vector3(side * 0.16, shaftHeight + 0.98, cz),
          0.062,
        ),
        palette.trim,
      ),
    );
  }
  for (let rib = 0; rib < 4; rib++) {
    const angle = (rib / 4) * Math.PI * 2 + Math.PI / 4;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    parts.masonry.push(
      piece(
        beamBetween(
          new Vector3(sin * 0.34, 0.06, cz + cos * 0.34),
          new Vector3(sin * 0.26, shaftHeight, cz + cos * 0.26),
          0.055,
        ),
        palette.trim,
      ),
    );
    parts.glow.push(
      piece(cutStoneBlock(0.06, 0.24, 0.032), palette.gem, sin * 0.29, 1.56, cz + cos * 0.29, angle),
      piece(cutStoneBlock(0.06, 0.24, 0.032), palette.gem, sin * 0.32, 1.02, cz + cos * 0.32, angle),
    );
  }
  parts.glow.push(
    piece(new OctahedronGeometry(0.155, 0).scale(0.84, 1.48, 0.84), palette.gem, 0, shaftHeight + 0.62, cz),
    piece(new OctahedronGeometry(0.072, 0).scale(0.84, 1.35, 0.84), palette.gem, 0, shaftHeight + 0.28, cz),
  );

  for (const [tx, tz, height] of EMPIRE_TURRET_SLOTS) {
    parts.masonry.push(
      piece(new CylinderGeometry(0.155, 0.17, height, 8), palette.stone, tx, height / 2, tz),
      piece(new CylinderGeometry(0.18, 0.185, 0.055, 8), palette.stoneShade, tx, 0.03, tz),
      piece(new TorusGeometry(0.165, 0.02, 5, 12).rotateX(Math.PI / 2), palette.accent, tx, height, tz),
      piece(new SphereGeometry(0.162, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), palette.roof, tx, height, tz),
    );
    for (let rib = 0; rib < 4; rib++) {
      parts.masonry.push(
        piece(
          new TorusGeometry(0.166, 0.013, 5, 10, Math.PI),
          rib % 2 === 0 ? palette.stone : palette.accent,
          tx,
          height,
          tz,
          (rib * Math.PI) / 4,
        ),
      );
    }
    parts.glow.push(piece(new OctahedronGeometry(0.038, 0).scale(0.85, 1.35, 0.85), palette.gem, tx, height + 0.2, tz));
  }
}

function addTwinTowerSkybridge(
  parts: KitParts,
  options: {
    z: number;
    bridgeY: number;
    span: number;
    depth: number;
    bodyColor: string;
    trimColor: string;
    archRadius: number;
    crenelated: boolean;
    roofColor?: string;
  },
): void {
  const { z, bridgeY, span, depth, bodyColor, trimColor, archRadius } = options;
  parts.masonry.push(
    piece(cutStoneBlock(span, 0.13, depth), bodyColor, 0, bridgeY + 0.11, z),
    piece(cutStoneBlock(span + 0.04, 0.04, depth + 0.04), trimColor, 0, bridgeY + 0.18, z),
    piece(new TorusGeometry(archRadius, 0.055, 6, 14, Math.PI), bodyColor, 0, bridgeY - 0.06, z),
    piece(new TorusGeometry(archRadius + 0.025, 0.022, 5, 14, Math.PI), trimColor, 0, bridgeY - 0.06, z + depth / 2),
    piece(new TorusGeometry(archRadius + 0.025, 0.022, 5, 14, Math.PI), trimColor, 0, bridgeY - 0.06, z - depth / 2),
  );
  if (options.crenelated) {
    for (const faceZ of [z + depth / 2 - 0.03, z - depth / 2 + 0.03]) {
      for (let slot = -1; slot <= 1; slot++) {
        parts.masonry.push(
          piece(cutStoneBlock(0.085, 0.08, 0.055), bodyColor, slot * 0.16, bridgeY + 0.23, faceZ),
          piece(cutStoneBlock(0.095, 0.028, 0.065), trimColor, slot * 0.16, bridgeY + 0.275, faceZ),
        );
      }
    }
  }
  if (options.roofColor) {
    const vault = new CylinderGeometry(depth * 0.56, depth * 0.56, span, 10, 1, false, 0, Math.PI)
      .rotateX(Math.PI / 2)
      .rotateZ(Math.PI / 2);
    parts.masonry.push(piece(vault, options.roofColor, 0, bridgeY + 0.18, z));
  }
}

function addProwessTwinTowers(parts: KitParts, palette: AspectKitPalette): void {
  const towerZ = -0.14;
  const shaftHeight = 1.44;
  const towerSize = 0.42;
  const gallerySize = 0.52;

  for (const side of [-1, 1]) {
    const tx = side * 0.42;
    parts.masonry.push(
      piece(cutStoneBlock(towerSize, shaftHeight, towerSize), palette.stone, tx, shaftHeight / 2, towerZ),
      piece(cutStoneBlock(towerSize + 0.05, 0.09, towerSize + 0.05), palette.trim, tx, 0.045, towerZ),
      piece(cutStoneBlock(towerSize + 0.04, 0.045, towerSize + 0.04), palette.trim, tx, 0.64, towerZ),
      piece(cutStoneBlock(towerSize + 0.04, 0.045, towerSize + 0.04), palette.trim, tx, 1.08, towerZ),
      piece(cutStoneBlock(gallerySize, 0.13, gallerySize), palette.stone, tx, shaftHeight + 0.04, towerZ),
      piece(cutStoneBlock(gallerySize + 0.03, 0.045, gallerySize + 0.03), palette.trim, tx, shaftHeight - 0.02, towerZ),
      piece(cutStoneBlock(gallerySize + 0.03, 0.04, gallerySize + 0.03), palette.trim, tx, shaftHeight + 0.11, towerZ),
      piece(new ConeGeometry(0.27, 0.44, 4), palette.roof, tx, shaftHeight + 0.34, towerZ, Math.PI / 4),
      piece(new CylinderGeometry(0.055, 0.075, 0.06, 6), palette.trim, tx, shaftHeight + 0.56, towerZ),
    );
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.masonry.push(
          piece(
            cutStoneBlock(0.07, shaftHeight + 0.02, 0.07),
            palette.trim,
            tx + sx * (towerSize / 2 - 0.01),
            (shaftHeight + 0.02) / 2,
            towerZ + sz * (towerSize / 2 - 0.01),
          ),
        );
        const cornerStart = new Vector3(tx + sx * 0.19, shaftHeight + 0.12, towerZ + sz * 0.19);
        const spireTip = new Vector3(tx, shaftHeight + 0.56, towerZ);
        parts.masonry.push(piece(beamBetween(cornerStart, spireTip, 0.036), palette.trim));
      }
    }
    for (const edge of [-1, 1]) {
      for (let m = -1; m <= 1; m++) {
        parts.masonry.push(
          piece(
            cutStoneBlock(0.09, 0.09, 0.075),
            palette.stone,
            tx + m * 0.18,
            shaftHeight + 0.16,
            towerZ + edge * (gallerySize / 2 - 0.03),
          ),
          piece(
            cutStoneBlock(0.1, 0.03, 0.085),
            palette.trim,
            tx + m * 0.18,
            shaftHeight + 0.21,
            towerZ + edge * (gallerySize / 2 - 0.03),
          ),
          piece(
            cutStoneBlock(0.075, 0.09, 0.09),
            palette.stone,
            tx + edge * (gallerySize / 2 - 0.03),
            shaftHeight + 0.16,
            towerZ + m * 0.18,
          ),
          piece(
            cutStoneBlock(0.085, 0.03, 0.1),
            palette.trim,
            tx + edge * (gallerySize / 2 - 0.03),
            shaftHeight + 0.21,
            towerZ + m * 0.18,
          ),
        );
      }
    }
    parts.glow.push(
      piece(new OctahedronGeometry(0.068, 0).scale(0.85, 1.4, 0.85), palette.gem, tx, shaftHeight + 0.65, towerZ),
      piece(cutStoneBlock(0.075, 0.13, 0.032), palette.gem, tx, 0.86, towerZ + towerSize / 2 + 0.012),
      piece(cutStoneBlock(0.075, 0.13, 0.032), palette.gem, tx, 1.24, towerZ + towerSize / 2 + 0.012),
    );
  }

  addTwinTowerSkybridge(parts, {
    z: towerZ,
    bridgeY: 1.14,
    span: 0.48,
    depth: 0.28,
    bodyColor: palette.stone,
    trimColor: palette.trim,
    archRadius: 0.2,
    crenelated: true,
  });
}

function addLuminaryTwinTowers(parts: KitParts, palette: AspectKitPalette): void {
  const towerZ = -0.14;
  const shaftHeight = 1.48;
  const towerSize = 0.4;

  for (const side of [-1, 1]) {
    const tx = side * 0.42;
    parts.masonry.push(
      piece(cutStoneBlock(towerSize, shaftHeight, towerSize), palette.stone, tx, shaftHeight / 2, towerZ),
      piece(cutStoneBlock(towerSize + 0.05, 0.08, towerSize + 0.05), palette.stoneShade, tx, 0.04, towerZ),
      piece(cutStoneBlock(towerSize + 0.055, 0.048, towerSize + 0.055), palette.accent, tx, 0.6, towerZ),
      piece(cutStoneBlock(towerSize + 0.06, 0.052, towerSize + 0.06), palette.accent, tx, 1.14, towerZ),
      piece(cutStoneBlock(towerSize + 0.07, 0.065, towerSize + 0.07), palette.accent, tx, shaftHeight + 0.01, towerZ),
      piece(new ConeGeometry(0.28, 0.46, 4), palette.roof, tx, shaftHeight + 0.27, towerZ, Math.PI / 4),
      piece(new TorusGeometry(0.07, 0.018, 5, 12), palette.trim, tx, shaftHeight + 0.55, towerZ),
    );
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const cornerStart = new Vector3(tx + sx * 0.19, shaftHeight + 0.04, towerZ + sz * 0.19);
        const spireTip = new Vector3(tx, shaftHeight + 0.5, towerZ);
        parts.masonry.push(piece(beamBetween(cornerStart, spireTip, 0.028), palette.stone));
      }
      parts.masonry.push(
        piece(
          new TorusGeometry(0.062, 0.018, 5, 10, Math.PI),
          palette.accent,
          tx + sx * 0.095,
          1.34,
          towerZ + towerSize / 2 + 0.012,
        ),
        piece(
          cutStoneBlock(0.09, 0.16, 0.028),
          palette.stoneShade,
          tx + sx * 0.095,
          1.26,
          towerZ + towerSize / 2 + 0.008,
        ),
      );
      parts.glow.push(
        piece(cutStoneBlock(0.055, 0.13, 0.026), palette.gem, tx + sx * 0.095, 1.28, towerZ + towerSize / 2 + 0.018),
      );
    }
    parts.glow.push(
      piece(new IcosahedronGeometry(0.052, 1), palette.gem, tx, shaftHeight + 0.55, towerZ),
      piece(cutStoneBlock(0.065, 0.16, 0.028), palette.gem, tx, 0.88, towerZ + towerSize / 2 + 0.012),
    );
  }

  addTwinTowerSkybridge(parts, {
    z: towerZ,
    bridgeY: 0.96,
    span: 0.48,
    depth: 0.28,
    bodyColor: palette.stone,
    trimColor: palette.accent,
    archRadius: 0.21,
    crenelated: false,
    roofColor: palette.roof,
  });
}

function addHavocTwinTowers(parts: KitParts, palette: AspectKitPalette): void {
  const towerZ = -0.14;
  const shaftHeight = 1.48;
  const towerSize = 0.42;
  const gallerySize = 0.52;

  for (const side of [-1, 1]) {
    const tx = side * 0.42;
    parts.masonry.push(
      piece(cutStoneBlock(towerSize, shaftHeight, towerSize), palette.stone, tx, shaftHeight / 2, towerZ),
      piece(cutStoneBlock(towerSize + 0.05, 0.09, towerSize + 0.05), palette.stoneShade, tx, 0.045, towerZ),
      piece(cutStoneBlock(towerSize + 0.045, 0.05, towerSize + 0.045), palette.accent, tx, 0.62, towerZ),
      piece(cutStoneBlock(towerSize + 0.045, 0.05, towerSize + 0.045), palette.accent, tx, 1.08, towerZ),
      piece(cutStoneBlock(gallerySize, 0.14, gallerySize), palette.stoneShade, tx, shaftHeight + 0.04, towerZ),
      piece(
        cutStoneBlock(gallerySize + 0.03, 0.045, gallerySize + 0.03),
        palette.accent,
        tx,
        shaftHeight - 0.02,
        towerZ,
      ),
      piece(
        new OctahedronGeometry(0.055, 0).scale(0.8, 1.45, 0.7),
        palette.trim,
        tx,
        0.86,
        towerZ + towerSize / 2 + 0.02,
      ),
      piece(
        new OctahedronGeometry(0.055, 0).scale(0.8, 1.45, 0.7),
        palette.trim,
        tx,
        1.26,
        towerZ + towerSize / 2 + 0.02,
      ),
    );
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const cx = tx + sx * (gallerySize / 2 - 0.03);
        const cz = towerZ + sz * (gallerySize / 2 - 0.03);
        parts.masonry.push(
          piece(cutStoneBlock(0.11, 0.15, 0.11), palette.stone, cx, shaftHeight + 0.18, cz),
          piece(new ConeGeometry(0.072, 0.24, 4), palette.stoneShade, cx, shaftHeight + 0.36, cz, Math.PI / 4),
        );
      }
    }
    parts.masonry.push(
      piece(new ConeGeometry(0.082, 0.34, 4), palette.stoneShade, tx, shaftHeight + 0.42, towerZ, Math.PI / 4),
    );
    parts.glow.push(
      piece(new OctahedronGeometry(0.088, 0).scale(0.85, 1.5, 0.85), palette.gem, tx, shaftHeight + 0.24, towerZ),
    );
  }

  addTwinTowerSkybridge(parts, {
    z: towerZ,
    bridgeY: 1.08,
    span: 0.48,
    depth: 0.28,
    bodyColor: palette.stoneShade,
    trimColor: palette.accent,
    archRadius: 0.2,
    crenelated: true,
  });
  for (let spike = -1; spike <= 1; spike++) {
    parts.masonry.push(
      piece(new ConeGeometry(0.048, 0.14, 4), palette.stone, spike * 0.14, 1.42, towerZ + 0.11, Math.PI / 4),
    );
  }

  parts.masonry.push(
    piece(new CylinderGeometry(0.12, 0.16, 0.34, 6), palette.stone, 0, 0.17, 0.24),
    piece(new CylinderGeometry(0.16, 0.12, 0.08, 6), palette.stoneShade, 0, 0.37, 0.24),
  );
  parts.glow.push(
    piece(new OctahedronGeometry(0.11, 0).scale(0.75, 2.2, 0.75), palette.gem, 0, 0.65, 0.24),
    piece(new OctahedronGeometry(0.055, 0).scale(0.8, 1.4, 0.8).rotateZ(0.28), palette.gem, -0.07, 0.5, 0.26),
    piece(new OctahedronGeometry(0.055, 0).scale(0.8, 1.4, 0.8).rotateZ(-0.28), palette.gem, 0.07, 0.5, 0.22),
  );
}

function addInsightTwinTowers(parts: KitParts, palette: AspectKitPalette): void {
  const towerZ = -0.14;
  const shaftHeight = 1.42;
  const towerSize = 0.4;

  for (const side of [-1, 1]) {
    const tx = side * 0.42;
    parts.masonry.push(
      piece(cutStoneBlock(towerSize, shaftHeight, towerSize), palette.stone, tx, shaftHeight / 2, towerZ),
      piece(cutStoneBlock(towerSize + 0.045, 0.08, towerSize + 0.045), palette.stoneShade, tx, 0.04, towerZ),
      piece(cutStoneBlock(towerSize + 0.045, 0.045, towerSize + 0.045), palette.accent, tx, 0.62, towerZ),
      piece(cutStoneBlock(towerSize + 0.05, 0.045, towerSize + 0.05), palette.accent, tx, 1.12, towerZ),
      piece(cutStoneBlock(towerSize + 0.055, 0.05, towerSize + 0.055), palette.trim, tx, shaftHeight, towerZ),
      piece(new CylinderGeometry(0.21, 0.22, 0.18, 8), palette.stone, tx, shaftHeight + 0.11, towerZ),
      piece(new TorusGeometry(0.225, 0.022, 5, 14).rotateX(Math.PI / 2), palette.accent, tx, shaftHeight + 0.2, towerZ),
      piece(
        new SphereGeometry(0.225, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
        palette.roof,
        tx,
        shaftHeight + 0.2,
        towerZ,
      ),
      piece(new CylinderGeometry(0.065, 0.085, 0.045, 8), palette.accent, tx, shaftHeight + 0.43, towerZ),
    );
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.masonry.push(
          piece(
            cutStoneBlock(0.075, shaftHeight + 0.02, 0.075),
            palette.trim,
            tx + sx * (towerSize / 2 - 0.005),
            (shaftHeight + 0.02) / 2,
            towerZ + sz * (towerSize / 2 - 0.005),
          ),
        );
      }
    }
    for (let rib = 0; rib < 4; rib++) {
      parts.masonry.push(
        piece(
          new TorusGeometry(0.228, 0.016, 5, 12, Math.PI),
          rib % 2 === 0 ? palette.stone : palette.accent,
          tx,
          shaftHeight + 0.2,
          towerZ,
          (rib * Math.PI) / 4,
        ),
      );
    }
    parts.glow.push(
      piece(new OctahedronGeometry(0.052, 0).scale(0.85, 1.35, 0.85), palette.gem, tx, shaftHeight + 0.51, towerZ),
      piece(cutStoneBlock(0.06, 0.15, 0.028), palette.gem, tx, 0.9, towerZ + towerSize / 2 + 0.012),
    );
  }

  addTwinTowerSkybridge(parts, {
    z: towerZ,
    bridgeY: 1.12,
    span: 0.48,
    depth: 0.26,
    bodyColor: palette.stone,
    trimColor: palette.trim,
    archRadius: 0.2,
    crenelated: false,
  });
  parts.masonry.push(
    piece(cutStoneBlock(0.46, 0.032, 0.032), palette.accent, 0, 1.38, towerZ + 0.11),
    piece(cutStoneBlock(0.46, 0.032, 0.032), palette.accent, 0, 1.38, towerZ - 0.11),
    piece(new TorusGeometry(0.19, 0.022, 6, 16).rotateX(Math.PI / 2), palette.stone, 0, 0.46, 0.14),
    piece(new TorusGeometry(0.16, 0.018, 5, 16).rotateY(Math.PI / 4).rotateX(0.42), palette.accent, 0, 0.84, 0.14),
    piece(new TorusGeometry(0.14, 0.016, 5, 16).rotateY(-Math.PI / 4).rotateX(-0.35), palette.accent, 0, 0.84, 0.14),
  );
  parts.glow.push(piece(new OctahedronGeometry(0.115, 0).scale(0.82, 1.45, 0.82), palette.gem, 0, 0.84, 0.14));
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
    piece(cutStoneBlock(0.16, 0.1, 0.16), palette.trim, 0, 0.99, centerZ),
    piece(new ConeGeometry(0.058, 0.13, 4), palette.trim, 0, 1.09, centerZ, Math.PI / 4),
  );
}

function addProwessCrossWing(parts: KitParts, palette: AspectKitPalette, centerZ: number, yaw: number): void {
  const width = 0.54;
  const depth = 0.94;
  const wallHeight = 0.56;
  const roofHeight = 0.36;
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
  place(cutStoneBlock(0.082, 0.065, overhangZ + 0.06), palette.trim, 0, ridgeY, 0, parts.masonry);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      place(
        cutStoneBlock(0.072, wallHeight + 0.02, 0.072),
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
    const tip = new Vector3(0, ridgeY + 0.12, end * (overhangZ / 2 + 0.06));
    place(beamBetween(start, tip, 0.066), palette.trim, 0, 0, 0, parts.masonry);
    place(
      new OctahedronGeometry(0.054, 0).scale(0.88, 1.35, 0.72),
      palette.gem,
      0,
      wallHeight + roofHeight * 0.44,
      end * (depth / 2 + 0.032),
      parts.glow,
    );
    for (const wx of [-0.11, 0.11]) {
      place(
        cutStoneBlock(0.07, 0.09, 0.035),
        palette.gem,
        wx,
        wallHeight * 0.74,
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
  const wallHeight = 0.58;
  const vaultRadius = 0.38;
  const vaultLength = 0.96;

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * 0.29;
      const pz = centerZ + sz * 0.29;
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
          new CylinderGeometry(0.054, 0.06, wallHeight, 8),
          palette.stone,
          side * 0.38,
          wallHeight / 2,
          faceZ,
          parts.masonry,
        );
        place(cutStoneBlock(0.12, 0.045, 0.12), palette.accent, side * 0.38, wallHeight, faceZ, parts.masonry);
      }
      place(cutStoneBlock(0.7, 0.14, 0.07), palette.stone, 0, wallHeight - 0.06, faceZ - end * 0.02, parts.masonry);
      place(
        new TorusGeometry(0.135, 0.024, 5, 14),
        palette.accent,
        0,
        wallHeight + vaultRadius * 0.44,
        faceZ + end * 0.025,
        parts.masonry,
      );
      place(
        new IcosahedronGeometry(0.112, 1),
        palette.gem,
        0,
        wallHeight + vaultRadius * 0.44,
        faceZ + end * 0.025,
        parts.glow,
      );
    }
  }

  const crownY = wallHeight + vaultRadius + 0.05;
  parts.masonry.push(
    piece(new CylinderGeometry(0.17, 0.2, 0.11, 8), palette.stone, 0, crownY, centerZ),
    piece(new TorusGeometry(0.13, 0.024, 5, 14).rotateX(Math.PI / 2), palette.accent, 0, crownY + 0.065, centerZ),
  );
  parts.glow.push(piece(new IcosahedronGeometry(0.09, 1), palette.gem, 0, crownY + 0.085, centerZ));
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
    z: -0.09,
    width: 0.74,
    depth: 0.76,
    wallHeight: 0.54,
    roofHeight: 0.42,
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
      piece(new ConeGeometry(0.038, 0.1, 4), palette.stoneShade, 0, 1.02, -0.09 + spike * 0.15, Math.PI / 4),
    );
  }
  for (const side of [-1, 1]) {
    parts.masonry.push(
      piece(cutStoneBlock(0.12, 0.48, 0.12), palette.stoneShade, side * 0.4, 0.24, 0.14),
      piece(new ConeGeometry(0.06, 0.11, 4), palette.stoneShade, side * 0.4, 0.53, 0.14, Math.PI / 4),
    );
    parts.glow.push(
      piece(new OctahedronGeometry(0.045, 0).scale(0.78, 1.4, 0.78), palette.gem, side * 0.4, 0.35, 0.21),
    );
  }
  parts.masonry.push(
    piece(new CylinderGeometry(0.13, 0.16, 0.4, 6), palette.stone, 0, 0.2, 0.36),
    piece(new CylinderGeometry(0.16, 0.13, 0.08, 6), palette.stoneShade, 0, 0.43, 0.36),
  );
  parts.glow.push(
    piece(new OctahedronGeometry(0.092, 0).scale(0.8, 1.55, 0.8), palette.gem, 0, 0.58, 0.36),
    piece(new OctahedronGeometry(0.052, 0).scale(0.85, 1.3, 0.85).rotateZ(0.32), palette.gem, -0.055, 0.52, 0.38),
    piece(new OctahedronGeometry(0.052, 0).scale(0.85, 1.3, 0.85).rotateZ(-0.3), palette.gem, 0.055, 0.52, 0.34),
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
  const drumRadius = 0.46;
  const drumHeight = 0.62;
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
      piece(cutStoneBlock(0.09, 0.19, 0.035), palette.accent, mx + outX * 0.038, 0.46, mz + outZ * 0.038, midAngle),
    );
    parts.glow.push(
      piece(cutStoneBlock(0.056, 0.145, 0.032), palette.gem, mx + outX * 0.048, 0.46, mz + outZ * 0.048, midAngle),
    );
  }

  const domeRadius = 0.47;
  parts.masonry.push(
    piece(new SphereGeometry(domeRadius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), palette.roof, 0, drumHeight, centerZ),
    piece(
      new TorusGeometry(domeRadius + 0.005, 0.03, 6, 16).rotateX(Math.PI / 2),
      palette.trim,
      0,
      drumHeight + 0.01,
      centerZ,
    ),
    piece(new CylinderGeometry(0.15, 0.18, 0.07, 8), palette.accent, 0, drumHeight + domeRadius, centerZ),
    piece(
      new TorusGeometry(0.12, 0.022, 5, 14).rotateX(Math.PI / 2),
      palette.trim,
      0,
      drumHeight + domeRadius + 0.04,
      centerZ,
    ),
  );
  for (let rib = 0; rib < 4; rib++) {
    parts.masonry.push(
      piece(
        new TorusGeometry(domeRadius + 0.005, 0.022, 5, 14, Math.PI),
        rib % 2 === 0 ? palette.stone : palette.accent,
        0,
        drumHeight,
        centerZ,
        (rib * Math.PI) / 4,
      ),
    );
  }
  parts.glow.push(
    piece(
      new OctahedronGeometry(0.055, 0).scale(0.85, 1.35, 0.85),
      palette.gem,
      0,
      drumHeight + domeRadius + 0.09,
      centerZ,
    ),
  );

  const gyroY = drumHeight + 0.08;
  const gyroZ = centerZ + 0.49;
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
      const postHeight = tall ? 0.34 : 0.28;
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
          new ConeGeometry(0.044, tall ? 0.11 : 0.08, 4),
          tall ? palette.timber : palette.stoneShade,
          px,
          postHeight + (tall ? 0.05 : 0.035),
          pz,
          yaw + Math.PI / 4,
        ),
      );
    }
  }
  for (const [x, z] of HEX_PERIMETER_POINTS) {
    parts.masonry.push(
      piece(cutStoneBlock(0.13, 0.37, 0.13), palette.stone, x, 0.185, z),
      piece(new ConeGeometry(0.072, 0.12, 4), palette.stoneShade, x, 0.425, z, Math.PI / 4),
    );
  }
}

function addClosedBastionGate(parts: KitParts, palette: AspectKitPalette): void {
  for (const side of [-1, 1]) {
    parts.masonry.push(
      piece(cutStoneBlock(0.13, 0.41, 0.14), palette.stone, side * 0.19, 0.205, 0.62),
      piece(cutStoneBlock(0.15, 0.05, 0.16), palette.trim, side * 0.19, 0.41, 0.62),
    );
  }
  parts.masonry.push(
    piece(cutStoneBlock(0.46, 0.1, 0.14), palette.stone, 0, 0.385, 0.62),
    piece(cutStoneBlock(0.49, 0.04, 0.16), palette.trim, 0, 0.44, 0.62),
    piece(cutStoneBlock(0.28, 0.31, 0.06), palette.timber, 0, 0.155, 0.62),
    piece(cutStoneBlock(0.28, 0.035, 0.075), palette.stoneShade, 0, 0.13, 0.625),
    piece(cutStoneBlock(0.28, 0.035, 0.075), palette.stoneShade, 0, 0.23, 0.625),
    piece(cutStoneBlock(0.025, 0.3, 0.075), palette.stoneShade, 0, 0.155, 0.625),
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
        new ConeGeometry(0.03, 0.095, 4),
        options.trimColor,
        x,
        ridgeY + 0.06,
        z + overhangZ / 2 - 0.04,
        Math.PI / 4,
      ),
    );
  } else if (options.finial === "horns") {
    for (const endZ of [z + overhangZ / 2 - 0.02, z - overhangZ / 2 + 0.02]) {
      for (const side of [-1, 1]) {
        const foot = new Vector3(x + side * 0.05, ridgeY - 0.025, endZ);
        const tip = new Vector3(x - side * 0.085, ridgeY + 0.1, endZ);
        parts.masonry.push(piece(beamBetween(foot, tip, 0.036), options.postColor));
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
    const lanternY = wallHeight + vaultRadius + 0.045;
    parts.masonry.push(
      piece(cutStoneBlock(0.14, 0.095, 0.16), palette.stone, x, lanternY, z - 0.02),
      piece(cutStoneBlock(0.17, 0.038, 0.19), palette.trim, x, lanternY + 0.06, z - 0.02),
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
