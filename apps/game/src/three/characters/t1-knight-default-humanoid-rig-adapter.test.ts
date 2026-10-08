import { Quaternion } from "three";
import { describe, expect, it } from "vitest";

import runtimeFit from "../../../asset-sources/characters/t1-knight-default/runtime-fit.json";
import {
  resolveHumanoidRigRequiredBoneNames,
  validateHumanoidRigAdapter,
  type HumanoidRigAdapter,
} from "./humanoid-rig-adapter";
import { resolveHumanoidRigAdapter } from "./humanoid-rig-adapters";
import { T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER } from "./t1-knight-default-humanoid-rig-adapter";

describe("T1 Knight rig adapter", () => {
  it("registers the normalized minimal-hand rig and its optional forearm socket", () => {
    const adapter = resolveHumanoidRigAdapter("t1-knight-default");
    expect(adapter).toBe(T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER);
    expect(validateHumanoidRigAdapter(adapter)).toEqual([]);
    expect(resolveHumanoidRigRequiredBoneNames(adapter)).toContain("lowerarm_l");
    expect(
      resolveHumanoidRigRequiredBoneNames(adapter).some((name) => /^(index|middle|ring|pinky|thumb)_/.test(name)),
    ).toBe(false);
  });

  it("carries the runtime fit's hands, feet, sockets and driven joints", () => {
    const adapter = T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER;
    for (const [side, key] of [
      ["left", "hand_l"],
      ["right", "hand_r"],
    ] as const) {
      const { index, middle, pinky, normal_sign: normalSign } = runtimeFit.hands[key];
      expect(adapter.hands[side].palm).toEqual({ index, middle, pinky, normalSign });
    }
    for (const [side, key] of [
      ["left", "l"],
      ["right", "r"],
    ] as const) {
      const fit = runtimeFit.feet[key];
      expect(adapter.feet[side]).toMatchObject({
        ankle: fit.ankle,
        toe: fit.toe,
        toeTip: fit.toe_tip,
        soleHeight: fit.sole_height,
        heelLengthRatio: fit.heel_length_ratio,
      });
    }
    for (const [socket, key] of [
      [adapter.sockets.gripRight, "sword"],
      [adapter.sockets.forearmLeft, "shield"],
    ] as const) {
      const fit = runtimeFit.sockets[key];
      expect(socket.bone).toBe(fit.joint);
      expect(socket.offset).toEqual({ kind: "fixed", value: fit.offset });
      expect(socket.rotationOffset).toEqual(fit.quaternion_xyzw);
      expect(new Quaternion().fromArray(socket.rotationOffset).length()).toBeCloseTo(1, 6);
    }
    expect(adapter.drivenJoints).toHaveLength(runtimeFit.helpers.length);
    for (const helper of runtimeFit.helpers) {
      const driven = adapter.drivenJoints.find(({ bone }) => bone === helper.name);
      expect(driven, helper.name).toMatchObject({ rule: helper.rule, follows: helper.follows, share: helper.share });
      if (helper.rule === "twist") expect(driven).toMatchObject({ axis: helper.twist_axis });
    }
  });

  it("requires the six driven joints and the joints they follow", () => {
    const required = resolveHumanoidRigRequiredBoneNames(T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER);
    expect(T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER.drivenJoints.map(({ bone }) => bone)).toEqual([
      "elbow_half_l",
      "elbow_half_r",
      "knee_half_l",
      "knee_half_r",
      "upperarm_twist_l",
      "upperarm_twist_r",
    ]);
    for (const { bone, follows } of T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER.drivenJoints) {
      expect(required).toContain(bone);
      expect(required).toContain(follows);
    }
  });

  it("rejects a driven joint with an unusable share or twist axis", () => {
    const withDriven = (drivenJoints: HumanoidRigAdapter["drivenJoints"]): HumanoidRigAdapter => ({
      ...T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER,
      drivenJoints,
    });
    expect(validateHumanoidRigAdapter(withDriven([{ rule: "half", bone: "a", follows: "b", share: 1.5 }]))).toContain(
      "invalid-driven-share:a",
    );
    expect(
      validateHumanoidRigAdapter(withDriven([{ rule: "twist", bone: "a", follows: "b", share: 0.4, axis: [0, 0, 0] }])),
    ).toContain("invalid-driven-axis:a");
  });

  it("requires the chest pair joints and rejects a degenerate pair", () => {
    expect(resolveHumanoidRigRequiredBoneNames(T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER)).toContain("upperarm_r");
    expect(
      validateHumanoidRigAdapter({
        ...T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER,
        sourceBody: { chestBetween: ["a", "a"] },
      }),
    ).toContain("invalid-source-body-chest");
  });
});
