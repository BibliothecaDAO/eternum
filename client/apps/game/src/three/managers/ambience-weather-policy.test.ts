import { describe, expect, it } from "vitest";
import { WeatherType } from "./weather-manager";
import { resolveAmbienceWeatherType } from "./ambience-weather-policy";

describe("resolveAmbienceWeatherType", () => {
  it("stays clear during atmospheric buildup without rain intensity", () => {
    expect(
      resolveAmbienceWeatherType({
        currentWeather: WeatherType.CLEAR,
        weatherIntensity: 0.25,
        rainIntensity: 0,
        stormIntensity: 0,
      }),
    ).toBe(WeatherType.CLEAR);
  });

  it("switches to rain once rain intensity is active", () => {
    expect(
      resolveAmbienceWeatherType({
        currentWeather: WeatherType.CLEAR,
        weatherIntensity: 0.35,
        rainIntensity: 0.2,
        stormIntensity: 0,
      }),
    ).toBe(WeatherType.RAIN);
  });

  it("prioritizes storm when storm intensity is active", () => {
    expect(
      resolveAmbienceWeatherType({
        currentWeather: WeatherType.RAIN,
        weatherIntensity: 0.8,
        rainIntensity: 0.7,
        stormIntensity: 0.4,
      }),
    ).toBe(WeatherType.STORM);
  });
});
