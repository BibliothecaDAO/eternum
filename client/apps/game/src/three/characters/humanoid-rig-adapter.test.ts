import { describe, expect, it } from "vitest";

import { resolveHumanoidRigRequiredBoneNames, validateHumanoidRigAdapter } from "./humanoid-rig-adapter";
import { QUATERNIUS_HUMANOID_RIG_ADAPTER } from "./quaternius-humanoid-rig-adapter";

describe("humanoid rig adapter", () => {
  it("maps every canonical pose, diagnostic, hand, foot, and socket role", () => {
    const adapter = QUATERNIUS_HUMANOID_RIG_ADAPTER;
    const requiredBones = resolveHumanoidRigRequiredBoneNames(adapter);

    expect(validateHumanoidRigAdapter(adapter)).toEqual([]);
    expect(adapter.partBindings.thighLeft).toEqual({ bone: "thigh_l", childBone: "calf_l", stable: true });
    expect(adapter.diagnosticBones.kneeRight).toBe("calf_r");
    expect(adapter.feet.left).toEqual({ ankle: "foot_l", toe: "ball_l" });
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
});
