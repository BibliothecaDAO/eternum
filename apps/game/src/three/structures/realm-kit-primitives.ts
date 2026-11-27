import { RealmLevels } from "@bibliothecadao/types";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Quaternion,
  Shape,
  Vector3,
} from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import type { FlagAnchor } from "./flag-anchors";

export interface KitPart {
  readonly geometry: BufferGeometry;
  readonly color: string;
}

export interface KitParts {
  readonly masonry: KitPart[];
  readonly glow: KitPart[];
  readonly anchors: FlagAnchor[];
}

export interface WallSegment {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
}

export const REALM_KIT_LEVELS: readonly RealmLevels[] = Object.values(RealmLevels).filter(
  (level): level is RealmLevels => typeof level === "number",
);

export function extrudedGable(width: number, height: number, depth: number): BufferGeometry {
  const half = width / 2;
  const shape = new Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(0, height);
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 }).translate(0, 0, -depth / 2);
}

export function cutStoneBlock(width: number, height: number, depth: number): BufferGeometry {
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

export function beamBetween(start: Vector3, end: Vector3, width: number): BufferGeometry {
  const direction = end.clone().sub(start);
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize());
  const center = start.clone().add(end).multiplyScalar(0.5);
  return new BoxGeometry(width, direction.length(), width)
    .applyQuaternion(rotation)
    .translate(center.x, center.y, center.z);
}

export function piece(geometry: BufferGeometry, color: string, x = 0, y = 0, z = 0, yaw = 0): KitPart {
  geometry.rotateY(yaw).translate(x, y, z);
  return { geometry, color };
}

export function combineParts(parts: KitPart[]): BufferGeometry {
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
