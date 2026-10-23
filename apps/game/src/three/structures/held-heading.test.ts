import { Group, Matrix4, Mesh, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { heldHeadingCorrection, holdPartHeadings, yawOfPlacement } from "./held-heading";

const POLE: [number, number] = [0.3, -0.2];
// The board's six headings, each after the loader's half turn.
const HEADINGS = [0, 1, 2, 3, 4, 5].map((step) => Math.PI + (step * Math.PI) / 3);

function placement(yaw: number): Matrix4 {
  return new Matrix4()
    .makeTranslation(4, 0.05, -2)
    .multiply(new Matrix4().makeRotationY(yaw))
    .multiply(new Matrix4().makeScale(1.2, 1.2, 1.2));
}

function headingOf(matrix: Matrix4): Quaternion {
  const rotation = new Quaternion();
  matrix.decompose(new Vector3(), rotation, new Vector3());
  return rotation;
}

describe("held heading", () => {
  it.each(HEADINGS)("keeps a banner's world heading and carries its pole with the building at yaw %f", (yaw) => {
    const model = placement(yaw);
    expect(yawOfPlacement(model)).toBeCloseTo(Math.atan2(Math.sin(yaw), Math.cos(yaw)), 9);
    const held = model.clone().multiply(heldHeadingCorrection(POLE, yawOfPlacement(model)));
    expect(headingOf(held).angleTo(new Quaternion())).toBeCloseTo(0, 9);
    const pole = new Vector3(POLE[0], 0.4, POLE[1]);
    expect(pole.clone().applyMatrix4(held).distanceTo(pole.clone().applyMatrix4(model))).toBeCloseTo(0, 9);
  });

  it.each(HEADINGS)("holds only parts with a pole on a cloned model turned to %f", (yaw) => {
    const model = new Group();
    const banner = new Mesh();
    banner.userData.poleAxis = POLE;
    const building = new Mesh();
    model.add(banner, building);
    // The board places a clone with applyMatrix4, which can read a large turn as a flip about X and Z.
    model.applyMatrix4(placement(yaw));
    holdPartHeadings(model);
    model.updateMatrixWorld(true);
    expect(headingOf(banner.matrixWorld).angleTo(new Quaternion())).toBeCloseTo(0, 9);
    expect(building.matrix.equals(new Matrix4())).toBe(true);
  });
});
