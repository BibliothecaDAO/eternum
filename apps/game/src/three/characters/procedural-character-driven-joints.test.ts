import { Object3D, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import runtimeFit from "../../../asset-sources/characters/t1-knight-default/runtime-fit.json";
import { validateHumanoidRigAdapter, type HumanoidDrivenJointDefinition } from "./humanoid-rig-adapter";
import {
  assertDrivenJointsShareParent,
  resolveDrivenJointLocalRotation,
  resolveDrivenJointRotation,
} from "./procedural-character-driven-joints";
import { T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER } from "./t1-knight-default-humanoid-rig-adapter";

const TOLERANCE = 1e-4;
const TWIST: HumanoidDrivenJointDefinition = {
  rule: "twist",
  bone: "twist",
  follows: "arm",
  share: 0.4,
  axis: [1, 0, 0],
};
const HALF: HumanoidDrivenJointDefinition = { rule: "half", bone: "half", follows: "forearm", share: 0.5 };

function definitionFor(bone: string) {
  const definition = T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER.drivenJoints.find((joint) => joint.bone === bone);
  if (!definition) throw new Error(`No driven joint ${bone}`);
  return definition;
}

function expectSameRotation(actual: Quaternion, expected: readonly number[]): void {
  const sign = actual.dot(new Quaternion().fromArray(expected)) < 0 ? -1 : 1;
  const worstComponentError = Math.max(
    ...expected.map((component, index) => Math.abs(sign * actual.toArray()[index] - component)),
  );
  expect(worstComponentError).toBeLessThan(TOLERANCE);
}

function aboutAxis(axis: Vector3, degrees: number): Quaternion {
  return new Quaternion().setFromAxisAngle(axis, (degrees * Math.PI) / 180);
}

describe("driven joint rotation", () => {
  it("reproduces every worked case in the runtime fit", () => {
    expect(runtimeFit.driver_reference.cases).toHaveLength(66);
    for (const { helper, follows_quaternion_xyzw: follows, helper_quaternion_xyzw: expected } of runtimeFit
      .driver_reference.cases) {
      const actual = resolveDrivenJointRotation(
        definitionFor(helper),
        new Quaternion().fromArray(follows),
        new Quaternion(),
      );
      expectSameRotation(actual, expected);
    }
  });

  it("keeps a joint at rest when the followed joint is at rest", () => {
    for (const definition of T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER.drivenJoints) {
      const actual = resolveDrivenJointRotation(definition, new Quaternion(), new Quaternion(0.3, 0.2, 0.1, 0.9));
      expectSameRotation(actual, [0, 0, 0, 1]);
    }
  });

  it("gives the same rotation for either sign of the followed rotation", () => {
    for (const { helper, follows_quaternion_xyzw: follows } of runtimeFit.driver_reference.cases) {
      const [x, y, z, w] = follows;
      const positive = resolveDrivenJointRotation(definitionFor(helper), new Quaternion(x, y, z, w), new Quaternion());
      const negative = resolveDrivenJointRotation(
        definitionFor(helper),
        new Quaternion(-x, -y, -z, -w),
        new Quaternion(),
      );
      expectSameRotation(positive, negative.toArray());
    }
  });

  it("is safe when the output is the input", () => {
    for (const definition of [HALF, TWIST]) {
      const delta = new Quaternion(0.2, 0.3, 0.1, 0.9).normalize();
      const expected = resolveDrivenJointRotation(definition, delta, new Quaternion());
      expect(resolveDrivenJointRotation(definition, delta, delta).angleTo(expected)).toBeLessThan(1e-6);
    }
  });

  it("measures the followed joint from its own rest and applies the delta to the driven joint's rest", () => {
    const followsRest = aboutAxis(new Vector3(0, 1, 0), 30);
    const drivenRest = aboutAxis(new Vector3(0, 0, 1), 50);
    const bend = aboutAxis(new Vector3(1, 0, 0), 80);
    const followsRotation = bend.clone().multiply(followsRest);
    const actual = resolveDrivenJointLocalRotation(
      HALF,
      followsRotation,
      followsRest.clone().invert(),
      drivenRest,
      new Quaternion(),
    );
    const expected = aboutAxis(new Vector3(1, 0, 0), 40).multiply(drivenRest);
    expect(actual.angleTo(expected)).toBeLessThan(1e-6);
  });

  it("jumps by 144 degrees when the roll crosses 180, as swing-twist does", () => {
    const x = new Vector3(1, 0, 0);
    const before = resolveDrivenJointRotation(TWIST, aboutAxis(x, 179), new Quaternion());
    const after = resolveDrivenJointRotation(TWIST, aboutAxis(x, 181), new Quaternion());
    expect((before.angleTo(after) * 180) / Math.PI).toBeCloseTo(143.2, 0);
  });
});

describe("driven joint declarations", () => {
  it("rejects a joint that drives itself", () => {
    const issues = validateHumanoidRigAdapter({
      ...T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER,
      drivenJoints: [{ rule: "half", bone: "elbow_half_l", follows: "elbow_half_l", share: 0.5 }],
    });
    expect(issues).toContain("invalid-driven-joint:elbow_half_l");
  });

  it("accepts siblings and rejects a pair with different parents", () => {
    const parent = new Object3D();
    const driven = new Object3D();
    const sibling = new Object3D();
    parent.add(driven, sibling);
    expect(() => assertDrivenJointsShareParent(HALF, driven, sibling)).not.toThrow();

    const child = new Object3D();
    sibling.add(child);
    expect(() => assertDrivenJointsShareParent(HALF, driven, child)).toThrow("must share a parent");
    expect(() => assertDrivenJointsShareParent(HALF, new Object3D(), new Object3D())).toThrow("must share a parent");
  });
});
