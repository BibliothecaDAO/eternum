import { ASPECT_HEX } from "@/tokens";
import { aspectName, type AspectId } from "@bibliothecadao/types";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { positionGeometry, smoothstep } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { createProcgenMasonryMaterial } from "./procgen-masonry-material";

export const DEEP_GATE_HEIGHT = 1.34;

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
