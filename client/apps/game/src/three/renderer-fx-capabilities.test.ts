import { describe, expect, it } from "vitest";
import { resolveRendererFxCapabilities } from "./renderer-fx-capabilities";

describe("resolveRendererFxCapabilities", () => {
  it("chooses the webgpu-safe default before renderer diagnostics are ready", () => {
    expect(resolveRendererFxCapabilities(null)).toEqual({
      activeMode: null,
      supportsBillboardMeshFx: true,
      supportsDomLabelFx: true,
      supportsSpriteSceneFx: false,
    });
  });

  it("disables sprite scene fx in native webgpu mode", () => {
    expect(
      resolveRendererFxCapabilities({
        activeMode: "webgpu",
      }),
    ).toEqual({
      activeMode: "webgpu",
      supportsBillboardMeshFx: true,
      supportsDomLabelFx: true,
      supportsSpriteSceneFx: false,
    });
  });

  it("keeps sprite scene fx enabled in legacy and fallback renderers", () => {
    expect(
      resolveRendererFxCapabilities({
        activeMode: "legacy-webgl",
      }),
    ).toEqual({
      activeMode: "legacy-webgl",
      supportsBillboardMeshFx: true,
      supportsDomLabelFx: true,
      supportsSpriteSceneFx: true,
    });

    expect(
      resolveRendererFxCapabilities({
        activeMode: "webgl2-fallback",
      }),
    ).toEqual({
      activeMode: "webgl2-fallback",
      supportsBillboardMeshFx: true,
      supportsDomLabelFx: true,
      supportsSpriteSceneFx: true,
    });
  });
});
