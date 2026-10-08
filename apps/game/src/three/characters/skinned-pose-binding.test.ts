import { Bone, Group, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  applySegmentBoneRotation,
  createRestHingeAxis,
  createStableSegmentBoneBinding,
  resolveLimbHingeAxis,
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

describe("limb hinge axis", () => {
  it("is the normal of the plane through the three joints, forearm x upper arm", () => {
    const axis = new Vector3();
    // The arm hangs down and the forearm swings forward: the plane is the x = 0 plane.
    expect(resolveLimbHingeAxis(new Vector3(0, 1, 0), new Vector3(0, 0, 0), new Vector3(0, 0, 1), axis)).toBe(true);
    expect(axis.distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-9);
  });

  it("is undefined for a straight limb, which a rig asking for hinge arms must not rest in", () => {
    expect(resolveLimbHingeAxis(new Vector3(0, 2, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 0), new Vector3())).toBe(
      false,
    );
    const scene = new Group();
    const names = ["shoulder", "elbow", "wrist"];
    const bones = names.map((name, index) => {
      const bone = new Bone();
      bone.name = name;
      bone.position.set(0, index === 0 ? 0 : -1, 0);
      return bone;
    });
    scene.add(bones[0]);
    bones[0].add(bones[1]);
    bones[1].add(bones[2]);
    scene.updateWorldMatrix(true, true);

    expect(() => createRestHingeAxis(scene, "shoulder", "elbow", "wrist")).toThrow("rests straight");
  });
});
