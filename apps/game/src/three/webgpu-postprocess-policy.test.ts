import { describe, expect, it } from "vitest";

import { createRendererBackendCapabilities } from "./renderer-backend-v2";
import { resolveWebgpuPostprocessPolicy } from "./webgpu-postprocess-policy";

describe("resolveWebgpuPostprocessPolicy", () => {
  it("reports the native webgpu lane as a postprocess graph once tone mapping parity is implemented", () => {
    expect(
      resolveWebgpuPostprocessPolicy({
        activeMode: "webgpu",
        capabilities: createRendererBackendCapabilities({
          supportsToneMappingControl: true,
        }),
      }),
    ).toEqual({
      bloomRouting: "deferred",
      mode: "native-webgpu-minimal",
      unsupportedFeatures: ["bloom", "chromaticAberration", "colorGrade", "environmentIbl", "vignette"],
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
      unsupportedFeatures: [],
    });
  });
});
