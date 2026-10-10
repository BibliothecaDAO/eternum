import { describe, expect, it } from "vitest";

import {
  resolveHumanoidRigRequiredBoneNames,
  validateHumanoidRigAdapter,
  type HumanoidPartBindingDefinition,
} from "./humanoid-rig-adapter";
import type { CharacterPartId } from "./procedural-character-rig";
import { QUATERNIUS_HUMANOID_RIG_ADAPTER } from "./quaternius-humanoid-rig-adapter";
import { T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER } from "./t1-knight-default-humanoid-rig-adapter";

describe("humanoid rig adapter", () => {
  it("maps every canonical pose, diagnostic, hand, foot, and socket role", () => {
    const adapter = QUATERNIUS_HUMANOID_RIG_ADAPTER;
    const requiredBones = resolveHumanoidRigRequiredBoneNames(adapter);

    expect(validateHumanoidRigAdapter(adapter)).toEqual([]);
    expect(adapter.partBindings.thighLeft).toEqual({ bone: "thigh_l", childBone: "calf_l", stable: true });
    expect(adapter.diagnosticBones.kneeRight).toBe("calf_r");
    expect(adapter.feet.left).toEqual({
      ankle: "foot_l",
      toe: "ball_l",
      toeTip: "ball_leaf_l",
      soleHeight: 0,
      heelLengthRatio: 0.4,
    });
    expect(adapter.sockets.gripRight.offset.kind).toBe("knuckle-center");
    expect(requiredBones).toEqual(expect.arrayContaining(["pelvis", "hand_l", "thumb_03_r", "ball_l", "ball_r"]));
  });

  it("keeps skeleton convention separate from appearance selection", () => {
    expect(QUATERNIUS_HUMANOID_RIG_ADAPTER.id).toBe("quaternius-universal");
    expect(QUATERNIUS_HUMANOID_RIG_ADAPTER.label).toBe("Quaternius Universal humanoid");
  });

  it("rejects degenerate adapter axes before loading a model", () => {
    expect(validateHumanoidRigAdapter({ ...QUATERNIUS_HUMANOID_RIG_ADAPTER, sceneRotation: [0, 0, 0, 0] })).toContain(
      "invalid-scene-rotation",
    );
    expect(
      validateHumanoidRigAdapter({
        ...QUATERNIUS_HUMANOID_RIG_ADAPTER,
        partBindings: {
          ...QUATERNIUS_HUMANOID_RIG_ADAPTER.partBindings,
          thighLeft: { bone: "thigh_l", stable: true },
        },
      }),
    ).toContain("missing-stable-child:thighLeft");
  });

  it("asks for hinge arms on both parts of a side, and only on arms", () => {
    const withBindings = (bindings: Partial<Record<CharacterPartId, HumanoidPartBindingDefinition>>) =>
      validateHumanoidRigAdapter({
        ...QUATERNIUS_HUMANOID_RIG_ADAPTER,
        partBindings: { ...QUATERNIUS_HUMANOID_RIG_ADAPTER.partBindings, ...bindings },
      });

    expect(validateHumanoidRigAdapter(T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER)).toEqual([]);
    expect(withBindings({ upperArmLeft: { bone: "upperarm_l", childBone: "lowerarm_l", hinge: true } })).toContain(
      "hinge-arm-mismatch:left",
    );
    expect(withBindings({ thighLeft: { bone: "thigh_l", childBone: "calf_l", hinge: true } })).toContain(
      "hinge-on-a-non-arm:thighLeft",
    );
  });
});
