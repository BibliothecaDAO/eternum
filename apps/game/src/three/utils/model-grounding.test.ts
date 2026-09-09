import { BoxGeometry, Float32BufferAttribute, Matrix4, Mesh, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { ModelType } from "../types/army";
import { getArmyGroundOffset, groundModelMatrix } from "./model-grounding";

describe("army ground contact", () => {
  it("places the authored standing base on the surface with instance scale and rotation", () => {
    const body = new Mesh(new BoxGeometry(1, 2, 1).translate(0, 1.166, 0));
    const meshes = [body];
    const groundOffset = getArmyGroundOffset(meshes, ModelType.Knight2);
    expect(groundOffset).toBeCloseTo(-0.166);
    const base = new Vector3(0, 0.166, 0);
    const matrix = new Matrix4()
      .makeRotationY(0.8)
      .scale(new Vector3(2, 3, 2))
      .setPosition(4, 7, 9);

    groundModelMatrix(matrix, groundOffset);

    const groundedBase = base.applyMatrix4(matrix);
    expect(groundedBase.x).toBeCloseTo(4);
    expect(groundedBase.y).toBeCloseTo(7);
    expect(groundedBase.z).toBeCloseTo(9);
    body.geometry.dispose();
  });

  it("uses the complete model's standing geometry rather than animated extrema", () => {
    const body = new Mesh(new BoxGeometry(1, 2, 1).translate(0, 1.2, 0));
    const boot = new Mesh(new BoxGeometry(0.2, 0.2, 0.4));
    body.geometry.morphAttributes.position = [new Float32BufferAttribute([0, -20, 0], 3)];
    expect(getArmyGroundOffset([body, boot], ModelType.Knight2)).toBeCloseTo(0.1);
    body.geometry.dispose();
    boot.geometry.dispose();
  });

  it("preserves a ship's authored waterline even when its hull extends below it", () => {
    const hull = new Mesh(new BoxGeometry(2, 1, 4));
    expect(getArmyGroundOffset([hull], ModelType.ShipPaladin3)).toBe(0);
    hull.geometry.dispose();
  });
});
