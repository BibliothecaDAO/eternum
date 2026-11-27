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
): void {
  const outer = new Shape();
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * outerRadius;
    const y = Math.sin(a) * outerRadius;
    if (i === 0) outer.moveTo(x, y);
    else outer.lineTo(x, y);
  }
  outer.closePath();

  const hole = new Path();
  for (let i = 0; i < segments; i++) {
    const a = -(i / segments) * Math.PI * 2;
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
