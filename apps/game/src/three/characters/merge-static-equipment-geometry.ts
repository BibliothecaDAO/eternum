import { BufferGeometry, type Matrix4 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface StaticEquipmentGeometryPart {
  geometry: BufferGeometry;
  transform: Matrix4;
}

/** Merge immutable equipment primitives once so every actor shares one draw geometry. */
export function mergeStaticEquipmentGeometry(parts: readonly StaticEquipmentGeometryPart[]): BufferGeometry {
  const transformed = parts.map(({ geometry, transform }) => geometry.clone().applyMatrix4(transform));
  const merged = mergeGeometries(transformed, false);
  transformed.forEach((geometry) => geometry.dispose());
  if (!merged) throw new Error("Static equipment geometry attributes were incompatible");
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}
