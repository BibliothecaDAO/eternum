import { describe, expect, it } from "vitest";

import { resolveProceduralCrossbowCarryPose } from "./procedural-crossbow-pose";

describe("procedural crossbow carry pose", () => {
  it("is deterministic and keeps organic carry motion restrained", () => {
    const first = resolveProceduralCrossbowCarryPose(1.25, 1337);
    const second = resolveProceduralCrossbowCarryPose(1.25, 1337);

    expect(first).toEqual(second);
    expect(first.kind).toBe("crossbow");
    expect(Math.abs(first.lift)).toBeLessThanOrEqual(0.008);
    expect(Math.abs(first.swayRadians)).toBeLessThanOrEqual(0.018);
  });
});
