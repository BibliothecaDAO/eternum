import { Bone, Group, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  applySegmentBoneRotation,
  createStableSegmentBoneBinding,
  resolveStableSegmentQuaternion,
} from "./skinned-pose-binding";

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

  it("preserves bind-pose forward when a downward segment uses the stable frame", () => {
    const scene = new Group();
    const shin = new Bone();
    const ankle = new Bone();
    const toe = new Bone();
    shin.name = "shin";
    ankle.name = "ankle";
    toe.name = "toe";
    ankle.position.set(0, -1, 0);
    toe.position.set(0, 0, 0.3);
    scene.add(shin);
    shin.add(ankle);
    ankle.add(toe);
    scene.updateWorldMatrix(true, true);

    const binding = createStableSegmentBoneBinding(scene, "shin", "ankle", Z_AXIS, X_AXIS);
    const segment = resolveStableSegmentQuaternion(new Vector3(0, -1, 0), Z_AXIS, X_AXIS, new Quaternion());
    applySegmentBoneRotation(binding, scene, segment, new Quaternion(), new Quaternion(), new Quaternion());
    scene.updateWorldMatrix(true, true);

    const footForward = toe.getWorldPosition(new Vector3()).sub(ankle.getWorldPosition(new Vector3())).normalize();
    expect(footForward.dot(Z_AXIS)).toBeGreaterThan(0.99);
  });
});
