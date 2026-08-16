// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRenderProfile } from "./render-profile";

const { createRendererEffectsBridgeRuntime } = await import("./renderer-effects-bridge-runtime");

describe("renderer effects bridge runtime", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates the effects runtime lazily and delegates setup, environment, and profile calls", () => {
    const renderVisuals = createRenderProfile("quality").visuals;
    const effectsRuntime = createEffectsRuntimeStub();
    const createEffectsRuntime = vi.fn(() => effectsRuntime);
    const runtime = createRendererEffectsBridgeRuntime({
      createEffectsRuntime,
      resolveRenderVisualProfile: () => renderVisuals,
      resolveWeatherState: () => undefined,
    });

    runtime.setupPostProcessingEffects();
    runtime.applyRenderVisualProfile(renderVisuals);
    runtime.applyEnvironment();

    expect(createEffectsRuntime).toHaveBeenCalledTimes(1);
    expect(effectsRuntime.setupPostProcessingEffects).toHaveBeenCalledWith(renderVisuals);
    expect(effectsRuntime.applyRenderVisualProfile).toHaveBeenCalledWith(renderVisuals);
    expect(effectsRuntime.applyEnvironment).toHaveBeenCalledTimes(1);
  });

  it("only forwards weather updates after the effects runtime exists", () => {
    const weatherState = { intensity: 0.5, stormIntensity: 0.3 };
    const effectsRuntime = createEffectsRuntimeStub();
    const createEffectsRuntime = vi.fn(() => effectsRuntime);
    const runtime = createRendererEffectsBridgeRuntime({
      createEffectsRuntime,
      resolveRenderVisualProfile: () => createRenderProfile("quality").visuals,
      resolveWeatherState: () => weatherState,
    });

    runtime.updateWeatherPostProcessing();
    expect(createEffectsRuntime).not.toHaveBeenCalled();

    runtime.applyEnvironment();
    runtime.updateWeatherPostProcessing();
    expect(effectsRuntime.updateWeatherPostProcessing).toHaveBeenCalledWith(weatherState);
  });
});

function createEffectsRuntimeStub() {
  return {
    applyEnvironment: vi.fn(async () => {}),
    applyRenderVisualProfile: vi.fn(),
    hasPostProcessing: vi.fn(() => true),
    resolveRendererToneMappingMode: vi.fn(() => "aces-filmic" as const),
    setupPostProcessingEffects: vi.fn(),
    updateWeatherPostProcessing: vi.fn(),
  };
}
