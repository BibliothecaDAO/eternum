import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
  type Texture,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { createProcgenMasonryMaterial } from "../../structures/procgen-masonry-material";
import type { ShipArmyClass, ShipTier } from "./ship-design";
import { createSailPrint } from "./ship-sail-print";

interface ColoredPart {
  readonly geometry: BufferGeometry;
  readonly color: string;
}

interface MastSpec {
  readonly by: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

const TAU = Math.PI * 2;
const PROCEDURAL_SHIP_PREFIX = "procedural:ship:";
const SHIP_CLASSES: readonly ShipArmyClass[] = ["knight", "crossbowman", "paladin"];

const STATIONS: ReadonlyArray<readonly [number, number]> = [
  [-2.1, 0.33],
  [-1.83, 0.64],
  [-1.3, 0.81],
  [-0.55, 0.86],
  [0.3, 0.82],
  [1.05, 0.64],
  [1.64, 0.38],
  [2.1, 0],
];

const MAST_SPECS: Record<ShipTier, readonly MastSpec[]> = {
  1: [{ by: 0.05, top: 3.35, width: 2.2, height: 2.08 }],
  2: [
    { by: 0.38, top: 3.46, width: 2.2, height: 2.02 },
    { by: -1.25, top: 2.95, width: 1.35, height: 1.25 },
  ],
  3: [
    { by: 0.5, top: 3.65, width: 2.2, height: 2.13 },
    { by: -1.2, top: 3.6, width: 1.95, height: 1.65 },
  ],
};

const ENAMEL_PALETTE: Record<ShipArmyClass, string> = {
  knight: "#1b3669",
  crossbowman: "#1a5937",
  paladin: "#d6c89d",
};

const OAK_DARK = "#59331a";
const OAK_MID = "#784724";
const OAK_LIGHT = "#8f5a30";
const OAK_DECK = "#88542c";
const IRON_DARK = "#2d343d";
const RECESS_DARK = "#1a1714";
const ROPE_HEMP = "#997d52";
const GLASS_AMBER = "#c47d2b";
const GOLD_T1 = "#b88236";
const GOLD_RICH = "#dda844";
const GOLD_BRIGHT = "#f2c862";

const cachedClassSailPrints = new Map<ShipArmyClass, Texture>();

export function proceduralShipPath(army: ShipArmyClass, tier: ShipTier): string {
  return `${PROCEDURAL_SHIP_PREFIX}${army}:t${tier}`;
}

export function parseProceduralShipPath(path: string): { army: ShipArmyClass; tier: ShipTier } | null {
  if (!path.startsWith(PROCEDURAL_SHIP_PREFIX)) return null;
  const match = /^procedural:ship:(knight|crossbowman|paladin):t([123])$/.exec(path);
  if (!match) return null;
  return { army: match[1] as ShipArmyClass, tier: Number(match[2]) as ShipTier };
}

export function isProceduralShipPath(path: string): boolean {
  return parseProceduralShipPath(path) !== null;
}

export function resolveProceduralShipKit(path: string): GLTF | null {
  const parsed = parseProceduralShipPath(path);
  if (!parsed) return null;
  const scene = createProceduralShipTemplate(parsed.army, parsed.tier);
  return {
    animations: [],
    scene,
    scenes: [scene],
    cameras: [],
    asset: { version: "2.0" },
    parser: {} as GLTF["parser"],
    userData: {},
  };
}

export function createProceduralShipTemplate(army: ShipArmyClass, tier: ShipTier): Group {
  if (!SHIP_CLASSES.includes(army)) throw new Error(`Unknown fleet army class: ${army}`);
  const gold = tier === 1 ? GOLD_T1 : GOLD_RICH;
  const enamel = ENAMEL_PALETTE[army];

  const hullParts: ColoredPart[] = [];
  buildHullStrakes(hullParts, enamel, gold);
  buildTransomAndRudder(hullParts, gold);
  buildDeckAndHatch(hullParts, gold);
  buildBulwarksAndBindings(hullParts, gold);
  buildProwAndBowsprit(hullParts, gold);
  if (tier > 1) buildQuarterdeck(hullParts, enamel, gold);
  if (tier === 3) buildFlagshipGallery(hullParts, enamel, gold);
  buildClassEquipment(hullParts, army, tier, enamel, gold);
  buildFittingsAndShields(hullParts, army, tier, enamel, gold);
  shapeTierHullParts(hullParts, tier);

  const sailParts: BufferGeometry[] = [];
  const pennantParts: BufferGeometry[] = [];
  buildRiggingAndCloth(hullParts, sailParts, pennantParts, tier, gold);

  const root = new Group();
  root.name = `ship-${army}-t${tier}`;

  const hullMesh = new Mesh(combineColoredParts(hullParts), createProcgenMasonryMaterial());
  hullMesh.name = "FleetHull";
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  root.add(hullMesh);

  const sailMaterial = new MeshStandardMaterial({
    map: getClassSailPrint(army),
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0,
    side: DoubleSide,
  });
  sailMaterial.name = "Fleet Ownership sail";
  sailMaterial.userData.ownershipColor = true;
  sailMaterial.userData.shipCloth = "sail";

  const sailMesh = new Mesh(mergeClothGeometries(sailParts), sailMaterial);
  sailMesh.name = "Sail_0";
  sailMesh.castShadow = true;
  sailMesh.receiveShadow = true;
  sailMesh.userData.sailCount = MAST_SPECS[tier].length;
  root.add(sailMesh);

  const pennantMaterial = new MeshStandardMaterial({
    color: new Color(enamel),
    roughness: 0.72,
    metalness: 0.04,
    side: DoubleSide,
  });
  pennantMaterial.name = "Fleet Ownership pennant";
  pennantMaterial.userData.ownershipColor = true;
  pennantMaterial.userData.shipCloth = "pennant";

  const pennantMesh = new Mesh(mergeClothGeometries(pennantParts), pennantMaterial);
  pennantMesh.name = "Pennant_0";
  pennantMesh.castShadow = true;
  root.add(pennantMesh);

  return root;
}

function getClassSailPrint(army: ShipArmyClass): Texture {
  const existing = cachedClassSailPrints.get(army);
  if (existing) return existing;
  if (typeof document !== "undefined") {
    const tex = createSailPrint({ army, color: "#ffffff", print: "army" });
    cachedClassSailPrints.set(army, tex);
    return tex;
  }
  const data = new Uint8Array([245, 243, 237, 255]);
  const fallback = new DataTexture(data, 1, 1, RGBAFormat, UnsignedByteType);
  fallback.colorSpace = SRGBColorSpace;
  fallback.needsUpdate = true;
  cachedClassSailPrints.set(army, fallback);
  return fallback;
}

function toWorld(bx: number, by: number, bz: number): Vector3 {
  return new Vector3(bx, bz, -by);
}

function beam(by: number): number {
  const clamped = Math.max(-2.1, Math.min(2.1, by));
  for (let i = 0; i < STATIONS.length - 1; i++) {
    const [a, wa] = STATIONS[i];
    const [b, wb] = STATIONS[i + 1];
    if (clamped >= a && clamped <= b) {
      const t = (clamped - a) / (b - a);
      const before = STATIONS[Math.max(0, i - 1)];
      const after = STATIONS[Math.min(STATIONS.length - 1, i + 2)];
      const ma = (wb - before[1]) / (b - before[0]);
      const mb = (after[1] - wa) / (after[0] - a);
      const t2 = t * t;
      const t3 = t2 * t;
      return Math.max(
        0,
        (2 * t3 - 3 * t2 + 1) * wa +
          (t3 - 2 * t2 + t) * (b - a) * ma +
          (-2 * t3 + 3 * t2) * wb +
          (t3 - t2) * (b - a) * mb,
      );
    }
  }
  return 0;
}

function sheer(by: number): number {
  return 1.0 + 0.18 * Math.pow(Math.max(by, 0) / 2.1, 3) + 0.24 * Math.pow(Math.max(-by, 0) / 2.1, 3);
}

function hullSection(by: number, t: number, side: number): Vector3 {
  const bottom = -0.3 + 0.26 * Math.pow(Math.abs(by) / 2.1, 4);
  const x = side * beam(by) * Math.pow(Math.sin((t * Math.PI) / 2), 0.55);
  const bz = bottom + (sheer(by) - bottom) * t;
  return toWorld(x, by, bz);
}

function deckEdge(by: number): number {
  const bottom = -0.3 + 0.26 * Math.pow(Math.abs(by) / 2.1, 4);
  const t = Math.max(0, Math.min(1, (0.68 - bottom) / (sheer(by) - bottom)));
  return Math.max(0, beam(by) * Math.pow(Math.sin((t * Math.PI) / 2), 0.55) - 0.045);
}

function buildHullStrakes(parts: ColoredPart[], enamel: string, gold: string): void {
  const steps = 18;
  const oakCourses: ReadonlyArray<{ low: number; high: number; tint: string }> = [
    { low: 0.0, high: 0.2, tint: OAK_DARK },
    { low: 0.2, high: 0.4, tint: OAK_MID },
    { low: 0.4, high: 0.58, tint: OAK_LIGHT },
    { low: 0.58, high: 0.765, tint: OAK_MID },
  ];

  for (const side of [-1, 1]) {
    for (const course of oakCourses) {
      parts.push({
        geometry: createHullRibbon(side, course.low, course.high, steps),
        color: course.tint,
      });
    }
    parts.push({
      geometry: createHullRibbon(side, 0.765, 1.0, steps),
      color: enamel,
    });

    for (const [t, radius] of [
      [0.2, 0.022],
      [0.72, 0.024],
      [0.775, 0.024],
      [1.0, 0.04],
    ] as const) {
      const pts: Vector3[] = [];
      for (let i = 0; i <= 16; i++) pts.push(hullSection(-2.1 + (4.2 * i) / 16, t, side));
      addPolylineTube(parts, pts, radius, gold);
    }
  }
}

function createHullRibbon(side: number, lowT: number, highT: number, steps: number): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const by = -2.1 + (4.2 * i) / steps;
    const lo = hullSection(by, lowT, side);
    const hi = hullSection(by, highT, side);
    positions.push(lo.x, lo.y, lo.z, hi.x, hi.y, hi.z);
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    if (side > 0) {
      indices.push(a, c, d, a, d, b);
    } else {
      indices.push(a, b, d, a, d, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildTransomAndRudder(parts: ColoredPart[], gold: string): void {
  const rows = 8;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const left = hullSection(-2.1, t, -1);
    const right = hullSection(-2.1, t, 1);
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
  }
  for (let r = 0; r < rows; r++) {
    const a = r * 2;
    indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const transom = new BufferGeometry();
  transom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  transom.setIndex(indices);
  transom.computeVertexNormals();
  parts.push({ geometry: transom, color: OAK_DARK });

  addPolylineTube(parts, [toWorld(-0.33, -2.1, 1.24), toWorld(0, -2.14, 1.25), toWorld(0.33, -2.1, 1.24)], 0.042, gold);
  addBlenderBox(parts, 0, -2.18, -0.08, 0.075, 0.18, 0.45, OAK_DARK);
  for (const bz of [-0.13, 0.05]) addBlenderBox(parts, 0, -2.12, bz, 0.13, 0.12, 0.036, IRON_DARK);
}

function buildDeckAndHatch(parts: ColoredPart[], gold: string): void {
  const steps = 16;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const by = -2.05 + (4.1 * i) / steps;
    const w = deckEdge(by) + 0.03;
    const left = toWorld(-w, by, 0.68);
    const right = toWorld(w, by, 0.68);
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const deck = new BufferGeometry();
  deck.setAttribute("position", new Float32BufferAttribute(positions, 3));
  deck.setIndex(indices);
  deck.computeVertexNormals();
  parts.push({ geometry: deck, color: OAK_DECK });

  for (let strip = -3; strip <= 3; strip++) {
    const x = strip * 0.21;
    const span = Math.max(0.4, 3.6 - Math.abs(strip) * 0.55);
    addBlenderBox(parts, x, -0.1, 0.685, 0.018, span, 0.012, OAK_DARK);
  }

  addBlenderBox(parts, 0, 0.87, 0.71, 0.55, 0.52, 0.085, gold);
  addBlenderBox(parts, 0, 0.87, 0.758, 0.47, 0.44, 0.022, RECESS_DARK);
  for (const x of [-0.16, -0.055, 0.055, 0.16]) addBlenderBox(parts, x, 0.87, 0.775, 0.026, 0.43, 0.024, OAK_LIGHT);
  for (const by of [0.73, 0.87, 1.01]) addBlenderBox(parts, 0, by, 0.773, 0.44, 0.022, 0.022, OAK_LIGHT);
}

function buildBulwarksAndBindings(parts: ColoredPart[], gold: string): void {
  const steps = 16;
  for (const side of [-1, 1]) {
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const by = -2.1 + (4.2 * i) / steps;
      const top = toWorld(side * Math.max(0, beam(by) - 0.065), by, sheer(by) - 0.015);
      const bot = toWorld(side * deckEdge(by), by, 0.68);
      positions.push(bot.x, bot.y, bot.z, top.x, top.y, top.z);
    }
    for (let i = 0; i < steps; i++) {
      const a = i * 2;
      if (side > 0) {
        indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
      } else {
        indices.push(a, a + 2, a + 3, a, a + 3, a + 1);
      }
    }
    const inner = new BufferGeometry();
    inner.setAttribute("position", new Float32BufferAttribute(positions, 3));
    inner.setIndex(indices);
    inner.computeVertexNormals();
    parts.push({ geometry: inner, color: OAK_MID });

    for (const by of [-1.75, -1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.7]) {
      const x = side * beam(by);
      const bz = sheer(by);
      addBlenderBox(parts, x, by, bz - 0.1, 0.072, 0.07, 0.27, gold);
      addBlenderBox(parts, x, by, bz + 0.03, 0.125, 0.18, 0.056, OAK_DARK);
    }
  }
}

function buildProwAndBowsprit(parts: ColoredPart[], gold: string): void {
  addPolylineTube(
    parts,
    [
      toWorld(0, 2.08, -0.05),
      toWorld(0, 2.105, 0.26),
      toWorld(0, 2.13, 0.65),
      toWorld(0, 2.15, 1.05),
      toWorld(0, 2.08, 1.21),
    ],
    0.058,
    gold,
  );

  const bowStart = toWorld(0, 1.18, 0.91);
  const bowDir = toWorld(0, 0.93, 0.37).normalize();
  const bowEnd = bowStart.clone().addScaledVector(bowDir, 1.28);
  parts.push({ geometry: createTaperedCylinder(bowStart, bowEnd, 0.066, 0.038, 8), color: OAK_MID });

  for (const dist of [0.22, 0.65, 1.14]) {
    const p0 = bowStart.clone().addScaledVector(bowDir, dist);
    const p1 = bowStart.clone().addScaledVector(bowDir, dist + 0.045);
    parts.push({ geometry: createTaperedCylinder(p0, p1, 0.07, 0.066, 8), color: gold });
  }

  for (const side of [-1, 1]) {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const angle = (i / 12) * Math.PI * 2.8;
      const radius = 0.135 * (1 - i / 16);
      const by = 1.66 + radius * Math.cos(angle);
      pts.push(toWorld(side * (beam(by) + 0.038), by, 1.02 + radius * Math.sin(angle)));
    }
    addPolylineTube(parts, pts, 0.022, GOLD_BRIGHT);
  }
}

function buildQuarterdeck(parts: ColoredPart[], enamel: string, gold: string): void {
  const steps = 10;
  for (const side of [-1, 1]) {
    const positions: number[] = [];
    const indices: number[] = [];
    const railPts: Vector3[] = [];
    const mouldTopPts: Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const by = -2.04 + (1.09 * i) / steps;
      const lo = toWorld(side * beam(by) * 0.84, by, 0.69);
      const hi = toWorld(side * beam(by) * 0.89, by, 1.3);
      positions.push(lo.x, lo.y, lo.z, hi.x, hi.y, hi.z);
      mouldTopPts.push(toWorld(side * beam(by) * 0.91, by, 1.31));
      railPts.push(toWorld(side * beam(by) * 0.92, by, 1.54));
    }
    for (let i = 0; i < steps; i++) {
      const a = i * 2;
      if (side > 0) indices.push(a, a + 2, a + 3, a, a + 3, a + 1);
      else indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    const wall = new BufferGeometry();
    wall.setAttribute("position", new Float32BufferAttribute(positions, 3));
    wall.setIndex(indices);
    wall.computeVertexNormals();
    parts.push({ geometry: wall, color: enamel });

    addPolylineTube(parts, mouldTopPts, 0.024, gold);
    addPolylineTube(parts, railPts, 0.032, OAK_DARK);

    for (const by of [-1.78, -1.46, -1.15]) {
      const x = side * beam(by) * 0.91;
      addBlenderBox(parts, x, by, 1.015, 0.035, 0.2, 0.21, RECESS_DARK);
      addBlenderBox(parts, x + side * 0.015, by, 1.015, 0.02, 0.15, 0.16, GLASS_AMBER);
      addBlenderBox(parts, x + side * 0.025, by, 1.125, 0.024, 0.22, 0.03, GOLD_BRIGHT);
    }

    for (const by of [-1.94, -1.61, -1.29, -0.98]) {
      const x = side * beam(by) * 0.91;
      parts.push({
        geometry: createTaperedCylinder(toWorld(x, by, 1.32), toWorld(x, by, 1.54), 0.028, 0.022, 6),
        color: gold,
      });
    }
  }

  for (let i = 0; i < 6; i++) {
    const by = -1.96 + i * 0.18;
    addBlenderBox(parts, 0, by, 1.315, beam(by) * 1.8, 0.175, 0.052, OAK_DECK);
  }
  addBlenderBox(parts, 0, -0.953, 1.0, 1.36, 0.05, 0.61, enamel);
  addBlenderBox(parts, 0, -0.92, 0.94, 0.31, 0.035, 0.44, OAK_DARK);
  for (const x of [-0.18, 0.18]) addBlenderBox(parts, x, -0.89, 0.94, 0.038, 0.04, 0.49, gold);

  for (let i = 0; i < 6; i++) {
    addBlenderBox(parts, 0.49, -0.37 - i * 0.1, 0.72 + i * 0.105, 0.32, 0.12, 0.06, OAK_MID);
  }
  for (const x of [0.3, 0.68]) {
    addPolylineTube(parts, [toWorld(x, -0.32, 0.66), toWorld(x, -0.94, 1.26)], 0.024, gold);
  }
}

function buildFlagshipGallery(parts: ColoredPart[], enamel: string, gold: string): void {
  const steps = 8;
  for (const side of [-1, 1]) {
    const positions: number[] = [];
    const indices: number[] = [];
    const corniceTop: Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const by = -2.0 + (0.78 * i) / steps;
      const lo = toWorld(side * beam(by) * 0.83, by, 1.32);
      const hi = toWorld(side * beam(by) * 0.77, by, 1.91);
      positions.push(lo.x, lo.y, lo.z, hi.x, hi.y, hi.z);
      corniceTop.push(toWorld(side * beam(by) * 0.8, by, 1.93));
    }
    for (let i = 0; i < steps; i++) {
      const a = i * 2;
      if (side > 0) indices.push(a, a + 2, a + 3, a, a + 3, a + 1);
      else indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    const wall = new BufferGeometry();
    wall.setAttribute("position", new Float32BufferAttribute(positions, 3));
    wall.setIndex(indices);
    wall.computeVertexNormals();
    parts.push({ geometry: wall, color: enamel });
    addPolylineTube(parts, corniceTop, 0.028, gold);

    for (const by of [-1.82, -1.57, -1.32]) {
      const x = side * beam(by) * 0.825;
      addBlenderBox(parts, x, by, 1.63, 0.032, 0.18, 0.34, RECESS_DARK);
      addBlenderBox(parts, x + side * 0.015, by, 1.63, 0.02, 0.14, 0.27, GLASS_AMBER);
      addBlenderBox(parts, x + side * 0.025, by, 1.81, 0.024, 0.2, 0.032, GOLD_BRIGHT);
    }
  }

  for (let i = 0; i < 5; i++) {
    const by = -1.92 + i * 0.175;
    addBlenderBox(parts, 0, by, 1.96, beam(by) * 1.64, 0.17, 0.07, OAK_MID);
  }
  addBlenderBox(parts, 0, -1.21, 1.63, 1.16, 0.05, 0.59, enamel);
  addBlenderBox(parts, 0, -1.17, 1.64, 0.19, 0.035, 0.26, GOLD_BRIGHT);
}

function buildClassEquipment(
  parts: ColoredPart[],
  army: ShipArmyClass,
  tier: ShipTier,
  enamel: string,
  gold: string,
): void {
  if (army === "knight") buildArtillery(parts, tier, enamel, gold);
  else if (army === "crossbowman") buildBallista(parts, tier, enamel, gold);
  else buildSacredFittings(parts, tier, enamel, gold);
}

function buildArtillery(parts: ColoredPart[], tier: ShipTier, enamel: string, gold: string): void {
  const stations =
    tier === 1 ? [-0.35, 0.5] : tier === 2 ? [-0.82, -0.24, 0.36, 1.0] : [-1.08, -0.58, -0.08, 0.42, 1.0];
  for (const side of [-1, 1]) {
    for (const by of stations) {
      const pos = hullSection(by, 0.58, side);
      const bx = pos.x;
      const bz = pos.y;
      addBlenderBox(parts, bx + side * 0.022, by, bz, 0.045, 0.24, 0.215, gold);
      addBlenderBox(parts, bx + side * 0.046, by, bz, 0.035, 0.18, 0.16, RECESS_DARK);
      parts.push({
        geometry: createTaperedCylinder(toWorld(bx, by, bz), toWorld(bx + side * 0.21, by, bz), 0.066, 0.052, 8),
        color: IRON_DARK,
      });
      parts.push({
        geometry: createTaperedCylinder(
          toWorld(bx + side * 0.175, by, bz),
          toWorld(bx + side * 0.21, by, bz),
          0.066,
          0.062,
          8,
        ),
        color: gold,
      });
      const lid = new BoxGeometry(0.13, 0.035, 0.21);
      lid.rotateZ(side * -0.34);
      const lidPos = toWorld(bx + side * 0.055, by, bz + 0.15);
      lid.translate(lidPos.x, lidPos.y, lidPos.z);
      parts.push({ geometry: lid, color: enamel });
    }
  }
}

function buildBallista(parts: ColoredPart[], tier: ShipTier, enamel: string, gold: string): void {
  const by = 1.13;
  const bz = 0.93;
  const span = tier === 1 ? 0.78 : tier === 2 ? 0.98 : 1.12;
  addBlenderBox(parts, 0, by, 0.83, 0.36, 0.44, 0.22, OAK_MID);
  for (const x of [-0.19, 0.19]) {
    for (const dy of [-0.15, 0.15]) {
      parts.push({
        geometry: createTaperedCylinder(
          toWorld(x - 0.025, by + dy, 0.8),
          toWorld(x + 0.025, by + dy, 0.8),
          0.072,
          0.072,
          8,
        ),
        color: IRON_DARK,
      });
    }
  }
  parts.push({
    geometry: createTaperedCylinder(toWorld(0, by, bz), toWorld(0, by, bz + 0.065), 0.18, 0.17, 10),
    color: gold,
  });
  addBlenderBox(parts, 0, by + 0.06, bz + 0.14, 0.095, 0.7, 0.1, OAK_MID);
  addBlenderBox(parts, 0, by + 0.08, bz + 0.193, 0.042, 0.65, 0.015, RECESS_DARK);

  const offsets = tier < 3 ? [0.12] : [0.06, 0.19];
  for (const dy of offsets) {
    const pts = [
      toWorld(-span / 2, by + dy - 0.07, bz + 0.22),
      toWorld(-span * 0.32, by + dy + 0.09, bz + 0.23),
      toWorld(0, by + dy + 0.15, bz + 0.235),
      toWorld(span * 0.32, by + dy + 0.09, bz + 0.23),
      toWorld(span / 2, by + dy - 0.07, bz + 0.22),
    ];
    addPolylineTube(parts, pts, tier === 1 ? 0.025 : 0.032, OAK_DARK);
    addPolylineTube(
      parts,
      pts.map((p) => p.clone().add(new Vector3(0, 0.024, 0))),
      0.012,
      GOLD_BRIGHT,
    );
    addPolylineTube(parts, [pts[0], toWorld(0, by - 0.24, bz + 0.22), pts[pts.length - 1]], 0.009, ROPE_HEMP);
  }

  parts.push({
    geometry: createTaperedCylinder(
      toWorld(0, by - 0.19, bz + 0.215),
      toWorld(0, by + 0.61, bz + 0.215),
      0.016,
      0.006,
      6,
    ),
    color: IRON_DARK,
  });
  addBlenderBox(parts, 0, by - 0.1, bz + 0.215, 0.11, 0.14, 0.014, enamel);

  if (tier > 1) {
    parts.push({
      geometry: createTaperedCylinder(
        toWorld(-0.11, by - 0.18, bz + 0.14),
        toWorld(0.11, by - 0.18, bz + 0.14),
        0.05,
        0.05,
        8,
      ),
      color: gold,
    });
    addBlenderBox(parts, -0.25, by - 0.24, 0.99, 0.13, 0.34, 0.045, gold);
  }
}

function buildSacredFittings(parts: ColoredPart[], tier: ShipTier, enamel: string, gold: string): void {
  const by = 1.42;
  const center = tier === 1 ? 1.25 : 1.4;
  const radius = tier === 1 ? 0.13 : 0.18;

  const haloPts: Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * TAU;
    haloPts.push(toWorld(radius * Math.cos(a), by, center + radius * Math.sin(a)));
  }
  addPolylineTube(parts, haloPts, 0.024, GOLD_BRIGHT);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    addPolylineTube(
      parts,
      [
        toWorld(radius * Math.cos(a), by, center + radius * Math.sin(a)),
        toWorld(radius * 1.32 * Math.cos(a), by, center + radius * 1.32 * Math.sin(a)),
      ],
      0.012,
      GOLD_BRIGHT,
    );
  }
  addPolylineTube(parts, [toWorld(0, by, 1.04), toWorld(0, by, center)], 0.036, gold);

  if (tier === 1) return;

  const featherCount = tier === 2 ? 5 : 7;
  for (const side of [-1, 1]) {
    for (let i = 0; i < featherCount; i++) {
      const length = 0.3 + i * 0.045;
      const start = toWorld(side * 0.07, 1.57 - i * 0.065, 1.09 + i * 0.018);
      const tip = toWorld(side * (0.18 + length), 1.57 - i * 0.065 - 0.36, 1.09 + i * 0.018 + 0.22);
      parts.push({ geometry: createBeam(start, tip, 0.065, 0.022), color: GOLD_BRIGHT });
    }
  }

  addBlenderBox(parts, 0, 0.81, 0.81, 0.35, 0.38, 0.1, gold);
  addBlenderBox(parts, 0, 0.81, 0.96, 0.28, 0.31, 0.22, enamel);
  parts.push({
    geometry: createTaperedCylinder(toWorld(0, 0.81, 1.075), toWorld(0, 0.81, 1.21), 0.15, 0.02, 8),
    color: GOLD_BRIGHT,
  });

  if (tier === 3) buildDragonFigurehead(parts, gold);
}

function buildDragonFigurehead(parts: ColoredPart[], gold: string): void {
  addPolylineTube(
    parts,
    [toWorld(0, 1.88, 1.08), toWorld(0, 2.03, 1.22), toWorld(0, 2.07, 1.39), toWorld(0, 2.17, 1.45)],
    0.08,
    gold,
  );
  addBlenderBox(parts, 0, 2.205, 1.44, 0.15, 0.23, 0.11, GOLD_BRIGHT);
  addBlenderBox(parts, 0, 2.2, 1.388, 0.115, 0.19, 0.03, gold);
  for (const side of [-1, 1]) {
    parts.push({
      geometry: createTaperedCylinder(
        toWorld(side * 0.06, 2.08, 1.48),
        toWorld(side * 0.1, 1.98, 1.67),
        0.03,
        0.008,
        6,
      ),
      color: GOLD_BRIGHT,
    });
    addBlenderBox(parts, side * 0.077, 2.16, 1.474, 0.018, 0.045, 0.024, GLASS_AMBER);
  }
}

function buildFittingsAndShields(
  parts: ColoredPart[],
  army: ShipArmyClass,
  tier: ShipTier,
  enamel: string,
  gold: string,
): void {
  for (const [x, by] of [
    [-0.34, 1.12],
    [0.28, 0.1],
    [-0.39, -0.6],
  ] as const) {
    parts.push({
      geometry: createTaperedCylinder(toWorld(x, by, 0.69), toWorld(x, by, 0.98), 0.102, 0.095, 8),
      color: OAK_MID,
    });
    for (const bz of [0.74, 0.92]) {
      parts.push({
        geometry: createTaperedCylinder(toWorld(x, by, bz), toWorld(x, by, bz + 0.026), 0.11, 0.11, 8),
        color: IRON_DARK,
      });
    }
  }

  const helmOffset = tier === 1 ? -0.6 : 0;
  addBlenderBox(parts, 0, -1.42, 1.43 + helmOffset, 0.09, 0.14, 0.22, OAK_DARK);
  const wheelPts: Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * TAU;
    wheelPts.push(toWorld(0.15 * Math.cos(a), -1.42, 1.63 + helmOffset + 0.15 * Math.sin(a)));
  }
  addPolylineTube(parts, wheelPts, 0.018, gold);

  for (const side of [-1, 1]) {
    const lx = side * 0.42;
    const ly = -1.86;
    const lz = 1.38 + helmOffset;
    parts.push({
      geometry: createTaperedCylinder(toWorld(lx, ly, lz), toWorld(lx, ly, lz + 0.05), 0.072, 0.06, 6),
      color: gold,
    });
    parts.push({
      geometry: createTaperedCylinder(toWorld(lx, ly, lz + 0.05), toWorld(lx, ly, lz + 0.19), 0.058, 0.058, 6),
      color: GLASS_AMBER,
    });
    parts.push({
      geometry: createTaperedCylinder(toWorld(lx, ly, lz + 0.19), toWorld(lx, ly, lz + 0.31), 0.082, 0.012, 6),
      color: gold,
    });
  }

  for (const side of [-1, 1]) {
    const by = -0.48;
    const x = side * (beam(by) + 0.055);
    addBlenderBox(parts, x, by, 0.91, 0.032, 0.25, 0.29, enamel);
    addBlenderBox(parts, x + side * 0.012, by, 1.05, 0.025, 0.27, 0.025, GOLD_BRIGHT);
    addBlenderBox(parts, x + side * 0.012, by, 0.77, 0.025, 0.18, 0.025, GOLD_BRIGHT);
    const ex = x + side * 0.024;
    if (army === "knight") {
      addBlenderBox(parts, ex, by, 0.9, 0.018, 0.028, 0.19, GOLD_BRIGHT);
      addBlenderBox(parts, ex, by, 0.93, 0.018, 0.13, 0.024, GOLD_BRIGHT);
    } else if (army === "crossbowman") {
      addBlenderBox(parts, ex, by, 0.91, 0.018, 0.024, 0.19, GOLD_BRIGHT);
      addPolylineTube(
        parts,
        [toWorld(ex, by - 0.075, 0.9), toWorld(ex, by, 0.975), toWorld(ex, by + 0.075, 0.9)],
        0.013,
        GOLD_BRIGHT,
      );
    } else {
      parts.push({
        geometry: createTaperedCylinder(
          toWorld(ex - side * 0.008, by, 0.925),
          toWorld(ex + side * 0.01, by, 0.925),
          0.055,
          0.055,
          8,
        ),
        color: GOLD_BRIGHT,
      });
    }
  }
}

function shapeTierHullParts(parts: ColoredPart[], tier: ShipTier): void {
  if (tier === 2) return;
  for (const part of parts) {
    const pos = part.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (tier === 1) {
        pos.setXYZ(i, x * 1.025, y * 0.92, z);
      } else {
        const by = -z;
        pos.setXYZ(i, x * (1.045 - 0.012 * by), y, z);
      }
    }
    pos.needsUpdate = true;
    part.geometry.computeVertexNormals();
  }
}

function buildRiggingAndCloth(
  hullParts: ColoredPart[],
  sailParts: BufferGeometry[],
  pennantParts: BufferGeometry[],
  tier: ShipTier,
  gold: string,
): void {
  const specs = MAST_SPECS[tier];
  for (const spec of specs) {
    const mastBase = toWorld(0, spec.by, 0.54);
    const mastTop = toWorld(0, spec.by, spec.top + 0.52);
    hullParts.push({ geometry: createTaperedCylinder(mastBase, mastTop, 0.082, 0.026, 8), color: OAK_MID });

    for (const bz of [0.64, 0.87, spec.top + 0.34]) {
      hullParts.push({
        geometry: createTaperedCylinder(toWorld(0, spec.by, bz), toWorld(0, spec.by, bz + 0.055), 0.088, 0.072, 8),
        color: gold,
      });
    }

    const yardLeft = toWorld(-spec.width * 0.55, spec.by + 0.065, spec.top + 0.045);
    const yardRight = toWorld(spec.width * 0.55, spec.by + 0.065, spec.top + 0.045);
    hullParts.push({ geometry: createTaperedCylinder(yardLeft, yardRight, 0.044, 0.044, 8), color: OAK_DARK });

    hullParts.push({
      geometry: createTaperedCylinder(
        toWorld(0, spec.by, spec.top + 0.08),
        toWorld(0, spec.by, spec.top + 0.185),
        0.065,
        0.2,
        10,
      ),
      color: OAK_DARK,
    });
    const nestRingPts: Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * TAU;
      nestRingPts.push(toWorld(0.19 * Math.cos(a), spec.by + 0.19 * Math.sin(a), spec.top + 0.33));
    }
    addPolylineTube(hullParts, nestRingPts, 0.02, GOLD_BRIGHT);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const sx = 0.18 * Math.cos(a);
      const sy = spec.by + 0.18 * Math.sin(a);
      addPolylineTube(hullParts, [toWorld(sx, sy, spec.top + 0.17), toWorld(sx, sy, spec.top + 0.34)], 0.012, gold);
    }

    for (const side of [-1, 1]) {
      const head = toWorld(0, spec.by, spec.top + 0.15);
      const footA = toWorld(side * beam(spec.by) * 0.93, spec.by - 0.14, 1.02);
      const footB = toWorld(side * beam(spec.by) * 0.93, spec.by - 0.46, 1.02);
      addPolylineTube(hullParts, [footA, head], 0.011, ROPE_HEMP);
      addPolylineTube(hullParts, [footB, head], 0.011, ROPE_HEMP);
      for (let r = 2; r <= 12; r += 2) {
        const t = r / 14;
        addPolylineTube(
          hullParts,
          [new Vector3().lerpVectors(footA, head, t), new Vector3().lerpVectors(footB, head, t)],
          0.007,
          ROPE_HEMP,
        );
      }
    }

    sailParts.push(createSailGeometry(spec));
    pennantParts.push(createPennantGeometry(spec.by, spec.top + 0.48));
  }

  const last = specs[specs.length - 1];
  addPolylineTube(
    hullParts,
    [toWorld(0, -2.02, tier === 1 ? 0.95 : 1.5), toWorld(0, last.by, last.top + 0.22)],
    0.011,
    ROPE_HEMP,
  );
}

function createSailGeometry(spec: MastSpec): BufferGeometry {
  const cols = 14;
  const rows = 12;
  const positions: number[] = [];
  const uvs: number[] = [];
  const clearances: number[] = [];
  const indices: number[] = [];
  const mastZ = -spec.by;
  const clearanceZ = mastZ - 0.063 - 0.015;

  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const bx = (u - 0.5) * spec.width * (1 - 0.08 * v);
      const bz = spec.top - v * spec.height + 0.13 * Math.pow(2 * u - 1, 2) * v;
      const belly = 0.42 * Math.sin(v * Math.PI) * Math.sin(u * Math.PI);
      const folds = 0.014 * Math.sin(u * Math.PI * 12) * Math.sin(v * Math.PI);
      const by = spec.by + 0.14 + belly + folds;
      const p = toWorld(bx, by, bz);
      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);
      clearances.push(clearanceZ);
    }
  }

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const c = a + cols + 1;
      const d = c + 1;
      indices.push(a, c, d, a, d, b);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("aMastClearanceZ", new Float32BufferAttribute(clearances, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createPennantGeometry(by: number, top: number): BufferGeometry {
  const cols = 10;
  const positions: number[] = [];
  const uvs: number[] = [];
  const clearances: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= cols; i++) {
    const t = i / cols;
    for (const edge of [0, 1]) {
      const bx = 0.63 * t;
      const py = by + 0.055 * Math.sin(t * TAU);
      const bz = top + 0.13 - edge * 0.18 * (1 - 0.4 * t);
      const p = toWorld(bx, py, bz);
      positions.push(p.x, p.y, p.z);
      uvs.push(t, edge);
      clearances.push(0);
    }
  }

  for (let i = 0; i < cols; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("aMastClearanceZ", new Float32BufferAttribute(clearances, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addBlenderBox(
  parts: ColoredPart[],
  bx: number,
  by: number,
  bz: number,
  sx: number,
  sy: number,
  sz: number,
  hexColor: string,
): void {
  const box = new BoxGeometry(sx, sz, sy);
  const p = toWorld(bx, by, bz);
  box.translate(p.x, p.y, p.z);
  parts.push({ geometry: box, color: hexColor });
}

function addPolylineTube(parts: ColoredPart[], points: readonly Vector3[], radius: number, hexColor: string): void {
  for (let i = 0; i < points.length - 1; i++) {
    parts.push({ geometry: createTaperedCylinder(points[i], points[i + 1], radius, radius, 6), color: hexColor });
  }
}

function createTaperedCylinder(
  start: Vector3,
  end: Vector3,
  rStart: number,
  rEnd: number,
  segments: number,
): BufferGeometry {
  const delta = new Vector3().subVectors(end, start);
  const len = Math.max(delta.length(), 1e-4);
  const geometry = new CylinderGeometry(rEnd, rStart, len, segments, 1);
  const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
  const quat = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize());
  geometry.applyMatrix4(new Matrix4().compose(mid, quat, new Vector3(1, 1, 1)));
  return geometry;
}

function createBeam(start: Vector3, end: Vector3, width: number, thickness: number): BufferGeometry {
  const delta = new Vector3().subVectors(end, start);
  const len = Math.max(delta.length(), 1e-4);
  const geometry = new BoxGeometry(width, thickness, len);
  const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
  const quat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), delta.normalize());
  geometry.applyMatrix4(new Matrix4().compose(mid, quat, new Vector3(1, 1, 1)));
  return geometry;
}

function combineColoredParts(parts: readonly ColoredPart[]): BufferGeometry {
  const normalized: BufferGeometry[] = [];
  const scratchColor = new Color();

  for (const part of parts) {
    const nonIndexed = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    part.geometry.dispose();
    if (!nonIndexed.getAttribute("normal")) nonIndexed.computeVertexNormals();
    for (const key of Object.keys(nonIndexed.attributes)) {
      if (key !== "position" && key !== "normal") nonIndexed.deleteAttribute(key);
    }
    const vertexCount = nonIndexed.getAttribute("position").count;
    const colors = new Float32Array(vertexCount * 3);
    scratchColor.set(part.color);
    for (let i = 0; i < vertexCount; i++) {
      colors[i * 3] = scratchColor.r;
      colors[i * 3 + 1] = scratchColor.g;
      colors[i * 3 + 2] = scratchColor.b;
    }
    nonIndexed.setAttribute("color", new Float32BufferAttribute(colors, 3));
    normalized.push(nonIndexed);
  }

  const merged = mergeGeometries(normalized, false);
  for (const geometry of normalized) geometry.dispose();
  if (!merged) throw new Error("Failed to merge procedural fleet hull geometry");
  const welded = mergeVertices(merged, 1e-4);
  merged.dispose();
  welded.computeBoundingBox();
  welded.computeBoundingSphere();
  return welded;
}

function mergeClothGeometries(geometries: readonly BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries([...geometries], false);
  for (const geometry of geometries) geometry.dispose();
  if (!merged) throw new Error("Failed to merge procedural fleet cloth geometry");
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  if (merged.boundingSphere) merged.boundingSphere.radius += 0.8;
  return merged;
}
