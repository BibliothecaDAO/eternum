import { ASPECT_HEX } from "@/tokens";
import { aspectName, type AspectId } from "@bibliothecadao/types";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Path,
  Quaternion,
  Shape,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { positionGeometry, smoothstep } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { DEEP_PALETTE } from "../terrain/deep-floor-material";
import { createProcgenMasonryMaterial } from "./procgen-masonry-material";

export const DEEP_GATE_HEIGHT = 1.34;
export const DEEP_ARCHIVE_HEIGHT = 1.18;
export const DEEP_CORE_HEIGHT = 1.08;
export const DEEP_MINE_HEIGHT = 1.22;
export const DEEP_ALTAR_HEIGHT = 1.04;

interface KitPart {
  readonly geometry: BufferGeometry;
  readonly color: string;
}

const OBSIDIAN_MAIN = "#323a46";
const OBSIDIAN_SHADE = "#242b36";
const OBSIDIAN_CROWN = "#424c5c";
const BRONZE_MAIN = "#c89644";
const BRONZE_LIGHT = "#d8a852";
const BRONZE_SHADE = "#9b7030";

const BASALT_MAIN = "#353940";
const BASALT_SHADE = "#22262c";
const BASALT_EDGE = "#464c55";
const GOLD_MAIN = "#d4a644";
const GOLD_LIGHT = "#e8bc58";
const GOLD_SHADE = "#a87d2e";

const SLATE_MAIN = "#3e4659";
const SLATE_EDGE = "#4f5970";
const SLATE_INNER = "#2a454d";
const SILVER_STEEL = "#c2c6cc";
const SILVER_SHADE = "#9fa5b0";
const ESSENCE_TEAL = "#4ef7d8";
const ESSENCE_EMISSIVE = "#22e0bc";

const QUARRY_MAIN = "#303642";
const QUARRY_EDGE = "#424a59";
const QUARRY_SHADE = "#1e232c";
const GANTRY_MAIN = "#7c563a";
const GANTRY_EDGE = "#9c7048";
const IRON_DARK = "#2c3038";
const AMBER_CRYSTAL = "#ff9e2c";
const AMBER_EMISSIVE = "#e86a0c";
const CYAN_CRYSTAL = "#4af0ff";
const CYAN_EMISSIVE = "#14c8e6";

const ALTAR_MAIN = "#3c3040";
const ALTAR_EDGE = "#4f4054";
const ALTAR_SHADE = "#271e2b";
const ALTAR_IRON = "#52463a";
const ALTAR_IRON_EDGE = "#6a5b4a";
const BANE_CRIMSON = "#ff2e5c";
const BANE_CRIMSON_EMISSIVE = "#e6154a";
const BANE_VIOLET = "#5e36ba";
const BANE_VIOLET_EMISSIVE = "#3f1c96";

const PYLON_X = 0.42;
const PYLON_BASE_W = 0.28;
const PYLON_BASE_D = 0.27;
const PYLON_TOP_W = 0.245;
const PYLON_TOP_D = 0.24;
const PYLON_HEIGHT = 1.06;

const LINTEL_BOTTOM_Y = 0.98;
const LINTEL_HEIGHT = 0.2;
const CORNICE_LOWER_Y = 1.18;
const CORNICE_LOWER_H = 0.07;
const CORNICE_UPPER_Y = 1.25;
const CORNICE_UPPER_H = DEEP_GATE_HEIGHT - CORNICE_UPPER_Y;

const MEDALLION_Y = 1.045;
const MEDALLION_Z = 0.15;

export function createDeepGateKit(aspect: AspectId): Pick<GLTF, "scene" | "animations"> {
  const slug = aspectName(aspect).toLowerCase();
  const aspectHex = ASPECT_HEX[aspect];
  const masonryParts: KitPart[] = [];
  const accentParts: KitPart[] = [];

  addGatePylons(masonryParts);
  addGateButtressesAndCollars(masonryParts);
  addGateArchitraveAndCrown(masonryParts);
  addGateMedallions(masonryParts, accentParts, aspectHex);
  addGateJambRunes(accentParts, aspectHex);

  const root = new Group();
  root.name = `deep-gate-kit-${slug}`;

  const masonryMesh = buildMasonryMesh(masonryParts, `deep-gate-masonry-${slug}`);
  const accentMesh = buildAccentMesh(accentParts, aspectHex, `deep-gate-aspect-${slug}`);

  root.add(masonryMesh, accentMesh);
  return { scene: root, animations: [] };
}

export function createDeepArchiveKit(): Pick<GLTF, "scene" | "animations"> {
  const masonryParts: KitPart[] = [];
  const socketParts: KitPart[] = [];

  addArchiveArcadeBase(masonryParts);
  addArchiveGoldCollar(masonryParts);
  addArchiveTabletDrum(masonryParts);
  addArchiveOculusCrown(masonryParts, socketParts);

  const root = new Group();
  root.name = "deep-site-kit-foundation";

  const masonryMesh = buildMasonryMesh(masonryParts, "deep-archive-masonry");
  const socketMesh = buildSocketGemMesh(socketParts, "deep_gem_archive");

  root.add(masonryMesh, socketMesh);
  return { scene: root, animations: [] };
}

export function createDeepCoreKit(): Pick<GLTF, "scene" | "animations"> {
  const masonryParts: KitPart[] = [];
  const socketParts: KitPart[] = [];

  addCoreBaseCollar(masonryParts);
  addCoreContainmentRibs(masonryParts, socketParts);
  addCoreEquatorialRing(masonryParts, socketParts);

  const root = new Group();
  root.name = "deep-site-kit-core";

  const masonryMesh = buildMasonryMesh(masonryParts, "deep-core-masonry");
  const orbMesh = buildEssenceOrbMesh("deep-core-orb");
  const socketMesh = buildSocketGemMesh(socketParts, "deep_gem_core");

  root.add(masonryMesh, orbMesh, socketMesh);
  return { scene: root, animations: [] };
}

export function createDeepMineKit(): Pick<GLTF, "scene" | "animations"> {
  const masonryParts: KitPart[] = [];
  const amberParts: KitPart[] = [];
  const cyanParts: KitPart[] = [];
  const socketParts: KitPart[] = [];

  addMineQuarryPit(masonryParts, socketParts);
  addMineHoistGantry(masonryParts, socketParts);
  addMinePulleyAndBasket(masonryParts, amberParts, cyanParts);
  addMineCrystalVeins(amberParts, cyanParts);

  const root = new Group();
  root.name = "deep-site-kit-mine";

  const masonryMesh = buildMasonryMesh(masonryParts, "deep-mine-masonry");
  const amberMesh = buildCrystalMesh(amberParts, AMBER_CRYSTAL, AMBER_EMISSIVE, "deep-mine-amber");
  const cyanMesh = buildCrystalMesh(cyanParts, CYAN_CRYSTAL, CYAN_EMISSIVE, "deep-mine-cyan");
  const socketMesh = buildSocketGemMesh(socketParts, "deep_gem_mine");

  root.add(masonryMesh, amberMesh, cyanMesh, socketMesh);
  return { scene: root, animations: [] };
}

function addMineQuarryPit(masonryParts: KitPart[], socketParts: KitPart[]): void {
  addHollowRing(masonryParts, 0, 0.17, 0.612, 0.452, 8, QUARRY_MAIN, Math.PI / 8);
  addHollowRing(masonryParts, 0.17, 0.335, 0.598, 0.448, 8, QUARRY_MAIN, Math.PI / 8);
  addHollowRing(masonryParts, 0.33, 0.365, 0.608, 0.442, 8, QUARRY_EDGE, Math.PI / 8);

  addHollowRing(masonryParts, 0.16, 0.255, 0.456, 0.345, 8, QUARRY_MAIN, Math.PI / 8);
  addHollowRing(masonryParts, 0, 0.162, 0.355, 0.24, 8, QUARRY_SHADE, Math.PI / 8);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    addRotatedBox(
      socketParts,
      Math.cos(angle) * 0.535,
      0.372,
      Math.sin(angle) * 0.535,
      0.044,
      0.022,
      0.044,
      -angle,
      DEEP_PALETTE.gold,
    );
  }
}

function addMineHoistGantry(masonryParts: KitPart[], socketParts: KitPart[]): void {
  const frameX = 0.43;
  const footZ = 0.255;
  const footY = 0.33;
  const apexY = 1.06;

  for (const side of [-1, 1] as const) {
    const x = side * frameX;
    addStrut(masonryParts, [x, footY, footZ], [x, apexY, 0.032], 0.064, 0.068, GANTRY_MAIN);
    addStrut(masonryParts, [x, footY, -footZ], [x, apexY, -0.032], 0.064, 0.068, GANTRY_MAIN);
    addStrut(masonryParts, [x, 0.7, 0.142], [x, 0.7, -0.142], 0.046, 0.052, GANTRY_MAIN);
    addStrut(masonryParts, [x, 0.7, 0.08], [x, 0.92, -0.045], 0.036, 0.04, GANTRY_EDGE);
    addStrut(masonryParts, [x, 0.7, -0.08], [x, 0.92, 0.045], 0.036, 0.04, GANTRY_EDGE);

    addBox(masonryParts, x, footY + 0.025, footZ, 0.088, 0.052, 0.092, BRONZE_MAIN);
    addBox(masonryParts, x, footY + 0.025, -footZ, 0.088, 0.052, 0.092, BRONZE_MAIN);
    addBox(masonryParts, x, apexY - 0.015, 0, 0.096, 0.115, 0.128, GANTRY_EDGE);
    addBox(masonryParts, x + side * 0.052, apexY - 0.015, 0, 0.018, 0.085, 0.092, BRONZE_MAIN);
    addBox(socketParts, x + side * 0.065, apexY - 0.015, 0, 0.018, 0.044, 0.044, DEEP_PALETTE.gold);
  }

  addBox(masonryParts, 0, 1.105, 0, 1.07, 0.105, 0.118, GANTRY_MAIN);
  addBox(masonryParts, 0, 1.162, 0, 1.09, 0.022, 0.132, GANTRY_EDGE);
  for (const side of [-1, 1] as const) {
    addBox(masonryParts, side * 0.51, 1.105, 0, 0.052, 0.12, 0.134, BRONZE_MAIN);
    addBox(socketParts, side * 0.548, 1.105, 0, 0.022, 0.054, 0.054, DEEP_PALETTE.gold);
  }
}

function addMinePulleyAndBasket(masonryParts: KitPart[], amberParts: KitPart[], cyanParts: KitPart[]): void {
  const upperWheel = new CylinderGeometry(0.082, 0.082, 0.05, 14);
  upperWheel.rotateX(Math.PI / 2);
  upperWheel.translate(0, 1.132, 0);
  masonryParts.push({ geometry: upperWheel, color: IRON_DARK });

  for (const face of [-1, 1] as const) {
    const flange = new CylinderGeometry(0.088, 0.088, 0.014, 14);
    flange.rotateX(Math.PI / 2);
    flange.translate(0, 1.132, face * 0.032);
    masonryParts.push({ geometry: flange, color: BRONZE_MAIN });
  }

  const lowerWheel = new CylinderGeometry(0.052, 0.052, 0.036, 12);
  lowerWheel.rotateX(Math.PI / 2);
  lowerWheel.translate(0, 0.935, 0);
  masonryParts.push({ geometry: lowerWheel, color: IRON_DARK });
  addBox(masonryParts, 0, 0.935, 0, 0.068, 0.11, 0.052, BRONZE_MAIN);

  addBox(masonryParts, 0, 0.85, 0, 0.022, 0.17, 0.022, IRON_DARK);

  const basketY = 0.65;
  addHollowRing(masonryParts, basketY - 0.01, basketY + 0.02, 0.095, 0.04, 6, IRON_DARK);
  addHollowRing(masonryParts, basketY + 0.105, basketY + 0.13, 0.122, 0.096, 6, BRONZE_MAIN);
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const bx = Math.cos(angle) * 0.085;
    const bz = Math.sin(angle) * 0.085;
    const tx = Math.cos(angle) * 0.112;
    const tz = Math.sin(angle) * 0.112;
    addStrut(masonryParts, [bx, basketY, bz], [tx, basketY + 0.125, tz], 0.018, 0.018, BRONZE_MAIN);
    if (i % 2 === 0) {
      addStrut(masonryParts, [tx, basketY + 0.125, tz], [0, 0.82, 0], 0.014, 0.014, IRON_DARK);
    }
  }

  addCrystalCluster(amberParts, -0.025, basketY + 0.04, 0.01, 0.55, 0.4, AMBER_CRYSTAL);
  addCrystalCluster(cyanParts, 0.045, basketY + 0.05, 0.035, 0.52, -0.5, CYAN_CRYSTAL);
}

export function createDeepAltarKit(): Pick<GLTF, "scene" | "animations"> {
  const masonryParts: KitPart[] = [];
  const crimsonParts: KitPart[] = [];
  const violetParts: KitPart[] = [];
  const socketParts: KitPart[] = [];

  addAltarDais(masonryParts, crimsonParts, socketParts);
  addAltarHorns(masonryParts, crimsonParts, socketParts);
  addAltarBaneOrb(crimsonParts, violetParts);

  const scene = new Group();
  scene.name = "deep-altar-kit";
  scene.add(
    buildMasonryMesh(masonryParts, "deep_altar_masonry"),
    buildCrystalMesh(crimsonParts, BANE_CRIMSON, BANE_CRIMSON_EMISSIVE, "deep_altar_crimson"),
    buildCrystalMesh(violetParts, BANE_VIOLET, BANE_VIOLET_EMISSIVE, "deep_altar_violet"),
    buildSocketGemMesh(socketParts, "deep_gem_altar"),
  );
  return { scene, animations: [] };
}

function addAltarDais(masonryParts: KitPart[], crimsonParts: KitPart[], socketParts: KitPart[]): void {
  addHollowRing(masonryParts, 0, 0.105, 0.57, 0.33, 12, ALTAR_MAIN, Math.PI / 12);
  addHollowRing(masonryParts, 0.095, 0.115, 0.556, 0.342, 12, ALTAR_EDGE, Math.PI / 12);

  addHollowRing(crimsonParts, 0.105, 0.152, 0.534, 0.425, 12, BANE_CRIMSON, Math.PI / 12);

  addHollowRing(masonryParts, 0.148, 0.238, 0.522, 0.32, 12, ALTAR_MAIN, Math.PI / 12);
  addHollowRing(masonryParts, 0.232, 0.252, 0.506, 0.335, 12, ALTAR_EDGE, Math.PI / 12);

  addHollowRing(masonryParts, 0.075, 0.165, 0.332, 0.232, 8, ALTAR_SHADE, Math.PI / 8);
  addHollowRing(masonryParts, 0.115, 0.228, 0.246, 0.13, 8, ALTAR_EDGE, Math.PI / 8);
  addHollowRing(masonryParts, 0.115, 0.168, 0.136, 0.096, 8, ALTAR_SHADE, Math.PI / 8);

  const count = 6;
  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count + Math.PI / 6;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const yaw = -angle;

    addRotatedBox(masonryParts, cos * 0.518, 0.13, sin * 0.518, 0.132, 0.26, 0.116, yaw, ALTAR_IRON);
    addRotatedBox(masonryParts, cos * 0.54, 0.132, sin * 0.54, 0.096, 0.225, 0.094, yaw, ALTAR_IRON_EDGE);
    addRotatedBox(socketParts, cos * 0.588, 0.138, sin * 0.588, 0.022, 0.068, 0.038, yaw, DEEP_PALETTE.gold);
  }
}

function addAltarHorns(masonryParts: KitPart[], crimsonParts: KitPart[], socketParts: KitPart[]): void {
  const count = 6;
  const tilt = 0.26;
  const baseRadius = 0.382;
  const baseY = 0.175;
  const hornLength = 0.875;

  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count + Math.PI / 6;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const yaw = -angle;

    addAltarHorn(masonryParts, cos * baseRadius, baseY, sin * baseRadius, yaw, tilt, 0.148, 0.156, hornLength);

    const collar = new BoxGeometry(0.168, 0.068, 0.176);
    collar.translate(0, 0.195, 0);
    collar.rotateZ(-tilt);
    collar.rotateY(yaw);
    collar.translate(cos * baseRadius, baseY, sin * baseRadius);
    masonryParts.push({ geometry: collar, color: ALTAR_IRON });

    const collarRim = new BoxGeometry(0.174, 0.018, 0.182);
    collarRim.translate(0, 0.23, 0);
    collarRim.rotateZ(-tilt);
    collarRim.rotateY(yaw);
    collarRim.translate(cos * baseRadius, baseY, sin * baseRadius);
    masonryParts.push({ geometry: collarRim, color: ALTAR_IRON_EDGE });

    const innerRune = new CylinderGeometry(0.008, 0.028, 0.38, 4);
    innerRune.translate(-0.044, 0.48, 0);
    innerRune.rotateZ(-tilt);
    innerRune.rotateY(yaw);
    innerRune.translate(cos * baseRadius, baseY, sin * baseRadius);
    crimsonParts.push({ geometry: innerRune, color: BANE_CRIMSON });

    const outerRune = new CylinderGeometry(0.006, 0.02, 0.28, 4);
    outerRune.translate(0.046, 0.44, 0);
    outerRune.rotateZ(-tilt);
    outerRune.rotateY(yaw);
    outerRune.translate(cos * baseRadius, baseY, sin * baseRadius);
    crimsonParts.push({ geometry: outerRune, color: BANE_CRIMSON });

    const collarGem = new CylinderGeometry(0.004, 0.026, 0.042, 4);
    collarGem.rotateZ(Math.PI / 2);
    collarGem.translate(-0.088, 0.195, 0);
    collarGem.rotateZ(-tilt);
    collarGem.rotateY(yaw);
    collarGem.translate(cos * baseRadius, baseY, sin * baseRadius);
    socketParts.push({ geometry: collarGem, color: DEEP_PALETTE.gold });
  }
}

function addAltarHorn(
  parts: KitPart[],
  x: number,
  y: number,
  z: number,
  yaw: number,
  tilt: number,
  baseW: number,
  baseD: number,
  length: number,
): void {
  const shaftH = length * 0.72;
  const tipH = length - shaftH;
  const topW = baseW * 0.44;
  const topD = baseD * 0.46;

  const shaft = createChamferedRectShape(baseW, baseD, 0.024);
  const shaftGeo = new ExtrudeGeometry(shaft, { depth: shaftH, bevelEnabled: false });
  shaftGeo.rotateX(-Math.PI / 2);
  const pos = shaftGeo.getAttribute("position");
  for (let index = 0; index < pos.count; index++) {
    const py = pos.getY(index);
    const t = Math.max(0, Math.min(1, py / shaftH));
    const sx = 1 + (topW / baseW - 1) * t;
    const sz = 1 + (topD / baseD - 1) * t;
    pos.setXYZ(index, pos.getX(index) * sx, py, pos.getZ(index) * sz);
  }
  shaftGeo.rotateZ(-tilt);
  shaftGeo.rotateY(yaw);
  shaftGeo.translate(x, y, z);
  shaftGeo.computeVertexNormals();
  parts.push({ geometry: shaftGeo, color: ALTAR_MAIN });

  const tip = new CylinderGeometry(0.006, Math.hypot(topW, topD) * 0.5, tipH, 4);
  tip.rotateY(Math.PI / 4);
  tip.translate(0, shaftH + tipH / 2, 0);
  tip.rotateZ(-tilt);
  tip.rotateY(yaw);
  tip.translate(x, y, z);
  parts.push({ geometry: tip, color: ALTAR_EDGE });
}

function addAltarBaneOrb(crimsonParts: KitPart[], violetParts: KitPart[]): void {
  const orbY = 0.31;

  const violetSphere = new IcosahedronGeometry(0.146, 0);
  const violetGeo = violetSphere.index ? violetSphere.toNonIndexed() : violetSphere;
  violetGeo.translate(0, orbY, 0);
  violetGeo.computeVertexNormals();
  if (violetGeo !== violetSphere) violetSphere.dispose();
  violetParts.push({ geometry: violetGeo, color: BANE_VIOLET });

  const crimsonSphere = new IcosahedronGeometry(0.143, 0);
  const crimsonGeo = crimsonSphere.index ? crimsonSphere.toNonIndexed() : crimsonSphere;
  crimsonGeo.rotateX(0.52);
  crimsonGeo.rotateY(0.78);
  crimsonGeo.rotateZ(0.35);
  crimsonGeo.translate(0, orbY, 0);
  crimsonGeo.computeVertexNormals();
  if (crimsonGeo !== crimsonSphere) crimsonSphere.dispose();
  crimsonParts.push({ geometry: crimsonGeo, color: BANE_CRIMSON });
}

function addMineCrystalVeins(amberParts: KitPart[], cyanParts: KitPart[]): void {
  addCrystalCluster(amberParts, -0.14, 0.25, -0.22, 1.15, 0.2, AMBER_CRYSTAL);
  addCrystalCluster(cyanParts, 0.06, 0.24, -0.25, 0.95, -0.35, CYAN_CRYSTAL);
  addCrystalCluster(cyanParts, -0.31, 0.25, 0.04, 0.88, 0.9, CYAN_CRYSTAL);
  addCrystalCluster(amberParts, -0.27, 0.24, 0.15, 0.78, 1.25, AMBER_CRYSTAL);
  addCrystalCluster(amberParts, 0.26, 0.25, 0.11, 0.82, -0.95, AMBER_CRYSTAL);
  addCrystalCluster(cyanParts, 0.31, 0.25, -0.04, 0.85, -1.2, CYAN_CRYSTAL);
  addCrystalCluster(amberParts, 0.12, 0.15, 0.19, 0.72, 2.4, AMBER_CRYSTAL);
  addCrystalCluster(cyanParts, -0.11, 0.15, 0.2, 0.68, 2.9, CYAN_CRYSTAL);
}

function addCrystalCluster(
  parts: KitPart[],
  x: number,
  y: number,
  z: number,
  scale: number,
  yaw: number,
  color: string,
): void {
  const spires: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
    [0, 0, 0.046 * scale, 0.21 * scale, 0.08, 0.05],
    [0.042 * scale, 0.025 * scale, 0.034 * scale, 0.155 * scale, 0.24, -0.22],
    [-0.038 * scale, 0.02 * scale, 0.032 * scale, 0.145 * scale, -0.22, 0.18],
    [0.01 * scale, -0.04 * scale, 0.028 * scale, 0.12 * scale, -0.18, -0.26],
  ];
  const rotY = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
  const offset = new Vector3();

  for (const [ox, oz, radius, height, tiltX, tiltZ] of spires) {
    const geometry = new CylinderGeometry(radius * 0.22, radius, height, 6);
    geometry.translate(0, height / 2, 0);
    geometry.rotateX(tiltX);
    geometry.rotateZ(tiltZ);
    geometry.rotateY(yaw);
    offset.set(ox, 0, oz).applyQuaternion(rotY);
    geometry.translate(x + offset.x, y, z + offset.z);
    parts.push({ geometry, color });
  }
}

function addStrut(
  parts: KitPart[],
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  width: number,
  depth: number,
  color: string,
): void {
  const start = new Vector3(from[0], from[1], from[2]);
  const end = new Vector3(to[0], to[1], to[2]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  const geometry = new BoxGeometry(width, length, depth);
  const quat = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize());
  geometry.applyQuaternion(quat);
  const mid = start.add(end).multiplyScalar(0.5);
  geometry.translate(mid.x, mid.y, mid.z);
  parts.push({ geometry, color });
}

function buildCrystalMesh(parts: readonly KitPart[], colorHex: string, emissiveHex: string, name: string): Mesh {
  const geometry = combineParts(parts, false);
  const material = new MeshStandardMaterial({
    name,
    color: new Color(colorHex),
    emissive: new Color(emissiveHex),
    emissiveIntensity: 1.2,
    roughness: 0.18,
    metalness: 0.1,
    flatShading: true,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function addCoreBaseCollar(parts: KitPart[]): void {
  addHollowRing(parts, 0, 0.132, 0.485, 0.345, 6, SLATE_MAIN, Math.PI / 6);
  addHollowRing(parts, 0.128, 0.15, 0.468, 0.358, 6, SLATE_EDGE, Math.PI / 6);
}

function addCoreContainmentRibs(masonryParts: KitPart[], socketParts: KitPart[]): void {
  const ribCount = 6;
  for (let i = 0; i < ribCount; i++) {
    const angle = (i * Math.PI * 2) / ribCount + Math.PI / 6;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const yaw = -angle;

    addRotatedBox(masonryParts, cos * 0.405, 0.145, sin * 0.405, 0.125, 0.056, 0.128, yaw, SILVER_STEEL);
    addRotatedBox(socketParts, cos * 0.47, 0.145, sin * 0.47, 0.022, 0.032, 0.054, yaw, DEEP_PALETTE.gold);

    const outerRib = createCurvedRibGeometry(0.095, false);
    outerRib.rotateY(yaw);
    masonryParts.push({ geometry: outerRib, color: SLATE_MAIN });

    const innerLinings = createCurvedRibGeometry(0.068, true);
    innerLinings.rotateY(yaw);
    masonryParts.push({ geometry: innerLinings, color: SLATE_INNER });
  }
}

function createCurvedRibGeometry(width: number, innerFaceOnly: boolean): BufferGeometry {
  const steps = 10;
  const outerProfile: Array<[number, number]> = [];
  const innerProfile: Array<[number, number]> = [];
  const yStart = 0.13;
  const yEnd = DEEP_CORE_HEIGHT;

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const y = yStart + (yEnd - yStart) * t;
    const bow = Math.sin(t * Math.PI);
    const baseR = 0.405 + (0.315 - 0.405) * t;
    const midR = baseR + bow * 0.155;
    const radialThickness = innerFaceOnly ? 0.016 : 0.088 * (1 - 0.18 * t);
    const innerR = midR - 0.044 * (1 - 0.18 * t) - (innerFaceOnly ? 0.003 : 0);
    const outerR = innerR + radialThickness;
    outerProfile.push([outerR, y]);
    innerProfile.push([innerR, y]);
  }

  const shape = new Shape();
  shape.moveTo(outerProfile[0]![0], outerProfile[0]![1]);
  for (let i = 1; i < outerProfile.length; i++) {
    shape.lineTo(outerProfile[i]![0], outerProfile[i]![1]);
  }
  for (let i = innerProfile.length - 1; i >= 0; i--) {
    shape.lineTo(innerProfile[i]![0], innerProfile[i]![1]);
  }
  shape.closePath();

  const geometry = new ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: !innerFaceOnly,
    bevelThickness: 0.008,
    bevelSize: 0.007,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -width / 2);
  return geometry;
}

function addCoreEquatorialRing(masonryParts: KitPart[], socketParts: KitPart[]): void {
  addHollowRing(masonryParts, 0.515, 0.532, 0.536, 0.478, 24, SILVER_SHADE);
  addHollowRing(masonryParts, 0.53, 0.588, 0.548, 0.472, 24, SILVER_STEEL);
  addHollowRing(masonryParts, 0.585, 0.602, 0.536, 0.478, 24, SILVER_STEEL);

  const clampCount = 6;
  for (let i = 0; i < clampCount; i++) {
    const angle = (i * Math.PI * 2) / clampCount + Math.PI / 6;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const yaw = -angle;
    addRotatedBox(masonryParts, cos * 0.53, 0.56, sin * 0.53, 0.075, 0.092, 0.132, yaw, SILVER_STEEL);
    addRotatedBox(socketParts, cos * 0.57, 0.56, sin * 0.57, 0.022, 0.056, 0.056, yaw, DEEP_PALETTE.gold);
  }
}

function buildEssenceOrbMesh(name: string): Mesh {
  const sphere = new IcosahedronGeometry(0.235, 1);
  const nonIndexed = sphere.index ? sphere.toNonIndexed() : sphere;
  nonIndexed.translate(0, 0.56, 0);
  nonIndexed.computeVertexNormals();
  if (nonIndexed !== sphere) sphere.dispose();

  const material = new MeshStandardMaterial({
    name,
    color: new Color(ESSENCE_TEAL),
    emissive: new Color(ESSENCE_EMISSIVE),
    emissiveIntensity: 1.15,
    roughness: 0.18,
    metalness: 0.12,
    flatShading: true,
  });
  const mesh = new Mesh(nonIndexed, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function addArchiveArcadeBase(parts: KitPart[]): void {
  const pierCount = 8;
  for (let i = 0; i < pierCount; i++) {
    const angle = (i * Math.PI * 2) / pierCount + Math.PI / 8;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const yaw = -angle;

    addRotatedBox(parts, cos * 0.525, 0.03, sin * 0.525, 0.2, 0.06, 0.16, yaw, BASALT_EDGE);
    addRotatedBox(parts, cos * 0.51, 0.145, sin * 0.51, 0.175, 0.17, 0.142, yaw, BASALT_MAIN);
    addRotatedBox(parts, cos * 0.498, 0.245, sin * 0.498, 0.185, 0.036, 0.15, yaw, BASALT_EDGE);
    addRotatedBox(parts, cos * 0.486, 0.35, sin * 0.486, 0.16, 0.18, 0.134, yaw, BASALT_MAIN);

    const midAngle = angle + Math.PI / 8;
    const mCos = Math.cos(midAngle);
    const mSin = Math.sin(midAngle);
    addVaultArchBridge(parts, mCos * 0.445, 0.22, mSin * 0.445, -midAngle + Math.PI / 2);
  }

  addHollowRing(parts, 0.31, 0.455, 0.425, 0.34, 16, BASALT_SHADE);
}

function addVaultArchBridge(parts: KitPart[], x: number, y: number, z: number, yaw: number): void {
  const halfSpan = 0.16;
  const height = 0.22;
  const archR = 0.105;
  const springY = 0.025;
  const shape = new Shape();
  shape.moveTo(-halfSpan, 0);
  shape.lineTo(-archR, 0);
  shape.lineTo(-archR, springY);
  const steps = 8;
  for (let s = 0; s <= steps; s++) {
    const a = Math.PI - (s / steps) * Math.PI;
    shape.lineTo(Math.cos(a) * archR, springY + Math.sin(a) * archR);
  }
  shape.lineTo(archR, 0);
  shape.lineTo(halfSpan, 0);
  shape.lineTo(halfSpan, height);
  shape.lineTo(-halfSpan, height);
  shape.closePath();

  const geometry = new ExtrudeGeometry(shape, { depth: 0.125, bevelEnabled: false });
  geometry.translate(0, 0, -0.0625);
  geometry.rotateY(yaw);
  geometry.translate(x, y, z);
  parts.push({ geometry, color: BASALT_MAIN });
}

function addArchiveGoldCollar(parts: KitPart[]): void {
  addHollowRing(parts, 0.415, 0.455, 0.548, 0.44, 24, GOLD_SHADE);
  addHollowRing(parts, 0.45, 0.54, 0.568, 0.445, 24, GOLD_MAIN);
  addHollowRing(parts, 0.535, 0.556, 0.556, 0.458, 24, GOLD_LIGHT);

  const cleatCount = 8;
  for (let i = 0; i < cleatCount; i++) {
    const angle = (i * Math.PI * 2) / cleatCount + Math.PI / 8;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const yaw = -angle;
    addRotatedBox(parts, cos * 0.528, 0.495, sin * 0.528, 0.125, 0.115, 0.105, yaw, GOLD_LIGHT);
    addRotatedBox(parts, cos * 0.585, 0.525, sin * 0.585, 0.018, 0.02, 0.022, yaw, GOLD_SHADE);
    addRotatedBox(parts, cos * 0.585, 0.465, sin * 0.585, 0.018, 0.02, 0.022, yaw, GOLD_SHADE);
  }
}

function addArchiveTabletDrum(parts: KitPart[]): void {
  const drum = new CylinderGeometry(0.425, 0.44, 0.3, 8);
  drum.rotateY(Math.PI / 8);
  drum.translate(0, 0.67, 0);
  parts.push({ geometry: drum, color: BASALT_MAIN });

  const parapet = new CylinderGeometry(0.405, 0.432, 0.06, 8);
  parapet.rotateY(Math.PI / 8);
  parapet.translate(0, 0.84, 0);
  parts.push({ geometry: parapet, color: BASALT_EDGE });

  const sides = 8;
  for (let i = 0; i < sides; i++) {
    const cornerAngle = (i * Math.PI * 2) / sides + Math.PI / 8;
    addRotatedBox(
      parts,
      Math.cos(cornerAngle) * 0.418,
      0.685,
      Math.sin(cornerAngle) * 0.418,
      0.075,
      0.32,
      0.075,
      -cornerAngle,
      BASALT_EDGE,
    );

    const faceAngle = cornerAngle + Math.PI / 8;
    const fCos = Math.cos(faceAngle);
    const fSin = Math.sin(faceAngle);
    const fYaw = -faceAngle;
    addRotatedBox(parts, fCos * 0.398, 0.665, fSin * 0.398, 0.042, 0.19, 0.155, fYaw, BASALT_EDGE);
    addRotatedBox(parts, fCos * 0.408, 0.66, fSin * 0.408, 0.032, 0.15, 0.115, fYaw, BASALT_SHADE);
    addRotatedBox(parts, fCos * 0.402, 0.765, fSin * 0.402, 0.048, 0.032, 0.165, fYaw, BASALT_EDGE);
  }
}

function addArchiveOculusCrown(masonryParts: KitPart[], socketParts: KitPart[]): void {
  const core = new CylinderGeometry(0.23, 0.24, 0.16, 8);
  core.rotateY(Math.PI / 8);
  core.translate(0, 0.92, 0);
  masonryParts.push({ geometry: core, color: BASALT_SHADE });

  addHollowRing(masonryParts, 0.845, 0.88, 0.278, 0.22, 16, GOLD_MAIN);
  addHollowRing(masonryParts, 0.965, 1.01, 0.282, 0.215, 16, GOLD_MAIN);
  addHollowRing(masonryParts, 1.005, 1.028, 0.272, 0.222, 16, GOLD_LIGHT);

  const mullions = 8;
  for (let i = 0; i < mullions; i++) {
    const angle = (i * Math.PI * 2) / mullions + Math.PI / 8;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const yaw = -angle;
    addRotatedBox(masonryParts, cos * 0.258, 0.925, sin * 0.258, 0.042, 0.11, 0.038, yaw, GOLD_LIGHT);
    addRotatedBox(masonryParts, cos * 0.268, 1.018, sin * 0.268, 0.048, 0.032, 0.042, yaw, GOLD_LIGHT);

    const paneAngle = angle + Math.PI / 8;
    addRotatedBox(
      socketParts,
      Math.cos(paneAngle) * 0.242,
      0.922,
      Math.sin(paneAngle) * 0.242,
      0.022,
      0.082,
      0.11,
      -paneAngle,
      DEEP_PALETTE.gold,
    );
  }

  masonryParts.push({ geometry: createFacetedDomeGeometry(0.222, 0.175, 0.992), color: GOLD_LIGHT });

  const keystone = new CylinderGeometry(0.022, 0.052, 0.026, 6);
  keystone.translate(0, 1.167, 0);
  socketParts.push({ geometry: keystone, color: DEEP_PALETTE.gold });
}

function createFacetedDomeGeometry(radius: number, height: number, baseY: number): BufferGeometry {
  const sphere = new IcosahedronGeometry(radius, 1);
  const nonIndexed = sphere.index ? sphere.toNonIndexed() : sphere;
  const pos = nonIndexed.getAttribute("position");
  const kept: number[] = [];
  const scaleY = height / radius;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    if (a.y + b.y + c.y < 0) continue;
    for (const v of [a, b, c]) {
      const clampedY = Math.max(0, v.y);
      kept.push(v.x, baseY + clampedY * scaleY, v.z);
    }
  }
  if (nonIndexed !== sphere) nonIndexed.dispose();
  sphere.dispose();

  const dome = new BufferGeometry();
  dome.setAttribute("position", new Float32BufferAttribute(kept, 3));
  dome.computeVertexNormals();
  return dome;
}

function addHollowRing(
  parts: KitPart[],
  yBottom: number,
  yTop: number,
  outerRadius: number,
  innerRadius: number,
  segments: number,
  color: string,
  startAngle = 0,
): void {
  const outer = new Shape();
  for (let i = 0; i < segments; i++) {
    const a = startAngle + (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * outerRadius;
    const y = Math.sin(a) * outerRadius;
    if (i === 0) outer.moveTo(x, y);
    else outer.lineTo(x, y);
  }
  outer.closePath();

  const hole = new Path();
  for (let i = 0; i < segments; i++) {
    const a = startAngle - (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * innerRadius;
    const y = Math.sin(a) * innerRadius;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  hole.closePath();
  outer.holes.push(hole);

  const geometry = new ExtrudeGeometry(outer, { depth: yTop - yBottom, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, yBottom, 0);
  parts.push({ geometry, color });
}

function addRotatedBox(
  parts: KitPart[],
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  yaw: number,
  color: string,
): void {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.rotateY(yaw);
  geometry.translate(x, y, z);
  parts.push({ geometry, color });
}

function buildSocketGemMesh(parts: readonly KitPart[], name: string): Mesh {
  const geometry = combineParts(parts, false);
  const material = new MeshStandardMaterial({
    name,
    color: new Color(DEEP_PALETTE.gold),
    emissive: new Color(DEEP_PALETTE.gold),
    emissiveIntensity: 1.2,
    roughness: 0.22,
    metalness: 0.35,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

export function createDeepGateVeilGeometry(): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(-0.27, 0.25);
  shape.lineTo(-0.18, 0.19);
  shape.lineTo(-0.07, 0.22);
  shape.lineTo(0.04, 0.14);
  shape.lineTo(0.16, 0.21);
  shape.lineTo(0.27, 0.18);
  shape.lineTo(0.27, 0.86);
  shape.lineTo(0.17, 0.985);
  shape.lineTo(-0.17, 0.985);
  shape.lineTo(-0.27, 0.86);
  shape.closePath();

  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -0.012);
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  nonIndexed.computeVertexNormals();
  const merged = mergeVertices(nonIndexed, 1e-4);
  if (nonIndexed !== geometry) nonIndexed.dispose();
  geometry.dispose();
  return merged;
}

export function createDeepGateVeilMaterial(color?: string): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({
    color: color ? new Color(color) : new Color(0xffffff),
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
  const across = positionGeometry.x.abs().div(0.28);
  const along = positionGeometry.y.sub(0.14).div(0.845).clamp(0, 1);
  material.opacityNode = smoothstep(1, 0.12, across)
    .mul(smoothstep(0, 0.22, along))
    .mul(smoothstep(1, 0.72, along))
    .mul(0.72);
  material.name = "deep-gateway-veil";
  return material;
}

function addGatePylons(parts: KitPart[]): void {
  for (const side of [-1, 1] as const) {
    const x = side * PYLON_X;
    addChamferedLoft(
      parts,
      x,
      0,
      0,
      PYLON_BASE_W,
      PYLON_BASE_D,
      PYLON_TOP_W,
      PYLON_TOP_D,
      PYLON_HEIGHT,
      0.042,
      OBSIDIAN_MAIN,
    );

    const innerX = x - side * 0.135;
    addBox(parts, innerX, 0.49, 0, 0.036, 0.96, 0.18, OBSIDIAN_SHADE);

    const notchX = x + side * 0.125;
    addBox(parts, notchX, 0.56, 0.04, 0.022, 0.06, 0.06, OBSIDIAN_SHADE);
    addBox(parts, notchX, 0.78, -0.035, 0.022, 0.055, 0.055, OBSIDIAN_SHADE);

    addCorbelHaunch(parts, side);
  }
}

function addCorbelHaunch(parts: KitPart[], side: -1 | 1): void {
  const wedge = new Shape();
  wedge.moveTo(0, 0);
  wedge.lineTo(0.13, 0.15);
  wedge.lineTo(0, 0.15);
  wedge.closePath();

  const geometry = new ExtrudeGeometry(wedge, {
    depth: 0.21,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -0.105);
  if (side === 1) {
    geometry.scale(-1, 1, 1);
    flipTriangleWinding(geometry);
  }
  geometry.translate(side * 0.305, 0.84, 0);
  parts.push({ geometry, color: OBSIDIAN_SHADE });
}

function addGateButtressesAndCollars(parts: KitPart[]): void {
  for (const side of [-1, 1] as const) {
    const x = side * PYLON_X;

    addButtressToe(parts, x + side * 0.12, 0, 0, 0.12, 0.27, 0.115, side === 1 ? 0 : Math.PI);
    addButtressToe(parts, x, 0, 0.12, 0.12, 0.27, 0.115, -Math.PI / 2);
    addButtressToe(parts, x, 0, -0.12, 0.12, 0.27, 0.115, Math.PI / 2);

    addChamferedPrism(parts, x, 0.23, 0, 0.315, 0.305, 0.088, 0.048, BRONZE_MAIN);
    addChamferedPrism(parts, x, 0.318, 0, 0.305, 0.295, 0.018, 0.046, BRONZE_LIGHT);
    addChamferedPrism(parts, x, 0.215, 0, 0.305, 0.295, 0.016, 0.046, BRONZE_SHADE);
  }
}

function addButtressToe(
  parts: KitPart[],
  x: number,
  y: number,
  z: number,
  reach: number,
  height: number,
  thickness: number,
  yaw: number,
): void {
  const bevel = 0.01;
  const shape = new Shape();
  shape.moveTo(0, bevel);
  shape.lineTo(reach, bevel);
  shape.lineTo(reach, 0.045);
  shape.lineTo(0.032, height);
  shape.lineTo(0, height);
  shape.closePath();

  const geometry = new ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: bevel,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -thickness / 2);
  geometry.rotateY(yaw);
  geometry.translate(x, y, z);
  parts.push({ geometry, color: BRONZE_MAIN });

  const cap = new BoxGeometry(0.035, 0.024, thickness * 0.72);
  cap.rotateY(yaw);
  const offset = new Vector3(reach * 0.55, height * 0.48, 0).applyAxisAngle(new Vector3(0, 1, 0), yaw);
  cap.translate(x + offset.x, y + offset.y, z + offset.z);
  parts.push({ geometry: cap, color: BRONZE_LIGHT });
}

function addGateArchitraveAndCrown(parts: KitPart[]): void {
  addChamferedPrism(parts, 0, LINTEL_BOTTOM_Y, 0, 1.12, 0.28, LINTEL_HEIGHT, 0.04, OBSIDIAN_MAIN);
  addBox(parts, 0, LINTEL_BOTTOM_Y + 0.015, 0, 0.62, 0.03, 0.24, OBSIDIAN_SHADE);

  addChamferedPrism(parts, 0, 1.03, 0, 1.18, 0.33, 0.068, 0.044, BRONZE_MAIN);
  addChamferedPrism(parts, 0, 1.098, 0, 1.165, 0.318, 0.015, 0.042, BRONZE_LIGHT);
  addChamferedPrism(parts, 0, 1.015, 0, 1.165, 0.318, 0.015, 0.042, BRONZE_SHADE);

  addChamferedPrism(parts, 0, CORNICE_LOWER_Y, 0, 1.24, 0.34, CORNICE_LOWER_H, 0.045, OBSIDIAN_MAIN);
  addChamferedPrism(parts, 0, CORNICE_UPPER_Y, 0, 1.15, 0.275, CORNICE_UPPER_H, 0.038, OBSIDIAN_CROWN);
  addBox(parts, 0, CORNICE_LOWER_Y + 0.004, 0, 1.18, 0.014, 0.3, OBSIDIAN_SHADE);
}

function addGateMedallions(masonryParts: KitPart[], accentParts: KitPart[], aspectHex: string): void {
  for (const facing of [-1, 1] as const) {
    const outerHex = createHexShape(0.114);
    const bezel = new ExtrudeGeometry(outerHex, {
      depth: 0.046,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.01,
      bevelSegments: 1,
    });
    bezel.translate(0, 0, -0.023);
    bezel.translate(0, MEDALLION_Y, facing * (MEDALLION_Z + 0.016));
    masonryParts.push({ geometry: bezel, color: BRONZE_LIGHT });

    const wellHex = createHexShape(0.082);
    const well = new ExtrudeGeometry(wellHex, {
      depth: 0.022,
      bevelEnabled: false,
    });
    well.translate(0, 0, -0.011);
    well.translate(0, MEDALLION_Y, facing * (MEDALLION_Z + 0.036));
    masonryParts.push({ geometry: well, color: BRONZE_SHADE });

    const coreHex = createHexShape(0.064);
    const core = new ExtrudeGeometry(coreHex, {
      depth: 0.024,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 1,
    });
    core.translate(0, 0, -0.012);
    core.translate(0, MEDALLION_Y, facing * (MEDALLION_Z + 0.044));
    accentParts.push({ geometry: core, color: aspectHex });
  }
}

function addGateJambRunes(accentParts: KitPart[], aspectHex: string): void {
  for (const side of [-1, 1] as const) {
    const innerX = side * 0.282;
    addBox(accentParts, innerX, 0.58, 0, 0.014, 0.34, 0.042, aspectHex);
  }
}

function buildMasonryMesh(parts: readonly KitPart[], name: string): Mesh {
  const geometry = combineParts(parts, true);
  const material = createProcgenMasonryMaterial();
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildAccentMesh(parts: readonly KitPart[], aspectHex: string, name: string): Mesh {
  const geometry = combineParts(parts, false);
  const material = new MeshStandardMaterial({
    name,
    color: new Color(aspectHex),
    emissive: new Color(aspectHex),
    emissiveIntensity: 1.25,
    roughness: 0.24,
    metalness: 0.25,
    vertexColors: true,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function createHexShape(radius: number): Shape {
  const shape = new Shape();
  for (let index = 0; index < 6; index++) {
    const angle = (Math.PI / 3) * index + Math.PI / 6;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createChamferedRectShape(width: number, depth: number, chamfer: number): Shape {
  const hw = width / 2;
  const hd = depth / 2;
  const c = Math.min(chamfer, hw * 0.45, hd * 0.45);
  const shape = new Shape();
  shape.moveTo(-hw + c, -hd);
  shape.lineTo(hw - c, -hd);
  shape.lineTo(hw, -hd + c);
  shape.lineTo(hw, hd - c);
  shape.lineTo(hw - c, hd);
  shape.lineTo(-hw + c, hd);
  shape.lineTo(-hw, hd - c);
  shape.lineTo(-hw, -hd + c);
  shape.closePath();
  return shape;
}

function addChamferedPrism(
  parts: KitPart[],
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  chamfer: number,
  color: string,
): void {
  const shape = createChamferedRectShape(width, depth, chamfer);
  const geometry = new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(x, y, z);
  parts.push({ geometry, color });
}

function addChamferedLoft(
  parts: KitPart[],
  x: number,
  y: number,
  z: number,
  bottomW: number,
  bottomD: number,
  topW: number,
  topD: number,
  height: number,
  chamfer: number,
  color: string,
): void {
  const shape = createChamferedRectShape(bottomW, bottomD, chamfer);
  const geometry = new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.getAttribute("position");
  const scaleX = topW / bottomW;
  const scaleZ = topD / bottomD;
  for (let index = 0; index < pos.count; index++) {
    const py = pos.getY(index);
    const t = Math.max(0, Math.min(1, py / height));
    const sx = 1 + (scaleX - 1) * t;
    const sz = 1 + (scaleZ - 1) * t;
    pos.setXYZ(index, pos.getX(index) * sx, py, pos.getZ(index) * sz);
  }
  geometry.computeVertexNormals();
  geometry.translate(x, y, z);
  parts.push({ geometry, color });
}

function addBox(
  parts: KitPart[],
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  color: string,
): void {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.translate(x, y, z);
  parts.push({ geometry, color });
}

function flipTriangleWinding(geometry: BufferGeometry): void {
  const index = geometry.getIndex();
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);
      index.setX(i + 1, c);
      index.setX(i + 2, b);
    }
    index.needsUpdate = true;
  } else {
    const pos = geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i += 3) {
      const bx = pos.getX(i + 1);
      const by = pos.getY(i + 1);
      const bz = pos.getZ(i + 1);
      pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      pos.setXYZ(i + 2, bx, by, bz);
    }
    pos.needsUpdate = true;
  }
  geometry.computeVertexNormals();
}

function combineParts(parts: readonly KitPart[], applyWear: boolean): BufferGeometry {
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
    if (applyWear) base.offsetHSL(0, 0, Math.sin(partIndex * 13.71) * 0.015);
    const faceTint = new Color();
    const colors = new Float32Array(pos.count * 3);
    for (let vertex = 0; vertex < pos.count; vertex++) {
      const wear = applyWear ? Math.max(0, normal.getY(vertex)) * 0.025 : 0;
      faceTint
        .copy(base)
        .offsetHSL(0, 0, wear)
        .toArray(colors, vertex * 3);
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
