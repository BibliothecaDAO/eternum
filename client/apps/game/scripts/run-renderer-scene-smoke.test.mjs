// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildSceneSmokeUrl,
  GLOW_REPRO_SCENES,
  GLOW_REPRO_TARGETS,
  evaluateRendererParitySummary,
  evaluateSceneSmokeResult,
  normalizeRendererDiagnosticsSnapshot,
  normalizeSceneList,
} from "./run-renderer-scene-smoke.mjs";

describe("glow repro matrix", () => {
  it("locks the named scenes and targets used for glow regression review", () => {
    expect(GLOW_REPRO_SCENES).toEqual(["map", "travel"]);
    expect(GLOW_REPRO_TARGETS).toEqual([
      "Essence Rift / FragmentMine emissive structures",
      "Fast-travel accent surfaces",
      "World FX emissive icons",
    ]);
  });
});

describe("normalizeSceneList", () => {
  it("defaults to world and hex scenes when no explicit scene list is provided", () => {
    expect(normalizeSceneList("")).toEqual(["map", "hex"]);
  });

  it("parses comma-separated scenes and preserves the declared order", () => {
    expect(normalizeSceneList("map,travel,hex")).toEqual(["map", "travel", "hex"]);
  });
});

describe("buildSceneSmokeUrl", () => {
  it("builds the worldmap spectate url with renderer mode overrides", () => {
    expect(
      buildSceneSmokeUrl({
        baseUrl: "https://127.0.0.1:4173",
        rendererMode: "experimental-webgpu-auto",
        scene: "map",
      }),
    ).toBe("https://127.0.0.1:4173/play/map?col=0&row=0&spectate=true&rendererMode=experimental-webgpu-auto");
  });

  it("builds the hexception url without spectate mode", () => {
    expect(
      buildSceneSmokeUrl({
        baseUrl: "https://127.0.0.1:4173",
        rendererMode: "legacy-webgl",
        scene: "hex",
      }),
    ).toBe("https://127.0.0.1:4173/play/hex?col=0&row=0&rendererMode=legacy-webgl");
  });
});

describe("evaluateSceneSmokeResult", () => {
  it("accepts a scene when the browser lands on the expected route and the canvas is present", () => {
    expect(
      evaluateSceneSmokeResult({
        canvasExists: true,
        errors: [],
        expectedPathname: "/play/map",
        openedUrl: "https://127.0.0.1:4173/play/map?col=0&row=0&spectate=true",
        unableToStartCount: 0,
      }),
    ).toEqual({
      ok: true,
      reasons: [],
    });
  });

  it("reports all failing assertions together", () => {
    expect(
      evaluateSceneSmokeResult({
        canvasExists: false,
        errors: ["Error creating WebGL context"],
        expectedPathname: "/play/hex",
        openedUrl: "https://127.0.0.1:4173/play/map?col=0&row=0",
        unableToStartCount: 1,
      }),
    ).toEqual({
      ok: false,
      reasons: [
        "landed on unexpected route",
        "main canvas was not present",
        "\"Unable to Start\" was visible",
        "browser reported runtime errors",
      ],
    });
  });
});

describe("normalizeRendererDiagnosticsSnapshot", () => {
  it("fills missing diagnostics fields with explicit null and empty defaults", () => {
    expect(normalizeRendererDiagnosticsSnapshot(null)).toEqual({
      activeMode: null,
      buildMode: null,
      capabilities: null,
      degradations: [],
      effectPlan: null,
      fallbackReason: null,
      fallbacks: 0,
      initErrors: 0,
      initTimeMs: null,
      postprocessPolicy: null,
      requestedMode: null,
      sceneName: null,
    });
  });
});

describe("evaluateRendererParitySummary", () => {
  it("treats unsupported required features as blockers and optional fx as advisory", () => {
    expect(
      evaluateRendererParitySummary({
        activeMode: "webgpu",
        buildMode: "experimental-webgpu-auto",
        capabilities: {
          supportsBloom: false,
          supportsChromaticAberration: false,
          supportsColorGrade: false,
          supportsEnvironmentIbl: false,
          supportsToneMappingControl: true,
          supportsVignette: false,
          supportsWideLines: false,
        },
        degradations: [
          { feature: "environmentIbl", reason: "unsupported-backend" },
          { feature: "bloom", reason: "unsupported-backend" },
        ],
        effectPlan: null,
        fallbackReason: null,
        fallbacks: 0,
        initErrors: 0,
        initTimeMs: 18,
        postprocessPolicy: {
          bloomRouting: "mrt-emissive",
          mode: "native-webgpu-postprocess",
          prewarmStrategy: "compile-async",
          unsupportedFeatures: ["environmentIbl"],
        },
        requestedMode: "experimental-webgpu-auto",
        sceneName: "worldmap",
      }),
    ).toEqual({
      advisory: [],
      blocking: [
        { feature: "environmentIbl", reason: "unsupported-backend" },
        { feature: "bloom", reason: "unsupported-backend" },
      ],
      ok: false,
    });
  });
});
