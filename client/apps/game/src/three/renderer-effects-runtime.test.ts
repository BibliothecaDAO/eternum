import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRenderProfile, RENDERER_PIXEL_RATIO_CAP } from "./render-profile";
import { resetRendererDiagnostics, snapshotRendererDiagnostics } from "./renderer-diagnostics";
import { createRendererBackendCapabilities } from "./renderer-backend-v2";

vi.mock("@/three/constants", () => ({
  POST_PROCESSING_CONFIG: {
    bloomIntensity: 0.4,
    brightness: 0.1,
    contrast: 0.2,
    hue: 0,
    saturation: 0.05,
    toneMapping: { exposure: 0.8, mode: "aces-filmic", whitePoint: 1.1 },
    vignette: { darkness: 0.4, offset: 0.3 },
  },
}));

const { createRendererEffectsRuntime } = await import("./renderer-effects-runtime");

describe("renderer effects runtime", () => {
  beforeEach(() => {
    resetRendererDiagnostics();
    vi.stubGlobal("window", { devicePixelRatio: 2, innerHeight: 768, innerWidth: 1024 });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("applies the one visual profile through the backend and every scene", async () => {
    const backend = createBackend();
    const scenes = createScenes();
    const runtime = createRuntime(backend, scenes);

    await runtime.applyEnvironment();
    runtime.setupPostProcessingEffects(createRenderProfile("quality").visuals);
    runtime.applyRenderVisualProfile(createRenderProfile("battery").visuals);

    expect(backend.applyEnvironment).toHaveBeenCalledWith({
      fastTravelScene: scenes.fastTravelScene,
      hexceptionScene: scenes.hexceptionScene,
      intensity: 0.55,
      worldmapScene: scenes.worldmapScene,
    });
    expect(backend.applyRenderVisuals).toHaveBeenCalledWith({
      height: 768,
      pixelRatio: RENDERER_PIXEL_RATIO_CAP,
      shadows: true,
      width: 1024,
    });
    expect(scenes.worldmapScene.applyRenderVisualProfile).toHaveBeenCalledTimes(1);
    expect(scenes.fastTravelScene.applyRenderVisualProfile).toHaveBeenCalledTimes(1);
    expect(scenes.hexceptionScene.applyRenderVisualProfile).toHaveBeenCalledTimes(1);
  });

  it("reports unsupported environment ownership explicitly", async () => {
    const backend = createBackend();
    backend.capabilities = createRendererBackendCapabilities({ supportsToneMappingControl: true });
    const runtime = createRuntime(backend, createScenes());

    await runtime.applyEnvironment();

    expect(backend.applyEnvironment).not.toHaveBeenCalled();
    expect(snapshotRendererDiagnostics().degradations).toContainEqual({
      detail: expect.any(String),
      feature: "environmentIbl",
      reason: "unsupported-backend",
    });
  });

  it("uses backend-neutral tone mapping names", () => {
    const runtime = createRuntime(createBackend(), createScenes());
    expect(runtime.resolveRendererToneMappingMode("aces-filmic")).toBe("aces-filmic");
    expect(runtime.resolveRendererToneMappingMode("linear")).toBe("linear");
    expect(runtime.resolveRendererToneMappingMode("neutral")).toBe("neutral");
    expect(runtime.resolveRendererToneMappingMode("reinhard")).toBe("reinhard");
    expect(runtime.resolveRendererToneMappingMode("cineon")).toBe("cineon");
  });
});

function createRuntime(backend: ReturnType<typeof createBackend>, scenes: ReturnType<typeof createScenes>) {
  return createRendererEffectsRuntime({
    backend: backend as never,
    createFolder: vi.fn(() => ({ add: vi.fn(), close: vi.fn() })),
    isGraphicsDevEnabled: false,
    scenes: scenes as never,
  });
}

function createBackend() {
  return {
    applyEnvironment: vi.fn(async () => {}),
    applyPostProcessPlan: vi.fn(() => ({ setColorGrade: vi.fn(), setVignette: vi.fn() })),
    applyRenderVisuals: vi.fn(),
    capabilities: createRendererBackendCapabilities({
      supportsBloom: true,
      supportsChromaticAberration: true,
      supportsColorGrade: true,
      supportsEnvironmentIbl: true,
      supportsToneMappingControl: true,
      supportsVignette: true,
    }),
    renderer: {
      info: {
        memory: { geometries: 0, textures: 0 },
        render: { calls: 0, triangles: 0 },
        reset: vi.fn(),
      },
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      shadowMap: { enabled: true },
    },
  };
}

function createScenes() {
  return {
    fastTravelScene: { applyRenderVisualProfile: vi.fn(), setEnvironment: vi.fn() },
    hexceptionScene: { applyRenderVisualProfile: vi.fn(), setEnvironment: vi.fn() },
    worldmapScene: { applyRenderVisualProfile: vi.fn(), setEnvironment: vi.fn() },
  };
}
