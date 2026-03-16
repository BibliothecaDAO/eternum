import type { WeatherState } from "@/three/managers/weather-manager";

export type AtmosphereTimeOfDay = "deep-night" | "dawn" | "day" | "dusk" | "evening";

export interface AtmosphereSnapshot {
  cycleProgress: number;
  timeOfDay: AtmosphereTimeOfDay;
  weatherType: WeatherState["type"];
  weatherPhase: WeatherState["phase"];
  intensity: number;
  rainIntensity: number;
  stormIntensity: number;
  fogFactor: number;
  skyDarkness: number;
  sunOcclusion: number;
  windDirection: { x: number; y: number };
  windSpeed: number;
}

export function resolveAtmosphereTimeOfDay(cycleProgress: number): AtmosphereTimeOfDay {
  if (cycleProgress < 12.5) return "deep-night";
  if (cycleProgress < 25) return "dawn";
  if (cycleProgress < 62.5) return "day";
  if (cycleProgress < 75) return "dusk";
  if (cycleProgress < 87.5) return "evening";
  return "deep-night";
}

export function createAtmosphereSnapshot(input: {
  cycleProgress: number;
  weatherState: WeatherState;
  windState: {
    direction: { x: number; y: number };
    effectiveSpeed: number;
  };
}): AtmosphereSnapshot {
  const weatherIntensity = Math.max(0, Math.min(1, input.weatherState.intensity));
  const stormIntensity = Math.max(0, Math.min(1, input.weatherState.stormIntensity));
  const fogFactor = Math.max(0, Math.min(1, input.weatherState.fogDensity));

  return {
    cycleProgress: input.cycleProgress,
    fogFactor,
    intensity: weatherIntensity,
    rainIntensity: Math.max(0, Math.min(1, input.weatherState.rainIntensity)),
    skyDarkness: Math.max(0, Math.min(1, input.weatherState.skyDarkness)),
    stormIntensity,
    sunOcclusion: Math.max(0, Math.min(1, weatherIntensity * 0.75 + stormIntensity * 0.25)),
    timeOfDay: resolveAtmosphereTimeOfDay(input.cycleProgress),
    weatherPhase: input.weatherState.phase,
    weatherType: input.weatherState.type,
    windDirection: {
      x: input.windState.direction.x,
      y: input.windState.direction.y,
    },
    windSpeed: Math.max(0, input.windState.effectiveSpeed),
  };
}
