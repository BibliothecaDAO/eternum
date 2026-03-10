import { WeatherType } from "./weather-manager";

interface ResolveAmbienceWeatherTypeParams {
  currentWeather: WeatherType;
  weatherIntensity: number;
  rainIntensity: number;
  stormIntensity: number;
}

export function resolveAmbienceWeatherType({
  currentWeather,
  rainIntensity,
  stormIntensity,
}: ResolveAmbienceWeatherTypeParams): WeatherType {
  if (stormIntensity > 0.3) return WeatherType.STORM;
  if (rainIntensity > 0.1) return WeatherType.RAIN;
  return currentWeather;
}
