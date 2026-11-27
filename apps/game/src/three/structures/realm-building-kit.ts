import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { createProcgenGlowMaterial, type ProcgenGlowOptions } from "./procgen-glow-material";
import { createProcgenMasonryMaterial } from "./procgen-masonry-material";
import {
  beamBetween,
  combineParts,
  cutStoneBlock,
  extrudedGable,
  type KitPart,
  type KitParts,
  piece,
  type WallSegment,
} from "./realm-kit-primitives";

export const REALM_BUILDING_FAMILIES = ["farm", "workshop", "barracks"] as const;
export type RealmBuildingFamily = (typeof REALM_BUILDING_FAMILIES)[number];

export const REALM_BUILDING_TIERS = [1, 2, 3, 4, 5] as const;
export type RealmBuildingTier = (typeof REALM_BUILDING_TIERS)[number];

const REALM_BUILDING_KIT_PREFIX = "procedural:realm-building:";
const BUILDING_HEARTH_GLOW: ProcgenGlowOptions = {
  emissive: "#ff9b3d",
  emissiveIntensity: 1.35,
  pulseSpeed: 0.75,
  pulseDepth: 0.14,
  fissureWeight: 0.22,
  fissureHotColor: "#ffe4a8",
  foldLightWeight: 0.12,
  roughness: 0.28,
  metalness: 0.1,
};

const PALETTE = {
  soilDark: "#5f4327",
  soilLight: "#7c5a37",
  meadow: "#6a7b45",
  meadowDark: "#556436",
  wheatGold: "#deb247",
  wheatBright: "#ecc75d",
  wheatShade: "#be9234",
  thatch: "#cfb27a",
  thatchShade: "#b6965d",
  plaster: "#e4d8c0",
  plasterShade: "#d2c3a5",
  travertine: "#e1d8c6",
  travertineLight: "#efe8da",
  travertineShade: "#c4b9a4",
  alabaster: "#e5e5e0",
  alabasterLight: "#f3f3ef",
  alabasterShade: "#c7cac6",
  rubble: "#8e8778",
  rubbleDark: "#6e685c",
  cobble: "#9a9386",
  cobbleDark: "#797368",
  timber: "#67452a",
  timberDark: "#472e1c",
  timberLight: "#875f3c",
  terracotta: "#b85f34",
  terracottaShade: "#944824",
  slate: "#3c5269",
  slateShade: "#2c3e50",
  tealCrown: "#226564",
  canvas: "#efe6d2",
  canvasShade: "#d8cbb0",
  crimson: "#9d2b2b",
  crimsonDark: "#781f1f",
  iron: "#3b3d40",
  steel: "#7f8994",
  bronze: "#a9773f",
  gold: "#d4ab50",
  goldBright: "#e5be63",
  water: "#4d859c",
  foliage: "#557d39",
  foliageLight: "#6f9849",
  windowAmber: "#ffbc52",
  forgeEmber: "#ff7e22",
  forgeCore: "#ffd064",
} as const;

const PLOT_PERIMETER_POINTS: readonly (readonly [number, number])[] = [
  [-0.22, 0.65],
  [-0.68, 0.38],
  [-0.68, -0.38],
  [0, -0.76],
  [0.68, -0.38],
  [0.68, 0.38],
  [0.22, 0.65],
];

const PLOT_WALL_SEGMENTS: readonly WallSegment[] = PLOT_PERIMETER_POINTS.slice(0, -1).map((from, index) => ({
  from,
  to: PLOT_PERIMETER_POINTS[index + 1]!,
}));

type BuildingTierBuilder = (parts: KitParts) => void;

const BUILDING_BUILDERS = {
  farm: {
    1: buildFarmTier1,
    2: buildFarmTier2,
    3: buildFarmTier3,
    4: buildFarmTier4,
    5: buildFarmTier5,
  },
  workshop: {
    1: buildWorkshopTier1,
    2: buildWorkshopTier2,
    3: buildWorkshopTier3,
    4: buildWorkshopTier4,
    5: buildWorkshopTier5,
  },
  barracks: {
    1: buildBarracksTier1,
    2: buildBarracksTier2,
    3: buildBarracksTier3,
    4: buildBarracksTier4,
    5: buildBarracksTier5,
  },
} as const satisfies Record<RealmBuildingFamily, Record<RealmBuildingTier, BuildingTierBuilder>>;

export function realmBuildingKitPath(family: RealmBuildingFamily, tier: number): string {
  const clamped = clampTier(tier);
  return `${REALM_BUILDING_KIT_PREFIX}${family}:${clamped}`;
}

export function parseRealmBuildingKitPath(
  path: string,
): { readonly family: RealmBuildingFamily; readonly tier: RealmBuildingTier } | null {
  if (!path.startsWith(REALM_BUILDING_KIT_PREFIX)) return null;
  const [familyText, tierText, extra] = path.slice(REALM_BUILDING_KIT_PREFIX.length).split(":");
  if (extra !== undefined || !familyText || !tierText) return null;
  if (!isBuildingFamily(familyText) || !/^\d+$/.test(tierText)) return null;
  const tier = Number(tierText);
  if (!isBuildingTier(tier)) return null;
  return { family: familyText, tier };
}

export function isRealmBuildingKitPath(path: string): boolean {
  return parseRealmBuildingKitPath(path) !== null;
}

export function createRealmBuildingKit(family: RealmBuildingFamily, tier: RealmBuildingTier): GLTF {
  const parts: KitParts = { masonry: [], glow: [], anchors: [] };
  BUILDING_BUILDERS[family][tier](parts);
  return assembleBuildingGltf(`realm-building-${family}-${tier}`, parts);
}

export function resolveRealmBuildingKit(path: string): GLTF | null {
  const parsed = parseRealmBuildingKitPath(path);
  return parsed ? createRealmBuildingKit(parsed.family, parsed.tier) : null;
}

function clampTier(tier: number): RealmBuildingTier {
  const rounded = Math.round(tier);
  if (rounded <= 1) return 1;
  if (rounded >= 5) return 5;
  return rounded as RealmBuildingTier;
}

function isBuildingFamily(value: string): value is RealmBuildingFamily {
  return (REALM_BUILDING_FAMILIES as readonly string[]).includes(value);
}

function isBuildingTier(value: number): value is RealmBuildingTier {
  return (REALM_BUILDING_TIERS as readonly number[]).includes(value);
}

function assembleBuildingGltf(name: string, parts: KitParts): GLTF {
  const scene = new Group();
  scene.name = name;
  const masonryMesh = new Mesh(combineParts(parts.masonry), createProcgenMasonryMaterial());
  masonryMesh.name = `${name}:masonry`;
  scene.add(masonryMesh);
  if (parts.glow.length > 0) {
    const glowMesh = new Mesh(combineParts(parts.glow), createProcgenGlowMaterial(BUILDING_HEARTH_GLOW));
    glowMesh.name = `${name}:glow`;
    scene.add(glowMesh);
  }
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

function addHexPlotPad(parts: KitParts, surfaceColor: string, rimColor: string, height = 0.044): void {
  parts.masonry.push(
    piece(new CylinderGeometry(0.84, 0.87, height * 0.65, 6), rimColor, 0, height * 0.325, 0),
    piece(new CylinderGeometry(0.79, 0.82, height * 0.45, 6), surfaceColor, 0, height * 0.775, 0),
  );
}

function addSplitRailFence(parts: KitParts, baseY = 0.04): void {
  for (let segIdx = 0; segIdx < PLOT_WALL_SEGMENTS.length; segIdx++) {
    const { from, to } = PLOT_WALL_SEGMENTS[segIdx]!;
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const posts = Math.max(2, Math.round(length / 0.24));
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      parts.masonry.push(
        piece(
          new BoxGeometry(0.036, 0.14, 0.036),
          PALETTE.timberDark,
          from[0] + dx * t,
          baseY + 0.07,
          from[1] + dz * t,
        ),
      );
    }
    const mx = (from[0] + to[0]) / 2;
    const mz = (from[1] + to[1]) / 2;
    parts.masonry.push(
      piece(new BoxGeometry(0.022, 0.024, length), PALETTE.timber, mx, baseY + 0.055, mz, yaw),
      piece(new BoxGeometry(0.022, 0.024, length), PALETTE.timberLight, mx, baseY + 0.115, mz, yaw),
    );
  }
}

function addPalisadePerimeter(parts: KitParts, baseY = 0.04, wallHeight = 0.24): void {
  for (let segIdx = 0; segIdx < PLOT_WALL_SEGMENTS.length; segIdx++) {
    const { from, to } = PLOT_WALL_SEGMENTS[segIdx]!;
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const stakes = Math.max(5, Math.round(length / 0.078));
    for (let i = 0; i <= stakes; i++) {
      const t = i / stakes;
      const sx = from[0] + dx * t;
      const sz = from[1] + dz * t;
      const h = wallHeight + ((i + segIdx) % 3) * 0.018;
      const tone = (i + segIdx) % 2 === 0 ? PALETTE.timber : PALETTE.timberLight;
      parts.masonry.push(
        piece(new CylinderGeometry(0.026, 0.031, h, 7), tone, sx, baseY + h / 2, sz),
        piece(new ConeGeometry(0.027, 0.055, 7), PALETTE.timberDark, sx, baseY + h + 0.027, sz),
      );
    }
    const mx = (from[0] + to[0]) / 2;
    const mz = (from[1] + to[1]) / 2;
    parts.masonry.push(
      piece(new BoxGeometry(0.028, 0.026, length + 0.01), PALETTE.timberDark, mx, baseY + wallHeight * 0.38, mz, yaw),
      piece(new BoxGeometry(0.028, 0.026, length + 0.01), PALETTE.timberDark, mx, baseY + wallHeight * 0.78, mz, yaw),
    );
  }
}

function addStonePerimeterWall(
  parts: KitParts,
  options: {
    baseY?: number;
    height: number;
    thickness: number;
    wallColor: string;
    baseColor: string;
    capColor: string;
    crenelated?: boolean;
    goldTrim?: boolean;
  },
): void {
  const {
    baseY = 0.04,
    height,
    thickness,
    wallColor,
    baseColor,
    capColor,
    crenelated = false,
    goldTrim = false,
  } = options;
  for (const { from, to } of PLOT_WALL_SEGMENTS) {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const mx = (from[0] + to[0]) / 2;
    const mz = (from[1] + to[1]) / 2;
    const plinthH = Math.min(0.06, height * 0.25);
    parts.masonry.push(
      piece(cutStoneBlock(thickness + 0.022, plinthH, length + 0.02), baseColor, mx, baseY + plinthH / 2, mz, yaw),
      piece(
        new BoxGeometry(thickness, height - plinthH, length),
        wallColor,
        mx,
        baseY + plinthH + (height - plinthH) / 2,
        mz,
        yaw,
      ),
      piece(cutStoneBlock(thickness + 0.024, 0.028, length + 0.02), capColor, mx, baseY + height + 0.014, mz, yaw),
    );
    if (goldTrim) {
      parts.masonry.push(
        piece(
          new BoxGeometry(thickness + 0.028, 0.02, length + 0.01),
          PALETTE.gold,
          mx,
          baseY + height * 0.68,
          mz,
          yaw,
        ),
      );
    }
    if (crenelated) {
      const merlons = Math.max(2, Math.floor(length / 0.14));
      for (let i = 0; i < merlons; i++) {
        const t = (i + 0.5) / merlons;
        parts.masonry.push(
          piece(
            cutStoneBlock(thickness + 0.012, 0.065, 0.075),
            capColor,
            from[0] + dx * t,
            baseY + height + 0.056,
            from[1] + dz * t,
            yaw,
          ),
        );
      }
    }
  }
  for (const [vx, vz] of PLOT_PERIMETER_POINTS) {
    parts.masonry.push(
      piece(
        cutStoneBlock(thickness + 0.04, height + 0.05, thickness + 0.04),
        baseColor,
        vx,
        baseY + (height + 0.05) / 2,
        vz,
      ),
      piece(cutStoneBlock(thickness + 0.06, 0.032, thickness + 0.06), capColor, vx, baseY + height + 0.064, vz),
    );
  }
}

function addGabledHall(
  parts: KitParts,
  options: {
    x: number;
    y?: number;
    z: number;
    width: number;
    depth: number;
    wallHeight: number;
    roofHeight: number;
    yaw?: number;
    wallColor: string;
    gableColor: string;
    plinthColor: string;
    roofColor: string;
    roofShade: string;
    timberFramed?: boolean;
    glowWindows?: boolean;
    doorColor?: string;
  },
): void {
  const {
    x,
    y = 0.04,
    z,
    width,
    depth,
    wallHeight,
    roofHeight,
    yaw = 0,
    wallColor,
    gableColor,
    plinthColor,
    roofColor,
    roofShade,
    timberFramed = true,
    glowWindows = false,
    doorColor = PALETTE.timberDark,
  } = options;
  const addLocal = (target: KitPart[], geometry: BufferGeometry, color: string, lx = 0, ly = 0, lz = 0, lyaw = 0) => {
    geometry.rotateY(lyaw).translate(lx, ly, lz);
    geometry.rotateY(yaw).translate(x, y, z);
    target.push({ geometry, color });
  };

  const plinthH = Math.min(0.065, wallHeight * 0.24);
  addLocal(parts.masonry, cutStoneBlock(width + 0.03, plinthH, depth + 0.03), plinthColor, 0, plinthH / 2, 0);
  addLocal(
    parts.masonry,
    new BoxGeometry(width, wallHeight - plinthH, depth),
    wallColor,
    0,
    plinthH + (wallHeight - plinthH) / 2,
    0,
  );
  addLocal(parts.masonry, extrudedGable(width, roofHeight * 0.9, depth), gableColor, 0, wallHeight, 0);

  if (timberFramed) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addLocal(
          parts.masonry,
          new BoxGeometry(0.032, wallHeight, 0.032),
          PALETTE.timberDark,
          sx * (width / 2 - 0.006),
          wallHeight / 2,
          sz * (depth / 2 - 0.006),
        );
      }
      addLocal(
        parts.masonry,
        new BoxGeometry(0.026, 0.026, depth + 0.015),
        PALETTE.timberDark,
        sx * (width / 2 - 0.004),
        wallHeight - 0.012,
        0,
      );
    }
    for (const sz of [-1, 1]) {
      addLocal(
        parts.masonry,
        new BoxGeometry(width + 0.015, 0.026, 0.026),
        PALETTE.timberDark,
        0,
        wallHeight - 0.012,
        sz * (depth / 2 - 0.004),
      );
      addLocal(
        parts.masonry,
        new BoxGeometry(width + 0.01, 0.022, 0.022),
        PALETTE.timber,
        0,
        wallHeight * 0.54,
        sz * (depth / 2 - 0.003),
      );
    }
  }

  const overhangX = width + 0.085;
  const overhangZ = depth + 0.085;
  const halfSpan = overhangX / 2;
  const slopeLength = Math.hypot(halfSpan, roofHeight);
  const slopeAngle = Math.atan2(roofHeight, halfSpan);
  for (const side of [-1, 1]) {
    const plane = new BoxGeometry(slopeLength + 0.025, 0.044, overhangZ).rotateZ(-side * slopeAngle);
    addLocal(
      parts.masonry,
      plane,
      side === -1 ? roofColor : roofShade,
      side * (halfSpan * 0.49),
      wallHeight + roofHeight * 0.48,
      0,
    );
  }
  addLocal(
    parts.masonry,
    new CylinderGeometry(0.026, 0.026, overhangZ + 0.025, 8).rotateX(Math.PI / 2),
    roofShade,
    0,
    wallHeight + roofHeight - 0.008,
    0,
  );
  addLocal(
    parts.masonry,
    new BoxGeometry(Math.min(0.11, width * 0.34), Math.min(0.16, wallHeight * 0.62), 0.028),
    doorColor,
    0,
    Math.min(0.08, wallHeight * 0.31),
    depth / 2 + 0.008,
  );

  if (glowWindows) {
    addLocal(
      parts.glow,
      new BoxGeometry(0.068, 0.068, 0.02),
      PALETTE.windowAmber,
      0,
      wallHeight + roofHeight * 0.34,
      depth / 2 + 0.008,
    );
    for (const sx of [-1, 1]) {
      addLocal(
        parts.glow,
        new BoxGeometry(0.02, 0.072, 0.078),
        PALETTE.windowAmber,
        sx * (width / 2 + 0.006),
        wallHeight * 0.62,
        0,
      );
    }
  }
}

function addRoundTower(
  parts: KitParts,
  options: {
    x: number;
    y?: number;
    z: number;
    radiusBottom: number;
    radiusTop: number;
    shaftHeight: number;
    roofHeight: number;
    wallColor: string;
    bandColor: string;
    roofColor: string;
    finialColor?: string;
    segments?: number;
    glowWindow?: boolean;
  },
): void {
  const {
    x,
    y = 0.04,
    z,
    radiusBottom,
    radiusTop,
    shaftHeight,
    roofHeight,
    wallColor,
    bandColor,
    roofColor,
    finialColor = PALETTE.gold,
    segments = 10,
    glowWindow = false,
  } = options;
  parts.masonry.push(
    piece(
      new CylinderGeometry(radiusBottom + 0.02, radiusBottom + 0.032, 0.06, segments),
      PALETTE.rubbleDark,
      x,
      y + 0.03,
      z,
    ),
    piece(new CylinderGeometry(radiusTop, radiusBottom, shaftHeight, segments), wallColor, x, y + shaftHeight / 2, z),
    piece(
      new CylinderGeometry(radiusTop + 0.022, radiusTop + 0.022, 0.032, segments),
      bandColor,
      x,
      y + shaftHeight - 0.02,
      z,
    ),
    piece(
      new CylinderGeometry(
        (radiusTop + radiusBottom) * 0.5 + 0.016,
        (radiusTop + radiusBottom) * 0.5 + 0.016,
        0.024,
        segments,
      ),
      bandColor,
      x,
      y + shaftHeight * 0.5,
      z,
    ),
    piece(new ConeGeometry(radiusTop + 0.055, roofHeight, segments), roofColor, x, y + shaftHeight + roofHeight / 2, z),
    piece(new OctahedronGeometry(0.032, 0), finialColor, x, y + shaftHeight + roofHeight + 0.022, z),
  );
  if (glowWindow) {
    parts.glow.push(
      piece(
        new BoxGeometry(0.056, 0.088, 0.026),
        PALETTE.windowAmber,
        x,
        y + shaftHeight * 0.68,
        z + radiusTop - 0.002,
      ),
    );
  }
}

function addSquareTower(
  parts: KitParts,
  options: {
    x: number;
    y?: number;
    z: number;
    size: number;
    height: number;
    wallColor: string;
    trimColor: string;
    roofColor?: string;
    roofHeight?: number;
    crenelated?: boolean;
    goldBand?: boolean;
    glowSlits?: boolean;
  },
): void {
  const {
    x,
    y = 0.04,
    z,
    size,
    height,
    wallColor,
    trimColor,
    roofColor,
    roofHeight = 0.24,
    crenelated = true,
    goldBand = false,
    glowSlits = false,
  } = options;
  const plinthH = 0.07;
  parts.masonry.push(
    piece(cutStoneBlock(size + 0.045, plinthH, size + 0.045), PALETTE.rubbleDark, x, y + plinthH / 2, z),
    piece(new BoxGeometry(size, height, size), wallColor, x, y + height / 2, z),
    piece(cutStoneBlock(size + 0.055, 0.045, size + 0.055), trimColor, x, y + height + 0.022, z),
  );
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.masonry.push(
        piece(
          new BoxGeometry(0.042, height + 0.02, 0.042),
          trimColor,
          x + sx * (size / 2 - 0.008),
          y + height / 2,
          z + sz * (size / 2 - 0.008),
        ),
      );
    }
  }
  if (goldBand) {
    parts.masonry.push(piece(new BoxGeometry(size + 0.04, 0.026, size + 0.04), PALETTE.gold, x, y + height * 0.72, z));
  }
  if (crenelated) {
    const half = size / 2 + 0.006;
    for (const offset of [-half * 0.62, 0, half * 0.62]) {
      for (const side of [-1, 1]) {
        parts.masonry.push(
          piece(cutStoneBlock(0.058, 0.068, 0.048), trimColor, x + offset, y + height + 0.076, z + side * half),
          piece(cutStoneBlock(0.048, 0.068, 0.058), trimColor, x + side * half, y + height + 0.076, z + offset),
        );
      }
    }
  }
  if (roofColor) {
    parts.masonry.push(
      piece(
        new ConeGeometry(size * 0.72, roofHeight, 4),
        roofColor,
        x,
        y + height + 0.05 + roofHeight / 2,
        z,
        Math.PI / 4,
      ),
      piece(new OctahedronGeometry(0.036, 0), PALETTE.goldBright, x, y + height + 0.05 + roofHeight + 0.024, z),
    );
  }
  if (glowSlits) {
    parts.glow.push(
      piece(new BoxGeometry(0.044, 0.11, 0.022), PALETTE.windowAmber, x, y + height * 0.64, z + size / 2 + 0.006),
      piece(new BoxGeometry(0.022, 0.095, 0.044), PALETTE.windowAmber, x + size / 2 + 0.006, y + height * 0.64, z),
    );
  }
}

function addWindmillSails(
  parts: KitParts,
  options: {
    x: number;
    y: number;
    z: number;
    radius: number;
    frameColor?: string;
    sailColor?: string;
    tilt?: number;
  },
): void {
  const { x, y, z, radius, frameColor = PALETTE.timberDark, sailColor = PALETTE.canvas, tilt = 0.38 } = options;
  parts.masonry.push(
    piece(new CylinderGeometry(0.05, 0.055, 0.07, 8).rotateX(Math.PI / 2), PALETTE.iron, x, y, z),
    piece(new CylinderGeometry(0.028, 0.028, 0.09, 8).rotateX(Math.PI / 2), PALETTE.gold, x, y, z + 0.015),
  );
  for (let i = 0; i < 4; i++) {
    const angle = tilt + (i * Math.PI) / 2;
    const spar = new BoxGeometry(radius, 0.026, 0.024).translate(radius / 2, 0, 0).rotateZ(angle);
    parts.masonry.push(piece(spar, frameColor, x, y, z + 0.024));
    const sailLen = radius * 0.74;
    const sailW = radius * 0.25;
    const sail = new BoxGeometry(sailLen, sailW, 0.014).translate(radius * 0.56, sailW * 0.42, 0.01).rotateZ(angle);
    parts.masonry.push(piece(sail, i % 2 === 0 ? sailColor : PALETTE.canvasShade, x, y, z + 0.024));
    const crossBar = new BoxGeometry(0.018, sailW + 0.02, 0.02)
      .translate(radius * 0.56, sailW * 0.42, 0.012)
      .rotateZ(angle);
    parts.masonry.push(piece(crossBar, frameColor, x, y, z + 0.024));
    const tip = new BoxGeometry(0.018, sailW + 0.02, 0.02).translate(radius * 0.92, sailW * 0.42, 0.012).rotateZ(angle);
    parts.masonry.push(piece(tip, frameColor, x, y, z + 0.024));
  }
}

function addWheatBed(parts: KitParts, x: number, z: number, width: number, depth: number, yaw = 0, baseY = 0.04): void {
  const addLocal = (geometry: BufferGeometry, color: string, lx = 0, ly = 0, lz = 0) => {
    geometry.translate(lx, ly, lz).rotateY(yaw).translate(x, baseY, z);
    parts.masonry.push({ geometry, color });
  };
  addLocal(cutStoneBlock(width + 0.04, 0.036, depth + 0.04), PALETTE.timber, 0, 0.018, 0);
  addLocal(new BoxGeometry(width, 0.032, depth), PALETTE.soilDark, 0, 0.026, 0);
  const rows = Math.max(2, Math.round(depth / 0.09));
  for (let i = 0; i < rows; i++) {
    const rz = -depth / 2 + ((i + 0.5) / rows) * depth;
    const h = 0.07 + (i % 2) * 0.018;
    addLocal(
      new BoxGeometry(width - 0.03, h, 0.045),
      i % 2 === 0 ? PALETTE.wheatGold : PALETTE.wheatBright,
      0,
      0.038 + h / 2,
      rz,
    );
  }
}

function addHayBale(parts: KitParts, x: number, z: number, baseY = 0.04, yaw = 0): void {
  parts.masonry.push(
    piece(
      new CylinderGeometry(0.055, 0.055, 0.12, 8).rotateZ(Math.PI / 2),
      PALETTE.wheatShade,
      x,
      baseY + 0.055,
      z,
      yaw,
    ),
  );
}

function addOrchardTree(parts: KitParts, x: number, z: number, baseY = 0.04, scale = 1): void {
  parts.masonry.push(
    piece(new CylinderGeometry(0.07 * scale, 0.08 * scale, 0.045, 7), PALETTE.travertineShade, x, baseY + 0.022, z),
    piece(
      new CylinderGeometry(0.022 * scale, 0.032 * scale, 0.14 * scale, 6),
      PALETTE.timberDark,
      x,
      baseY + 0.04 + 0.07 * scale,
      z,
    ),
    piece(new SphereGeometry(0.095 * scale, 7, 5), PALETTE.foliage, x, baseY + 0.04 + 0.18 * scale, z),
    piece(
      new SphereGeometry(0.072 * scale, 7, 5),
      PALETTE.foliageLight,
      x + 0.03 * scale,
      baseY + 0.04 + 0.22 * scale,
      z + 0.02 * scale,
    ),
  );
}

function addChimneyStack(
  parts: KitParts,
  options: {
    x: number;
    y?: number;
    z: number;
    width: number;
    height: number;
    stoneColor?: string;
    bandColor?: string;
    glowHearth?: boolean;
  },
): void {
  const {
    x,
    y = 0.04,
    z,
    width,
    height,
    stoneColor = PALETTE.rubble,
    bandColor = PALETTE.iron,
    glowHearth = true,
  } = options;
  const hearthH = Math.min(0.24, height * 0.42);
  parts.masonry.push(
    piece(cutStoneBlock(width * 1.48, hearthH, width * 1.38), PALETTE.rubbleDark, x, y + hearthH / 2, z),
    piece(new BoxGeometry(width, height - hearthH, width), stoneColor, x, y + hearthH + (height - hearthH) / 2, z),
    piece(cutStoneBlock(width + 0.042, 0.038, width + 0.042), PALETTE.rubbleDark, x, y + height + 0.018, z),
    piece(new BoxGeometry(width + 0.024, 0.024, width + 0.024), bandColor, x, y + height * 0.72, z),
  );
  if (glowHearth) {
    parts.glow.push(
      piece(
        new BoxGeometry(width * 0.72, hearthH * 0.48, 0.032),
        PALETTE.forgeEmber,
        x,
        y + hearthH * 0.36,
        z + width * 0.7,
      ),
      piece(
        new BoxGeometry(width * 0.44, hearthH * 0.28, 0.038),
        PALETTE.forgeCore,
        x,
        y + hearthH * 0.32,
        z + width * 0.71,
      ),
    );
  }
}

function addAnvilStation(parts: KitParts, x: number, z: number, baseY = 0.04): void {
  parts.masonry.push(
    piece(new CylinderGeometry(0.055, 0.064, 0.11, 7), PALETTE.timberDark, x, baseY + 0.055, z),
    piece(new BoxGeometry(0.11, 0.042, 0.052), PALETTE.iron, x, baseY + 0.132, z),
    piece(new ConeGeometry(0.028, 0.075, 5).rotateZ(-Math.PI / 2), PALETTE.steel, x + 0.075, baseY + 0.138, z),
    piece(new CylinderGeometry(0.048, 0.044, 0.1, 7), PALETTE.timber, x - 0.13, baseY + 0.05, z + 0.05),
    piece(new CylinderGeometry(0.04, 0.04, 0.015, 7), PALETTE.water, x - 0.13, baseY + 0.098, z + 0.05),
  );
}

function addCraneArm(parts: KitParts, x: number, z: number, mastHeight: number, yaw = 0, baseY = 0.04): void {
  const addLocal = (geometry: BufferGeometry, color: string) => {
    geometry.rotateY(yaw).translate(x, baseY, z);
    parts.masonry.push({ geometry, color });
  };
  addLocal(new BoxGeometry(0.055, mastHeight, 0.055).translate(0, mastHeight / 2, 0), PALETTE.timberDark);
  addLocal(
    beamBetween(new Vector3(0, mastHeight * 0.88, 0), new Vector3(0.32, mastHeight + 0.08, 0), 0.038),
    PALETTE.timber,
  );
  addLocal(
    beamBetween(new Vector3(0, mastHeight * 0.48, 0), new Vector3(0.19, mastHeight * 0.94, 0), 0.03),
    PALETTE.timberLight,
  );
  addLocal(new CylinderGeometry(0.008, 0.008, 0.24, 5).translate(0.28, mastHeight - 0.06, 0), PALETTE.iron);
  addLocal(cutStoneBlock(0.1, 0.09, 0.1).translate(0.28, mastHeight - 0.21, 0), PALETTE.timberLight);
}

function addWaterwheel(parts: KitParts, x: number, y: number, z: number, radius: number): void {
  parts.masonry.push(
    piece(new BoxGeometry(0.12, 0.06, radius * 2.15), PALETTE.rubbleDark, x, 0.06, z),
    piece(new BoxGeometry(0.08, 0.025, radius * 2.05), PALETTE.water, x, 0.092, z),
    piece(new TorusGeometry(radius, 0.024, 6, 14).rotateY(Math.PI / 2), PALETTE.timberDark, x, y, z),
    piece(new CylinderGeometry(0.048, 0.048, 0.09, 8).rotateZ(Math.PI / 2), PALETTE.iron, x, y, z),
  );
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const spoke = new BoxGeometry(0.024, radius * 2, 0.024).rotateX(a);
    parts.masonry.push(piece(spoke, PALETTE.timber, x, y, z));
    const paddle = new BoxGeometry(0.075, 0.048, 0.022).translate(0, radius + 0.01, 0).rotateX(a);
    parts.masonry.push(piece(paddle, PALETTE.timberLight, x, y, z));
  }
}

function addTierBanner(
  parts: KitParts,
  options: {
    x: number;
    y: number;
    z: number;
    poleHeight: number;
    clothColor: string;
    trimColor: string;
  },
): void {
  const { x, y, z, poleHeight, clothColor, trimColor } = options;
  parts.masonry.push(
    piece(new CylinderGeometry(0.014, 0.018, poleHeight, 6), PALETTE.timberDark, x, y + poleHeight / 2, z),
    piece(new OctahedronGeometry(0.024, 0), trimColor, x, y + poleHeight + 0.02, z),
    piece(new BoxGeometry(0.16, 0.095, 0.016), clothColor, x + 0.09, y + poleHeight - 0.055, z),
    piece(new BoxGeometry(0.168, 0.02, 0.02), trimColor, x + 0.09, y + poleHeight - 0.008, z),
    piece(new BoxGeometry(0.168, 0.02, 0.02), trimColor, x + 0.09, y + poleHeight - 0.102, z),
  );
}

function addBrazier(parts: KitParts, x: number, y: number, z: number): void {
  parts.masonry.push(
    piece(new CylinderGeometry(0.036, 0.046, 0.09, 7), PALETTE.rubbleDark, x, y + 0.045, z),
    piece(new CylinderGeometry(0.058, 0.034, 0.042, 7), PALETTE.iron, x, y + 0.105, z),
  );
  parts.glow.push(piece(new OctahedronGeometry(0.044, 0), PALETTE.forgeEmber, x, y + 0.145, z));
}

function addTrainingProps(parts: KitParts, x: number, z: number, baseY = 0.04): void {
  parts.masonry.push(
    piece(new CylinderGeometry(0.018, 0.022, 0.22, 6), PALETTE.timberDark, x, baseY + 0.11, z),
    piece(new BoxGeometry(0.15, 0.024, 0.024), PALETTE.timber, x, baseY + 0.16, z),
    piece(new CylinderGeometry(0.038, 0.044, 0.09, 7), PALETTE.thatch, x, baseY + 0.16, z),
    piece(new SphereGeometry(0.032, 6, 5), PALETTE.thatchShade, x, baseY + 0.23, z),
  );
}

function addWeaponRack(parts: KitParts, x: number, z: number, yaw = 0, baseY = 0.04): void {
  const addLocal = (geometry: BufferGeometry, color: string, lx = 0, ly = 0, lz = 0) => {
    geometry.translate(lx, ly, lz).rotateY(yaw).translate(x, baseY, z);
    parts.masonry.push({ geometry, color });
  };
  addLocal(new BoxGeometry(0.24, 0.024, 0.065), PALETTE.timberDark, 0, 0.014, 0);
  for (const sx of [-0.1, 0.1]) {
    addLocal(new BoxGeometry(0.024, 0.16, 0.024), PALETTE.timber, sx, 0.085, 0);
  }
  addLocal(new BoxGeometry(0.22, 0.02, 0.024), PALETTE.timberLight, 0, 0.135, 0);
  for (const sx of [-0.06, 0, 0.06]) {
    addLocal(new CylinderGeometry(0.008, 0.008, 0.26, 5), PALETTE.timberLight, sx, 0.13, 0.014);
    addLocal(new ConeGeometry(0.015, 0.048, 4), PALETTE.steel, sx, 0.275, 0.014);
  }
}

function addCanvasTent(
  parts: KitParts,
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  yaw = 0,
): void {
  const addLocal = (geometry: BufferGeometry, color: string, lx = 0, ly = 0, lz = 0) => {
    geometry.translate(lx, ly, lz).rotateY(yaw).translate(x, 0.04, z);
    parts.masonry.push({ geometry, color });
  };
  addLocal(extrudedGable(width, height, depth), PALETTE.canvas, 0, 0, 0);
  addLocal(
    new BoxGeometry(width * 0.22, height * 0.62, 0.022),
    PALETTE.timberDark,
    0,
    height * 0.31,
    depth / 2 + 0.006,
  );
  addLocal(new BoxGeometry(0.032, 0.032, depth + 0.04), PALETTE.crimson, 0, height, 0);
}

function addFortifiedGatehouse(
  parts: KitParts,
  options: {
    z: number;
    width: number;
    height: number;
    depth: number;
    wallColor: string;
    trimColor: string;
    portcullis?: boolean;
  },
): void {
  const { z, width, height, depth, wallColor, trimColor, portcullis = false } = options;
  const pierW = width * 0.28;
  const openingW = width - pierW * 2;
  for (const side of [-1, 1]) {
    parts.masonry.push(
      piece(cutStoneBlock(pierW, height, depth), wallColor, side * (openingW / 2 + pierW / 2), 0.04 + height / 2, z),
      piece(
        cutStoneBlock(pierW + 0.026, 0.042, depth + 0.026),
        trimColor,
        side * (openingW / 2 + pierW / 2),
        0.04 + height + 0.02,
        z,
      ),
    );
  }
  const lintelH = height * 0.34;
  parts.masonry.push(
    piece(cutStoneBlock(width + 0.02, lintelH, depth + 0.015), wallColor, 0, 0.04 + height - lintelH / 2, z),
    piece(cutStoneBlock(width + 0.05, 0.04, depth + 0.04), trimColor, 0, 0.04 + height + 0.02, z),
  );
  if (portcullis) {
    for (const bx of [-0.07, -0.024, 0.024, 0.07]) {
      parts.masonry.push(
        piece(new BoxGeometry(0.014, height * 0.56, 0.018), PALETTE.iron, bx, 0.04 + height * 0.34, z),
      );
    }
    parts.masonry.push(piece(new BoxGeometry(openingW, 0.018, 0.022), PALETTE.iron, 0, 0.04 + height * 0.45, z));
  }
}

function buildFarmTier1(parts: KitParts): void {
  addHexPlotPad(parts, PALETTE.meadow, PALETTE.soilDark);
  addSplitRailFence(parts);
  addWheatBed(parts, -0.25, 0.08, 0.34, 0.44, 0.06);
  addWheatBed(parts, 0.24, 0.24, 0.28, 0.24, -0.05);
  addGabledHall(parts, {
    x: 0.22,
    z: -0.22,
    width: 0.34,
    depth: 0.36,
    wallHeight: 0.24,
    roofHeight: 0.24,
    yaw: -0.18,
    wallColor: PALETTE.plaster,
    gableColor: PALETTE.plasterShade,
    plinthColor: PALETTE.rubble,
    roofColor: PALETTE.thatch,
    roofShade: PALETTE.thatchShade,
  });
  addHayBale(parts, -0.28, -0.32, 0.04, 0.4);
  addHayBale(parts, -0.14, -0.38, 0.04, -0.2);
  parts.masonry.push(piece(new CylinderGeometry(0.048, 0.052, 0.11, 7), PALETTE.timber, -0.02, 0.095, 0.36));
}

function buildFarmTier2(parts: KitParts): void {
  addHexPlotPad(parts, PALETTE.meadow, PALETTE.rubbleDark);
  addSplitRailFence(parts);
  addWheatBed(parts, -0.3, 0.16, 0.34, 0.38, 0.05);
  addWheatBed(parts, 0.28, 0.2, 0.3, 0.34, -0.05);
  parts.masonry.push(
    piece(cutStoneBlock(0.11, 0.06, 0.56), PALETTE.rubble, -0.01, 0.07, 0.18),
    piece(new BoxGeometry(0.065, 0.022, 0.52), PALETTE.water, -0.01, 0.102, 0.18),
  );
  addGabledHall(parts, {
    x: 0.08,
    z: -0.26,
    width: 0.52,
    depth: 0.4,
    wallHeight: 0.32,
    roofHeight: 0.3,
    wallColor: PALETTE.plaster,
    gableColor: PALETTE.plasterShade,
    plinthColor: PALETTE.rubble,
    roofColor: PALETTE.terracotta,
    roofShade: PALETTE.terracottaShade,
    glowWindows: true,
  });
  addHayBale(parts, -0.36, -0.24, 0.04, 0.2);
  addHayBale(parts, -0.32, -0.34, 0.04, -0.4);
  addTierBanner(parts, {
    x: 0.42,
    y: 0.04,
    z: -0.18,
    poleHeight: 0.56,
    clothColor: PALETTE.wheatGold,
    trimColor: PALETTE.steel,
  });
}

function buildFarmTier3(parts: KitParts): void {
  addHexPlotPad(parts, PALETTE.meadow, PALETTE.rubbleDark);
  addStonePerimeterWall(parts, {
    height: 0.16,
    thickness: 0.06,
    wallColor: PALETTE.rubble,
    baseColor: PALETTE.rubbleDark,
    capColor: PALETTE.travertineShade,
  });
  addWheatBed(parts, -0.28, 0.22, 0.34, 0.32, 0.04);
  addWheatBed(parts, 0.26, 0.24, 0.32, 0.28, -0.04);
  addGabledHall(parts, {
    x: 0.22,
    z: -0.18,
    width: 0.44,
    depth: 0.38,
    wallHeight: 0.34,
    roofHeight: 0.28,
    wallColor: PALETTE.travertine,
    gableColor: PALETTE.travertineShade,
    plinthColor: PALETTE.rubbleDark,
    roofColor: PALETTE.terracotta,
    roofShade: PALETTE.terracottaShade,
    glowWindows: true,
  });
  addRoundTower(parts, {
    x: -0.28,
    z: -0.22,
    radiusBottom: 0.2,
    radiusTop: 0.14,
    shaftHeight: 0.72,
    roofHeight: 0.28,
    wallColor: PALETTE.travertine,
    bandColor: PALETTE.timberDark,
    roofColor: PALETTE.slate,
    glowWindow: true,
  });
  addWindmillSails(parts, { x: -0.28, y: 0.66, z: -0.04, radius: 0.42 });
  addRoundTower(parts, {
    x: 0.46,
    z: -0.32,
    radiusBottom: 0.13,
    radiusTop: 0.125,
    shaftHeight: 0.46,
    roofHeight: 0.18,
    wallColor: PALETTE.rubble,
    bandColor: PALETTE.timber,
    roofColor: PALETTE.thatch,
  });
}

function buildFarmTier4(parts: KitParts): void {
  addHexPlotPad(parts, PALETTE.meadowDark, PALETTE.travertineShade, 0.05);
  addStonePerimeterWall(parts, {
    height: 0.2,
    thickness: 0.068,
    wallColor: PALETTE.travertine,
    baseColor: PALETTE.travertineShade,
    capColor: PALETTE.travertineLight,
  });
  parts.masonry.push(piece(cutStoneBlock(0.96, 0.07, 0.72), PALETTE.travertineShade, 0, 0.075, -0.16));
  addWheatBed(parts, -0.32, 0.26, 0.32, 0.28, 0.05);
  addWheatBed(parts, 0.32, 0.26, 0.32, 0.28, -0.05);
  addOrchardTree(parts, -0.44, 0.02, 0.05, 0.95);
  addOrchardTree(parts, 0.44, 0.02, 0.05, 0.95);
  addOrchardTree(parts, 0, 0.34, 0.05, 0.85);
  addGabledHall(parts, {
    x: 0.04,
    y: 0.11,
    z: -0.18,
    width: 0.48,
    depth: 0.42,
    wallHeight: 0.38,
    roofHeight: 0.3,
    wallColor: PALETTE.travertine,
    gableColor: PALETTE.travertineLight,
    plinthColor: PALETTE.rubbleDark,
    roofColor: PALETTE.terracotta,
    roofShade: PALETTE.terracottaShade,
    glowWindows: true,
  });
  addRoundTower(parts, {
    x: -0.34,
    y: 0.11,
    z: -0.26,
    radiusBottom: 0.2,
    radiusTop: 0.145,
    shaftHeight: 0.82,
    roofHeight: 0.3,
    wallColor: PALETTE.travertine,
    bandColor: PALETTE.gold,
    roofColor: PALETTE.slate,
    glowWindow: true,
  });
  addWindmillSails(parts, {
    x: -0.34,
    y: 0.82,
    z: -0.07,
    radius: 0.48,
    frameColor: PALETTE.timberDark,
    sailColor: PALETTE.canvas,
  });
  addRoundTower(parts, {
    x: 0.38,
    y: 0.11,
    z: -0.28,
    radiusBottom: 0.15,
    radiusTop: 0.145,
    shaftHeight: 0.58,
    roofHeight: 0.22,
    wallColor: PALETTE.travertineLight,
    bandColor: PALETTE.bronze,
    roofColor: PALETTE.terracotta,
  });
  addRoundTower(parts, {
    x: 0.12,
    y: 0.11,
    z: -0.48,
    radiusBottom: 0.13,
    radiusTop: 0.125,
    shaftHeight: 0.54,
    roofHeight: 0.2,
    wallColor: PALETTE.travertine,
    bandColor: PALETTE.bronze,
    roofColor: PALETTE.terracottaShade,
  });
}

function buildFarmTier5(parts: KitParts): void {
  addHexPlotPad(parts, PALETTE.travertineShade, PALETTE.rubbleDark, 0.055);
  addStonePerimeterWall(parts, {
    height: 0.24,
    thickness: 0.075,
    wallColor: PALETTE.travertine,
    baseColor: PALETTE.travertineShade,
    capColor: PALETTE.travertineLight,
    goldTrim: true,
  });
  addFortifiedGatehouse(parts, {
    z: 0.62,
    width: 0.36,
    height: 0.32,
    depth: 0.14,
    wallColor: PALETTE.travertine,
    trimColor: PALETTE.travertineLight,
  });
  parts.masonry.push(
    piece(new CylinderGeometry(0.56, 0.62, 0.11, 8), PALETTE.travertineShade, 0, 0.105, -0.1),
    piece(new CylinderGeometry(0.46, 0.5, 0.04, 8), PALETTE.travertineLight, 0, 0.18, -0.1),
  );
  addWheatBed(parts, -0.36, 0.28, 0.28, 0.26, 0.12, 0.055);
  addWheatBed(parts, 0.36, 0.28, 0.28, 0.26, -0.12, 0.055);
  addOrchardTree(parts, -0.48, -0.04, 0.055, 0.9);
  addOrchardTree(parts, 0.48, -0.04, 0.055, 0.9);
  for (const side of [-1, 1]) {
    addGabledHall(parts, {
      x: side * 0.34,
      y: 0.16,
      z: -0.22,
      width: 0.3,
      depth: 0.4,
      wallHeight: 0.34,
      roofHeight: 0.24,
      yaw: side * -0.16,
      wallColor: PALETTE.alabaster,
      gableColor: PALETTE.travertineLight,
      plinthColor: PALETTE.travertineShade,
      roofColor: PALETTE.terracotta,
      roofShade: PALETTE.terracottaShade,
      glowWindows: true,
    });
  }
  addRoundTower(parts, {
    x: 0,
    y: 0.18,
    z: -0.12,
    radiusBottom: 0.25,
    radiusTop: 0.18,
    shaftHeight: 0.98,
    roofHeight: 0.4,
    wallColor: PALETTE.alabaster,
    bandColor: PALETTE.gold,
    roofColor: PALETTE.tealCrown,
    finialColor: PALETTE.goldBright,
    segments: 8,
    glowWindow: true,
  });
  addWindmillSails(parts, {
    x: 0,
    y: 0.98,
    z: 0.11,
    radius: 0.54,
    frameColor: PALETTE.gold,
    sailColor: PALETTE.canvas,
  });
  addBrazier(parts, -0.22, 0.055, 0.52);
  addBrazier(parts, 0.22, 0.055, 0.52);
}

function buildWorkshopTier1(parts: KitParts): void {
  addHexPlotPad(parts, PALETTE.cobble, PALETTE.rubbleDark);
  addSplitRailFence(parts);
  addChimneyStack(parts, { x: -0.26, z: -0.22, width: 0.14, height: 0.52, glowHearth: true });
  for (const sx of [-0.08, 0.34]) {
    for (const sz of [-0.36, 0.06]) {
      parts.masonry.push(piece(new BoxGeometry(0.038, 0.32, 0.038), PALETTE.timberDark, sx, 0.2, sz));
    }
  }
  parts.masonry.push(
    piece(new BoxGeometry(0.52, 0.042, 0.52).rotateZ(-0.2), PALETTE.timber, 0.13, 0.38, -0.15),
    piece(new BoxGeometry(0.32, 0.032, 0.14), PALETTE.timberLight, 0.14, 0.15, -0.18),
    piece(new BoxGeometry(0.28, 0.07, 0.12), PALETTE.timber, -0.14, 0.075, 0.34, 0.2),
  );
  addAnvilStation(parts, 0.22, 0.24);
}

function buildWorkshopTier2(parts: KitParts): void {
  addHexPlotPad(parts, PALETTE.cobble, PALETTE.rubbleDark);
  addSplitRailFence(parts);
  addGabledHall(parts, {
    x: 0.12,
    z: -0.2,
    width: 0.5,
    depth: 0.42,
    wallHeight: 0.32,
    roofHeight: 0.28,
    wallColor: PALETTE.rubble,
    gableColor: PALETTE.plasterShade,
    plinthColor: PALETTE.rubbleDark,
    roofColor: PALETTE.timber,
    roofShade: PALETTE.timberDark,
    glowWindows: true,
  });
  addChimneyStack(parts, { x: -0.24, z: -0.26, width: 0.16, height: 0.76, glowHearth: true });
  parts.masonry.push(
    piece(new BoxGeometry(0.28, 0.036, 0.32).rotateZ(0.24), PALETTE.timberDark, -0.26, 0.26, 0.02),
    piece(new BoxGeometry(0.18, 0.08, 0.16), PALETTE.iron, -0.3, 0.08, 0.28),
  );
  addAnvilStation(parts, 0.2, 0.24);
  addTierBanner(parts, {
    x: 0.42,
    y: 0.04,
    z: -0.14,
    poleHeight: 0.58,
    clothColor: PALETTE.terracotta,
    trimColor: PALETTE.steel,
  });
}

function buildWorkshopTier3(parts: KitParts): void {
  addHexPlotPad(parts, PALETTE.cobble, PALETTE.rubbleDark);
  addStonePerimeterWall(parts, {
    height: 0.18,
    thickness: 0.062,
    wallColor: PALETTE.rubble,
    baseColor: PALETTE.rubbleDark,
    capColor: PALETTE.cobble,
  });
  addGabledHall(parts, {
    x: -0.02,
    z: -0.18,
    width: 0.62,
    depth: 0.44,
    wallHeight: 0.44,
    roofHeight: 0.32,
    wallColor: PALETTE.travertine,
    gableColor: PALETTE.plaster,
    plinthColor: PALETTE.rubbleDark,
    roofColor: PALETTE.slate,
    roofShade: PALETTE.slateShade,
    glowWindows: true,
  });
  parts.masonry.push(
    piece(new BoxGeometry(0.26, 0.1, 0.16), PALETTE.timberDark, -0.02, 0.78, -0.18),
    piece(new BoxGeometry(0.3, 0.035, 0.2), PALETTE.slateShade, -0.02, 0.84, -0.18),
  );
  addChimneyStack(parts, { x: -0.36, z: -0.3, width: 0.15, height: 1.0, bandColor: PALETTE.bronze, glowHearth: true });
  addChimneyStack(parts, { x: 0.32, z: -0.3, width: 0.14, height: 0.9, bandColor: PALETTE.bronze, glowHearth: false });
  addCraneArm(parts, 0.26, 0.24, 0.56, -2.5);
  addAnvilStation(parts, -0.18, 0.26);
}

function buildWorkshopTier4(parts: KitParts): void {
  addHexPlotPad(parts, PALETTE.cobbleDark, PALETTE.rubbleDark, 0.05);
  addStonePerimeterWall(parts, {
    height: 0.22,
    thickness: 0.07,
    wallColor: PALETTE.rubble,
    baseColor: PALETTE.rubbleDark,
    capColor: PALETTE.travertineShade,
  });
  addGabledHall(parts, {
    x: -0.08,
    y: 0.05,
    z: -0.18,
    width: 0.62,
    depth: 0.5,
    wallHeight: 0.5,
    roofHeight: 0.34,
    wallColor: PALETTE.travertine,
    gableColor: PALETTE.travertineShade,
    plinthColor: PALETTE.rubbleDark,
    roofColor: PALETTE.slate,
    roofShade: PALETTE.slateShade,
    glowWindows: true,
  });
  parts.masonry.push(
    piece(new BoxGeometry(0.36, 0.14, 0.24), PALETTE.travertineShade, -0.08, 0.88, -0.18),
    piece(new BoxGeometry(0.4, 0.04, 0.28), PALETTE.slateShade, -0.08, 0.96, -0.18),
  );
  parts.glow.push(
    piece(new BoxGeometry(0.28, 0.07, 0.255), PALETTE.forgeCore, -0.08, 0.88, -0.18),
    piece(new BoxGeometry(0.18, 0.14, 0.03), PALETTE.forgeEmber, -0.08, 0.18, 0.08),
  );
  addChimneyStack(parts, {
    x: -0.42,
    y: 0.05,
    z: -0.28,
    width: 0.16,
    height: 1.24,
    stoneColor: PALETTE.travertineShade,
    bandColor: PALETTE.gold,
    glowHearth: true,
  });
  addChimneyStack(parts, {
    x: 0.22,
    y: 0.05,
    z: -0.36,
    width: 0.15,
    height: 1.14,
    stoneColor: PALETTE.travertineShade,
    bandColor: PALETTE.gold,
    glowHearth: false,
  });
  addWaterwheel(parts, 0.38, 0.3, 0.08, 0.23);
  addCraneArm(parts, -0.3, 0.28, 0.62, -0.4, 0.05);
  addAnvilStation(parts, 0.04, 0.34, 0.05);
}

function buildWorkshopTier5(parts: KitParts): void {
  addHexPlotPad(parts, PALETTE.cobbleDark, PALETTE.rubbleDark, 0.055);
  addStonePerimeterWall(parts, {
    height: 0.25,
    thickness: 0.075,
    wallColor: PALETTE.travertine,
    baseColor: PALETTE.rubbleDark,
    capColor: PALETTE.travertineLight,
    goldTrim: true,
  });
  addFortifiedGatehouse(parts, {
    z: 0.62,
    width: 0.4,
    height: 0.34,
    depth: 0.14,
    wallColor: PALETTE.travertine,
    trimColor: PALETTE.travertineLight,
  });
  parts.masonry.push(piece(new CylinderGeometry(0.56, 0.6, 0.1, 8), PALETTE.rubbleDark, 0, 0.105, -0.12));
  for (const side of [-1, 1]) {
    addGabledHall(parts, {
      x: side * 0.38,
      y: 0.14,
      z: -0.18,
      width: 0.28,
      depth: 0.44,
      wallHeight: 0.38,
      roofHeight: 0.24,
      wallColor: PALETTE.travertine,
      gableColor: PALETTE.travertineLight,
      plinthColor: PALETTE.rubbleDark,
      roofColor: PALETTE.slate,
      roofShade: PALETTE.slateShade,
      glowWindows: true,
    });
    addChimneyStack(parts, {
      x: side * 0.36,
      y: 0.14,
      z: -0.44,
      width: 0.13,
      height: 1.18,
      stoneColor: PALETTE.rubble,
      bandColor: PALETTE.gold,
      glowHearth: false,
    });
  }
  parts.masonry.push(
    piece(new CylinderGeometry(0.28, 0.33, 0.78, 8), PALETTE.alabaster, 0, 0.54, -0.12),
    piece(new CylinderGeometry(0.31, 0.31, 0.045, 8), PALETTE.gold, 0, 0.92, -0.12),
    piece(new CylinderGeometry(0.33, 0.33, 0.036, 8), PALETTE.bronze, 0, 0.56, -0.12),
    piece(new SphereGeometry(0.28, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55), PALETTE.bronze, 0, 0.93, -0.12),
    piece(new CylinderGeometry(0.08, 0.11, 0.16, 8), PALETTE.slate, 0, 1.24, -0.12),
    piece(new ConeGeometry(0.095, 0.2, 8), PALETTE.goldBright, 0, 1.41, -0.12),
  );
  for (let i = 0; i < 4; i++) {
    const yaw = (i * Math.PI) / 2;
    const rib = new TorusGeometry(0.285, 0.016, 5, 12, Math.PI).rotateY(yaw);
    parts.masonry.push(piece(rib, PALETTE.gold, 0, 0.93, -0.12));
  }
  parts.glow.push(
    piece(new BoxGeometry(0.18, 0.2, 0.04), PALETTE.forgeEmber, 0, 0.26, 0.2),
    piece(new BoxGeometry(0.11, 0.12, 0.048), PALETTE.forgeCore, 0, 0.24, 0.21),
    piece(new CylinderGeometry(0.09, 0.09, 0.08, 8), PALETTE.forgeCore, 0, 1.23, -0.12),
    piece(new BoxGeometry(0.07, 0.12, 0.03), PALETTE.windowAmber, 0, 0.72, 0.17),
  );
  addCraneArm(parts, -0.34, 0.28, 0.56, -0.35, 0.055);
  addAnvilStation(parts, 0.28, 0.3, 0.055);
  addBrazier(parts, -0.22, 0.055, 0.52);
  addBrazier(parts, 0.22, 0.055, 0.52);
}

function buildBarracksTier1(parts: KitParts): void {
  addHexPlotPad(parts, PALETTE.cobble, PALETTE.soilDark);
  addPalisadePerimeter(parts, 0.04, 0.22);
  addCanvasTent(parts, -0.16, -0.22, 0.44, 0.48, 0.34, 0.12);
  addWeaponRack(parts, 0.32, -0.14, -0.3);
  addTrainingProps(parts, 0.22, 0.26);
  addTrainingProps(parts, -0.24, 0.28);
  addTierBanner(parts, {
    x: 0.28,
    y: 0.04,
    z: -0.38,
    poleHeight: 0.58,
    clothColor: PALETTE.crimson,
    trimColor: PALETTE.gold,
  });
}

function buildBarracksTier2(parts: KitParts): void {
  addHexPlotPad(parts, PALETTE.cobble, PALETTE.rubbleDark);
  addPalisadePerimeter(parts, 0.04, 0.25);
  addGabledHall(parts, {
    x: -0.08,
    z: -0.22,
    width: 0.54,
    depth: 0.42,
    wallHeight: 0.34,
    roofHeight: 0.26,
    wallColor: PALETTE.rubble,
    gableColor: PALETTE.plasterShade,
    plinthColor: PALETTE.rubbleDark,
    roofColor: PALETTE.terracotta,
    roofShade: PALETTE.terracottaShade,
    glowWindows: true,
  });
  addSquareTower(parts, {
    x: 0.34,
    z: -0.18,
    size: 0.24,
    height: 0.54,
    wallColor: PALETTE.timber,
    trimColor: PALETTE.timberDark,
    roofColor: PALETTE.slate,
    roofHeight: 0.2,
    crenelated: false,
  });
  addWeaponRack(parts, -0.28, 0.24, 0.25);
  addTrainingProps(parts, 0.24, 0.26);
  addTierBanner(parts, {
    x: -0.36,
    y: 0.04,
    z: -0.28,
    poleHeight: 0.72,
    clothColor: PALETTE.crimson,
    trimColor: PALETTE.steel,
  });
}

function buildBarracksTier3(parts: KitParts): void {
  addHexPlotPad(parts, PALETTE.cobble, PALETTE.rubbleDark);
  addStonePerimeterWall(parts, {
    height: 0.22,
    thickness: 0.072,
    wallColor: PALETTE.travertine,
    baseColor: PALETTE.rubbleDark,
    capColor: PALETTE.travertineLight,
    crenelated: true,
  });
  addGabledHall(parts, {
    x: -0.12,
    z: -0.2,
    width: 0.56,
    depth: 0.44,
    wallHeight: 0.44,
    roofHeight: 0.28,
    wallColor: PALETTE.travertine,
    gableColor: PALETTE.travertineShade,
    plinthColor: PALETTE.rubbleDark,
    roofColor: PALETTE.terracotta,
    roofShade: PALETTE.terracottaShade,
    glowWindows: true,
  });
  addSquareTower(parts, {
    x: 0.34,
    z: -0.2,
    size: 0.28,
    height: 0.86,
    wallColor: PALETTE.travertine,
    trimColor: PALETTE.travertineLight,
    crenelated: true,
    glowSlits: true,
  });
  addTierBanner(parts, {
    x: 0.34,
    y: 0.92,
    z: -0.2,
    poleHeight: 0.28,
    clothColor: PALETTE.crimson,
    trimColor: PALETTE.gold,
  });
  addWeaponRack(parts, -0.28, 0.24, 0.2);
  addTrainingProps(parts, 0.24, 0.28);
}

function buildBarracksTier4(parts: KitParts): void {
  addHexPlotPad(parts, PALETTE.travertineShade, PALETTE.rubbleDark, 0.05);
  addStonePerimeterWall(parts, {
    height: 0.28,
    thickness: 0.082,
    wallColor: PALETTE.alabaster,
    baseColor: PALETTE.alabasterShade,
    capColor: PALETTE.alabasterLight,
    crenelated: true,
  });
  addFortifiedGatehouse(parts, {
    z: 0.62,
    width: 0.4,
    height: 0.38,
    depth: 0.16,
    wallColor: PALETTE.alabaster,
    trimColor: PALETTE.alabasterLight,
    portcullis: true,
  });
  addGabledHall(parts, {
    x: 0,
    y: 0.05,
    z: -0.26,
    width: 0.68,
    depth: 0.42,
    wallHeight: 0.48,
    roofHeight: 0.3,
    wallColor: PALETTE.alabaster,
    gableColor: PALETTE.alabasterShade,
    plinthColor: PALETTE.rubbleDark,
    roofColor: PALETTE.slate,
    roofShade: PALETTE.slateShade,
    glowWindows: true,
  });
  for (const side of [-1, 1]) {
    addSquareTower(parts, {
      x: side * 0.38,
      y: 0.05,
      z: -0.08,
      size: 0.27,
      height: 0.92,
      wallColor: PALETTE.alabaster,
      trimColor: PALETTE.alabasterLight,
      roofColor: PALETTE.slate,
      roofHeight: 0.26,
      crenelated: true,
      goldBand: true,
      glowSlits: true,
    });
    addBrazier(parts, side * 0.24, 0.05, 0.48);
  }
  addTierBanner(parts, {
    x: -0.38,
    y: 0.96,
    z: 0.08,
    poleHeight: 0.32,
    clothColor: PALETTE.crimson,
    trimColor: PALETTE.goldBright,
  });
  addTierBanner(parts, {
    x: 0.38,
    y: 0.96,
    z: 0.08,
    poleHeight: 0.32,
    clothColor: PALETTE.crimson,
    trimColor: PALETTE.goldBright,
  });
  addTrainingProps(parts, 0, 0.22, 0.05);
}

function buildBarracksTier5(parts: KitParts): void {
  addHexPlotPad(parts, PALETTE.alabasterShade, PALETTE.rubbleDark, 0.055);
  addStonePerimeterWall(parts, {
    height: 0.32,
    thickness: 0.088,
    wallColor: PALETTE.alabaster,
    baseColor: PALETTE.alabasterShade,
    capColor: PALETTE.alabasterLight,
    crenelated: true,
    goldTrim: true,
  });
  addFortifiedGatehouse(parts, {
    z: 0.62,
    width: 0.46,
    height: 0.44,
    depth: 0.18,
    wallColor: PALETTE.alabaster,
    trimColor: PALETTE.alabasterLight,
    portcullis: true,
  });
  parts.masonry.push(
    piece(new BoxGeometry(0.16, 0.016, 0.52), PALETTE.crimson, 0, 0.064, 0.32),
    piece(cutStoneBlock(0.96, 0.11, 0.68), PALETTE.alabasterShade, 0, 0.11, -0.18),
  );
  for (const side of [-1, 1]) {
    addGabledHall(parts, {
      x: side * 0.36,
      y: 0.16,
      z: -0.22,
      width: 0.28,
      depth: 0.42,
      wallHeight: 0.42,
      roofHeight: 0.24,
      wallColor: PALETTE.alabaster,
      gableColor: PALETTE.alabasterLight,
      plinthColor: PALETTE.alabasterShade,
      roofColor: PALETTE.slate,
      roofShade: PALETTE.slateShade,
      glowWindows: true,
    });
    addRoundTower(parts, {
      x: side * 0.42,
      y: 0.055,
      z: 0.18,
      radiusBottom: 0.15,
      radiusTop: 0.135,
      shaftHeight: 0.72,
      roofHeight: 0.28,
      wallColor: PALETTE.alabaster,
      bandColor: PALETTE.gold,
      roofColor: PALETTE.slate,
      finialColor: PALETTE.goldBright,
      segments: 8,
    });
    addTierBanner(parts, {
      x: side * 0.42,
      y: 0.78,
      z: 0.32,
      poleHeight: 0.34,
      clothColor: PALETTE.crimson,
      trimColor: PALETTE.goldBright,
    });
    addBrazier(parts, side * 0.24, 0.055, 0.48);
  }
  addSquareTower(parts, {
    x: 0,
    y: 0.16,
    z: -0.18,
    size: 0.38,
    height: 1.04,
    wallColor: PALETTE.alabasterLight,
    trimColor: PALETTE.alabaster,
    roofColor: PALETTE.slate,
    roofHeight: 0.38,
    crenelated: true,
    goldBand: true,
    glowSlits: true,
  });
}
