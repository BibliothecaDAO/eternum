import { describe, expect, it } from "vitest";
import { resolveRendererFxCapabilities } from "../renderer-fx-capabilities";
import { shouldPlayArmyMovementFx } from "./worldmap-movement-fx-policy";

describe("shouldPlayArmyMovementFx", () => {
  it("disables explore compass fx when sprite scene fx are unavailable", () => {
    expect(
      shouldPlayArmyMovementFx({
        capabilities: resolveRendererFxCapabilities({
          activeMode: "webgpu",
        }),
        movementType: "explore",
      }),
    ).toBe(false);
  });

  it("keeps travel fx enabled in native webgpu during the tactical suppression window", () => {
    expect(
      shouldPlayArmyMovementFx({
        capabilities: resolveRendererFxCapabilities({
          activeMode: "webgpu",
        }),
        movementType: "travel",
      }),
    ).toBe(true);
  });

  it("keeps explore fx enabled when sprite scene fx are supported", () => {
    expect(
      shouldPlayArmyMovementFx({
        capabilities: resolveRendererFxCapabilities({
          activeMode: "legacy-webgl",
        }),
        movementType: "explore",
      }),
    ).toBe(true);

    expect(
      shouldPlayArmyMovementFx({
        capabilities: resolveRendererFxCapabilities({
          activeMode: "webgl2-fallback",
        }),
        movementType: "explore",
      }),
    ).toBe(true);
  });
});
