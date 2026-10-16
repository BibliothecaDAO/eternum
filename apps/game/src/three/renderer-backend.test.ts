import { describe, expect, it } from "vitest";
import { createRendererBackendCapabilities, createRendererInitDiagnostics } from "./renderer-backend";

describe("createRendererInitDiagnostics", () => {
  it("defaults fallback reason and counters consistently", () => {
    expect(
      createRendererInitDiagnostics({
        activeMode: "webgl2-fallback",
        buildMode: "webgpu-force-webgl",
        requestedMode: "webgpu-force-webgl",
      }),
    ).toEqual({
      activeMode: "webgl2-fallback",
      buildMode: "webgpu-force-webgl",
      fallbackReason: null,
      initTimeMs: 0,
      requestedMode: "webgpu-force-webgl",
    });
  });
});

describe("createRendererBackendCapabilities", () => {
  it("defaults every declared capability to false", () => {
    expect(createRendererBackendCapabilities()).toEqual({
      supportsBloom: false,
      supportsChromaticAberration: false,
      supportsColorGrade: false,
      supportsEnvironmentIbl: false,
      supportsToneMappingControl: false,
      supportsVignette: false,
      supportsWideLines: false,
    });
  });

  it("merges explicit capability truth over the conservative defaults", () => {
    expect(
      createRendererBackendCapabilities({
        supportsColorGrade: true,
        supportsEnvironmentIbl: true,
        supportsToneMappingControl: true,
      }),
    ).toEqual({
      supportsBloom: false,
      supportsChromaticAberration: false,
      supportsColorGrade: true,
      supportsEnvironmentIbl: true,
      supportsToneMappingControl: true,
      supportsVignette: false,
      supportsWideLines: false,
    });
  });
});
