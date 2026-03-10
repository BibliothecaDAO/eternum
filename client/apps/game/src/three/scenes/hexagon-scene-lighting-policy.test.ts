import { describe, expect, it } from "vitest";
import {
  applyFogDensityToRange,
  getStormFillLightMultiplier,
  getStormLightIntensity,
} from "./hexagon-scene-lighting-policy";

describe("hexagon-scene-lighting-policy", () => {
  it("disables storm point light when storm depth is negligible", () => {
    expect(getStormLightIntensity(0, 10)).toBe(0);
    expect(getStormLightIntensity(0.04, 10)).toBe(0);
  });

  it("does not flicker fill lights when storm depth is negligible", () => {
    expect(getStormFillLightMultiplier(0, 10, 2)).toBe(1);
    expect(getStormFillLightMultiplier(0.03, 10, 1.5)).toBe(1);
  });

  it("thickens fog as weather density increases", () => {
    expect(applyFogDensityToRange(20, 60, 0)).toEqual({ near: 20, far: 60 });
    expect(applyFogDensityToRange(20, 60, 0.5)).toEqual({ near: 16, far: 54 });
  });
});
