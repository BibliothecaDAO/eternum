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
      bloomRouting: "none",
      mode: "legacy-webgl-postprocess",
      prewarmStrategy: "compile-async",
      unsupportedFeatures: [],
    });
  });

  it("reports the native webgpu lane as a postprocess graph once tone mapping parity is implemented", () => {
    expect(
      resolveWebgpuPostprocessPolicy({
        activeMode: "webgpu",
        capabilities: createRendererBackendCapabilities({
        }),
      }),
    ).toEqual({
      bloomRouting: "deferred",
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
      bloomRouting: "none",
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

  it("calls compileAsync with correct this binding on class-based renderer instances", async () => {
    class FakeRenderer {
      compileAsync = vi.fn(async function (this: FakeRenderer) {
        // If `this` is not the renderer instance, this assertion will fail
        expect(this).toBeInstanceOf(FakeRenderer);
      });
    }

    const renderer = new FakeRenderer();

    await requestRendererScenePrewarm(
      renderer as never,
      { id: "scene" } as never,
      { id: "camera" } as never,
    );

    expect(renderer.compileAsync).toHaveBeenCalledOnce();
    expect(renderer.compileAsync).toHaveBeenCalledWith({ id: "scene" }, { id: "camera" });
  });

  it("no-ops when renderer is undefined", async () => {
    // Should resolve without throwing
    await expect(
      requestRendererScenePrewarm(undefined, { id: "scene" } as never, { id: "camera" } as never),
    ).resolves.toBeUndefined();
  });

  it("no-ops when renderer does not expose compileAsync", async () => {
    const renderer = { someOtherMethod: vi.fn() };

    await expect(
      requestRendererScenePrewarm(renderer as never, { id: "scene" } as never, { id: "camera" } as never),
    ).resolves.toBeUndefined();

    expect(renderer.someOtherMethod).not.toHaveBeenCalled();
  });
});
