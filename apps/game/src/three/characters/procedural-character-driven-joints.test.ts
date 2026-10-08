import { Quaternion } from "three";
import { describe, expect, it } from "vitest";

import { BASTION_KNIGHT_HUMANOID_RIG_ADAPTER } from "./bastion-knight-humanoid-rig-adapter";
import reference from "./bastion-knight-driver-reference.json";
import { resolveDrivenJointRotation } from "./procedural-character-driven-joints";

const TOLERANCE = 1e-4;

function definitionFor(bone: string) {
  const definition = BASTION_KNIGHT_HUMANOID_RIG_ADAPTER.drivenJoints.find((joint) => joint.bone === bone);
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

describe("driven joint rotation", () => {
  it("reproduces every baseline reference case", () => {
    expect(reference.cases).toHaveLength(66);
    for (const { helper, follows_quaternion_xyzw: follows, helper_quaternion_xyzw: expected } of reference.cases) {
      const actual = resolveDrivenJointRotation(
        definitionFor(helper),
        new Quaternion().fromArray(follows),
        new Quaternion(),
      );
      expectSameRotation(actual, expected);
    }
  });

  it("keeps a joint at rest when the followed joint is at rest", () => {
    for (const definition of BASTION_KNIGHT_HUMANOID_RIG_ADAPTER.drivenJoints) {
      const actual = resolveDrivenJointRotation(definition, new Quaternion(), new Quaternion(0.3, 0.2, 0.1, 0.9));
      expectSameRotation(actual, [0, 0, 0, 1]);
    }
  });

  it("gives the same rotation for either sign of the followed rotation", () => {
    for (const { helper, follows_quaternion_xyzw: follows } of reference.cases) {
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
});
