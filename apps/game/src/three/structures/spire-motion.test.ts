import { describe, expect, it } from "vitest";
import { spireOrbitAngle } from "./spire-motion";

describe("spire orbit", () => {
  it("starts slowly, accelerates, completes one turn and rests", () => {
    expect(spireOrbitAngle(0)).toBe(0);
    expect(spireOrbitAngle(1)).toBeGreaterThan(0);
    expect(spireOrbitAngle(1)).toBeLessThan(Math.PI / 8);
    expect(spireOrbitAngle(4) - spireOrbitAngle(3)).toBeGreaterThan(spireOrbitAngle(1));
    expect(spireOrbitAngle(8)).toBe(Math.PI * 2);
    expect(spireOrbitAngle(10)).toBe(Math.PI * 2);
    expect(spireOrbitAngle(11.99)).toBe(Math.PI * 2);
    expect(spireOrbitAngle(12)).toBe(0);
    for (let time = 0; time < 8; time += 0.1)
      expect(spireOrbitAngle(time + 0.1)).toBeGreaterThanOrEqual(spireOrbitAngle(time));
  });
});
