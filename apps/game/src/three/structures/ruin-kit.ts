import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { createProcgenMasonryMaterial } from "./procgen-masonry-material";

export const RUIN_VARIANT_COUNT = 4;
export type RuinVariant = 0 | 1 | 2 | 3;
export const RUIN_VARIANTS: readonly RuinVariant[] = [0, 1, 2, 3];

const RUIN_KIT_PREFIX = "procedural:ruin:";

export function ruinKitPath(variant: RuinVariant): string {
  return `${RUIN_KIT_PREFIX}${variant}`;
}

export const RUIN_KIT_PATHS: readonly string[] = RUIN_VARIANTS.map(ruinKitPath);

export function parseRuinKitPath(path: string): RuinVariant | null {
  if (!path.startsWith(RUIN_KIT_PREFIX)) return null;
  const suffix = path.slice(RUIN_KIT_PREFIX.length);
  if (!/^[0-9]+$/.test(suffix)) return null;
  const parsed = Number(suffix);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= RUIN_VARIANT_COUNT) return null;
  return parsed as RuinVariant;
}

export function isRuinKitPath(path: string): boolean {
  return parseRuinKitPath(path) !== null;
}

export function ruinVariantForHex(col: number, row: number): RuinVariant {
  const mixed =
    Math.imul(Math.trunc(col) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.trunc(row) ^ 0xc2b2ae35, 0x27d4eb2d);
  const hash = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97) >>> 0;
  return (hash % RUIN_VARIANT_COUNT) as RuinVariant;
}

export function resolveProceduralRuinKit(path: string): GLTF | null {
  const variant = parseRuinKitPath(path);
  if (variant === null) return null;
  return createRuinKit(variant) as GLTF;
}

interface KitPart {
  readonly geometry: BufferGeometry;
  readonly color: string;
}

type SideKind = "arch" | "broken-arch" | "high-wall" | "stepped-wall" | "low-breach" | "cleft-wall";

interface TurretSpec {
  readonly corner: number;
  readonly height: number;
  readonly radius: number;
  readonly brokenArcStart: number;
  readonly hasSlateRemnant: boolean;
  readonly squareKeep?: boolean;
}

interface RuinVariantSpec {
  readonly seed: number;
  readonly sides: readonly [SideKind, SideKind, SideKind, SideKind, SideKind, SideKind];
  readonly turrets: readonly TurretSpec[];
}

const LIMESTONE_LIGHT = "#cdc0a6";
const LIMESTONE_MAIN = "#b8aa8f";
const LIMESTONE_MID = "#9f9279";
const LIMESTONE_SHADE = "#827660";
const MOSS_STONE = "#77795b";
const DARK_CREVICE = "#524c41";
const SLATE_ROOF = "#485866";
const SLATE_EDGE = "#5f7282";
const TIMBER_RAFTER = "#6f553b";

const WALL_PALETTE = [LIMESTONE_MAIN, LIMESTONE_LIGHT, LIMESTONE_MID, LIMESTONE_MAIN, LIMESTONE_SHADE] as const;

const FOOTING_Y = -0.024;
const WALL_CENTER_APOTHEM = 0.796;
const WALL_THICKNESS = 0.088;
const HEX_CORNER_RADIUS = WALL_CENTER_APOTHEM / (Math.sqrt(3) / 2);
const TURRET_CENTER_RADIUS = 0.845;

const VARIANT_SPECS = {
  0: {
    seed: 101,
    sides: ["stepped-wall", "high-wall", "arch", "stepped-wall", "high-wall", "low-breach"],
    turrets: [{ corner: 3, height: 0.92, radius: 0.104, brokenArcStart: 0.4, hasSlateRemnant: true }],
  },
  1: {
    seed: 211,
    sides: ["cleft-wall", "broken-arch", "stepped-wall", "low-breach", "cleft-wall", "high-wall"],
    turrets: [
      { corner: 5, height: 0.86, radius: 0.104, brokenArcStart: 2.2, hasSlateRemnant: false },
      { corner: 3, height: 0.56, radius: 0.094, brokenArcStart: 5.1, hasSlateRemnant: false },
    ],
  },
  2: {
    seed: 317,
    sides: ["low-breach", "stepped-wall", "cleft-wall", "arch", "stepped-wall", "high-wall"],
    turrets: [{ corner: 4, height: 0.94, radius: 0.104, brokenArcStart: 1.5, hasSlateRemnant: true }],
  },
  3: {
    seed: 433,
    sides: ["low-breach", "cleft-wall", "broken-arch", "high-wall", "high-wall", "stepped-wall"],
    turrets: [
      { corner: 5, height: 0.84, radius: 0.098, brokenArcStart: 3.1, hasSlateRemnant: false, squareKeep: true },
      { corner: 2, height: 0.5, radius: 0.09, brokenArcStart: 0.9, hasSlateRemnant: false },
    ],
  },
} as const satisfies Record<RuinVariant, RuinVariantSpec>;

export function createRuinKit(variant: RuinVariant = 0): Pick<GLTF, "scene" | "animations"> {
  const spec: RuinVariantSpec = VARIANT_SPECS[variant];
  const rand = createSeededRandom(spec.seed);
  const parts: KitPart[] = [];
  const turretCorners = new Set<number>(spec.turrets.map((turret) => turret.corner));

  for (let side = 0; side < 6; side++) {
    buildHexWallSide(parts, side, spec.sides[side], rand);
  }

  for (let corner = 0; corner < 6; corner++) {
    if (!turretCorners.has(corner)) {
      buildCornerButtress(parts, corner, spec.sides, rand);
    }
  }

  for (const turret of spec.turrets) {
    if (turret.squareKeep) {
      buildRuinedCornerKeep(parts, turret, rand);
    } else {
      buildRuinedWatchtower(parts, turret, rand);
    }
  }

  const root = new Group();
  root.name = `ruin-kit-${variant}`;

  const geometry = combineParts(parts);
  const material = createProcgenMasonryMaterial();
  const mesh = new Mesh(geometry, material);
  mesh.name = `ruin-masonry-${variant}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);

  return { scene: root, animations: [] };
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function sideBasis(side: number): { nx: number; nz: number; tx: number; tz: number } {
  const normalAngle = (side * Math.PI) / 3;
  const nx = Math.cos(normalAngle);
  const nz = Math.sin(normalAngle);
  return { nx, nz, tx: -nz, tz: nx };
}

function cornerDirection(corner: number): { cx: number; cz: number; angle: number } {
  const angle = (corner * Math.PI) / 3 + Math.PI / 6;
  return { cx: Math.cos(angle), cz: Math.sin(angle), angle };
}

function addOrientedBox(
  parts: KitPart[],
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  rotY: number,
  color: string,
  tiltX = 0,
  tiltZ = 0,
): void {
  const geometry = new BoxGeometry(width, height, depth);
  const matrix = new Matrix4();
  const rotMatrix = new Matrix4();
  if (tiltX !== 0) {
    rotMatrix.makeRotationX(tiltX);
    geometry.applyMatrix4(rotMatrix);
  }
  if (tiltZ !== 0) {
    rotMatrix.makeRotationZ(tiltZ);
    geometry.applyMatrix4(rotMatrix);
  }
  matrix.makeRotationY(rotY);
  matrix.setPosition(x, y, z);
  geometry.applyMatrix4(matrix);
  parts.push({ geometry, color });
}

function addWallLocalBox(
  parts: KitPart[],
  side: number,
  along: number,
  centerY: number,
  radialOffset: number,
  length: number,
  height: number,
  thickness: number,
  color: string,
  tiltAlong = 0,
  tiltRadial = 0,
): void {
  const { nx, nz, tx, tz } = sideBasis(side);
  const radial = WALL_CENTER_APOTHEM + radialOffset;
  const x = nx * radial + tx * along;
  const z = nz * radial + tz * along;
  const rotY = Math.atan2(tx, tz);
  addOrientedBox(parts, x, centerY, z, thickness, height, length, rotY, color, tiltAlong, tiltRadial);
}

function buildHexWallSide(parts: KitPart[], side: number, kind: SideKind, rand: () => number): void {
  const span = HEX_CORNER_RADIUS - 0.22;
  addWallLocalBox(parts, side, 0, FOOTING_Y + 0.032, 0.004, span + 0.08, 0.064, WALL_THICKNESS + 0.012, MOSS_STONE);

  if (kind === "arch" || kind === "broken-arch") {
    buildArchedGatewaySide(parts, side, kind === "broken-arch", span, rand);
    return;
  }

  const bayHeights = resolveWallBayHeights(kind, rand);
  const bayCount = bayHeights.length;
  const bayLength = span / bayCount;
  const courseHeight = 0.092;

  for (let bay = 0; bay < bayCount; bay++) {
    const targetHeight = bayHeights[bay];
    const courses = Math.max(1, Math.round(targetHeight / courseHeight));
    const bayCenter = -span / 2 + (bay + 0.5) * bayLength;

    if (kind === "cleft-wall" && bay === 1) {
      addWallLocalBox(
        parts,
        side,
        bayCenter,
        0.045,
        0.002,
        bayLength * 0.62,
        0.09,
        WALL_THICKNESS * 0.72,
        DARK_CREVICE,
      );
      addRubbleBlocks(parts, side, bayCenter, bayLength * 0.85, rand, 2);
      continue;
    }

    for (let course = 0; course < courses; course++) {
      const yBottom = 0.036 + course * courseHeight;
      const isTopCourse = course === courses - 1;
      const blockH = courseHeight * (isTopCourse ? 0.88 + rand() * 0.24 : 0.98);
      const stagger = course % 2 === 1 ? bayLength * 0.14 : -bayLength * 0.08;
      const clampedAlong = clampNumber(
        bayCenter + stagger * (bay === 0 || bay === bayCount - 1 ? 0.25 : 0.6),
        -span / 2 + bayLength * 0.42,
        span / 2 - bayLength * 0.42,
      );
      const blockLen = bayLength * (isTopCourse ? 0.84 + rand() * 0.14 : 0.95);
      const radialJitter = (rand() - 0.5) * 0.008;
      const thickJitter = WALL_THICKNESS * (0.94 + rand() * 0.1);
      const tilt = isTopCourse ? (rand() - 0.5) * 0.08 : 0;
      const color = pickWallBlockColor(course, bay, isTopCourse, rand);

      addWallLocalBox(
        parts,
        side,
        clampedAlong,
        yBottom + blockH / 2,
        radialJitter,
        blockLen,
        blockH,
        thickJitter,
        color,
        tilt,
      );
    }

    const topY = 0.036 + courses * courseHeight;
    if (kind === "high-wall" && bay % 2 === 0 && courses >= 4) {
      addWallLocalBox(
        parts,
        side,
        bayCenter,
        topY + 0.048,
        0.014,
        bayLength * 0.62,
        0.096,
        WALL_THICKNESS * 0.66,
        LIMESTONE_LIGHT,
      );
    }
    if (kind === "low-breach" && (bay === 1 || bay === 2)) {
      addRubbleBlocks(parts, side, bayCenter, bayLength, rand, 2);
    }
  }
}

function resolveWallBayHeights(kind: SideKind, rand: () => number): readonly number[] {
  const jitter = () => (rand() - 0.5) * 0.05;
  switch (kind) {
    case "high-wall":
      return [0.4 + jitter(), 0.43 + jitter(), 0.37 + jitter(), 0.41 + jitter()];
    case "stepped-wall":
      return [0.38 + jitter(), 0.28 + jitter(), 0.18 + jitter(), 0.33 + jitter()];
    case "cleft-wall":
      return [0.38 + jitter(), 0.08, 0.31 + jitter(), 0.4 + jitter()];
    case "low-breach":
      return [0.27 + jitter(), 0.11 + jitter(), 0.12 + jitter(), 0.25 + jitter()];
    default:
      return [0.3, 0.2, 0.22, 0.3];
  }
}

function buildArchedGatewaySide(
  parts: KitPart[],
  side: number,
  broken: boolean,
  span: number,
  rand: () => number,
): void {
  const pierOffset = 0.21;
  const pierWidth = 0.15;
  const pierHeight = 0.34;

  for (const dir of [-1, 1] as const) {
    const baseAlong = dir * pierOffset;
    const outerAlong = dir * (span * 0.44);
    addWallLocalBox(parts, side, baseAlong, 0.04, 0.008, pierWidth + 0.02, 0.08, WALL_THICKNESS + 0.02, MOSS_STONE);
    addWallLocalBox(
      parts,
      side,
      baseAlong,
      0.08 + pierHeight / 2,
      0.006,
      pierWidth,
      pierHeight,
      WALL_THICKNESS + 0.012,
      LIMESTONE_MAIN,
    );
    addWallLocalBox(
      parts,
      side,
      baseAlong,
      0.08 + pierHeight + 0.022,
      0.01,
      pierWidth + 0.022,
      0.044,
      WALL_THICKNESS + 0.022,
      LIMESTONE_LIGHT,
    );

    const wingLen = Math.max(0.08, Math.abs(outerAlong - baseAlong) - pierWidth * 0.4);
    const wingCenter = (outerAlong + baseAlong + dir * pierWidth * 0.45) / 2;
    const wingH = dir < 0 ? 0.34 : broken ? 0.22 : 0.3;
    addWallLocalBox(parts, side, wingCenter, 0.036 + wingH / 2, 0, wingLen, wingH, WALL_THICKNESS, LIMESTONE_MID);
  }

  const archRadius = 0.155;
  const archCenterY = 0.315;
  const voussoirs = 7;
  for (let i = 0; i < voussoirs; i++) {
    if (broken && (i === 3 || i === 4)) continue;
    const t = (i + 0.5) / voussoirs;
    const theta = Math.PI * (1 - t);
    const along = Math.cos(theta) * archRadius;
    const y = archCenterY + Math.sin(theta) * archRadius;
    const tilt = -(theta - Math.PI / 2);
    const isKeystone = i === 3;
    addWallLocalBox(
      parts,
      side,
      along,
      y,
      isKeystone ? 0.014 : 0.008,
      isKeystone ? 0.072 : 0.068,
      isKeystone ? 0.098 : 0.082,
      WALL_THICKNESS + (isKeystone ? 0.016 : 0.008),
      isKeystone ? LIMESTONE_LIGHT : i % 2 === 0 ? LIMESTONE_MAIN : LIMESTONE_LIGHT,
      tilt,
    );
  }

  if (broken) {
    addRubbleBlocks(parts, side, 0.02, 0.24, rand, 3);
  }
}

function buildCornerButtress(parts: KitPart[], corner: number, sides: readonly SideKind[], rand: () => number): void {
  const { cx, cz, angle } = cornerDirection(corner);
  const leftKind = sides[corner];
  const rightKind = sides[(corner + 5) % 6];
  const lowCorner = leftKind === "low-breach" && rightKind === "low-breach";
  const height = lowCorner ? 0.26 + rand() * 0.08 : 0.4 + rand() * 0.1;
  const radius = 0.858;
  const x = cx * radius;
  const z = cz * radius;
  const rotY = -angle;

  addOrientedBox(parts, x, FOOTING_Y + 0.052, z, 0.132, 0.104, 0.132, rotY, MOSS_STONE);
  addOrientedBox(parts, x, 0.08 + height / 2, z, 0.114, height, 0.114, rotY, LIMESTONE_MAIN);
  addOrientedBox(parts, x, 0.08 + height + 0.022, z, 0.124, 0.044, 0.124, rotY, LIMESTONE_LIGHT);
}

function buildRuinedWatchtower(parts: KitPart[], turret: TurretSpec, rand: () => number): void {
  const { cx, cz } = cornerDirection(turret.corner);
  const tx = cx * TURRET_CENTER_RADIUS;
  const tz = cz * TURRET_CENTER_RADIUS;
  const r = turret.radius;
  const drumTop = turret.height - 0.18;

  const plinth = new CylinderGeometry(r * 1.07, r * 1.12, 0.145, 8);
  plinth.translate(tx, FOOTING_Y + 0.0725, tz);
  parts.push({ geometry: plinth, color: MOSS_STONE });

  const lowerDrumH = (drumTop - 0.11) * 0.54;
  const lowerDrum = new CylinderGeometry(r * 0.99, r * 1.04, lowerDrumH, 8);
  lowerDrum.translate(tx, 0.11 + lowerDrumH / 2, tz);
  parts.push({ geometry: lowerDrum, color: LIMESTONE_MAIN });

  const upperDrumH = drumTop - 0.11 - lowerDrumH;
  const upperDrum = new CylinderGeometry(r * 0.95, r * 0.99, upperDrumH, 8);
  upperDrum.translate(tx, 0.11 + lowerDrumH + upperDrumH / 2, tz);
  parts.push({ geometry: upperDrum, color: LIMESTONE_LIGHT });

  const band = new CylinderGeometry(r * 1.06, r * 1.02, 0.045, 8);
  band.translate(tx, drumTop - 0.01, tz);
  parts.push({ geometry: band, color: LIMESTONE_MID });

  for (let i = 0; i < 4; i++) {
    const slitAngle = turret.brokenArcStart + i * (Math.PI / 2) + 0.35;
    const sx = tx + Math.cos(slitAngle) * (r * 0.97);
    const sz = tz + Math.sin(slitAngle) * (r * 0.97);
    addOrientedBox(parts, sx, 0.11 + lowerDrumH * 0.85, sz, 0.022, 0.12, 0.024, -slitAngle, DARK_CREVICE);
  }

  const corbelCount = 8;
  for (let i = 0; i < corbelCount; i++) {
    const a = (i / corbelCount) * Math.PI * 2;
    const bx = tx + Math.cos(a) * (r * 0.97);
    const bz = tz + Math.sin(a) * (r * 0.97);
    addOrientedBox(parts, bx, drumTop - 0.042, bz, 0.036, 0.042, 0.032, -a, LIMESTONE_SHADE);
  }

  const merlonCount = 8;
  for (let i = 0; i < merlonCount; i++) {
    const a = (i / merlonCount) * Math.PI * 2;
    const delta = angularDelta(a, turret.brokenArcStart);
    const collapsed = Math.abs(delta) < 1.15;
    if (collapsed && i % 2 === 0) continue;
    const merlonH = collapsed ? 0.048 + rand() * 0.03 : 0.125 + rand() * 0.035;
    const mx = tx + Math.cos(a) * (r * 0.86);
    const mz = tz + Math.sin(a) * (r * 0.86);
    addOrientedBox(
      parts,
      mx,
      drumTop + 0.015 + merlonH / 2,
      mz,
      0.044,
      merlonH,
      0.056,
      -a,
      collapsed ? LIMESTONE_SHADE : LIMESTONE_LIGHT,
      collapsed ? (rand() - 0.5) * 0.18 : 0,
    );
  }

  if (turret.hasSlateRemnant) {
    buildBrokenSlateRoof(parts, tx, drumTop + 0.06, tz, r, turret.brokenArcStart + Math.PI);
  }
}

function buildBrokenSlateRoof(
  parts: KitPart[],
  tx: number,
  baseY: number,
  tz: number,
  radius: number,
  standingAngle: number,
): void {
  const panels = 5;
  const roofH = 0.22;
  for (let i = 0; i < panels; i++) {
    const a = standingAngle + (i - 2) * 0.48;
    const pitchR = radius * 0.62;
    const px = tx + Math.cos(a) * pitchR;
    const pz = tz + Math.sin(a) * pitchR;
    const panelLen = i === 0 || i === panels - 1 ? 0.14 : 0.19;
    addOrientedBox(
      parts,
      px,
      baseY + roofH * 0.42,
      pz,
      0.024,
      panelLen,
      0.072,
      -a,
      i % 2 === 0 ? SLATE_ROOF : SLATE_EDGE,
      0,
      0.46,
    );
  }
  const rx = tx + Math.cos(standingAngle + Math.PI) * (radius * 0.25);
  const rz = tz + Math.sin(standingAngle + Math.PI) * (radius * 0.25);
  addOrientedBox(parts, rx, baseY + roofH * 0.56, rz, 0.022, 0.2, 0.022, -standingAngle, TIMBER_RAFTER, 0.25, -0.52);
}

function buildRuinedCornerKeep(parts: KitPart[], turret: TurretSpec, rand: () => number): void {
  const { cx, cz, angle } = cornerDirection(turret.corner);
  const tx = cx * TURRET_CENTER_RADIUS;
  const tz = cz * TURRET_CENTER_RADIUS;
  const size = turret.radius * 1.72;
  const rotY = -angle;

  addOrientedBox(parts, tx, FOOTING_Y + 0.07, tz, size * 1.04, 0.14, size * 1.04, rotY, MOSS_STONE);
  addOrientedBox(
    parts,
    tx,
    0.11 + (turret.height - 0.28) / 2,
    tz,
    size * 0.96,
    turret.height - 0.28,
    size * 0.96,
    rotY,
    LIMESTONE_MAIN,
  );
  addOrientedBox(parts, tx, turret.height - 0.15, tz, size * 1.02, 0.044, size * 1.02, rotY, LIMESTONE_LIGHT);

  const offsets: readonly [number, number, number][] = [
    [-0.36, -0.36, 0.14],
    [0.36, -0.36, 0.12],
    [-0.36, 0.36, 0.05],
    [0.36, 0.36, 0.11],
  ];
  for (const [ox, oz, h] of offsets) {
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const lx = ox * size;
    const lz = oz * size;
    const wx = tx + lx * cos + lz * sin;
    const wz = tz - lx * sin + lz * cos;
    addOrientedBox(
      parts,
      wx,
      turret.height - 0.12 + h / 2,
      wz,
      size * 0.34,
      h + rand() * 0.025,
      size * 0.34,
      rotY,
      h > 0.08 ? LIMESTONE_LIGHT : LIMESTONE_SHADE,
    );
  }
}

function addRubbleBlocks(
  parts: KitPart[],
  side: number,
  centerAlong: number,
  spread: number,
  rand: () => number,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const along = centerAlong + (rand() - 0.5) * spread * 0.85;
    const radialOffset = (rand() - 0.5) * 0.045;
    const len = 0.065 + rand() * 0.055;
    const h = 0.045 + rand() * 0.04;
    const thick = 0.055 + rand() * 0.04;
    addWallLocalBox(
      parts,
      side,
      along,
      h * 0.42,
      radialOffset,
      len,
      h,
      thick,
      i % 2 === 0 ? LIMESTONE_MID : LIMESTONE_SHADE,
      (rand() - 0.5) * 0.34,
      (rand() - 0.5) * 0.28,
    );
  }
}

function pickWallBlockColor(course: number, bay: number, isTopCourse: boolean, rand: () => number): string {
  if (course === 0 && rand() < 0.45) return MOSS_STONE;
  if (isTopCourse && rand() < 0.5) return LIMESTONE_LIGHT;
  return WALL_PALETTE[(course * 3 + bay + Math.floor(rand() * 2)) % WALL_PALETTE.length];
}

function angularDelta(a: number, b: number): number {
  let diff = (a - b + Math.PI) % (Math.PI * 2);
  if (diff < 0) diff += Math.PI * 2;
  return diff - Math.PI;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function combineParts(parts: readonly KitPart[]): BufferGeometry {
  const mossTint = new Color(MOSS_STONE);
  const geometries = parts.map(({ geometry, color }, partIndex) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    flat.computeVertexNormals();
    const pos = flat.getAttribute("position");
    const normal = flat.getAttribute("normal");
    if (!flat.getAttribute("uv")) {
      const uvs = new Float32Array(pos.count * 2);
      for (let vertex = 0; vertex < pos.count; vertex++) {
        uvs[vertex * 2] = pos.getX(vertex) * 0.5 + 0.5;
        uvs[vertex * 2 + 1] = pos.getY(vertex) * 0.5;
      }
      flat.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    }
    const base = new Color(color);
    base.offsetHSL(0, 0, Math.sin(partIndex * 11.37) * 0.016);
    const vertexColor = new Color();
    const colors = new Float32Array(pos.count * 3);
    for (let vertex = 0; vertex < pos.count; vertex++) {
      const py = pos.getY(vertex);
      const ny = normal.getY(vertex);
      vertexColor.copy(base);
      if (py < 0.14) {
        const dampness = Math.max(0, 1 - Math.max(0, py) / 0.14) * 0.24;
        vertexColor.lerp(mossTint, dampness);
      }
      vertexColor.offsetHSL(0, 0, Math.max(0, ny) * 0.028);
      vertexColor.toArray(colors, vertex * 3);
    }
    flat.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return flat;
  });
  const merged = mergeGeometries(geometries, false)!;
  for (const geometry of geometries) geometry.dispose();
  for (const part of parts) part.geometry.dispose();
  const indexed = mergeVertices(merged, 1e-4);
  merged.dispose();
  return indexed;
}
