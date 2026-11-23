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
      supportsChromaticAberration: false,
      supportsEnvironmentIbl: false,
      supportsToneMappingControl: false,
      supportsWideLines: false,
    });
  });

  it("merges explicit capability truth over the conservative defaults", () => {
    expect(
      createRendererBackendCapabilities({
        supportsEnvironmentIbl: true,
        supportsToneMappingControl: true,
      }),
    ).toEqual({
      supportsChromaticAberration: false,
      supportsEnvironmentIbl: true,
      supportsToneMappingControl: true,
      supportsWideLines: false,
    });
  });
});
