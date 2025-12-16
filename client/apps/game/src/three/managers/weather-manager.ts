import { RainEffect } from "@/three/effects/rain-effect";
import { WindSystem } from "@/three/systems/wind-system";
import { Scene, Vector3 } from "three";

/**
 * Weather Types - The target weather state
 */
export enum WeatherType {
  CLEAR = "clear",
  RAIN = "rain",
  STORM = "storm",
}

/**
 * Weather Phases - The transition state within a weather change
 *
 * CLEAR: No weather effects
 * APPROACHING: Sky darkening, wind picking up, anticipation builds
 * ARRIVING: First rain drops, fog rolling in
 * PEAK: Full weather intensity
 * DEPARTING: Weather fading, clearing
 */
export enum WeatherPhase {
  CLEAR = "clear",
  APPROACHING = "approaching",
  ARRIVING = "arriving",
  PEAK = "peak",
  DEPARTING = "departing",
}

/**
 * Weather state snapshot for external consumers
 */
export interface WeatherState {
  /** Current weather type */
  type: WeatherType;
  /** Current phase in the weather transition */
  phase: WeatherPhase;
  /** Overall weather intensity 0-1 (0 = clear, 1 = storm peak) */
  intensity: number;
  /** Rain-specific intensity 0-1 */
  rainIntensity: number;
  /** Storm-specific intensity 0-1 (higher than rain for lightning, etc.) */
  stormIntensity: number;
  /** Fog density modifier 0-1 */
  fogDensity: number;
  /** Sky darkness modifier 0-1 */
  skyDarkness: number;
  /** Is weather currently transitioning */
  isTransitioning: boolean;
  /** Progress through current phase 0-1 */
  phaseProgress: number;
}

/**
 * Phase timing configuration
 */
interface PhaseTiming {
  /** Duration in seconds */
  duration: number;
  /** Easing curve: "linear" | "easeIn" | "easeOut" | "easeInOut" */
  easing: "linear" | "easeIn" | "easeOut" | "easeInOut";
}

/**
 * Weather configuration
 */
interface WeatherConfig {
  /** Timings for transitioning TO weather (from clear) */
  approachDuration: number;
  arriveDuration: number;
  /** Minimum time at peak before weather can start departing */
  peakMinDuration: number;
  /** Timings for clearing weather */
  departDuration: number;
  /** Rain intensity at peak (0-1) */
  peakRainIntensity: number;
  /** Storm intensity multiplier */
  stormMultiplier: number;
}

interface WeatherManagerParams {
  autoChange: boolean;
  autoChangeInterval: number;
  peakDuration: number;
}

/**
 * WeatherManager - Atmospheric weather system with multi-phase transitions
 *
 * Key features:
 * - Weather arrives gradually through phases (approach → arrive → peak → depart)
 * - Single intensity float drives all systems (rain, fog, audio, post-processing)
 * - Integrates with WindSystem for coherent atmospheric effects
 * - Exposes state for external consumers
 *
 * Weather doesn't flip, it arrives. Storms build anticipation.
 */
export class WeatherManager {
  private scene: Scene;
  private rainEffect: RainEffect;
  private windSystem: WindSystem;

  // Current state
  private currentType: WeatherType = WeatherType.CLEAR;
  private targetType: WeatherType = WeatherType.CLEAR;
  private currentPhase: WeatherPhase = WeatherPhase.CLEAR;
  private phaseProgress: number = 0;
  private phaseElapsed: number = 0;

  // Computed intensity values (updated each frame)
  private intensity: number = 0;
  private rainIntensity: number = 0;
  private stormIntensity: number = 0;
  private fogDensity: number = 0;
  private skyDarkness: number = 0;

  // Timing
  private autoChangeTimer: number = 0;
  private peakTimer: number = 0;

  // Configuration
  private weatherConfigs: Record<WeatherType, WeatherConfig> = {
    [WeatherType.CLEAR]: {
      approachDuration: 0,
      arriveDuration: 0,
      peakMinDuration: 0,
      departDuration: 30,
      peakRainIntensity: 0,
      stormMultiplier: 0,
    },
    [WeatherType.RAIN]: {
      approachDuration: 20,
      arriveDuration: 15,
      peakMinDuration: 60,
      departDuration: 25,
      peakRainIntensity: 0.7,
      stormMultiplier: 0,
    },
    [WeatherType.STORM]: {
      approachDuration: 25,
      arriveDuration: 20,
      peakMinDuration: 45,
      departDuration: 35,
      peakRainIntensity: 1.0,
      stormMultiplier: 1.0,
    },
  };

  private params: WeatherManagerParams = {
    autoChange: true,
    autoChangeInterval: 180,
    peakDuration: 90,
  };

  // State change listeners
  private listeners: Set<(state: WeatherState) => void> = new Set();

  // Cached state object to avoid allocations
  private cachedState: WeatherState = {
    type: WeatherType.CLEAR,
    phase: WeatherPhase.CLEAR,
    intensity: 0,
    rainIntensity: 0,
    stormIntensity: 0,
    fogDensity: 0,
    skyDarkness: 0,
    isTransitioning: false,
    phaseProgress: 0,
  };

  constructor(scene: Scene, rainEffect: RainEffect, windSystem?: WindSystem) {
    this.scene = scene;
    this.rainEffect = rainEffect;
    this.windSystem = windSystem || new WindSystem();

    // Start with rain disabled
    this.rainEffect.setEnabled(false);
  }

  /**
   * Main update loop
   */
  update(deltaTime: number, spawnCenter?: Vector3): void {
    // Update wind system with current weather intensity
    this.windSystem.update(deltaTime, this.intensity);

    // Handle auto weather changes
    this.updateAutoChange(deltaTime);

    // Update weather phase progression
    this.updatePhase(deltaTime);

    // Compute derived intensity values
    this.computeIntensities();

    // Apply effects
    this.applyEffects(deltaTime, spawnCenter);

    // Notify listeners
    this.notifyListeners();
  }

  private updateAutoChange(deltaTime: number): void {
    if (!this.params.autoChange) return;
    if (this.currentPhase !== WeatherPhase.CLEAR && this.currentPhase !== WeatherPhase.PEAK) return;

    this.autoChangeTimer += deltaTime;
    if (this.autoChangeTimer >= this.params.autoChangeInterval) {
      this.autoChangeTimer = 0;
      this.triggerRandomWeather();
    }
  }

  private updatePhase(deltaTime: number): void {
    if (this.currentPhase === WeatherPhase.CLEAR && this.targetType === WeatherType.CLEAR) {
      return; // Nothing to do
    }

    this.phaseElapsed += deltaTime;
    const phaseDuration = this.getCurrentPhaseDuration();

    if (phaseDuration > 0) {
      this.phaseProgress = Math.min(1, this.phaseElapsed / phaseDuration);
    } else {
      this.phaseProgress = 1;
    }

    // Check for phase transitions
    if (this.phaseProgress >= 1) {
      this.advancePhase();
    }
  }

  private getCurrentPhaseDuration(): number {
    const config = this.weatherConfigs[this.targetType];

    switch (this.currentPhase) {
      case WeatherPhase.APPROACHING:
        return config.approachDuration;
      case WeatherPhase.ARRIVING:
        return config.arriveDuration;
      case WeatherPhase.PEAK:
        // Peak duration is controlled by peakTimer, not phaseProgress
        return this.params.peakDuration;
      case WeatherPhase.DEPARTING:
        return config.departDuration;
      default:
        return 0;
    }
  }

  private advancePhase(): void {
    this.phaseElapsed = 0;
    this.phaseProgress = 0;

    switch (this.currentPhase) {
      case WeatherPhase.CLEAR:
        // Starting weather transition
        if (this.targetType !== WeatherType.CLEAR) {
          this.currentPhase = WeatherPhase.APPROACHING;
        }
        break;

      case WeatherPhase.APPROACHING:
        this.currentPhase = WeatherPhase.ARRIVING;
        break;

      case WeatherPhase.ARRIVING:
        this.currentPhase = WeatherPhase.PEAK;
        this.currentType = this.targetType;
        this.peakTimer = 0;
        break;

      case WeatherPhase.PEAK:
        // Check if we should start departing
        if (this.targetType === WeatherType.CLEAR) {
          this.currentPhase = WeatherPhase.DEPARTING;
        }
        // Otherwise stay at peak
        break;

      case WeatherPhase.DEPARTING:
        this.currentPhase = WeatherPhase.CLEAR;
        this.currentType = WeatherType.CLEAR;
        this.targetType = WeatherType.CLEAR;
        this.intensity = 0;
        break;
    }
  }

  private computeIntensities(): void {
    const config = this.weatherConfigs[this.targetType];
    const eased = this.easeInOut(this.phaseProgress);

    switch (this.currentPhase) {
      case WeatherPhase.CLEAR:
        this.intensity = 0;
        this.rainIntensity = 0;
        this.stormIntensity = 0;
        this.fogDensity = 0;
        this.skyDarkness = 0;
        break;

      case WeatherPhase.APPROACHING:
        // Build anticipation: sky darkens, fog starts, but no rain yet
        this.intensity = eased * 0.3;
        this.rainIntensity = 0;
        this.stormIntensity = 0;
        this.fogDensity = eased * 0.4;
        this.skyDarkness = eased * 0.5;
        break;

      case WeatherPhase.ARRIVING:
        // Rain starts, everything intensifies
        this.intensity = 0.3 + eased * 0.5;
        this.rainIntensity = eased * config.peakRainIntensity * 0.7;
        this.stormIntensity = eased * config.stormMultiplier * 0.5;
        this.fogDensity = 0.4 + eased * 0.3;
        this.skyDarkness = 0.5 + eased * 0.3;
        break;

      case WeatherPhase.PEAK:
        // Full intensity
        this.intensity = 0.8 + Math.sin(this.phaseElapsed * 0.5) * 0.1; // Subtle pulsing
        this.rainIntensity = config.peakRainIntensity;
        this.stormIntensity = config.stormMultiplier;
        this.fogDensity = 0.7 + Math.sin(this.phaseElapsed * 0.3) * 0.1;
        this.skyDarkness = 0.8;
        break;

      case WeatherPhase.DEPARTING:
        // Everything fades
        const fadeOut = 1 - eased;
        this.intensity = 0.8 * fadeOut;
        this.rainIntensity = config.peakRainIntensity * fadeOut;
        this.stormIntensity = config.stormMultiplier * fadeOut;
        this.fogDensity = 0.7 * fadeOut;
        this.skyDarkness = 0.8 * fadeOut;
        break;
    }
  }

  private applyEffects(deltaTime: number, spawnCenter?: Vector3): void {
    // Apply rain effect
    const shouldRain = this.rainIntensity > 0.1;
    this.rainEffect.setEnabled(shouldRain);

    if (shouldRain) {
      // Pass wind to rain effect
      const windState = this.windSystem.getState();
      this.rainEffect.setWindFromSystem(windState.direction, windState.effectiveSpeed);
      this.rainEffect.setIntensity(this.rainIntensity);
      this.rainEffect.update(deltaTime, spawnCenter);
    }
  }

  private notifyListeners(): void {
    if (this.listeners.size === 0) return;

    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  private easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  // ============ Public API ============

  /**
   * Start transitioning to a new weather type
   */
  transitionToWeather(weather: WeatherType): void {
    if (weather === this.targetType) return;

    // If we're at peak and target is CLEAR, start departing
    if (weather === WeatherType.CLEAR && this.currentPhase === WeatherPhase.PEAK) {
      this.targetType = WeatherType.CLEAR;
      this.advancePhase(); // Will set to DEPARTING
      return;
    }

    // If we're clear, start approaching
    if (this.currentPhase === WeatherPhase.CLEAR) {
      this.targetType = weather;
      this.phaseElapsed = 0;
      this.phaseProgress = 0;
      this.currentPhase = WeatherPhase.APPROACHING;
      return;
    }

    // If we're in a transition, just update target
    this.targetType = weather;
  }

  /**
   * Set weather immediately (no transition) - useful for initialization
   */
  setWeather(weather: WeatherType): void {
    this.currentType = weather;
    this.targetType = weather;
    this.phaseElapsed = 0;
    this.phaseProgress = 0;

    if (weather === WeatherType.CLEAR) {
      this.currentPhase = WeatherPhase.CLEAR;
      this.intensity = 0;
      this.rainIntensity = 0;
      this.stormIntensity = 0;
      this.fogDensity = 0;
      this.skyDarkness = 0;
    } else {
      this.currentPhase = WeatherPhase.PEAK;
      const config = this.weatherConfigs[weather];
      this.intensity = 0.85;
      this.rainIntensity = config.peakRainIntensity;
      this.stormIntensity = config.stormMultiplier;
      this.fogDensity = 0.7;
      this.skyDarkness = 0.8;
    }
  }

  /**
   * Trigger a random weather change (prefers different weather)
   */
  triggerRandomWeather(): void {
    const weathers = [WeatherType.CLEAR, WeatherType.RAIN, WeatherType.STORM];
    const available = weathers.filter((w) => w !== this.currentType);
    const next = available[Math.floor(Math.random() * available.length)];
    this.transitionToWeather(next);
  }

  /**
   * Force weather to start clearing
   */
  clearWeather(): void {
    this.transitionToWeather(WeatherType.CLEAR);
  }

  /**
   * Get current weather state (reuses cached object)
   */
  getState(): WeatherState {
    this.cachedState.type = this.currentType;
    this.cachedState.phase = this.currentPhase;
    this.cachedState.intensity = this.intensity;
    this.cachedState.rainIntensity = this.rainIntensity;
    this.cachedState.stormIntensity = this.stormIntensity;
    this.cachedState.fogDensity = this.fogDensity;
    this.cachedState.skyDarkness = this.skyDarkness;
    this.cachedState.isTransitioning =
      this.currentPhase !== WeatherPhase.CLEAR && this.currentPhase !== WeatherPhase.PEAK;
    this.cachedState.phaseProgress = this.phaseProgress;
    return this.cachedState;
  }

  /**
   * Get the wind system for direct access
   */
  getWindSystem(): WindSystem {
    return this.windSystem;
  }

  /**
   * Get current wind state (convenience method)
   */
  getWindState(): { direction: import("three").Vector2; speed: number; effectiveSpeed: number } {
    return this.windSystem.getState();
  }

  /**
   * Get current weather intensity (0-1)
   */
  getIntensity(): number {
    return this.intensity;
  }

  /**
   * Get current weather type
   */
  getCurrentWeather(): WeatherType {
    return this.currentType;
  }

  /**
   * Get current phase
   */
  getCurrentPhase(): WeatherPhase {
    return this.currentPhase;
  }

  /**
   * Check if it's raining
   */
  isRaining(): boolean {
    return this.rainIntensity > 0.1;
  }

  /**
   * Check if storming
   */
  isStorming(): boolean {
    return this.stormIntensity > 0.5;
  }

  /**
   * Subscribe to state changes
   */
  addListener(listener: (state: WeatherState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Add GUI controls
   */
  addGUIControls(guiFolder: any): void {
    const weatherFolder = guiFolder.addFolder("Weather System");

    // Status display
    const status = {
      type: this.currentType,
      phase: this.currentPhase,
      intensity: 0,
      rainIntensity: 0,
      phaseProgress: 0,
    };

    weatherFolder.add(status, "type").name("Current Type").listen();
    weatherFolder.add(status, "phase").name("Current Phase").listen();
    weatherFolder.add(status, "intensity").name("Intensity").listen();
    weatherFolder.add(status, "rainIntensity").name("Rain Intensity").listen();
    weatherFolder.add(status, "phaseProgress").name("Phase Progress").listen();

    // Update display
    setInterval(() => {
      status.type = this.currentType;
      status.phase = this.currentPhase;
      status.intensity = Math.round(this.intensity * 100) / 100;
      status.rainIntensity = Math.round(this.rainIntensity * 100) / 100;
      status.phaseProgress = Math.round(this.phaseProgress * 100) / 100;
    }, 100);

    // Weather controls
    weatherFolder
      .add({ setWeather: WeatherType.CLEAR }, "setWeather", Object.values(WeatherType))
      .name("Set Weather")
      .onChange((value: WeatherType) => {
        this.transitionToWeather(value);
      });

    weatherFolder
      .add({ instant: () => this.setWeather(this.targetType) }, "instant")
      .name("Skip to Target");

    weatherFolder
      .add({ random: () => this.triggerRandomWeather() }, "random")
      .name("Random Weather");

    weatherFolder
      .add({ clear: () => this.clearWeather() }, "clear")
      .name("Clear Weather");

    // Timing controls
    const timingFolder = weatherFolder.addFolder("Timing");

    timingFolder
      .add(this.weatherConfigs[WeatherType.RAIN], "approachDuration", 5, 60, 1)
      .name("Rain Approach (s)");
    timingFolder
      .add(this.weatherConfigs[WeatherType.RAIN], "arriveDuration", 5, 30, 1)
      .name("Rain Arrive (s)");
    timingFolder
      .add(this.weatherConfigs[WeatherType.STORM], "approachDuration", 5, 60, 1)
      .name("Storm Approach (s)");
    timingFolder
      .add(this.weatherConfigs[WeatherType.STORM], "arriveDuration", 5, 30, 1)
      .name("Storm Arrive (s)");
    timingFolder.add(this.params, "peakDuration", 30, 180, 10).name("Peak Duration (s)");

    timingFolder.close();

    // Auto change
    weatherFolder.add(this.params, "autoChange").name("Auto Change");
    weatherFolder.add(this.params, "autoChangeInterval", 60, 600, 30).name("Auto Interval (s)");

    // Wind controls
    this.windSystem.addGUIControls(weatherFolder);

    weatherFolder.close();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.listeners.clear();
    this.windSystem.dispose();
  }
}
