import { describe, expect, it } from "vitest";

import type { ProceduralArcherUpperBodyPose } from "./archer/procedural-archer-pose";
import type { ProceduralCrossbowUpperBodyPose } from "./crossbow/procedural-crossbow-pose";
import type { ProceduralMeleeUpperBodyPose } from "./melee/procedural-melee-pose";
import { resolveProceduralCharacterHandPose } from "./procedural-character-hand-pose";

describe("procedural character hand pose", () => {
  it("closes the weapon and shield hands for melee loadouts", () => {
    const pose = resolveProceduralCharacterHandPose(createMeleeAction("round-shield"));

    expect(pose.right.profile).toBe("power");
    expect(pose.left.profile).toBe("shield");
    expect(pose.right.curls.middle).toBeGreaterThan(0.9);
    expect(pose.left.curls.pinky).toBe(1);
  });

  it("leaves an empty melee offhand relaxed", () => {
    const pose = resolveProceduralCharacterHandPose(createMeleeAction("none"));

    expect(pose.left.profile).toBe("open");
    expect(pose.right.profile).toBe("power");
  });

  it("uses distinct bow and string-draw grips", () => {
    const pose = resolveProceduralCharacterHandPose({
      kind: "archer",
      previewArrowVisible: true,
      drawFraction: 0.7,
    } as ProceduralArcherUpperBodyPose);

    expect(pose.left.profile).toBe("bow");
    expect(pose.right.profile).toBe("draw");
    expect(pose.right.curls.index).toBeLessThan(pose.right.curls.middle);
  });

  it("keeps both crossbow hands on their handles", () => {
    const pose = resolveProceduralCharacterHandPose({ kind: "crossbow" } as ProceduralCrossbowUpperBodyPose);

    expect(pose.left.profile).toBe("support");
    expect(pose.right.profile).toBe("support");
  });
});

function createMeleeAction(offhandId: "none" | "round-shield"): ProceduralMeleeUpperBodyPose {
  return { kind: "melee", offhandId } as ProceduralMeleeUpperBodyPose;
}
