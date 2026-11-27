import { rankName, RealmLevels } from "@bibliothecadao/types";
import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three";
import MeshStandardNodeMaterial from "three/src/materials/nodes/MeshStandardNodeMaterial.js";
import { attribute, varying } from "three/tsl";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { createProcgenMasonryMaterial } from "./procgen-masonry-material";
import {
  beamBetween,
  combineParts,
  cutStoneBlock,
  extrudedGable,
  type KitPart,
  type KitParts,
  piece,
  REALM_KIT_LEVELS,
  type WallSegment,
} from "./realm-kit-primitives";

const BASE_REALM_KIT_PREFIX = "procedural:base-realm:";
const BASE_REALM_GLOW_KEY = "eternum-base-realm-glow-v1";
const BASE_REALM_GLOW_INTENSITY = 1.35;

interface BaseRealmAssetMeta {
  readonly id: string;
  readonly label: string;
  readonly level: RealmLevels;
  readonly wonder: false;
  readonly path: string;
}

const BASE_PALETTE = {
  plaster: "#e4d8c0",
  plasterShade: "#d4c5a8",
  rubble: "#8f8878",
  rubbleDark: "#746d5f",
  timber: "#5e3e26",
  timberDark: "#442c1a",
  timberLight: "#7c5636",
  thatch: "#cfb27a",
  thatchShade: "#b89962",
  canvas: "#efe6d2",
  canvasShade: "#d9ccb0",
  iron: "#3a3938",
  travertine: "#e1d8c6",
  travertineLight: "#efe8da",
  travertineShade: "#c7bca7",
  terracotta: "#b85f34",
  terracottaShade: "#984a26",
  alabaster: "#e4e4e0",
  alabasterLight: "#f2f2ee",
  alabasterShade: "#caccc9",
  imperialMarble: "#ecece8",
  imperialLight: "#f6f6f3",
  imperialShade: "#d2d3d0",
  slate: "#3c5269",
  slateShade: "#2f4255",
  tealSpire: "#1f6664",
  tealSpireShade: "#185250",
  gold: "#cda44b",
  goldBright: "#deb75e",
  windowAmber: "#ffb84d",
  emberOrange: "#ff8c28",
  flameGold: "#ffd26a",
  essenceTeal: "#4ef0e0",
} as const;

const POINTY_HEX_PERIMETER: readonly (readonly [number, number])[] = [
  [-0.2, 0.7],
  [-0.7, 0.4],
  [-0.7, -0.4],
  [0, -0.78],
  [0.7, -0.4],
  [0.7, 0.4],
  [0.2, 0.7],
];

const POINTY_HEX_WALL_SEGMENTS: readonly WallSegment[] = POINTY_HEX_PERIMETER.slice(0, -1).map((from, index) => ({
  from,
  to: POINTY_HEX_PERIMETER[index + 1]!,
}));

const BASE_REALM_META = {
  [RealmLevels.Settlement]: { id: "settlement", label: () => "Canvas & Thatch" },
  [RealmLevels.City]: { id: "city", label: () => "Terrace Forum" },
  [RealmLevels.Kingdom]: { id: "kingdom", label: () => "Twin Ward" },
  [RealmLevels.Empire]: { id: "empire", label: () => rankName(RealmLevels.Empire) },
} as const satisfies Record<RealmLevels, { readonly id: string; readonly label: () => string }>;

const BASE_REALM_BUILDERS = {
  [RealmLevels.Settlement]: buildSettlement,
  [RealmLevels.City]: buildCity,
  [RealmLevels.Kingdom]: buildKingdom,
  [RealmLevels.Empire]: buildEmpire,
} as const satisfies Record<RealmLevels, (parts: KitParts) => void>;

export const BASE_REALM_KIT_LEVELS = REALM_KIT_LEVELS;

export function baseRealmKitPath(level: RealmLevels): string {
  return `${BASE_REALM_KIT_PREFIX}${level}`;
}

export const BASE_REALM_ASSETS: readonly BaseRealmAssetMeta[] = BASE_REALM_KIT_LEVELS.map((level) => ({
  id: BASE_REALM_META[level].id,
  label: BASE_REALM_META[level].label(),
  level,
  wonder: false,
  path: baseRealmKitPath(level),
}));

export function parseBaseRealmKitPath(path: string): RealmLevels | null {
  if (!path.startsWith(BASE_REALM_KIT_PREFIX)) return null;
  const levelText = path.slice(BASE_REALM_KIT_PREFIX.length);
  if (!/^\d+$/.test(levelText)) return null;
  const level = Number(levelText);
  return BASE_REALM_KIT_LEVELS.some((rank) => rank === level) ? (level as RealmLevels) : null;
}

export function isBaseRealmKitPath(path: string): boolean {
  return parseBaseRealmKitPath(path) !== null;
}

export function createBaseRealmKit(level: RealmLevels): GLTF {
  const parts: KitParts = { masonry: [], glow: [], anchors: [] };
  BASE_REALM_BUILDERS[level](parts);
  return assembleBaseRealmGltf(`base-realm-${BASE_REALM_META[level].id}`, parts);
}

class BaseRealmGlowNodeMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();
    this.name = "Base realm glow";
    this.roughness = 0.28;
    this.metalness = 0.1;
    this.flatShading = false;
    const glow = varying(attribute("color", "vec3"), "vBaseRealmGlow");
    this.colorNode = glow;
    this.emissiveNode = glow.mul(BASE_REALM_GLOW_INTENSITY);
  }

  override customProgramCacheKey(): string {
    return BASE_REALM_GLOW_KEY;
  }
}

function assembleBaseRealmGltf(name: string, parts: KitParts): GLTF {
  const scene = new Group();
  scene.name = name;
  const masonryMesh = new Mesh(combineParts(parts.masonry), createProcgenMasonryMaterial());
  masonryMesh.name = `${name}:masonry`;
  scene.add(masonryMesh);
  if (parts.glow.length > 0) {
    const glowMesh = new Mesh(combineParts(parts.glow), new BaseRealmGlowNodeMaterial());
    glowMesh.name = `${name}:glow`;
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

function buildSettlement(parts: KitParts): void {
  addTimberPalisade(parts);
  addTimberGatePosts(parts);
  addWallBanners(parts, {
    slots: [
      { x: -0.34, y: 0.3, z: 0.67 },
      { x: 0.34, y: 0.3, z: 0.67 },
    ],
    width: 0.11,
    railColor: BASE_PALETTE.timberDark,
  });

  addTimberCottage(parts, {
    x: -0.34,
    z: 0.05,
    width: 0.34,
    depth: 0.46,
    wallHeight: 0.28,
    roofHeight: 0.3,
    yaw: 0.04,
    hasChimney: true,
  });
  addTimberCottage(parts, {
    x: 0.34,
    z: 0.06,
    width: 0.32,
    depth: 0.44,
    wallHeight: 0.26,
    roofHeight: 0.27,
    yaw: -0.04,
    hasChimney: false,
  });

  addMarketCanopy(parts, -0.14, -0.38);
  addCanvasTent(parts, 0.24, -0.32);
  addCampfireCourtyard(parts, 0, 0.18);
}

function buildCity(parts: KitParts): void {
  addPointyHexCurtainWall(parts, {
    height: 0.34,
    thickness: 0.09,
    wallColor: BASE_PALETTE.travertine,
    baseColor: BASE_PALETTE.travertineShade,
    capColor: BASE_PALETTE.travertineLight,
    crenelated: false,
  });
  addPerimeterPilasters(parts, 0.38, 0.125, BASE_PALETTE.travertineShade, BASE_PALETTE.travertineLight);
  addSouthGatehouse(parts, {
    height: 0.42,
    width: 0.44,
    depth: 0.18,
    wallColor: BASE_PALETTE.travertine,
    baseColor: BASE_PALETTE.travertineShade,
    capColor: BASE_PALETTE.travertineLight,
    crenelated: false,
  });
  addForumTerrace(parts);
  addForumBasilica(parts);
  addForumSideWing(parts, -0.43, -0.08);
  addForumSideWing(parts, 0.43, -0.08);
  addWallBanners(parts, {
    slots: [
      { x: -0.38, y: 0.56, z: 0.33 },
      { x: 0.38, y: 0.56, z: 0.33 },
    ],
    width: 0.125,
    railColor: BASE_PALETTE.gold,
  });
}

function buildKingdom(parts: KitParts): void {
  addPointyHexCurtainWall(parts, {
    height: 0.42,
    thickness: 0.1,
    wallColor: BASE_PALETTE.alabaster,
    baseColor: BASE_PALETTE.alabasterShade,
    capColor: BASE_PALETTE.alabasterLight,
    crenelated: true,
  });
  addPerimeterPilasters(parts, 0.52, 0.145, BASE_PALETTE.alabasterShade, BASE_PALETTE.alabasterLight);
  addSouthGatehouse(parts, {
    height: 0.54,
    width: 0.46,
    depth: 0.2,
    wallColor: BASE_PALETTE.alabaster,
    baseColor: BASE_PALETTE.alabasterShade,
    capColor: BASE_PALETTE.alabasterLight,
    crenelated: true,
  });

  addSquareKeep(parts, {
    x: -0.31,
    z: -0.14,
    size: 0.39,
    shaftHeight: 1.38,
    roofHeight: 0.42,
    crystalY: 1.98,
  });
  addSquareKeep(parts, {
    x: 0.31,
    z: -0.07,
    size: 0.36,
    shaftHeight: 1.12,
    roofHeight: 0.36,
    crystalY: 1.66,
  });
  addTwinSkybridge(parts, -0.1, 0.84);
  addRearCastleHall(parts);
  addWallBanners(parts, {
    slots: [
      { x: -0.31, y: 0.96, z: 0.08 },
      { x: 0.31, y: 0.82, z: 0.13 },
    ],
    width: 0.125,
    railColor: BASE_PALETTE.gold,
  });
}

function buildEmpire(parts: KitParts): void {
  addPointyHexCurtainWall(parts, {
    height: 0.48,
    thickness: 0.11,
    wallColor: BASE_PALETTE.imperialMarble,
    baseColor: BASE_PALETTE.imperialShade,
    capColor: BASE_PALETTE.imperialLight,
    crenelated: true,
    goldBandY: 0.28,
  });
  addPerimeterPilasters(parts, 0.58, 0.16, BASE_PALETTE.imperialShade, BASE_PALETTE.imperialLight);
  addSouthGatehouse(parts, {
    height: 0.62,
    width: 0.48,
    depth: 0.22,
    wallColor: BASE_PALETTE.imperialMarble,
    baseColor: BASE_PALETTE.imperialShade,
    capColor: BASE_PALETTE.imperialLight,
    crenelated: true,
    goldBandY: 0.42,
  });

  addImperialDrumKeep(parts);
  addImperialTurret(parts, -0.45, -0.16, 1.32);
  addImperialTurret(parts, 0.45, -0.16, 1.32);
  addImperialTurret(parts, 0, -0.48, 1.46);
  addWallBanners(parts, {
    slots: [
      { x: -0.45, y: 1.06, z: 0.02 },
      { x: 0.45, y: 1.06, z: 0.02 },
    ],
    width: 0.135,
    railColor: BASE_PALETTE.goldBright,
  });
}

function addTimberPalisade(parts: KitParts): void {
  for (let segIdx = 0; segIdx < POINTY_HEX_WALL_SEGMENTS.length; segIdx++) {
    const { from, to } = POINTY_HEX_WALL_SEGMENTS[segIdx]!;
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const stakes = Math.max(5, Math.round(length / 0.08));
    for (let i = 0; i <= stakes; i++) {
      const t = i / stakes;
      const sx = from[0] + dx * t;
      const sz = from[1] + dz * t;
      const height = 0.25 + ((i + segIdx) % 3) * 0.018;
      const color = (i + segIdx) % 2 === 0 ? BASE_PALETTE.timber : BASE_PALETTE.timberLight;
      parts.masonry.push(
        piece(new CylinderGeometry(0.029, 0.034, height, 7), color, sx, height / 2, sz),
        piece(new ConeGeometry(0.029, 0.055, 7), BASE_PALETTE.timberDark, sx, height + 0.0275, sz),
      );
    }
    const mx = (from[0] + to[0]) / 2;
    const mz = (from[1] + to[1]) / 2;
    parts.masonry.push(
      piece(new BoxGeometry(0.032, 0.03, length + 0.02), BASE_PALETTE.timberDark, mx, 0.09, mz, yaw),
      piece(new BoxGeometry(0.032, 0.03, length + 0.02), BASE_PALETTE.timberDark, mx, 0.2, mz, yaw),
    );
  }
}

function addTimberGatePosts(parts: KitParts): void {
  for (const side of [-1, 1]) {
    parts.masonry.push(
      piece(new CylinderGeometry(0.044, 0.052, 0.36, 8), BASE_PALETTE.timberDark, side * 0.2, 0.18, 0.7),
      piece(new ConeGeometry(0.048, 0.06, 8), BASE_PALETTE.timber, side * 0.2, 0.39, 0.7),
      piece(cutStoneBlock(0.1, 0.07, 0.1), BASE_PALETTE.rubble, side * 0.2, 0.035, 0.7),
    );
  }
}

function addTimberCottage(
  parts: KitParts,
  options: {
    x: number;
    z: number;
    width: number;
    depth: number;
    wallHeight: number;
    roofHeight: number;
    yaw: number;
    hasChimney: boolean;
  },
): void {
  const { x, z, width, depth, wallHeight, roofHeight, yaw, hasChimney } = options;
  const addLocal = (target: KitPart[], geometry: BufferGeometry, color: string, lx = 0, ly = 0, lz = 0, lyaw = 0) => {
    geometry.rotateY(lyaw).translate(lx, ly, lz);
    geometry.rotateY(yaw).translate(x, 0, z);
    target.push({ geometry, color });
  };

  const plinthH = 0.06;
  addLocal(parts.masonry, cutStoneBlock(width + 0.03, plinthH, depth + 0.03), BASE_PALETTE.rubble, 0, plinthH / 2, 0);
  addLocal(
    parts.masonry,
    new BoxGeometry(width, wallHeight - plinthH, depth),
    BASE_PALETTE.plaster,
    0,
    plinthH + (wallHeight - plinthH) / 2,
    0,
  );
  addLocal(parts.masonry, extrudedGable(width, roofHeight * 0.88, depth), BASE_PALETTE.plasterShade, 0, wallHeight, 0);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addLocal(
        parts.masonry,
        new BoxGeometry(0.036, wallHeight, 0.036),
        BASE_PALETTE.timberDark,
        sx * (width / 2 - 0.01),
        wallHeight / 2,
        sz * (depth / 2 - 0.01),
      );
    }
    addLocal(
      parts.masonry,
      new BoxGeometry(0.032, 0.032, depth + 0.02),
      BASE_PALETTE.timberDark,
      sx * (width / 2 - 0.008),
      wallHeight - 0.01,
      0,
    );
  }
  for (const sz of [-1, 1]) {
    addLocal(
      parts.masonry,
      new BoxGeometry(width + 0.02, 0.032, 0.032),
      BASE_PALETTE.timberDark,
      0,
      wallHeight - 0.01,
      sz * (depth / 2 - 0.006),
    );
    addLocal(
      parts.masonry,
      new BoxGeometry(width + 0.01, 0.026, 0.026),
      BASE_PALETTE.timber,
      0,
      wallHeight * 0.56,
      sz * (depth / 2 - 0.004),
    );
  }

  const overhangX = width + 0.09;
  const overhangZ = depth + 0.09;
  const halfSpan = overhangX / 2;
  const slopeLength = Math.hypot(halfSpan, roofHeight);
  const slopeAngle = Math.atan2(roofHeight, halfSpan);
  for (const side of [-1, 1]) {
    const roofPlane = new BoxGeometry(slopeLength + 0.03, 0.055, overhangZ).rotateZ(-side * slopeAngle);
    addLocal(
      parts.masonry,
      roofPlane,
      side === -1 ? BASE_PALETTE.thatch : BASE_PALETTE.thatchShade,
      side * (halfSpan * 0.48),
      wallHeight + roofHeight * 0.47,
      0,
    );
  }
  addLocal(
    parts.masonry,
    new CylinderGeometry(0.032, 0.032, overhangZ + 0.03, 8).rotateX(Math.PI / 2),
    BASE_PALETTE.thatchShade,
    0,
    wallHeight + roofHeight - 0.01,
    0,
  );
  addLocal(parts.masonry, new BoxGeometry(0.1, 0.16, 0.034), BASE_PALETTE.timber, 0, 0.08, depth / 2 + 0.008);
  addLocal(parts.masonry, new BoxGeometry(0.125, 0.028, 0.042), BASE_PALETTE.timberDark, 0, 0.17, depth / 2 + 0.01);

  addLocal(
    parts.glow,
    new BoxGeometry(0.072, 0.072, 0.022),
    BASE_PALETTE.windowAmber,
    0,
    wallHeight + roofHeight * 0.34,
    depth / 2 + 0.008,
  );
  addLocal(
    parts.glow,
    new BoxGeometry(0.022, 0.078, 0.086),
    BASE_PALETTE.windowAmber,
    (x < 0 ? 1 : -1) * (width / 2 + 0.006),
    wallHeight * 0.62,
    0.02,
  );

  if (hasChimney) {
    addLocal(
      parts.masonry,
      cutStoneBlock(0.095, 0.25, 0.095),
      BASE_PALETTE.rubbleDark,
      -width * 0.18,
      wallHeight + roofHeight * 0.78,
      -depth * 0.14,
    );
    addLocal(
      parts.masonry,
      cutStoneBlock(0.12, 0.032, 0.12),
      BASE_PALETTE.rubble,
      -width * 0.18,
      wallHeight + roofHeight * 0.78 + 0.135,
      -depth * 0.14,
    );
  }
}

function addMarketCanopy(parts: KitParts, x: number, z: number): void {
  const width = 0.42;
  const depth = 0.28;
  const frontH = 0.34;
  const backH = 0.27;
  for (const sx of [-1, 1]) {
    parts.masonry.push(
      piece(
        new CylinderGeometry(0.018, 0.022, frontH, 6),
        BASE_PALETTE.timberDark,
        x + sx * 0.18,
        frontH / 2,
        z + 0.11,
      ),
      piece(new CylinderGeometry(0.018, 0.022, backH, 6), BASE_PALETTE.timberDark, x + sx * 0.18, backH / 2, z - 0.11),
    );
  }
  parts.masonry.push(
    piece(new BoxGeometry(width, 0.026, depth + 0.06).rotateX(-0.22), BASE_PALETTE.canvas, x, 0.31, z),
    piece(new BoxGeometry(width * 0.3, 0.03, depth + 0.065).rotateX(-0.22), BASE_PALETTE.canvasShade, x, 0.313, z),
    piece(new BoxGeometry(0.11, 0.095, 0.095), BASE_PALETTE.timberLight, x - 0.09, 0.0475, z + 0.02),
    piece(new BoxGeometry(0.085, 0.08, 0.085), BASE_PALETTE.timber, x - 0.08, 0.135, z + 0.01, 0.3),
    piece(new CylinderGeometry(0.045, 0.042, 0.105, 10), BASE_PALETTE.timber, x + 0.08, 0.0525, z + 0.01),
    piece(new TorusGeometry(0.045, 0.008, 5, 10).rotateX(Math.PI / 2), BASE_PALETTE.iron, x + 0.08, 0.078, z + 0.01),
    piece(new BoxGeometry(0.1, 0.085, 0.09), BASE_PALETTE.timberLight, x + 0.12, 0.0425, z - 0.05),
  );
}

function addCanvasTent(parts: KitParts, x: number, z: number): void {
  parts.masonry.push(
    piece(new ConeGeometry(0.17, 0.38, 6), BASE_PALETTE.canvas, x, 0.19, z),
    piece(new CylinderGeometry(0.012, 0.012, 0.43, 6), BASE_PALETTE.timberDark, x, 0.215, z),
    piece(new BoxGeometry(0.07, 0.16, 0.03), BASE_PALETTE.timberDark, x, 0.08, z + 0.11),
  );
}

function addCampfireCourtyard(parts: KitParts, x: number, z: number): void {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    parts.masonry.push(
      piece(
        new SphereGeometry(0.03, 7, 5).scale(1.15, 0.65, 0.95),
        i % 2 === 0 ? BASE_PALETTE.rubble : BASE_PALETTE.rubbleDark,
        x + Math.cos(angle) * 0.095,
        0.021,
        z + Math.sin(angle) * 0.095,
      ),
    );
  }
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI;
    parts.masonry.push(
      piece(
        new CylinderGeometry(0.013, 0.015, 0.15, 6).rotateZ(Math.PI / 2 - 0.24),
        BASE_PALETTE.timberDark,
        x,
        0.036,
        z,
        angle,
      ),
    );
  }
  parts.glow.push(
    piece(new CylinderGeometry(0.065, 0.075, 0.02, 8), BASE_PALETTE.emberOrange, x, 0.013, z),
    piece(new ConeGeometry(0.045, 0.115, 7), BASE_PALETTE.flameGold, x, 0.075, z),
    piece(new ConeGeometry(0.026, 0.08, 6), BASE_PALETTE.emberOrange, x + 0.02, 0.055, z - 0.015),
  );
  parts.masonry.push(
    piece(new BoxGeometry(0.2, 0.024, 0.052), BASE_PALETTE.timberLight, x, 0.054, z + 0.16),
    piece(new BoxGeometry(0.026, 0.048, 0.046), BASE_PALETTE.timberDark, x - 0.065, 0.024, z + 0.16),
    piece(new BoxGeometry(0.026, 0.048, 0.046), BASE_PALETTE.timberDark, x + 0.065, 0.024, z + 0.16),
  );
}

function addPointyHexCurtainWall(
  parts: KitParts,
  options: {
    height: number;
    thickness: number;
    wallColor: string;
    baseColor: string;
    capColor: string;
    crenelated: boolean;
    goldBandY?: number;
  },
): void {
  const { height, thickness, wallColor, baseColor, capColor, crenelated, goldBandY } = options;
  const plinthH = 0.085;
  for (const { from, to } of POINTY_HEX_WALL_SEGMENTS) {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    const mx = (from[0] + to[0]) / 2;
    const mz = (from[1] + to[1]) / 2;
    const yaw = Math.atan2(dx, dz);

    parts.masonry.push(
      piece(cutStoneBlock(thickness + 0.032, plinthH, length + 0.03), baseColor, mx, plinthH / 2, mz, yaw),
      piece(cutStoneBlock(thickness, height, length + 0.02), wallColor, mx, height / 2, mz, yaw),
      piece(cutStoneBlock(thickness + 0.028, 0.036, length + 0.03), capColor, mx, height + 0.012, mz, yaw),
    );
    if (goldBandY !== undefined) {
      parts.masonry.push(
        piece(cutStoneBlock(thickness + 0.024, 0.026, length + 0.02), BASE_PALETTE.gold, mx, goldBandY, mz, yaw),
      );
    }
    if (crenelated) {
      const merlons = Math.max(3, Math.floor(length / 0.145));
      for (let m = 0; m < merlons; m++) {
        const t = (m + 0.5) / merlons;
        const bx = from[0] + dx * t;
        const bz = from[1] + dz * t;
        parts.masonry.push(
          piece(cutStoneBlock(thickness + 0.01, 0.068, 0.078), wallColor, bx, height + 0.06, bz, yaw),
          piece(cutStoneBlock(thickness + 0.02, 0.022, 0.088), capColor, bx, height + 0.1, bz, yaw),
        );
      }
    }
  }
}

function addPerimeterPilasters(
  parts: KitParts,
  height: number,
  width: number,
  bodyColor: string,
  capColor: string,
): void {
  for (const [px, pz] of POINTY_HEX_PERIMETER) {
    parts.masonry.push(
      piece(cutStoneBlock(width, height, width), bodyColor, px, height / 2, pz),
      piece(cutStoneBlock(width + 0.03, 0.04, width + 0.03), capColor, px, height + 0.015, pz),
    );
  }
}

function addWallBanners(
  parts: KitParts,
  options: {
    slots: readonly { readonly x: number; readonly y: number; readonly z: number }[];
    width: number;
    railColor: string;
  },
): void {
  const { slots, width, railColor } = options;
  for (const { x, y, z } of slots) {
    parts.masonry.push(
      piece(new CylinderGeometry(0.013, 0.013, width + 0.055, 8).rotateZ(Math.PI / 2), railColor, x, y + 0.008, z),
      piece(new SphereGeometry(0.018, 7, 6), railColor, x - (width / 2 + 0.028), y + 0.008, z),
      piece(new SphereGeometry(0.018, 7, 6), railColor, x + (width / 2 + 0.028), y + 0.008, z),
    );
    parts.anchors.push({
      top: [x, y, z + 0.008],
      width,
      facing: 0,
    });
  }
}

function addSouthGatehouse(
  parts: KitParts,
  options: {
    height: number;
    width: number;
    depth: number;
    wallColor: string;
    baseColor: string;
    capColor: string;
    crenelated: boolean;
    goldBandY?: number;
  },
): void {
  const { height, width, depth, wallColor, baseColor, capColor, crenelated, goldBandY } = options;
  const gz = 0.7;
  parts.masonry.push(
    piece(cutStoneBlock(width, height, depth), wallColor, 0, height / 2, gz),
    piece(cutStoneBlock(width + 0.045, 0.085, depth + 0.045), baseColor, 0, 0.0425, gz),
    piece(cutStoneBlock(width + 0.045, 0.042, depth + 0.045), capColor, 0, height + 0.01, gz),
    piece(new TorusGeometry(0.1, 0.028, 7, 14, Math.PI), capColor, 0, 0.18, gz + depth / 2 + 0.004),
    piece(new BoxGeometry(0.18, 0.22, 0.036), BASE_PALETTE.timber, 0, 0.11, gz + depth / 2 - 0.002),
    piece(new BoxGeometry(0.022, 0.22, 0.042), BASE_PALETTE.timberDark, 0, 0.11, gz + depth / 2 + 0.002),
  );
  if (goldBandY !== undefined) {
    parts.masonry.push(piece(cutStoneBlock(width + 0.03, 0.028, depth + 0.03), BASE_PALETTE.gold, 0, goldBandY, gz));
  }
  if (crenelated) {
    for (const mx of [-0.14, 0, 0.14]) {
      parts.masonry.push(
        piece(cutStoneBlock(0.085, 0.068, 0.068), wallColor, mx, height + 0.06, gz + depth / 2 - 0.02),
        piece(cutStoneBlock(0.095, 0.022, 0.078), capColor, mx, height + 0.1, gz + depth / 2 - 0.02),
      );
    }
  }
}

function addForumTerrace(parts: KitParts): void {
  const terraceH = 0.34;
  parts.masonry.push(
    piece(cutStoneBlock(0.84, terraceH, 0.58), BASE_PALETTE.travertineShade, 0, terraceH / 2, -0.04),
    piece(cutStoneBlock(0.88, 0.042, 0.62), BASE_PALETTE.travertineLight, 0, terraceH + 0.01, -0.04),
  );
  for (const cx of [-0.21, -0.07, 0.07, 0.21]) {
    parts.masonry.push(
      piece(
        new CylinderGeometry(0.028, 0.033, terraceH - 0.04, 10),
        BASE_PALETTE.travertineLight,
        cx,
        terraceH / 2,
        0.28,
      ),
    );
  }
  for (const side of [-1, 1]) {
    for (let step = 0; step < 5; step++) {
      const stepH = (5 - step) * 0.065;
      parts.masonry.push(
        piece(
          cutStoneBlock(0.18, stepH, 0.065),
          step % 2 === 0 ? BASE_PALETTE.travertine : BASE_PALETTE.travertineLight,
          side * 0.38,
          stepH / 2,
          0.26 + step * 0.06,
        ),
      );
    }
    parts.masonry.push(
      piece(cutStoneBlock(0.14, 0.26, 0.14), BASE_PALETTE.travertine, side * 0.38, terraceH + 0.13, 0.24),
      piece(cutStoneBlock(0.165, 0.036, 0.165), BASE_PALETTE.travertineLight, side * 0.38, terraceH + 0.27, 0.24),
    );
  }
}

function addForumBasilica(parts: KitParts): void {
  const baseY = 0.34;
  const cz = -0.18;
  const width = 0.56;
  const depth = 0.52;
  const wallH = 0.5;
  const roofH = 0.34;

  parts.masonry.push(
    piece(cutStoneBlock(width, wallH, depth), BASE_PALETTE.travertine, 0, baseY + wallH / 2, cz),
    piece(cutStoneBlock(width + 0.06, 0.05, depth + 0.08), BASE_PALETTE.travertineLight, 0, baseY + wallH + 0.015, cz),
    piece(
      extrudedGable(width + 0.04, roofH * 0.86, depth + 0.06),
      BASE_PALETTE.travertineLight,
      0,
      baseY + wallH + 0.038,
      cz,
    ),
  );

  for (const cx of [-0.22, -0.075, 0.075, 0.22]) {
    parts.masonry.push(
      piece(
        new CylinderGeometry(0.03, 0.035, wallH - 0.05, 12),
        BASE_PALETTE.travertineLight,
        cx,
        baseY + wallH / 2,
        cz + depth / 2 + 0.055,
      ),
      piece(cutStoneBlock(0.08, 0.04, 0.08), BASE_PALETTE.travertineShade, cx, baseY + 0.02, cz + depth / 2 + 0.055),
      piece(
        cutStoneBlock(0.085, 0.038, 0.085),
        BASE_PALETTE.travertineLight,
        cx,
        baseY + wallH - 0.02,
        cz + depth / 2 + 0.055,
      ),
    );
  }

  const overhangX = width + 0.14;
  const overhangZ = depth + 0.18;
  const halfSpan = overhangX / 2;
  const slopeLen = Math.hypot(halfSpan, roofH);
  const slopeAngle = Math.atan2(roofH, halfSpan);
  for (const side of [-1, 1]) {
    const roofSlope = new BoxGeometry(slopeLen + 0.02, 0.052, overhangZ).rotateZ(-side * slopeAngle);
    parts.masonry.push(
      piece(
        roofSlope,
        side === -1 ? BASE_PALETTE.terracotta : BASE_PALETTE.terracottaShade,
        side * halfSpan * 0.49,
        baseY + wallH + 0.038 + roofH * 0.48,
        cz + 0.02,
      ),
    );
  }
  parts.masonry.push(
    piece(
      cutStoneBlock(0.072, 0.05, overhangZ + 0.03),
      BASE_PALETTE.terracottaShade,
      0,
      baseY + wallH + 0.038 + roofH - 0.01,
      cz + 0.02,
    ),
    piece(new BoxGeometry(0.16, 0.28, 0.04), BASE_PALETTE.timber, 0, baseY + 0.14, cz + depth / 2 + 0.008),
  );

  for (const side of [-1, 1]) {
    parts.glow.push(
      piece(
        new BoxGeometry(0.075, 0.14, 0.024),
        BASE_PALETTE.windowAmber,
        side * 0.16,
        baseY + 0.28,
        cz + depth / 2 + 0.008,
      ),
      piece(
        new BoxGeometry(0.024, 0.12, 0.095),
        BASE_PALETTE.windowAmber,
        side * (width / 2 + 0.006),
        baseY + 0.32,
        cz - 0.06,
      ),
    );
  }
}

function addForumSideWing(parts: KitParts, x: number, z: number): void {
  const width = 0.24;
  const depth = 0.42;
  const wallH = 0.64;
  const roofH = 0.22;
  parts.masonry.push(
    piece(cutStoneBlock(width, wallH, depth), BASE_PALETTE.travertine, x, wallH / 2, z),
    piece(cutStoneBlock(width + 0.04, 0.04, depth + 0.04), BASE_PALETTE.travertineLight, x, wallH + 0.01, z),
    piece(extrudedGable(width + 0.05, roofH, depth + 0.06), BASE_PALETTE.terracotta, x, wallH + 0.02, z),
    piece(cutStoneBlock(0.05, 0.035, depth + 0.08), BASE_PALETTE.terracottaShade, x, wallH + roofH + 0.015, z),
  );
  parts.glow.push(piece(new BoxGeometry(0.075, 0.11, 0.024), BASE_PALETTE.windowAmber, x, 0.5, z + depth / 2 + 0.008));
}

function addSquareKeep(
  parts: KitParts,
  options: { x: number; z: number; size: number; shaftHeight: number; roofHeight: number; crystalY: number },
): void {
  const { x, z, size, shaftHeight, roofHeight, crystalY } = options;
  const crownSize = size + 0.085;
  parts.masonry.push(
    piece(cutStoneBlock(size, shaftHeight, size), BASE_PALETTE.alabaster, x, shaftHeight / 2, z),
    piece(cutStoneBlock(size + 0.06, 0.1, size + 0.06), BASE_PALETTE.alabasterShade, x, 0.05, z),
    piece(cutStoneBlock(size + 0.045, 0.04, size + 0.045), BASE_PALETTE.alabasterLight, x, shaftHeight * 0.44, z),
    piece(cutStoneBlock(size + 0.045, 0.04, size + 0.045), BASE_PALETTE.alabasterLight, x, shaftHeight * 0.74, z),
    piece(cutStoneBlock(crownSize, 0.11, crownSize), BASE_PALETTE.alabaster, x, shaftHeight + 0.04, z),
    piece(
      cutStoneBlock(crownSize + 0.028, 0.038, crownSize + 0.028),
      BASE_PALETTE.alabasterShade,
      x,
      shaftHeight - 0.02,
      z,
    ),
    piece(
      cutStoneBlock(crownSize + 0.028, 0.036, crownSize + 0.028),
      BASE_PALETTE.alabasterLight,
      x,
      shaftHeight + 0.1,
      z,
    ),
    piece(
      new ConeGeometry(size * 0.7, roofHeight, 4),
      BASE_PALETTE.slate,
      x,
      shaftHeight + 0.1 + roofHeight / 2,
      z,
      Math.PI / 4,
    ),
    piece(new CylinderGeometry(0.04, 0.058, 0.055, 8), BASE_PALETTE.gold, x, shaftHeight + 0.1 + roofHeight, z),
    piece(new BoxGeometry(0.15, 0.24, 0.036), BASE_PALETTE.timber, x, 0.48, z + size / 2 + 0.006),
    piece(new TorusGeometry(0.075, 0.022, 6, 12, Math.PI), BASE_PALETTE.alabasterLight, x, 0.6, z + size / 2 + 0.01),
  );

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.masonry.push(
        piece(
          cutStoneBlock(0.06, shaftHeight, 0.06),
          BASE_PALETTE.alabasterShade,
          x + sx * (size / 2 - 0.008),
          shaftHeight / 2,
          z + sz * (size / 2 - 0.008),
        ),
        piece(
          beamBetween(
            new Vector3(x + sx * (size * 0.47), shaftHeight + 0.11, z + sz * (size * 0.47)),
            new Vector3(x, shaftHeight + 0.1 + roofHeight, z),
            0.024,
          ),
          BASE_PALETTE.gold,
        ),
      );
    }
  }

  for (const edge of [-1, 1]) {
    for (let m = -1; m <= 1; m++) {
      parts.masonry.push(
        piece(
          cutStoneBlock(0.08, 0.078, 0.06),
          BASE_PALETTE.alabaster,
          x + m * (crownSize * 0.34),
          shaftHeight + 0.145,
          z + edge * (crownSize / 2 - 0.025),
        ),
        piece(
          cutStoneBlock(0.06, 0.078, 0.08),
          BASE_PALETTE.alabaster,
          x + edge * (crownSize / 2 - 0.025),
          shaftHeight + 0.145,
          z + m * (crownSize * 0.34),
        ),
      );
    }
  }

  parts.glow.push(
    piece(new BoxGeometry(0.065, 0.13, 0.022), BASE_PALETTE.windowAmber, x, shaftHeight * 0.84, z + size / 2 + 0.008),
    piece(
      new BoxGeometry(0.022, 0.13, 0.065),
      BASE_PALETTE.windowAmber,
      x + (x < 0 ? -1 : 1) * (size / 2 + 0.008),
      shaftHeight * 0.72,
      z,
    ),
    piece(new OctahedronGeometry(0.062, 0).scale(0.8, 1.48, 0.8), BASE_PALETTE.essenceTeal, x, crystalY, z),
  );
}

function addTwinSkybridge(parts: KitParts, z: number, bridgeY: number): void {
  const span = 0.4;
  const depth = 0.24;
  parts.masonry.push(
    piece(cutStoneBlock(span, 0.12, depth), BASE_PALETTE.alabaster, 0, bridgeY + 0.08, z),
    piece(cutStoneBlock(span + 0.04, 0.036, depth + 0.04), BASE_PALETTE.alabasterLight, 0, bridgeY + 0.15, z),
    piece(new TorusGeometry(0.155, 0.046, 8, 16, Math.PI), BASE_PALETTE.alabasterShade, 0, bridgeY - 0.07, z),
    piece(
      new TorusGeometry(0.175, 0.02, 6, 16, Math.PI),
      BASE_PALETTE.alabasterLight,
      0,
      bridgeY - 0.07,
      z + depth / 2,
    ),
    piece(
      new TorusGeometry(0.175, 0.02, 6, 16, Math.PI),
      BASE_PALETTE.alabasterLight,
      0,
      bridgeY - 0.07,
      z - depth / 2,
    ),
  );
  for (const faceZ of [z + depth / 2 - 0.024, z - depth / 2 + 0.024]) {
    for (const mx of [-0.11, 0, 0.11]) {
      parts.masonry.push(piece(cutStoneBlock(0.072, 0.068, 0.046), BASE_PALETTE.alabaster, mx, bridgeY + 0.2, faceZ));
    }
  }
}

function addRearCastleHall(parts: KitParts): void {
  const z = -0.38;
  const width = 0.66;
  const depth = 0.3;
  const wallH = 0.64;
  const roofH = 0.26;
  parts.masonry.push(
    piece(cutStoneBlock(width, wallH, depth), BASE_PALETTE.alabasterShade, 0, wallH / 2, z),
    piece(cutStoneBlock(width + 0.04, 0.04, depth + 0.04), BASE_PALETTE.alabasterLight, 0, wallH + 0.01, z),
    piece(extrudedGable(depth + 0.06, roofH, width + 0.04), BASE_PALETTE.slateShade, 0, wallH + 0.02, z, Math.PI / 2),
    piece(cutStoneBlock(width + 0.06, 0.038, 0.05), BASE_PALETTE.gold, 0, wallH + roofH + 0.015, z),
  );
}

function addImperialDrumKeep(parts: KitParts): void {
  const cz = -0.1;
  const baseH = 0.68;
  const shaftBottom = 0.64;
  const shaftTop = 1.72;
  const shaftH = shaftTop - shaftBottom;

  parts.masonry.push(
    piece(new CylinderGeometry(0.41, 0.46, baseH, 16), BASE_PALETTE.imperialShade, 0, baseH / 2, cz),
    piece(new CylinderGeometry(0.44, 0.45, 0.048, 16), BASE_PALETTE.gold, 0, baseH, cz),
    piece(new CylinderGeometry(0.32, 0.35, shaftH, 16), BASE_PALETTE.imperialMarble, 0, shaftBottom + shaftH / 2, cz),
    piece(new CylinderGeometry(0.365, 0.37, 0.044, 16), BASE_PALETTE.gold, 0, 1.04, cz),
    piece(new CylinderGeometry(0.35, 0.355, 0.044, 16), BASE_PALETTE.gold, 0, 1.4, cz),
    piece(new CylinderGeometry(0.39, 0.33, 0.13, 16), BASE_PALETTE.imperialLight, 0, shaftTop + 0.05, cz),
    piece(new TorusGeometry(0.382, 0.022, 8, 24).rotateX(Math.PI / 2), BASE_PALETTE.goldBright, 0, shaftTop + 0.12, cz),
    piece(createOgiveSpireGeometry(0.34, 0.84, 18), BASE_PALETTE.tealSpire, 0, shaftTop + 0.12, cz),
    piece(new CylinderGeometry(0.052, 0.074, 0.072, 12), BASE_PALETTE.goldBright, 0, shaftTop + 0.96, cz),
    piece(new TorusGeometry(0.068, 0.017, 6, 16).rotateX(Math.PI / 2), BASE_PALETTE.gold, 0, shaftTop + 0.99, cz),
  );

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    parts.masonry.push(
      piece(
        cutStoneBlock(0.07, baseH + 0.02, 0.11),
        BASE_PALETTE.imperialMarble,
        sin * 0.43,
        (baseH + 0.02) / 2,
        cz + cos * 0.43,
        angle,
      ),
      piece(
        cutStoneBlock(0.046, shaftH, 0.052),
        BASE_PALETTE.imperialLight,
        sin * 0.345,
        shaftBottom + shaftH / 2,
        cz + cos * 0.345,
        angle,
      ),
      piece(
        cutStoneBlock(0.084, 0.08, 0.064),
        BASE_PALETTE.imperialMarble,
        sin * 0.365,
        shaftTop + 0.155,
        cz + cos * 0.365,
        angle,
      ),
      piece(
        beamBetween(
          new Vector3(sin * 0.34, shaftTop + 0.14, cz + cos * 0.34),
          new Vector3(sin * 0.24, shaftTop + 0.56, cz + cos * 0.24),
          0.022,
        ),
        BASE_PALETTE.goldBright,
      ),
      piece(
        beamBetween(
          new Vector3(sin * 0.24, shaftTop + 0.55, cz + cos * 0.24),
          new Vector3(sin * 0.03, shaftTop + 0.96, cz + cos * 0.03),
          0.018,
        ),
        BASE_PALETTE.goldBright,
      ),
    );

    const winAngle = angle + Math.PI / 8;
    const wSin = Math.sin(winAngle);
    const wCos = Math.cos(winAngle);
    parts.glow.push(
      piece(new BoxGeometry(0.06, 0.18, 0.024), BASE_PALETTE.windowAmber, wSin * 0.34, 1.2, cz + wCos * 0.34, winAngle),
      piece(
        new BoxGeometry(0.056, 0.16, 0.024),
        BASE_PALETTE.windowAmber,
        wSin * 0.33,
        1.54,
        cz + wCos * 0.33,
        winAngle,
      ),
    );
  }

  parts.glow.push(
    piece(new OctahedronGeometry(0.088, 0).scale(0.78, 1.6, 0.78), BASE_PALETTE.essenceTeal, 0, shaftTop + 1.07, cz),
  );
}

function addImperialTurret(parts: KitParts, tx: number, tz: number, shaftHeight: number): void {
  const spireH = 0.44;
  parts.masonry.push(
    piece(new CylinderGeometry(0.145, 0.17, shaftHeight, 12), BASE_PALETTE.imperialMarble, tx, shaftHeight / 2, tz),
    piece(new CylinderGeometry(0.185, 0.198, 0.1, 12), BASE_PALETTE.imperialShade, tx, 0.05, tz),
    piece(new CylinderGeometry(0.172, 0.176, 0.034, 12), BASE_PALETTE.gold, tx, shaftHeight * 0.54, tz),
    piece(new CylinderGeometry(0.18, 0.156, 0.088, 12), BASE_PALETTE.imperialLight, tx, shaftHeight + 0.03, tz),
    piece(
      new TorusGeometry(0.176, 0.017, 6, 16).rotateX(Math.PI / 2),
      BASE_PALETTE.goldBright,
      tx,
      shaftHeight + 0.075,
      tz,
    ),
    piece(createOgiveSpireGeometry(0.158, spireH, 14), BASE_PALETTE.tealSpireShade, tx, shaftHeight + 0.07, tz),
    piece(new CylinderGeometry(0.03, 0.042, 0.045, 8), BASE_PALETTE.goldBright, tx, shaftHeight + 0.07 + spireH, tz),
  );
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    parts.masonry.push(
      piece(
        cutStoneBlock(0.052, 0.056, 0.046),
        BASE_PALETTE.imperialMarble,
        tx + sin * 0.162,
        shaftHeight + 0.1,
        tz + cos * 0.162,
        angle,
      ),
      piece(
        beamBetween(
          new Vector3(tx + sin * 0.155, shaftHeight + 0.08, tz + cos * 0.155),
          new Vector3(tx + sin * 0.015, shaftHeight + 0.07 + spireH, tz + cos * 0.015),
          0.014,
        ),
        BASE_PALETTE.goldBright,
      ),
    );
  }
  const faceAngle = Math.atan2(tx, tz + 0.8);
  parts.glow.push(
    piece(
      new BoxGeometry(0.044, 0.13, 0.022),
      BASE_PALETTE.windowAmber,
      tx + Math.sin(faceAngle) * 0.156,
      shaftHeight * 0.72,
      tz + Math.cos(faceAngle) * 0.156,
      faceAngle,
    ),
    piece(
      new OctahedronGeometry(0.048, 0).scale(0.8, 1.48, 0.8),
      BASE_PALETTE.essenceTeal,
      tx,
      shaftHeight + 0.07 + spireH + 0.072,
      tz,
    ),
  );
}

function createOgiveSpireGeometry(radius: number, height: number, radialSegments: number): BufferGeometry {
  const points: Vector2[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = Math.max(0.008, radius * Math.pow(1 - t, 0.72) * (1 + 0.14 * Math.sin(t * Math.PI)));
    points.push(new Vector2(r, t * height));
  }
  const geometry = new LatheGeometry(points, radialSegments);
  geometry.computeVertexNormals();
  return geometry;
}
