import { Scene, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { WeatherManager, WeatherType } from "./weather-manager";

describe("weather-manager", () => {
  it("derives ambient boost from clear, cloudy buildup, rain, and storm intensity", () => {
    const rainEffect = {
      setEnabled: () => {},
      setWindFromSystem: () => {},
      setIntensity: () => {},
      update: () => {},
    };

    const manager = new WeatherManager(new Scene(), rainEffect as any);

    expect(manager.getState().ambientBoost).toBe(0);

    manager.transitionToWeather(WeatherType.RAIN);
    manager.update(10, new Vector3());
    expect(manager.getState().ambientBoost).toBeGreaterThan(0);
    expect(manager.getState().ambientBoost).toBeLessThanOrEqual(0.1);

    manager.update(10, new Vector3());
    manager.update(1, new Vector3());
    expect(manager.getState().ambientBoost).toBeGreaterThanOrEqual(0.1);

    manager.setWeather(WeatherType.RAIN);
    expect(manager.getState().ambientBoost).toBeCloseTo(0.16);

    manager.setWeather(WeatherType.STORM);
    expect(manager.getState().ambientBoost).toBeCloseTo(0.22);
  });

  it("fades rain and storm intensity during departing phase", () => {
    const rainEffect = {
      setEnabled: () => {},
      setWindFromSystem: () => {},
      setIntensity: () => {},
      update: () => {},
    };

    const manager = new WeatherManager(new Scene(), rainEffect as any);

    manager.setWeather(WeatherType.STORM);
    manager.clearWeather();
    manager.update(0.1, new Vector3());

    const state = manager.getState();

    expect(state.phase).toBe("departing");
    expect(state.rainIntensity).toBeGreaterThan(0);
    expect(state.stormIntensity).toBeGreaterThan(0);
  });
});
