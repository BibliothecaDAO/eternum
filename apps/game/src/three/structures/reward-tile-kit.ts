import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  OctahedronGeometry,
  Quaternion,
  Shape,
  TorusGeometry,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import {
  atan,
  clamp,
  color,
  float,
  length,
  mix,
  mx_noise_float,
  positionGeometry,
  positionLocal,
  sin,
  smoothstep,
  uniform,
  vec3,
} from "three/tsl";
import { mapAnimationTime } from "../effects/endgame/state";
import { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";
import { createProcgenMasonryMaterial } from "./procgen-masonry-material";

export const PROCEDURAL_RIFT_PATH = "procedural:reward-tile:rift";
export const PROCEDURAL_CHEST_PATH = "procedural:reward-tile:chest";

export const REWARD_RIFT_HEIGHT = 0.48;
export const REWARD_CHEST_HEIGHT = 0.9;

interface ColoredPart {
  readonly geometry: BufferGeometry;
  readonly color: string;
}

const TAU = Math.PI * 2;
const RIFT_VORTEX_CACHE_KEY = "eternum-procgen-rift-vortex-v1";

const SLATE_BLOCKS = ["#586270", "#4a5361", "#657080", "#414a57", "#534e66", "#5e6876"] as const;
const SLATE_SHADE = "#2e3540";
const SLATE_MONOLITH = "#4b5362";
const SLATE_MONOLITH_LIGHT = "#677282";

const ENAMEL_MAIN = "#6b4b94";
const ENAMEL_DEEP = "#553878";
const ENAMEL_LID = "#7453a0";
const ENAMEL_CROWN = "#8260ae";
const GOLD_MAIN = "#e5b54b";
const GOLD_BRIGHT = "#f5d06e";
const BRONZE_DEEP = "#6c4b28";
const CYAN_BASE = "#3ed0e4";
const CYAN_MID = "#76eefb";
const CYAN_HIGHLIGHT = "#d6fdff";
const LID_SEAM_VIOLET = "#9454d6";

class EssenceRiftLiquidMaterial extends FrostedStandardNodeMaterial {
  readonly nightAmount = uniform(0);

  constructor() {
    super({ roughness: 0.24, metalness: 0.08, side: DoubleSide });
    this.name = "Living liquid";
    this.userData.nightAmount = this.nightAmount;

    const r = length(positionGeometry.xz);
    const angle = atan(positionGeometry.z, positionGeometry.x);
    const isDroplet = smoothstep(float(0.145), float(0.165), positionGeometry.y);
    const poolMask = isDroplet.oneMinus();

    const poolWave = sin(r.mul(22).sub(mapAnimationTime.mul(3.1)).add(angle.mul(3)))
      .mul(0.015)
      .mul(smoothstep(float(0.46), float(0.06), r))
      .mul(poolMask);
    const dropPhase = positionGeometry.x.mul(13).add(positionGeometry.z.mul(11));
    const dropBob = sin(mapAnimationTime.mul(2.4).add(dropPhase)).mul(0.032).mul(isDroplet);
    const dropSwayX = sin(mapAnimationTime.mul(1.7).add(dropPhase)).mul(0.014).mul(isDroplet);
    const dropSwayZ = sin(mapAnimationTime.mul(1.9).sub(dropPhase)).mul(0.014).mul(isDroplet);
    this.positionNode = positionLocal.add(vec3(dropSwayX, poolWave.add(dropBob), dropSwayZ));

    const swirlCoord = vec3(
      positionGeometry.x.mul(4.8).add(sin(mapAnimationTime.mul(0.75).add(r.mul(6))).mul(0.55)),
      positionGeometry.y.mul(4.0).sub(mapAnimationTime.mul(0.6)),
      positionGeometry.z.mul(4.8).sub(sin(mapAnimationTime.mul(0.65).sub(r.mul(5))).mul(0.55)),
    );
    const turbulence = mx_noise_float(swirlCoord).mul(0.5).add(0.5);
    const spiral = sin(angle.mul(3).add(r.mul(11.5)).sub(mapAnimationTime.mul(1.8)).add(turbulence.mul(2.4)))
      .mul(0.5)
      .add(0.5);
    const veinMask = smoothstep(float(0.44), float(0.5), r);
    const coreEye = smoothstep(float(0.24), float(0.0), r);
    const crest = clamp(spiral.mul(0.65).add(turbulence.mul(0.35)).add(coreEye.mul(0.35)), float(0), float(1));

    const deepViolet = color("#24054d");
    const royalViolet = color("#751de6");
    const hotMagenta = color("#d248ff");
    const coreCyan = color("#a6f0ff");

    const baseSwirl = mix(deepViolet, royalViolet, smoothstep(float(0.12), float(0.68), crest));
    const brightSwirl = mix(baseSwirl, hotMagenta, smoothstep(float(0.58), float(0.95), crest));
    const fissureTint = mix(
      brightSwirl,
      coreCyan,
      clamp(coreEye.mul(0.55).add(veinMask.mul(0.28)).add(isDroplet.mul(0.35)), float(0), float(1)),
    );

    this.colorNode = fissureTint;
    const nightBoost = float(0.62).add(this.nightAmount.mul(0.58));
    const emissiveStrength = float(0.45)
      .add(crest.mul(0.55))
      .add(veinMask.mul(0.45))
      .add(isDroplet.mul(0.55))
      .mul(nightBoost);
    this.emissiveNode = fissureTint.mul(emissiveStrength);
  }

  override customProgramCacheKey(): string {
    return RIFT_VORTEX_CACHE_KEY;
  }
}

export function isProceduralRewardTilePath(path: string): boolean {
  return path === PROCEDURAL_RIFT_PATH || path === PROCEDURAL_CHEST_PATH;
}

export function resolveProceduralRewardTileKit(path: string): GLTF | null {
  if (path === PROCEDURAL_RIFT_PATH) return createEssenceRiftKit();
  if (path === PROCEDURAL_CHEST_PATH) return createArcaneChestKit();
  return null;
}

export function createEssenceRiftKit(): GLTF {
  const masonryParts: ColoredPart[] = [];
  const vortexParts: BufferGeometry[] = [];

  buildRiftStoneRing(masonryParts);
  buildRiftMonolithsAndBoulders(masonryParts);
  buildRiftPoolFloor(masonryParts);
  buildRiftVortexSurface(vortexParts);
  buildRiftFissureVeins(vortexParts);
  buildRiftLevitatingDroplets(vortexParts);

  const scene = new Group();
  scene.name = "procedural-essence-rift";

  const masonryMesh = new Mesh(combineColoredParts(masonryParts), createProcgenMasonryMaterial());
  masonryMesh.name = "essence-rift:masonry";
  masonryMesh.castShadow = true;
  masonryMesh.receiveShadow = true;
  scene.add(masonryMesh);

  const vortexGeometry = mergeNormalizedGeometries(vortexParts);
  const vortexMesh = new Mesh(vortexGeometry, new EssenceRiftLiquidMaterial());
  vortexMesh.name = "essence-rift:vortex";
  vortexMesh.receiveShadow = true;
  scene.add(vortexMesh);

  return wrapKitGltf(scene);
}

export function createArcaneChestKit(): GLTF {
  const chestParts: ColoredPart[] = [];

  buildCofferBaseAndWalls(chestParts);
  buildCofferDomedLid(chestParts);
  buildCofferTrimAndStraps(chestParts);
  buildCofferClaspAndGem(chestParts);
  buildCofferHandlesAndHinges(chestParts);

  const scene = new Group();
  scene.name = "procedural-arcane-chest";

  const chestBody = new Group();
  chestBody.name = "ChestBody";

  const chestMesh = new Mesh(combineColoredParts(chestParts), createProcgenMasonryMaterial());
  chestMesh.name = "arcane-chest:body";
  chestMesh.castShadow = true;
  chestMesh.receiveShadow = true;
  chestBody.add(chestMesh);
  scene.add(chestBody);

  return wrapKitGltf(scene);
}

function buildRiftStoneRing(parts: ColoredPart[]): void {
  const outerCount = 12;
  for (let i = 0; i < outerCount; i++) {
    const a0 = (i / outerCount) * TAU + 0.032;
    const a1 = ((i + 1) / outerCount) * TAU - 0.032;
    const innerR = 0.565 + ((i * 3) % 4) * 0.008;
    const hexLimit = Math.min(hexRadiusAtAngle(a0), hexRadiusAtAngle(a1), hexRadiusAtAngle((a0 + a1) * 0.5));
    const outerR = hexLimit * 0.945;
    const height = 0.165 + ((i * 5) % 4) * 0.016;
    const block = createBevelledWedgePrism(innerR, outerR, a0, a1, 0, height, 0.014);
    parts.push({ geometry: block, color: SLATE_BLOCKS[i % SLATE_BLOCKS.length] });
  }

  const innerCount = 12;
  for (let i = 0; i < innerCount; i++) {
    const a0 = ((i + 0.5) / innerCount) * TAU + 0.038;
    const a1 = ((i + 1.5) / innerCount) * TAU - 0.038;
    const innerR = 0.425 + ((i * 7) % 3) * 0.01;
    const outerR = 0.56;
    const height = 0.12 + ((i * 3) % 3) * 0.014;
    const block = createBevelledWedgePrism(innerR, outerR, a0, a1, 0, height, 0.012);
    parts.push({ geometry: block, color: SLATE_BLOCKS[(i + 2) % SLATE_BLOCKS.length] });
  }
}

function buildRiftPoolFloor(parts: ColoredPart[]): void {
  const floor = new CylinderGeometry(0.45, 0.47, 0.05, 18);
  floor.translate(0, 0.025, 0);
  parts.push({ geometry: floor, color: SLATE_SHADE });
}

function buildRiftMonolithsAndBoulders(parts: ColoredPart[]): void {
  const monoliths = [
    { angle: -2.25, radius: 0.52, height: 0.42, baseR: 0.105, tilt: 0.16, tint: SLATE_MONOLITH_LIGHT },
    { angle: -0.78, radius: 0.55, height: 0.34, baseR: 0.092, tilt: -0.14, tint: SLATE_MONOLITH },
    { angle: 1.92, radius: 0.54, height: 0.31, baseR: 0.088, tilt: 0.12, tint: SLATE_MONOLITH_LIGHT },
    { angle: 0.65, radius: 0.2, height: 0.27, baseR: 0.072, tilt: -0.1, tint: SLATE_MONOLITH },
  ];

  for (const spec of monoliths) {
    const shard = createTaperedShard(spec.baseR, spec.height, 6);
    shard.rotateZ(spec.tilt);
    shard.rotateY(spec.angle);
    shard.translate(Math.cos(spec.angle) * spec.radius, 0.04, Math.sin(spec.angle) * spec.radius);
    parts.push({ geometry: shard, color: spec.tint });
  }

  for (let i = 0; i < 8; i++) {
    const angle = i * 0.81 + 0.24;
    const radius = 0.53 + (i % 3) * 0.07;
    const size = 0.048 + (i % 3) * 0.016;
    const boulder = new OctahedronGeometry(size, 0);
    boulder.scale(1.15, 0.72, 0.95);
    boulder.rotateY(angle * 1.7);
    boulder.translate(Math.cos(angle) * radius, 0.14 + (i % 2) * 0.02, Math.sin(angle) * radius);
    parts.push({ geometry: boulder, color: SLATE_BLOCKS[(i + 1) % SLATE_BLOCKS.length] });
  }
}

function buildRiftVortexSurface(parts: BufferGeometry[]): void {
  const rings = 7;
  const sectors = 32;
  const maxRadius = 0.455;
  const positions: number[] = [0, 0.118, 0];
  const indices: number[] = [];

  for (let ring = 1; ring <= rings; ring++) {
    const t = ring / rings;
    const radius = maxRadius * t;
    const archY = 0.086 + Math.pow(1 - t, 1.65) * 0.032 - Math.sin(t * Math.PI) * 0.008;
    for (let s = 0; s < sectors; s++) {
      const a = (s / sectors) * TAU;
      const ridge = Math.sin(a * 3 + t * 5.2) * 0.007 * (1 - t * 0.5);
      positions.push(Math.cos(a) * radius, archY + ridge, Math.sin(a) * radius);
    }
  }

  for (let s = 0; s < sectors; s++) {
    const next = (s + 1) % sectors;
    indices.push(0, 1 + next, 1 + s);
  }
  for (let ring = 1; ring < rings; ring++) {
    const rowA = 1 + (ring - 1) * sectors;
    const rowB = 1 + ring * sectors;
    for (let s = 0; s < sectors; s++) {
      const next = (s + 1) % sectors;
      indices.push(rowA + s, rowA + next, rowB + next);
      indices.push(rowA + s, rowB + next, rowB + s);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  parts.push(geometry);
}

function buildRiftFissureVeins(parts: BufferGeometry[]): void {
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * TAU + TAU / 24;
    const lengthSpan = 0.34;
    const vein = new BoxGeometry(0.038, 0.022, lengthSpan, 1, 1, 3);
    vein.translate(0, 0.102, 0.43 + lengthSpan * 0.5);
    vein.rotateY(angle);
    parts.push(vein);
  }
}

function buildRiftLevitatingDroplets(parts: BufferGeometry[]): void {
  const droplets = [
    { x: 0.02, y: 0.25, z: -0.02, rx: 0.038, ry: 0.068, rz: 0.038 },
    { x: -0.14, y: 0.21, z: 0.09, rx: 0.026, ry: 0.046, rz: 0.026 },
    { x: 0.15, y: 0.23, z: 0.11, rx: 0.024, ry: 0.042, rz: 0.024 },
    { x: 0.06, y: 0.34, z: -0.12, rx: 0.021, ry: 0.038, rz: 0.021 },
    { x: -0.09, y: 0.31, z: -0.14, rx: 0.019, ry: 0.034, rz: 0.019 },
  ];
  for (const drop of droplets) {
    const shard = new OctahedronGeometry(1, 0);
    shard.scale(drop.rx, drop.ry, drop.rz);
    shard.translate(drop.x, drop.y, drop.z);
    parts.push(shard);
  }
}

function buildCofferBaseAndWalls(parts: ColoredPart[]): void {
  const lowerFootprint = createOctagonPoints(0.98, 0.66, 0.11);
  const upperFootprint = createOctagonPoints(1.03, 0.7, 0.12);

  parts.push({
    geometry: createLoftedOctagon(lowerFootprint, 0.065, upperFootprint, 0.515),
    color: ENAMEL_MAIN,
  });

  const basePlinth = createOctagonPrism(0.96, 0.64, 0.1, 0.05, 0.085);
  parts.push({ geometry: basePlinth, color: ENAMEL_DEEP });

  for (const x of [-0.34, 0.34]) {
    for (const z of [-0.23, 0.23]) {
      const foot = new BoxGeometry(0.155, 0.072, 0.145);
      foot.translate(x, 0.036, z);
      parts.push({ geometry: foot, color: GOLD_MAIN });
    }
  }

  const seam = createOctagonPrism(1.045, 0.715, 0.125, 0.518, 0.538);
  parts.push({ geometry: seam, color: LID_SEAM_VIOLET });
}

function buildCofferDomedLid(parts: ColoredPart[]): void {
  const tier0 = createOctagonPoints(1.065, 0.73, 0.13);
  const tier1 = createOctagonPoints(1.025, 0.7, 0.13);
  const tier2 = createOctagonPoints(0.86, 0.55, 0.115);
  const tier3 = createOctagonPoints(0.68, 0.39, 0.09);

  parts.push({ geometry: createLoftedOctagon(tier0, 0.54, tier1, 0.625), color: ENAMEL_MAIN });
  parts.push({ geometry: createLoftedOctagon(tier1, 0.625, tier2, 0.815), color: ENAMEL_LID });
  parts.push({ geometry: createLoftedOctagon(tier2, 0.815, tier3, 0.875), color: ENAMEL_CROWN });
  parts.push({ geometry: createOctagonPrism(0.68, 0.39, 0.09, 0.862, 0.878), color: ENAMEL_CROWN });
}

function buildCofferTrimAndStraps(parts: ColoredPart[]): void {
  const bodyOutline = createOctagonPoints(1.045, 0.712, 0.12);
  for (const y of [0.095, 0.135, 0.49, 0.535]) {
    addOctagonFrame(parts, bodyOutline, y, 0.022, y === 0.535 ? GOLD_BRIGHT : GOLD_MAIN);
  }

  for (const [x, z] of bodyOutline) {
    const post = new CylinderGeometry(0.024, 0.026, 0.455, 6);
    post.translate(x, 0.315, z);
    parts.push({ geometry: post, color: GOLD_MAIN });
  }

  for (const x of [-0.34, 0.34]) {
    for (const z of [-0.352, 0.352]) {
      const pilaster = new BoxGeometry(0.088, 0.395, 0.038);
      pilaster.translate(x, 0.305, z);
      parts.push({ geometry: pilaster, color: GOLD_MAIN });

      const rivetTop = new OctahedronGeometry(0.024, 0);
      rivetTop.scale(0.85, 1.25, 0.6);
      rivetTop.translate(x, 0.455, z + Math.sign(z) * 0.022);
      parts.push({ geometry: rivetTop, color: GOLD_BRIGHT });

      const rivetBot = new OctahedronGeometry(0.024, 0);
      rivetBot.scale(0.85, 1.25, 0.6);
      rivetBot.translate(x, 0.155, z + Math.sign(z) * 0.022);
      parts.push({ geometry: rivetBot, color: GOLD_BRIGHT });
    }
  }

  const lidBase = createOctagonPoints(1.072, 0.738, 0.13);
  const lidCrown = createOctagonPoints(0.692, 0.402, 0.092);
  addOctagonFrame(parts, lidBase, 0.548, 0.018, GOLD_BRIGHT);
  addOctagonFrame(parts, lidCrown, 0.878, 0.016, GOLD_BRIGHT);

  for (const x of [-0.22, 0.22]) {
    const profile: Array<[number, number]> = [
      [0.372, 0.548],
      [0.354, 0.628],
      [0.282, 0.818],
      [0.202, 0.882],
      [-0.202, 0.882],
      [-0.282, 0.818],
      [-0.354, 0.628],
      [-0.372, 0.548],
    ];
    for (let i = 0; i < profile.length - 1; i++) {
      const [z0, y0] = profile[i];
      const [z1, y1] = profile[i + 1];
      const p0 = new Vector3(x, y0, z0);
      const p1 = new Vector3(x, y1, z1);
      parts.push({ geometry: createBeam(p0, p1, 0.068, 0.024), color: GOLD_MAIN });
      parts.push({
        geometry: createBeam(
          p0.clone().add(new Vector3(-0.032, 0.004, 0)),
          p1.clone().add(new Vector3(-0.032, 0.004, 0)),
          0.014,
          0.016,
        ),
        color: GOLD_BRIGHT,
      });
      parts.push({
        geometry: createBeam(
          p0.clone().add(new Vector3(0.032, 0.004, 0)),
          p1.clone().add(new Vector3(0.032, 0.004, 0)),
          0.014,
          0.016,
        ),
        color: GOLD_BRIGHT,
      });
    }
  }
}

function buildCofferClaspAndGem(parts: ColoredPart[]): void {
  const claspY = 0.395;

  const bronzeBack = createDiamondPrism(0.325, 0.485, 0.048);
  bronzeBack.translate(0, claspY, 0.365);
  parts.push({ geometry: bronzeBack, color: BRONZE_DEEP });

  const goldBezel = createDiamondPrism(0.285, 0.43, 0.056);
  goldBezel.translate(0, claspY, 0.388);
  parts.push({ geometry: goldBezel, color: GOLD_BRIGHT });

  const gemBase = createDiamondPrism(0.215, 0.325, 0.036);
  gemBase.translate(0, claspY, 0.418);
  parts.push({ geometry: gemBase, color: CYAN_BASE });

  const gemMid = createDiamondPrism(0.155, 0.24, 0.034);
  gemMid.translate(0, claspY + 0.008, 0.435);
  parts.push({ geometry: gemMid, color: CYAN_MID });

  const gemTable = createDiamondPrism(0.075, 0.135, 0.02);
  gemTable.translate(-0.014, claspY + 0.022, 0.452);
  parts.push({ geometry: gemTable, color: CYAN_HIGHLIGHT });
}

function buildCofferHandlesAndHinges(parts: ColoredPart[]): void {
  for (const side of [-1, 1]) {
    const plate = new BoxGeometry(0.042, 0.125, 0.11);
    plate.translate(side * 0.532, 0.385, 0);
    parts.push({ geometry: plate, color: GOLD_MAIN });

    const pin = new OctahedronGeometry(0.032, 0);
    pin.translate(side * 0.558, 0.395, 0);
    parts.push({ geometry: pin, color: GOLD_BRIGHT });

    const ring = new TorusGeometry(0.082, 0.017, 6, 14);
    ring.rotateY(Math.PI / 2);
    ring.translate(side * 0.562, 0.305, 0);
    parts.push({ geometry: ring, color: GOLD_MAIN });
  }

  for (const x of [-0.29, 0.29]) {
    const leaf = new BoxGeometry(0.13, 0.13, 0.034);
    leaf.translate(x, 0.52, -0.365);
    parts.push({ geometry: leaf, color: GOLD_MAIN });

    const barrel = new CylinderGeometry(0.024, 0.024, 0.13, 8);
    barrel.rotateZ(Math.PI / 2);
    barrel.translate(x, 0.545, -0.385);
    parts.push({ geometry: barrel, color: GOLD_BRIGHT });
  }
}

function hexRadiusAtAngle(angle: number): number {
  const sector = ((((angle + Math.PI / 6) % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)) - Math.PI / 6;
  return Math.sqrt(3) / 2 / Math.cos(sector);
}

function createBevelledWedgePrism(
  innerR: number,
  outerR: number,
  a0: number,
  a1: number,
  bottomY: number,
  topY: number,
  bevel: number,
): BufferGeometry {
  const insetA = bevel / Math.max(outerR, 0.25);
  const rings: Array<{ rIn: number; rOut: number; s0: number; s1: number; y: number }> = [
    { rIn: innerR, rOut: outerR, s0: a0, s1: a1, y: bottomY },
    { rIn: innerR, rOut: outerR, s0: a0, s1: a1, y: Math.max(bottomY + 0.005, topY - bevel) },
    { rIn: innerR + bevel, rOut: outerR - bevel, s0: a0 + insetA, s1: a1 - insetA, y: topY },
  ];

  const corners = (r: (typeof rings)[number]): Array<[number, number, number]> => [
    [Math.cos(r.s0) * r.rIn, r.y, Math.sin(r.s0) * r.rIn],
    [Math.cos(r.s0) * r.rOut, r.y, Math.sin(r.s0) * r.rOut],
    [Math.cos(r.s1) * r.rOut, r.y, Math.sin(r.s1) * r.rOut],
    [Math.cos(r.s1) * r.rIn, r.y, Math.sin(r.s1) * r.rIn],
  ];

  const positions: number[] = [];
  for (const ring of rings) {
    for (const [x, y, z] of corners(ring)) positions.push(x, y, z);
  }

  const indices: number[] = [0, 1, 2, 0, 2, 3, 8, 10, 9, 8, 11, 10];
  for (let layer = 0; layer < 2; layer++) {
    const base = layer * 4;
    const next = (layer + 1) * 4;
    for (let edge = 0; edge < 4; edge++) {
      const eNext = (edge + 1) % 4;
      indices.push(base + edge, next + eNext, base + eNext);
      indices.push(base + edge, next + edge, next + eNext);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createTaperedShard(baseR: number, height: number, sides: number): BufferGeometry {
  const tiers = [
    { scale: 1.0, y: 0 },
    { scale: 0.86, y: height * 0.38 },
    { scale: 0.48, y: height * 0.82 },
    { scale: 0.07, y: height },
  ];
  const positions: number[] = [];
  for (const tier of tiers) {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU;
      const jitter = 1 + (((i * 7 + sides) % 5) - 2) * 0.055;
      positions.push(
        Math.cos(a) * baseR * tier.scale * jitter,
        tier.y,
        Math.sin(a) * baseR * tier.scale * 0.86 * jitter,
      );
    }
  }
  const indices: number[] = [];
  for (let layer = 0; layer < tiers.length - 1; layer++) {
    const aBase = layer * sides;
    const bBase = (layer + 1) * sides;
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      indices.push(aBase + i, bBase + next, aBase + next);
      indices.push(aBase + i, bBase + i, bBase + next);
    }
  }
  const topBase = (tiers.length - 1) * sides;
  for (let i = 1; i < sides - 1; i++) {
    indices.push(topBase, topBase + i + 1, topBase + i);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createOctagonPoints(width: number, depth: number, chamfer: number): Array<[number, number]> {
  const hx = width * 0.5;
  const hz = depth * 0.5;
  return [
    [hx - chamfer, -hz],
    [hx, -hz + chamfer],
    [hx, hz - chamfer],
    [hx - chamfer, hz],
    [-hx + chamfer, hz],
    [-hx, hz - chamfer],
    [-hx, -hz + chamfer],
    [-hx + chamfer, -hz],
  ];
}

function createOctagonPrism(
  width: number,
  depth: number,
  chamfer: number,
  bottomY: number,
  topY: number,
): BufferGeometry {
  const pts = createOctagonPoints(width, depth, chamfer);
  const shape = new Shape();
  pts.forEach(([x, z], idx) => {
    if (idx === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  const extrude = new ExtrudeGeometry(shape, { depth: topY - bottomY, bevelEnabled: false });
  extrude.rotateX(-Math.PI / 2);
  extrude.translate(0, bottomY, 0);
  return extrude;
}

function createLoftedOctagon(
  lower: readonly [number, number][],
  lowerY: number,
  upper: readonly [number, number][],
  upperY: number,
): BufferGeometry {
  const n = lower.length;
  const positions: number[] = [];
  for (const [x, z] of lower) positions.push(x, lowerY, z);
  for (const [x, z] of upper) positions.push(x, upperY, z);

  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    indices.push(i, n + next, next);
    indices.push(i, n + i, n + next);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addOctagonFrame(
  parts: ColoredPart[],
  outline: readonly [number, number][],
  y: number,
  thickness: number,
  hexColor: string,
): void {
  for (let i = 0; i < outline.length; i++) {
    const [x0, z0] = outline[i];
    const [x1, z1] = outline[(i + 1) % outline.length];
    parts.push({
      geometry: createBeam(new Vector3(x0, y, z0), new Vector3(x1, y, z1), thickness, thickness),
      color: hexColor,
    });
  }
}

function createDiamondPrism(width: number, height: number, depth: number): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(0, height * 0.5);
  shape.lineTo(width * 0.5, 0);
  shape.lineTo(0, -height * 0.5);
  shape.lineTo(-width * 0.5, 0);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth: depth * 0.6,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: width * 0.08,
    bevelThickness: depth * 0.25,
  });
  geometry.translate(0, 0, -depth * 0.3);
  return geometry;
}

function createBeam(start: Vector3, end: Vector3, width: number, thickness: number): BufferGeometry {
  const delta = new Vector3().subVectors(end, start);
  const lengthSpan = delta.length();
  const geometry = new BoxGeometry(width, thickness, lengthSpan);
  const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
  const quat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), delta.clone().normalize());
  const matrix = new Matrix4().compose(mid, quat, new Vector3(1, 1, 1));
  geometry.applyMatrix4(matrix);
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
  if (!merged) throw new Error("Failed to merge procedural reward tile geometry");
  const welded = mergeVertices(merged, 1e-4);
  merged.dispose();
  welded.computeBoundingBox();
  welded.computeBoundingSphere();
  return welded;
}

function mergeNormalizedGeometries(geometries: readonly BufferGeometry[]): BufferGeometry {
  const normalized: BufferGeometry[] = [];
  for (const geometry of geometries) {
    const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    if (!nonIndexed.getAttribute("normal")) nonIndexed.computeVertexNormals();
    for (const key of Object.keys(nonIndexed.attributes)) {
      if (key !== "position" && key !== "normal") nonIndexed.deleteAttribute(key);
    }
    normalized.push(nonIndexed);
  }
  const merged = mergeGeometries(normalized, false);
  for (const geometry of normalized) geometry.dispose();
  if (!merged) throw new Error("Failed to merge procedural reward vortex geometry");
  const welded = mergeVertices(merged, 1e-4);
  merged.dispose();
  welded.computeBoundingBox();
  welded.computeBoundingSphere();
  return welded;
}

function wrapKitGltf(scene: Group): GLTF {
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
