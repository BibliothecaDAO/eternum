import { Quaternion } from "three";
import { describe, expect, it } from "vitest";

import { resolveHumanoidRigRequiredBoneNames, validateHumanoidRigAdapter } from "./humanoid-rig-adapter";
import { resolveHumanoidRigAdapter } from "./humanoid-rig-adapters";
import { BASTION_KNIGHT_HUMANOID_RIG_ADAPTER } from "./bastion-knight-humanoid-rig-adapter";

describe("T1 Knight rig adapter", () => {
  it("registers the normalized minimal-hand rig and its optional forearm socket", () => {
    const adapter = resolveHumanoidRigAdapter("t1-knight-bastion-v1");
    expect(adapter).toBe(BASTION_KNIGHT_HUMANOID_RIG_ADAPTER);
    expect(validateHumanoidRigAdapter(adapter)).toEqual([]);
    expect(resolveHumanoidRigRequiredBoneNames(adapter)).toContain("lowerarm_l");
    expect(
      resolveHumanoidRigRequiredBoneNames(adapter).some((name) => /^(index|middle|ring|pinky|thumb)_/.test(name)),
    ).toBe(false);
  });

  it("keeps measured gear rotations normalized", () => {
    for (const socket of [
      BASTION_KNIGHT_HUMANOID_RIG_ADAPTER.sockets.gripRight,
      BASTION_KNIGHT_HUMANOID_RIG_ADAPTER.sockets.forearmLeft,
    ]) {
      expect(new Quaternion().fromArray(socket.rotationOffset).length()).toBeCloseTo(1, 6);
    }
    expect(BASTION_KNIGHT_HUMANOID_RIG_ADAPTER.sockets.forearmLeft.offset.value).toEqual([
      0.02429374013366986, 0.0540103893277306, 0.00590031303859076,
    ]);
  });
});
