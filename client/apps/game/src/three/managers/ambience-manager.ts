import { AudioManager } from "@/audio/core/AudioManager";
import { WeatherType } from "./weather-manager";

/**
 * Time of day periods for ambient sounds
 */
export enum TimeOfDay {
  NIGHT = "night", // 0-12.5, 87.5-100
  DAWN = "dawn", // 12.5-25
  DAY = "day", // 25-62.5
  DUSK = "dusk", // 62.5-75
  EVENING = "evening", // 75-87.5
}

/**
 * Configuration for ambient sound layers
 */
interface AmbienceSoundConfig {
  assetId: string | string[]; // Can be single sound or array of variations
  timeOfDay: TimeOfDay[];
  weather?: WeatherType[];
  baseVolume: number;
  fadeInDuration: number; // seconds
  fadeOutDuration: number; // seconds
  playbackMode?: "loop" | "random_interval"; // loop = continuous, random_interval = play randomly
  minInterval?: number; // seconds between random plays (if using random_interval mode)
  maxInterval?: number; // seconds between random plays (if using random_interval mode)
}

/**
 * Active sound instance with fade state
 */
interface ActiveAmbienceSound {
  layerId: string; // Unique identifier for the layer
  assetId: string; // Currently playing asset
  source: AudioBufferSourceNode;
  targetVolume: number;
  currentVolume: number;
  fadeSpeed: number; // volume change per second
  isFadingOut: boolean;
  nextPlayTime?: number; // For random_interval mode
}

interface AmbienceParams {
  enabled: boolean;
  masterVolume: number;
  weatherIntensity: number;
  stormIntensity: number;
}

/**
 * AmbienceManager handles time-of-day and weather-based ambient sounds
 * Uses the existing AudioManager for robust audio playback
 */
export class AmbienceManager {
  private audioManager: AudioManager;
  private params: AmbienceParams = {
    enabled: true,
    masterVolume: 1.0,
    weatherIntensity: 0,
    stormIntensity: 0,
  };

  private currentTimeOfDay: TimeOfDay = TimeOfDay.DAY;
  private currentWeather: WeatherType = WeatherType.CLEAR;
  private activeSounds: Map<string, ActiveAmbienceSound> = new Map();
  private layerIdCounter: number = 0;
  private isFirstUpdate: boolean = true;
  private debugIntervalId: ReturnType<typeof setInterval> | null = null;

  // Configurable ambient sound layers
  private readonly soundLayers: AmbienceSoundConfig[] = [
    // Time-based ambient sounds with variations
    {
      assetId: ["ambient.birds.morning.1", "ambient.birds.morning.2", "ambient.birds.morning.3"],
      timeOfDay: [TimeOfDay.DAWN, TimeOfDay.DAY],
      weather: [WeatherType.CLEAR],
      baseVolume: 0.2,
      fadeInDuration: 5.0,
      fadeOutDuration: 5.0,
      playbackMode: "random_interval",
      minInterval: 25,
      maxInterval: 75,
    },
    {
      assetId: ["ambient.crickets.night.1"],
      timeOfDay: [TimeOfDay.NIGHT, TimeOfDay.EVENING],
      weather: [WeatherType.CLEAR],
      baseVolume: 0.175,
      fadeInDuration: 5.0,
      fadeOutDuration: 5.0,
      playbackMode: "random_interval",
      minInterval: 25,
      maxInterval: 75,
    },
    {
      assetId: ["ambient.birds.night.1"],
      timeOfDay: [TimeOfDay.NIGHT, TimeOfDay.EVENING],
      weather: [WeatherType.CLEAR],
      baseVolume: 0.175,
      fadeInDuration: 5.0,
      fadeOutDuration: 5.0,
      playbackMode: "random_interval",
      minInterval: 25,
      maxInterval: 75,
    },
    {
      assetId: ["ambient.wolves.night.1", "ambient.wolves.night.2"], // Only 2 wolf sounds available
      timeOfDay: [TimeOfDay.NIGHT],
      weather: [WeatherType.CLEAR],
      baseVolume: 0.15,
      fadeInDuration: 3.0,
      fadeOutDuration: 3.0,
      playbackMode: "random_interval",
      minInterval: 75,
      maxInterval: 225,
    },
    {
      assetId: ["ambient.wind.day.1", "ambient.wind.day.2"],
      timeOfDay: [TimeOfDay.DAY],
      baseVolume: 0.125,
      fadeInDuration: 4.0,
      fadeOutDuration: 4.0,
      playbackMode: "random_interval",
      minInterval: 40,
      maxInterval: 100,
    },

    // Weather-based ambient sounds - rain should loop continuously
    {
      assetId: "ambient.rain.light",
      timeOfDay: [TimeOfDay.DAWN, TimeOfDay.DAY, TimeOfDay.DUSK, TimeOfDay.EVENING, TimeOfDay.NIGHT],
      weather: [WeatherType.RAIN],
      baseVolume: 0.1,
      fadeInDuration: 5.0,
      fadeOutDuration: 5.0,
      playbackMode: "loop",
    },
    {
      assetId: "ambient.rain.heavy",
      timeOfDay: [TimeOfDay.DAWN, TimeOfDay.DAY, TimeOfDay.DUSK, TimeOfDay.EVENING, TimeOfDay.NIGHT],
      weather: [WeatherType.STORM],
      baseVolume: 0.125,
      fadeInDuration: 4.0,
      fadeOutDuration: 4.0,
      playbackMode: "loop",
    },
    {
      assetId: ["ambient.thunder.distant.1", "ambient.thunder.distant.2", "ambient.thunder.distant.3"],
      timeOfDay: [TimeOfDay.DAWN, TimeOfDay.DAY, TimeOfDay.DUSK, TimeOfDay.EVENING, TimeOfDay.NIGHT],
      weather: [WeatherType.STORM],
      baseVolume: 0.125,
      fadeInDuration: 1.0,
      fadeOutDuration: 2.0,
      playbackMode: "random_interval",
      minInterval: 25,
      maxInterval: 100,
    },
  ];

  constructor() {
    this.audioManager = AudioManager.getInstance();
  }

  /**
   * Check if AudioManager is ready (has initialized audioContext)
   */
  private isAudioReady(): boolean {
    return this.audioManager.isInitialized();
  }

  /**
   * Update ambience based on current time and weather
   * @param cycleProgress - Day/night cycle progress (0-100)
   * @param currentWeather - Current weather type
   * @param deltaTime - Time since last frame in seconds
   */
  update(cycleProgress: number, currentWeather: WeatherType, deltaTime: number): void {
    if (!this.params.enabled) {
      this.fadeOutAll(deltaTime);
      return;
    }

    // Check if AudioManager is ready
    if (!this.isAudioReady()) {
      return; // Wait until audio system is initialized
    }

    // Determine current time of day
    const newTimeOfDay = this.getTimeOfDay(cycleProgress);
    const timeChanged = newTimeOfDay !== this.currentTimeOfDay;
    const weatherChanged = currentWeather !== this.currentWeather;

    // On first update, always trigger sound layer update
    if (this.isFirstUpdate) {
      this.isFirstUpdate = false;
      this.currentTimeOfDay = newTimeOfDay;
      this.currentWeather = currentWeather;
      this.updateSoundLayers();
      // Don't return - we need to update active sounds for fade-in
    } else {
      this.currentTimeOfDay = newTimeOfDay;
      this.currentWeather = currentWeather;

      // Check if we need to start/stop sounds
      if (timeChanged || weatherChanged) {
        this.updateSoundLayers();
      }
    }

    // Update active sounds (for fading)
    this.updateActiveSounds(deltaTime);
  }

  /**
   * Get time of day from cycle progress
   */
  private getTimeOfDay(cycleProgress: number): TimeOfDay {
    if (cycleProgress >= 0 && cycleProgress < 12.5) return TimeOfDay.NIGHT;
    if (cycleProgress >= 12.5 && cycleProgress < 25) return TimeOfDay.DAWN;
    if (cycleProgress >= 25 && cycleProgress < 62.5) return TimeOfDay.DAY;
    if (cycleProgress >= 62.5 && cycleProgress < 75) return TimeOfDay.DUSK;
    if (cycleProgress >= 75 && cycleProgress < 87.5) return TimeOfDay.EVENING;
    return TimeOfDay.NIGHT;
  }

  /**
   * Update sound layers based on current conditions
   */
  private updateSoundLayers(): void {
    // Check each sound layer
    this.soundLayers.forEach((layer, index) => {
      const layerId = this.getLayerId(layer, index);
      const shouldPlay = this.shouldPlayLayer(layer);
      const isPlaying = this.activeSounds.has(layerId);

      if (shouldPlay && !isPlaying) {
        this.startSound(layer, layerId);
      } else if (!shouldPlay && isPlaying) {
        this.stopSound(layerId);
      }
    });
  }

  /**
   * Get unique layer ID
   */
  private getLayerId(layer: AmbienceSoundConfig, index: number): string {
    const assetIds = Array.isArray(layer.assetId) ? layer.assetId : [layer.assetId];
    return `layer_${index}_${assetIds[0]}`;
  }

  /**
   * Check if a sound layer should be playing
   */
  private shouldPlayLayer(layer: AmbienceSoundConfig): boolean {
    // Check time of day
    const timeMatches = layer.timeOfDay.includes(this.currentTimeOfDay);

    // Check weather (if specified)
    const weatherMatches = !layer.weather || layer.weather.includes(this.currentWeather);

    return timeMatches && weatherMatches;
  }

  /**
   * Start playing a sound with fade in
   */
  private async startSound(layer: AmbienceSoundConfig, layerId: string): Promise<void> {
    // Skip if audio not ready
    if (!this.isAudioReady()) {
      return;
    }

    try {
      // Pick a random variation if multiple are provided
      const assetIds = Array.isArray(layer.assetId) ? layer.assetId : [layer.assetId];
      const selectedAssetId = assetIds[Math.floor(Math.random() * assetIds.length)];

      const playbackMode = layer.playbackMode || "loop";
      const shouldLoop = playbackMode === "loop";

      const targetVolume = layer.baseVolume * this.params.masterVolume;

      // Start at volume 0 for fade-in effect
      const source = await this.audioManager.play(selectedAssetId, {
        loop: shouldLoop,
        volume: 0, // Start silent, will fade in
        onComplete: () => {
          // For random_interval mode, schedule next play
          if (playbackMode === "random_interval") {
            this.scheduleNextPlay(layer, layerId);
          }
        },
      });

      // If source is null (audio muted), skip adding to active sounds
      if (!source) {
        return;
      }

      const fadeSpeed = layer.baseVolume / layer.fadeInDuration;

      const activeSound: ActiveAmbienceSound = {
        layerId,
        assetId: selectedAssetId,
        source,
        targetVolume,
        currentVolume: 0, // Start at 0 for fade-in
        fadeSpeed,
        isFadingOut: false,
      };

      // For random_interval mode, set next play time
      if (playbackMode === "random_interval") {
        const minInterval = layer.minInterval || 10;
        const maxInterval = layer.maxInterval || 30;
        const interval = minInterval + Math.random() * (maxInterval - minInterval);
        activeSound.nextPlayTime = performance.now() / 1000 + interval;
      }

      this.activeSounds.set(layerId, activeSound);
    } catch (error) {
      console.warn(`Failed to start ambient sound for layer ${layerId}:`, error);
    }
  }

  /**
   * Schedule next play for random_interval sounds
   */
  private scheduleNextPlay(layer: AmbienceSoundConfig, layerId: string): void {
    const activeSound = this.activeSounds.get(layerId);
    if (!activeSound || activeSound.isFadingOut) return;

    const minInterval = layer.minInterval || 10;
    const maxInterval = layer.maxInterval || 30;
    const interval = minInterval + Math.random() * (maxInterval - minInterval);
    activeSound.nextPlayTime = performance.now() / 1000 + interval;
  }

  /**
   * Stop a sound with fade out
   */
  private stopSound(layerId: string): void {
    const activeSound = this.activeSounds.get(layerId);
    if (!activeSound) return;

    const layer = this.soundLayers.find((l, index) => this.getLayerId(l, index) === layerId);
    if (!layer) return;

    // Mark for fade out
    activeSound.isFadingOut = true;
    activeSound.fadeSpeed = activeSound.currentVolume / layer.fadeOutDuration;
  }

  /**
   * Update active sound volumes (handles fading)
   */
  private updateActiveSounds(deltaTime: number): void {
    const soundsToRemove: string[] = [];
    const currentTime = performance.now() / 1000;

    this.activeSounds.forEach((activeSound, layerId) => {
      if (activeSound.isFadingOut) {
        // Fade out
        activeSound.currentVolume -= activeSound.fadeSpeed * deltaTime;

        if (activeSound.currentVolume <= 0) {
          // Fade out complete - stop sound
          try {
            this.audioManager.stop(activeSound.source);
          } catch (e) {
            // Ignore errors
          }
          soundsToRemove.push(layerId);
        }
      } else {
        // Fade in
        if (activeSound.currentVolume < activeSound.targetVolume) {
          activeSound.currentVolume += activeSound.fadeSpeed * deltaTime;
          activeSound.currentVolume = Math.min(activeSound.currentVolume, activeSound.targetVolume);
        }

        // Check if it's time to play next random_interval sound
        if (activeSound.nextPlayTime && currentTime >= activeSound.nextPlayTime) {
          // Find the layer config
          const layerIndex = parseInt(layerId.split("_")[1]);
          const layer = this.soundLayers[layerIndex];

          if (layer) {
            // Play a random variation
            const assetIds = Array.isArray(layer.assetId) ? layer.assetId : [layer.assetId];
            const selectedAssetId = assetIds[Math.floor(Math.random() * assetIds.length)];

            this.audioManager
              .play(selectedAssetId, {
                loop: false,
                volume: activeSound.currentVolume,
                onComplete: () => {
                  this.scheduleNextPlay(layer, layerId);
                },
              })
              .catch((error) => {
                console.warn(`Failed to play random interval sound ${selectedAssetId}:`, error);
              });

            // Clear next play time (will be set in onComplete)
            activeSound.nextPlayTime = undefined;
          }
        }
      }

      // Apply the calculated volume to the actual audio source
      this.audioManager.setSourceVolume(activeSound.source, activeSound.currentVolume);
    });

    // Remove stopped sounds
    soundsToRemove.forEach((layerId) => this.activeSounds.delete(layerId));
  }

  /**
   * Fade out all active sounds
   */
  private fadeOutAll(deltaTime: number): void {
    this.activeSounds.forEach((activeSound) => {
      if (!activeSound.isFadingOut) {
        activeSound.isFadingOut = true;
        activeSound.fadeSpeed = activeSound.currentVolume / 2.0; // 2 second fade out
      }
    });

    this.updateActiveSounds(deltaTime);
  }

  /**
   * Set master volume for ambience
   */
  setMasterVolume(volume: number): void {
    this.params.masterVolume = Math.max(0, Math.min(1, volume));

    // Update target volumes for active sounds
    this.activeSounds.forEach((activeSound, layerId) => {
      const layerIndex = parseInt(layerId.split("_")[1]);
      const layer = this.soundLayers[layerIndex];
      if (layer) {
        activeSound.targetVolume = layer.baseVolume * this.params.masterVolume;
      }
    });
  }

  /**
   * Enable or disable ambience system
   */
  setEnabled(enabled: boolean): void {
    this.params.enabled = enabled;

    if (!enabled) {
      // Fade out all sounds
      this.activeSounds.forEach((_, layerId) => this.stopSound(layerId));
    }
  }

  /**
   * Get current time of day
   */
  getCurrentTimeOfDay(): TimeOfDay {
    return this.currentTimeOfDay;
  }

  /**
   * Add GUI controls
   */
  addGUIControls(guiFolder: any): void {
    const ambienceFolder = guiFolder.addFolder("Ambience System");

    ambienceFolder
      .add(this.params, "enabled")
      .name("Enable Ambience")
      .onChange((value: boolean) => {
        this.setEnabled(value);
      });

    ambienceFolder
      .add(this.params, "masterVolume", 0, 1, 0.05)
      .name("Master Volume")
      .onChange((value: number) => {
        this.setMasterVolume(value);
      });

    // Debug info
    const debugInfo = {
      timeOfDay: this.currentTimeOfDay,
      weather: this.currentWeather,
      activeSounds: 0,
    };

    ambienceFolder.add(debugInfo, "timeOfDay").name("Time of Day").listen();
    ambienceFolder.add(debugInfo, "weather").name("Weather").listen();
    ambienceFolder.add(debugInfo, "activeSounds").name("Active Sounds").listen();

    // Update debug info - store interval ID for cleanup
    this.debugIntervalId = setInterval(() => {
      debugInfo.timeOfDay = this.currentTimeOfDay;
      debugInfo.weather = this.currentWeather;
      debugInfo.activeSounds = this.activeSounds.size;
    }, 100);

    ambienceFolder.close();
  }

  /**
   * Update ambience based on weather intensity from WeatherManager
   * This provides smoother transitions than binary weather type changes
   *
   * @param weatherIntensity - Overall weather intensity 0-1
   * @param stormIntensity - Storm-specific intensity 0-1 (for thunder)
   */
  updateFromWeather(weatherIntensity: number, stormIntensity: number): void {
    this.params.weatherIntensity = weatherIntensity;
    this.params.stormIntensity = stormIntensity;

    // Map intensity to weather type for sound layer activation
    // This creates a graduated transition rather than binary switching
    let effectiveWeather: WeatherType;

    if (stormIntensity > 0.3) {
      effectiveWeather = WeatherType.STORM;
    } else if (weatherIntensity > 0.2) {
      effectiveWeather = WeatherType.RAIN;
    } else {
      effectiveWeather = WeatherType.CLEAR;
    }

    // Only update if weather type changed (to avoid constant sound restarts)
    if (effectiveWeather !== this.currentWeather) {
      this.currentWeather = effectiveWeather;
      this.updateSoundLayers();
    }

    // Modulate active rain/storm sound volumes based on intensity
    // This provides smooth volume transitions during weather phases
    this.activeSounds.forEach((activeSound, layerId) => {
      const layerIndex = parseInt(layerId.split("_")[1]);
      const layer = this.soundLayers[layerIndex];

      if (!layer || !layer.weather) return;

      // Calculate intensity-based volume multiplier
      let volumeMultiplier = 1.0;

      if (layer.weather.includes(WeatherType.RAIN) || layer.weather.includes(WeatherType.STORM)) {
        // Rain sounds: scale with weather intensity
        volumeMultiplier = Math.max(0.3, weatherIntensity);
      }

      if (layer.weather.includes(WeatherType.STORM)) {
        // Storm sounds (thunder): scale with storm intensity
        volumeMultiplier = Math.max(0.2, stormIntensity);
      }

      // Update target volume with intensity multiplier
      activeSound.targetVolume = layer.baseVolume * this.params.masterVolume * volumeMultiplier;
    });
  }

  /**
   * Get current weather intensity
   */
  getWeatherIntensity(): number {
    return this.params.weatherIntensity;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    // Clear debug interval if it exists
    if (this.debugIntervalId !== null) {
      clearInterval(this.debugIntervalId);
      this.debugIntervalId = null;
    }

    // Stop all active sounds
    this.activeSounds.forEach((activeSound) => {
      try {
        this.audioManager.stop(activeSound.source);
      } catch (e) {
        // Ignore errors
      }
    });

    this.activeSounds.clear();
  }
}
