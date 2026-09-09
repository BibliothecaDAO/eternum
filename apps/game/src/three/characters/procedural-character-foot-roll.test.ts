import { describe, expect, it } from "vitest";
import { resolveWalkingFootRoll } from "./procedural-character-foot-roll";

const geometry = { ankleHeight: 0.11, heelLength: 0.074, ballLength: 0.185 };

describe("walking foot rollover", () => {
  it("loads the heel, plants the sole, then pushes over the forefoot", () => {
    expect(resolveWalkingFootRoll({ contact: "stance", progress: 0 }, geometry).contactKind).toBe("heel");
    expect(resolveWalkingFootRoll({ contact: "stance", progress: 0.4 }, geometry).contactKind).toBe("sole");
    const push = resolveWalkingFootRoll({ contact: "stance", progress: 0.95 }, geometry);
    expect(push.contactKind).toBe("forefoot");
    expect(push.ankleOffset[1]).toBeGreaterThan(geometry.ankleHeight + 0.06);
    expect(push.toeFlexRadians).toBe(push.pitchRadians);
  });

  it("keeps the active heel or forefoot stationary while the ankle rotates around it", () => {
    for (let step = 0; step <= 100; step++) {
      const roll = resolveWalkingFootRoll({ contact: "stance", progress: step / 100 }, geometry);
      const pivotZ =
        roll.contactKind === "heel" ? -geometry.heelLength : roll.contactKind === "forefoot" ? geometry.ballLength : 0;
      const y =
        roll.ankleOffset[1] - geometry.ankleHeight * Math.cos(roll.pitchRadians) - pivotZ * Math.sin(roll.pitchRadians);
      const z =
        roll.ankleOffset[2] - geometry.ankleHeight * Math.sin(roll.pitchRadians) + pivotZ * Math.cos(roll.pitchRadians);
      expect(y).toBeCloseTo(0, 10);
      expect(z).toBeCloseTo(pivotZ, 10);
    }
  });

  it("joins lift-off and touchdown continuously without carrying pose history", () => {
    for (const [from, to] of [
      ["stance", "swing"],
      ["swing", "stance"],
    ] as const) {
      const end = resolveWalkingFootRoll({ contact: from, progress: 1 }, geometry);
      const start = resolveWalkingFootRoll({ contact: to, progress: 0 }, geometry);
      expect(end.pitchRadians).toBeCloseTo(start.pitchRadians, 10);
      expect(end.toeFlexRadians).toBeCloseTo(start.toeFlexRadians, 10);
      end.ankleOffset.forEach((value, axis) => expect(start.ankleOffset[axis]).toBeCloseTo(value, 10));
    }
  });
});
