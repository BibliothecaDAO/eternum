// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRendererEffectsBridgeRuntime } = await import("./renderer-effects-bridge-runtime");

function createQualityFeatures() {
  return {
    animationCullDistance: 120,
    animationFPS: 20,
    bloom: true,
    bloomIntensity: 0.2,
    chromaticAberration: false,
    chunkLoadRadius: 2,
    fxaa: true,
    labelRenderDistance: 120,
    maxVisibleArmies: 250,
    maxVisibleLabels: 200,
    maxVisibleStructures: 150,
    morphAnimations: true,
    pixelRatio: 1.5,
    shadowMapSize: 1024,
    shadows: true,
    vignette: false,
  };
}

describe("renderer effects bridge runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the effects runtime lazily and delegates setup, environment, and quality calls", async () => {
    const qualityFeatures = createQualityFeatures();
    const effectsRuntime = {
      applyEnvironment: vi.fn(async () => {}),
      applyQualityFeatures: vi.fn(),
      hasPostProcessing: vi.fn(() => true),
      resolveRendererToneMappingMode: vi.fn(() => "aces-filmic" as const),
      setupPostProcessingEffects: vi.fn(),
      updateWeatherPostProcessing: vi.fn(),
    };
    const createEffectsRuntime = vi.fn(() => effectsRuntime);
    const runtime = createRendererEffectsBridgeRuntime({
      addQualityListener: vi.fn(),
      createEffectsRuntime,
      resolveQualityFeatures: () => qualityFeatures,
      resolveWeatherState: () => undefined,
    });

    runtime.setupPostProcessingEffects();
    runtime.applyQualityFeatures(qualityFeatures);
    runtime.applyEnvironment();

    expect(createEffectsRuntime).toHaveBeenCalledTimes(1);
    expect(effectsRuntime.setupPostProcessingEffects).toHaveBeenCalledWith(qualityFeatures);
    expect(effectsRuntime.applyQualityFeatures).toHaveBeenCalledWith(qualityFeatures);
    expect(effectsRuntime.applyEnvironment).toHaveBeenCalledTimes(1);
  });

  it("subscribes once to quality changes and disposes the subscription", () => {
    const qualityFeatures = createQualityFeatures();
    const effectsRuntime = {
      applyEnvironment: vi.fn(async () => {}),
      applyQualityFeatures: vi.fn(),
      hasPostProcessing: vi.fn(() => true),
      resolveRendererToneMappingMode: vi.fn(() => "aces-filmic" as const),
      setupPostProcessingEffects: vi.fn(),
      updateWeatherPostProcessing: vi.fn(),
    };
    const unsubscribe = vi.fn();
    let listener: ((event: { currentFeatures: ReturnType<typeof createQualityFeatures> }) => void) | undefined;
    const addQualityListener = vi.fn((next) => {
      listener = next;
      return unsubscribe;
    });
    const runtime = createRendererEffectsBridgeRuntime({
      addQualityListener,
      createEffectsRuntime: () => effectsRuntime,
      resolveQualityFeatures: () => qualityFeatures,
      resolveWeatherState: () => undefined,
    });

    runtime.subscribeToQualityController();
    runtime.subscribeToQualityController();
    listener?.({ currentFeatures: qualityFeatures });
    runtime.dispose();

    expect(addQualityListener).toHaveBeenCalledTimes(1);
    expect(effectsRuntime.applyQualityFeatures).toHaveBeenCalledWith(qualityFeatures);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("only forwards weather updates when an effects runtime already exists", () => {
    const weatherState = { intensity: 0.5, stormIntensity: 0.3 };
    const effectsRuntime = {
      applyEnvironment: vi.fn(async () => {}),
      applyQualityFeatures: vi.fn(),
      hasPostProcessing: vi.fn(() => true),
      resolveRendererToneMappingMode: vi.fn(() => "aces-filmic" as const),
      setupPostProcessingEffects: vi.fn(),
      updateWeatherPostProcessing: vi.fn(),
    };
    const createEffectsRuntime = vi.fn(() => effectsRuntime);
    const runtime = createRendererEffectsBridgeRuntime({
      addQualityListener: vi.fn(),
      createEffectsRuntime,
      resolveQualityFeatures: () => createQualityFeatures(),
      resolveWeatherState: () => weatherState,
    });

    runtime.updateWeatherPostProcessing();
    expect(createEffectsRuntime).not.toHaveBeenCalled();

    runtime.applyEnvironment();
    runtime.updateWeatherPostProcessing();

    expect(createEffectsRuntime).toHaveBeenCalledTimes(1);
    expect(effectsRuntime.updateWeatherPostProcessing).toHaveBeenCalledWith(weatherState);
  });
});
