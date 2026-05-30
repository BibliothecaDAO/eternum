import { Scene, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { WeatherManager, WeatherType } from "./weather-manager";

describe("weather-manager", () => {
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
