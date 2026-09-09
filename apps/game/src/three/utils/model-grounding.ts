import type { Matrix4, Mesh } from "three";
import { isShipModel } from "../constants/army-constants";
import type { ModelType } from "../types/army";

const groundOffsets = new WeakMap<readonly Mesh[], number>();

/** Instanced models draw raw geometry; node transforms and animation bounds are not their standing origin. */
export function getArmyGroundOffset(meshes: readonly Mesh[], modelType?: ModelType): number {
  // Ship origins describe their waterline; placing the keel on the surface would lift the hull out of the water.
  if (isShipModel(modelType)) return 0;
  const cached = groundOffsets.get(meshes);
  if (cached !== undefined) return cached;

  let lowestPoint = Infinity;
  for (const mesh of meshes) {
    const positions = mesh.geometry.getAttribute("position");
    for (let index = 0; index < positions.count; index++) {
      lowestPoint = Math.min(lowestPoint, positions.getY(index));
    }
  }
  const offset = meshes.length === 0 ? 0 : -lowestPoint;
  if (!Number.isFinite(offset)) throw new Error("Cannot ground a model without finite vertex positions");
  groundOffsets.set(meshes, offset);
  return offset;
}

/** Move the authored base onto the supplied surface without changing the surface anchor itself. */
export function groundModelMatrix(matrix: Matrix4, offset: number): void {
  const elements = matrix.elements;
  elements[12] += elements[4] * offset;
  elements[13] += elements[5] * offset;
  elements[14] += elements[6] * offset;
}
