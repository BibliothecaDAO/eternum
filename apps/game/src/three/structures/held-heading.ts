import { Matrix4, type Object3D } from "three";

/**
 * A part authored with a `poleAxis` (a building's banner: its pole's [x, z] in model space) keeps one heading in the
 * world whichever way its building turns: it pivots on its pole, so it reads broadside to the camera at every
 * placement instead of turning edge-on with the building.
 */
export function poleAxisOf(part: Object3D): readonly [number, number] | undefined {
  const axis = part.userData.poleAxis;
  return Array.isArray(axis) && axis.length === 2 ? (axis as [number, number]) : undefined;
}

/** The model-space turn about the pole that cancels the model's own yaw. */
export function heldHeadingCorrection(
  poleAxis: readonly [number, number],
  modelYaw: number,
  target = new Matrix4(),
): Matrix4 {
  const [x, z] = poleAxis;
  return target
    .makeTranslation(x, 0, z)
    .multiply(scratch.makeRotationY(-modelYaw))
    .multiply(pivot.makeTranslation(-x, 0, -z));
}

/** The yaw of a placement matrix made of a translation, a turn about Y and a uniform scale. */
export function yawOfPlacement(matrix: Matrix4): number {
  const elements = matrix.elements;
  return Math.atan2(elements[8], elements[10]);
}

/**
 * Turns each held part of a placed model back to its authored heading. The yaw comes from the model's matrix: an Euler
 * angle reads a turn past a quarter as a flip about the other axes.
 */
export function holdPartHeadings(model: Object3D): void {
  model.updateMatrix();
  const yaw = yawOfPlacement(model.matrix);
  model.traverse((part) => {
    const axis = poleAxisOf(part);
    if (!axis || part === model) return;
    heldHeadingCorrection(axis, yaw, held).decompose(part.position, part.quaternion, part.scale);
  });
}

const scratch = new Matrix4();
const pivot = new Matrix4();
const held = new Matrix4();
