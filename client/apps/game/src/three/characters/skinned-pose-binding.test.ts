import { Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { resolveStableSegmentQuaternion } from "./skinned-pose-binding";

const Y_AXIS = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);
const Z_AXIS = new Vector3(0, 0, 1);

describe("stable segment orientation", () => {
  it("keeps near-vertical downward segments continuous while matching their direction", () => {
    const beforeDirection = new Vector3(0.015, -1, -0.01).normalize();
    const afterDirection = new Vector3(-0.015, -1, 0.01).normalize();
    const before = resolveStableSegmentQuaternion(beforeDirection, Z_AXIS, X_AXIS, new Quaternion());
    const after = resolveStableSegmentQuaternion(afterDirection, Z_AXIS, X_AXIS, new Quaternion());

    expect(Y_AXIS.clone().applyQuaternion(before).angleTo(beforeDirection)).toBeLessThan(1e-5);
    expect(Y_AXIS.clone().applyQuaternion(after).angleTo(afterDirection)).toBeLessThan(1e-5);
    expect((before.angleTo(after) * 180) / Math.PI).toBeLessThan(3);
  });
});
