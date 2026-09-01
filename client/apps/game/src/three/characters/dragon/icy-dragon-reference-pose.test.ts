import { AnimationClip, Bone, Group, QuaternionKeyframeTrack, VectorKeyframeTrack } from "three";
import { describe, expect, it } from "vitest";

import { applyIcyDragonReferencePose } from "./icy-dragon-assets";

describe("Icy Dragon reference pose", () => {
  it("bakes the first authored sample without retaining clip playback", () => {
    const scene = new Group();
    const wing = new Bone();
    wing.name = "wing";
    scene.add(wing);
    const clip = new AnimationClip("reference", 1, [
      new VectorKeyframeTrack("wing.position", [0, 1], [1, 2, 3, 8, 9, 10]),
      new QuaternionKeyframeTrack("wing.quaternion", [0, 1], [0, 0, 0, 1, 0, 1, 0, 0]),
    ]);

    applyIcyDragonReferencePose(scene, clip);

    expect(wing.position.toArray()).toEqual([1, 2, 3]);
    expect(wing.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  });
});
