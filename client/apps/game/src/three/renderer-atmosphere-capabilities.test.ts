import { describe, expect, it } from "vitest";
import { createRendererBackendCapabilities } from "./renderer-backend-v2";

describe("renderer atmosphere capability surface", () => {
  it("publishes atmosphere-specific capability truth alongside the existing renderer flags", () => {
    expect(
      createRendererBackendCapabilities({
        fallbackLightingMode: "no-ibl-balanced-rig",
        supportsColorGrade: false,
        supportsEnvironmentIbl: false,
        supportsToneMappingControl: false,
        supportsWeatherColorPostFx: false,
        supportsWorldWeatherFx: true,
      }),
    ).toMatchObject({
      fallbackLightingMode: "no-ibl-balanced-rig",
      supportsEnvironmentIbl: false,
      supportsWeatherColorPostFx: false,
      supportsWorldWeatherFx: true,
    });
  });
});
