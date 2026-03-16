import { describe, expect, it } from "vitest";
import { resolveFogPolicy } from "./fog-policy";

describe("resolveFogPolicy", () => {
  it("enables fog by default for supported quality tiers", () => {
    expect(
      resolveFogPolicy({
        cameraFar: 120,
        cameraView: "medium",
        qualityEnabled: true,
        weatherFogFactor: 0,
      }),
    ).toMatchObject({
      enabled: true,
    });
  });

  it("disables fog in close view to preserve readability", () => {
    expect(
      resolveFogPolicy({
        cameraFar: 120,
        cameraView: "close",
        qualityEnabled: true,
        weatherFogFactor: 0.8,
      }),
    ).toEqual({
      enabled: false,
      far: null,
      near: null,
      reason: "camera-close",
    });
  });

  it("pulls the fog range inward as storm intensity increases", () => {
    const clear = resolveFogPolicy({
      cameraFar: 120,
      cameraView: "far",
      qualityEnabled: true,
      weatherFogFactor: 0,
    });
    const storm = resolveFogPolicy({
      cameraFar: 120,
      cameraView: "far",
      qualityEnabled: true,
      weatherFogFactor: 0.9,
    });

    expect(clear.enabled).toBe(true);
    expect(storm.enabled).toBe(true);
    expect(storm.near).toBeLessThan(clear.near);
    expect(storm.far).toBeLessThan(clear.far);
  });

  it("reports low-quality fog disablement intentionally", () => {
    expect(
      resolveFogPolicy({
        cameraFar: 120,
        cameraView: "medium",
        qualityEnabled: false,
        weatherFogFactor: 0.6,
      }),
    ).toEqual({
      enabled: false,
      far: null,
      near: null,
      reason: "quality-disabled",
    });
  });
});
