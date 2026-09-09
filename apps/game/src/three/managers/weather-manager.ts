import type GUI from "lil-gui";
import { WindSystem } from "@/three/systems/wind-system";

export enum WeatherType {
  SUNNY = "sunny",
  CLOUDY = "cloudy",
  RAIN = "rainy",
  STORM = "stormy",
}

type WeatherPhase = "clear" | "approaching" | "arriving" | "peak" | "departing";
interface WeatherLighting {
  intensity: number;
  rainIntensity: number;
  stormIntensity: number;
  fogDensity: number;
  skyDarkness: number;
  sunOcclusion: number;
  ambientBoost: number;
}
export interface WeatherState extends WeatherLighting {
  windX: number;
  windZ: number;
  type: WeatherType;
  phase: WeatherPhase;
  isTransitioning: boolean;
  phaseProgress: number;
}
interface WeatherProfile {
  lighting: WeatherLighting;
  dwell: readonly [number, number];
  transitionSeconds: number;
  next: readonly WeatherType[];
}

// One weather state drives lighting, rain, lightning, wind and ambience.
const WEATHER: Record<WeatherType, WeatherProfile> = {
  [WeatherType.SUNNY]: {
    lighting: {
      intensity: 0,
      rainIntensity: 0,
      stormIntensity: 0,
      fogDensity: 0,
      skyDarkness: 0,
      sunOcclusion: 0,
      ambientBoost: 0,
    },
    dwell: [180, 420],
    transitionSeconds: 35,
    next: [WeatherType.CLOUDY],
  },
  [WeatherType.CLOUDY]: {
    lighting: {
      intensity: 0.45,
      rainIntensity: 0,
      stormIntensity: 0,
      fogDensity: 0.2,
      skyDarkness: 0.3,
      sunOcclusion: 0.5,
      ambientBoost: 0.12,
    },
    dwell: [90, 240],
    transitionSeconds: 25,
    next: [WeatherType.SUNNY, WeatherType.SUNNY, WeatherType.RAIN, WeatherType.RAIN, WeatherType.STORM],
  },
  [WeatherType.RAIN]: {
    lighting: {
      intensity: 0.7,
      rainIntensity: 0.7,
      stormIntensity: 0,
      fogDensity: 0.45,
      skyDarkness: 0.55,
      sunOcclusion: 0.75,
      ambientBoost: 0.16,
    },
    dwell: [90, 180],
    transitionSeconds: 30,
    next: [WeatherType.CLOUDY, WeatherType.CLOUDY, WeatherType.STORM],
  },
  [WeatherType.STORM]: {
    lighting: {
      intensity: 0.95,
      rainIntensity: 1,
      stormIntensity: 1,
      fogDensity: 0.6,
      skyDarkness: 0.75,
      sunOcclusion: 1,
      ambientBoost: 0.22,
    },
    dwell: [45, 100],
    transitionSeconds: 40,
    next: [WeatherType.RAIN, WeatherType.RAIN, WeatherType.CLOUDY],
  },
};
const LIGHTING_FIELDS = Object.keys(WEATHER[WeatherType.SUNNY].lighting) as Array<keyof WeatherLighting>;
const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export class WeatherManager {
  private readonly windSystem: WindSystem;
  private target = WeatherType.SUNNY;
  private from: WeatherLighting = { ...WEATHER[WeatherType.SUNNY].lighting };
  private transitionElapsed = 0;
  private dwellRemaining = 0;
  private readonly params = { evolving: true };
  private readonly state: WeatherState = {
    windX: 0,
    windZ: 0,
    ...WEATHER[WeatherType.SUNNY].lighting,
    type: WeatherType.SUNNY,
    phase: "clear",
    isTransitioning: false,
    phaseProgress: 1,
  };

  constructor(windSystem?: WindSystem) {
    this.windSystem = windSystem ?? new WindSystem();
    this.scheduleNextWeather();
  }

  update(deltaTime: number): void {
    this.advanceWeather(Math.max(0, deltaTime));
    this.windSystem.update(deltaTime, this.state.intensity);
    const wind = this.windSystem.getState();
    this.state.windX = wind.direction.x * wind.effectiveSpeed;
    this.state.windZ = wind.direction.y * wind.effectiveSpeed;
  }

  private advanceWeather(delta: number): void {
    if (this.state.isTransitioning) {
      this.updateTransition(delta);
      return;
    }
    if (!this.params.evolving) return;
    this.dwellRemaining -= delta;
    if (this.dwellRemaining <= 0) this.chooseNextWeather();
  }

  private chooseNextWeather(): void {
    const candidates = WEATHER[this.target].next;
    this.transitionToWeather(candidates[Math.floor(Math.random() * candidates.length)]);
  }

  private scheduleNextWeather(): void {
    const [min, max] = WEATHER[this.target].dwell;
    this.dwellRemaining = min + Math.random() * (max - min);
  }

  private updateTransition(delta: number): void {
    this.transitionElapsed += delta;
    const profile = WEATHER[this.target];
    const progress = Math.min(1, this.transitionElapsed / profile.transitionSeconds);
    for (const field of LIGHTING_FIELDS) {
      // Clouds build first when rain or lightning is increasing; fading starts immediately.
      const delay =
        profile.lighting[field] > this.from[field]
          ? field === "rainIntensity"
            ? 0.35
            : field === "stormIntensity"
              ? 0.6
              : 0
          : 0;
      const weight = ease((progress - delay) / (1 - delay));
      this.state[field] = this.from[field] + (profile.lighting[field] - this.from[field]) * weight;
    }
    this.state.phaseProgress = progress;
    this.state.phase = this.target === WeatherType.SUNNY ? "departing" : progress < 0.35 ? "approaching" : "arriving";
    if (progress === 1) this.settleWeather();
  }

  private settleWeather(): void {
    Object.assign(this.state, WEATHER[this.target].lighting, {
      type: this.target,
      phase: this.target === WeatherType.SUNNY ? "clear" : "peak",
      isTransitioning: false,
      phaseProgress: 1,
    });
    this.scheduleNextWeather();
  }

  transitionToWeather(type: WeatherType): void {
    if (type === this.target) return;
    this.from = { ...this.state };
    this.target = type;
    this.transitionElapsed = 0;
    this.state.isTransitioning = true;
    this.state.phaseProgress = 0;
    this.state.phase = type === WeatherType.SUNNY ? "departing" : "approaching";
  }

  /** Forced previews hold their weather until evolution is enabled again. */
  setWeather(type: WeatherType): void {
    this.params.evolving = false;
    this.target = type;
    this.settleWeather();
  }

  setEvolving(enabled: boolean): void {
    this.params.evolving = enabled;
    this.scheduleNextWeather();
  }
  getState(): WeatherState {
    return this.state;
  }
  getWindState() {
    return this.windSystem.getState();
  }
  getCurrentWeather(): WeatherType {
    return this.state.type;
  }

  addGUIControls(folder: GUI): void {
    const weather = folder.addFolder("Weather");
    weather.add(this.params, "evolving").name("Evolving weather").listen();
    weather
      .add({ type: this.target }, "type", Object.values(WeatherType))
      .name("Force weather")
      .onChange((type: WeatherType) => this.setWeather(type));
    weather.add({ next: () => this.chooseNextWeather() }, "next").name("Next weather front");
    this.windSystem.addGUIControls(weather);
    weather.close();
  }

  dispose(): void {
    this.windSystem.dispose();
  }
}
