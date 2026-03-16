import { describe, expect, it } from "vitest";
import { Scene, Vector3 } from "three";
import { WeatherManager, WeatherType } from "./weather-manager";

function createRainEffectStub() {
  return {
    setEnabled: () => {},
    setWindFromSystem: () => {},
    setIntensity: () => {},
    update: () => {},
  };
}

describe("WeatherManager transition semantics", () => {
  it("clears cleanly from approaching without manufacturing rain or storm output", () => {
    const manager = new WeatherManager(new Scene(), createRainEffectStub() as never);

    manager.transitionToWeather(WeatherType.STORM);
    manager.update(5, new Vector3());
    manager.clearWeather();
    manager.update(0.1, new Vector3());

    const state = manager.getState();

    expect(state.phase).toBe("departing");
    expect(state.type).toBe(WeatherType.CLEAR);
    expect(state.rainIntensity).toBe(0);
    expect(state.stormIntensity).toBe(0);
  });

  it("retargets rain peak to storm without leaving the weather type stale at rain", () => {
    const manager = new WeatherManager(new Scene(), createRainEffectStub() as never);

    manager.setWeather(WeatherType.RAIN);
    manager.transitionToWeather(WeatherType.STORM);
    manager.update(0.1, new Vector3());

    const state = manager.getState();

    expect(state.phase).not.toBe("peak");
    expect(state.type).toBe(WeatherType.STORM);
    expect(state.stormIntensity).toBeGreaterThan(0);
  });

  it("enforces the configured minimum peak duration before departing", () => {
    const manager = new WeatherManager(new Scene(), createRainEffectStub() as never);

    manager.setWeather(WeatherType.STORM);
    manager.clearWeather();
    manager.update(0.1, new Vector3());

    expect(manager.getState().phase).toBe("peak");

    manager.update(44.5, new Vector3());
    expect(manager.getState().phase).toBe("peak");

    manager.update(1, new Vector3());
    expect(manager.getState().phase).toBe("departing");
  });
});
