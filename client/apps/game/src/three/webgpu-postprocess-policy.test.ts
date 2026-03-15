import { describe, expect, it, vi } from "vitest";

import { createRendererBackendCapabilities } from "./renderer-backend-v2";
import { resolveWebgpuPostprocessPolicy } from "./webgpu-postprocess-policy";
import { requestRendererScenePrewarm } from "./webgpu-postprocess-policy";

describe("resolveWebgpuPostprocessPolicy", () => {
  it("keeps the full post stack in legacy webgl mode", () => {
    expect(
      resolveWebgpuPostprocessPolicy({
        activeMode: "legacy-webgl",
        capabilities: createRendererBackendCapabilities({
          supportsBloom: true,
          supportsChromaticAberration: true,
          supportsColorGrade: true,
          supportsEnvironmentIbl: true,
          supportsToneMappingControl: true,
          supportsVignette: true,
        }),
      }),
    ).toEqual({
      mode: "legacy-webgl-postprocess",
      prewarmStrategy: "compile-async",
      unsupportedFeatures: [],
    });
  });

  it("reports the native webgpu lane as minimal until parity features are implemented", () => {
    expect(
      resolveWebgpuPostprocessPolicy({
        activeMode: "webgpu",
        capabilities: createRendererBackendCapabilities(),
      }),
    ).toEqual({
      mode: "native-webgpu-minimal",
      prewarmStrategy: "compile-async",
      unsupportedFeatures: ["bloom", "chromaticAberration", "colorGrade", "environmentIbl", "toneMappingControl", "vignette"],
    });
  });

  it("treats forced webgl fallback as a full postprocess lane again", () => {
    expect(
      resolveWebgpuPostprocessPolicy({
        activeMode: "webgl2-fallback",
        capabilities: createRendererBackendCapabilities({
          supportsBloom: true,
          supportsChromaticAberration: true,
          supportsColorGrade: true,
          supportsEnvironmentIbl: true,
          supportsToneMappingControl: true,
          supportsVignette: true,
        }),
      }),
    ).toEqual({
      mode: "webgl2-fallback-postprocess",
      prewarmStrategy: "compile-async",
      unsupportedFeatures: [],
    });
  });

  it("requests async scene compilation when the renderer exposes compileAsync", async () => {
    const compileAsync = vi.fn(async () => {});

    await requestRendererScenePrewarm(
      {
        compileAsync,
      } as never,
      { id: "scene" } as never,
      { id: "camera" } as never,
    );

    expect(compileAsync).toHaveBeenCalledWith({ id: "scene" }, { id: "camera" });
  });
});
