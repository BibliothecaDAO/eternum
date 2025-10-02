import { RainEffect } from "@/three/effects/rain-effect";
import { Scene, Vector3 } from "three";

export enum WeatherType {
  CLEAR = "clear",
  RAIN = "rain",
  STORM = "storm",
}

interface WeatherParams {
  currentWeather: WeatherType;
  transitionDuration: number; // seconds
  autoChange: boolean;
  autoChangeInterval: number; // seconds
  rainIntensity: number;
}

export class WeatherManager {
  private scene: Scene;
  private rainEffect: RainEffect;
  private params: WeatherParams = {
    currentWeather: WeatherType.CLEAR,
    transitionDuration: 3.0,
    autoChange: false,
    autoChangeInterval: 120, // 2 minutes
    rainIntensity: 0.9,
  };

  private targetWeather: WeatherType;
  private isTransitioning: boolean = false;
  private transitionProgress: number = 0;
  private autoChangeTimer: number = 0;

  constructor(scene: Scene, rainEffect: RainEffect) {
    this.scene = scene;
    this.rainEffect = rainEffect;
    this.targetWeather = this.params.currentWeather;

    // Start with rain disabled
    this.rainEffect.setEnabled(false);
  }

  /**
   * Update weather system
   */
  update(deltaTime: number, spawnCenter?: Vector3): void {
    // Handle auto weather changes
    if (this.params.autoChange) {
      this.autoChangeTimer += deltaTime;
      if (this.autoChangeTimer >= this.params.autoChangeInterval) {
        this.autoChangeTimer = 0;
        this.changeWeatherRandomly();
      }
    }

    // Handle weather transitions
    if (this.isTransitioning) {
      this.updateTransition(deltaTime);
    }

    // Update rain effect based on current weather
    if (this.params.currentWeather === WeatherType.RAIN || this.params.currentWeather === WeatherType.STORM) {
      this.rainEffect.update(deltaTime, spawnCenter);
    }
  }

  /**
   * Set weather immediately (no transition)
   */
  setWeather(weather: WeatherType): void {
    this.params.currentWeather = weather;
    this.targetWeather = weather;
    this.isTransitioning = false;
    this.transitionProgress = 0;
    this.applyWeather(weather, 1.0);
  }

  /**
   * Transition to new weather
   */
  transitionToWeather(weather: WeatherType): void {
    if (weather === this.params.currentWeather) return;

    this.targetWeather = weather;
    this.isTransitioning = true;
    this.transitionProgress = 0;
  }

  /**
   * Change to random weather
   */
  private changeWeatherRandomly(): void {
    const weathers = Object.values(WeatherType);
    const currentIndex = weathers.indexOf(this.params.currentWeather);
    // Pick a different weather
    const availableWeathers = weathers.filter((_, index) => index !== currentIndex);
    const randomWeather = availableWeathers[Math.floor(Math.random() * availableWeathers.length)];
    this.transitionToWeather(randomWeather);
  }

  /**
   * Update weather transition
   */
  private updateTransition(deltaTime: number): void {
    this.transitionProgress += deltaTime / this.params.transitionDuration;

    if (this.transitionProgress >= 1.0) {
      // Transition complete
      this.transitionProgress = 1.0;
      this.isTransitioning = false;
      this.params.currentWeather = this.targetWeather;
    }

    // Apply weather with transition progress
    this.applyWeather(this.targetWeather, this.transitionProgress);
  }

  /**
   * Apply weather effects with intensity
   */
  private applyWeather(weather: WeatherType, intensity: number): void {
    switch (weather) {
      case WeatherType.CLEAR:
        // Fade out rain
        this.rainEffect.setEnabled(intensity < 0.5);
        break;

      case WeatherType.RAIN:
        // Fade in rain
        this.rainEffect.setEnabled(intensity > 0.5);
        break;

      case WeatherType.STORM:
        // Heavy rain
        this.rainEffect.setEnabled(intensity > 0.3);
        break;
    }
  }

  /**
   * Get current weather type
   */
  getCurrentWeather(): WeatherType {
    return this.params.currentWeather;
  }

  /**
   * Check if it's raining
   */
  isRaining(): boolean {
    return (
      this.params.currentWeather === WeatherType.RAIN || this.params.currentWeather === WeatherType.STORM
    );
  }

  /**
   * Check if storming
   */
  isStorming(): boolean {
    return this.params.currentWeather === WeatherType.STORM;
  }

  /**
   * Add GUI controls
   */
  addGUIControls(guiFolder: any): void {
    const weatherFolder = guiFolder.addFolder("Weather System");

    weatherFolder
      .add(this.params, "currentWeather", Object.values(WeatherType))
      .name("Current Weather")
      .onChange((value: WeatherType) => {
        this.setWeather(value);
      });

    weatherFolder
      .add(
        {
          transitionTo: () => {
            const weathers = Object.values(WeatherType);
            const currentIndex = weathers.indexOf(this.params.currentWeather);
            const nextWeather = weathers[(currentIndex + 1) % weathers.length];
            this.transitionToWeather(nextWeather);
          },
        },
        "transitionTo",
      )
      .name("Transition to Next");

    weatherFolder.add(this.params, "transitionDuration", 1, 10, 0.5).name("Transition Duration (s)");

    weatherFolder.add(this.params, "autoChange").name("Auto Change Weather");

    weatherFolder.add(this.params, "autoChangeInterval", 30, 300, 10).name("Auto Change Interval (s)");

    weatherFolder.add(this.params, "rainIntensity", 0, 1, 0.1).name("Rain Intensity");

    weatherFolder.close();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // Rain effect is disposed elsewhere
  }
}
