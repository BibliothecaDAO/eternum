import {
  Scene,
  DirectionalLight,
  HemisphereLight,
  AmbientLight,
  Color,
  Fog,
  Vector3,
  MathUtils,
} from "three";

interface TimeOfDayColors {
  skyColor: number;
  groundColor: number;
  sunColor: number;
  ambientColor: number;
  fogColor: number;
  hemisphereIntensity: number;
  sunIntensity: number;
  ambientIntensity: number;
  fogNear: number;
  fogFar: number;
}

interface DayNightParams {
  enabled: boolean;
  cycleSpeed: number; // Multiplier for testing (1.0 = normal)
  sunHeight: number;
  sunDistance: number;
  transitionSmoothness: number; // 0-1, higher = smoother
  colorTransitionSpeed: number; // How fast colors transition (0.01-1.0)
}

export class DayNightCycleManager {
  private scene: Scene;
  private directionalLight: DirectionalLight;
  private hemisphereLight: HemisphereLight;
  private ambientLight: AmbientLight;
  private fog: Fog;
  private params: DayNightParams = {
    enabled: true,
    cycleSpeed: 1.0,
    sunHeight: 9,
    sunDistance: 15,
    transitionSmoothness: 0.5,
    colorTransitionSpeed: 0.05, // Smooth color transitions
  };

  // Current color state (for smooth transitions)
  private currentColors: TimeOfDayColors = {
    skyColor: 0x2a1a3e,
    groundColor: 0x0a0514,
    sunColor: 0x9966ff,
    ambientColor: 0x3a1a3a,
    fogColor: 0x2d1b4e,
    hemisphereIntensity: 1.2,
    sunIntensity: 2.0,
    ambientIntensity: 0.1,
    fogNear: 15,
    fogFar: 35,
  };

  // Store original lighting values to restore when disabled
  private originalLightingState: {
    directionalColor: Color;
    directionalIntensity: number;
    directionalPosition: Vector3;
    hemisphereColor: Color;
    hemisphereGroundColor: Color;
    hemisphereIntensity: number;
    ambientColor: Color;
    ambientIntensity: number;
    sceneBackground: Color;
    fogColor: Color;
    fogNear: number;
    fogFar: number;
  };

  // Color stops for different times of day
  // Progress: 0-25 (Night→Dawn), 25-50 (Day), 50-75 (Dusk→Evening), 75-100 (Night)
  private readonly timeOfDayPresets: { [key: string]: TimeOfDayColors } = {
    deepNight: {
      // 0, 100
      skyColor: 0x1a0f2e,
      groundColor: 0x0a0514,
      sunColor: 0x6644aa,
      ambientColor: 0x2a1a4a,
      fogColor: 0x1d0f3e,
      hemisphereIntensity: 0.4,
      sunIntensity: 0.8,
      ambientIntensity: 0.15,
      fogNear: 15,
      fogFar: 35,
    },
    dawn: {
      // 12.5
      skyColor: 0xff6b4a,
      groundColor: 0x4a2c5c,
      sunColor: 0xff8866,
      ambientColor: 0x6a4a7a,
      fogColor: 0x8d5a7e,
      hemisphereIntensity: 0.8,
      sunIntensity: 1.5,
      ambientIntensity: 0.25,
      fogNear: 18,
      fogFar: 40,
    },
    day: {
      // 37.5
      skyColor: 0x87ceeb,
      groundColor: 0xd4a76a,
      sunColor: 0xfff4e6,
      ambientColor: 0x9988bb,
      fogColor: 0xb8a8c8,
      hemisphereIntensity: 1.4,
      sunIntensity: 2.2,
      ambientIntensity: 0.3,
      fogNear: 20,
      fogFar: 45,
    },
    dusk: {
      // 62.5
      skyColor: 0xff6347,
      groundColor: 0x5a3a6a,
      sunColor: 0xff7744,
      ambientColor: 0x7a5a8a,
      fogColor: 0x9d6a8e,
      hemisphereIntensity: 0.9,
      sunIntensity: 1.6,
      ambientIntensity: 0.25,
      fogNear: 18,
      fogFar: 40,
    },
    evening: {
      // 87.5
      skyColor: 0x3a2a5e,
      groundColor: 0x1a0f2e,
      sunColor: 0x8866cc,
      ambientColor: 0x4a3a6a,
      fogColor: 0x3d2a5e,
      hemisphereIntensity: 0.5,
      sunIntensity: 1.0,
      ambientIntensity: 0.18,
      fogNear: 16,
      fogFar: 38,
    },
  };

  constructor(
    scene: Scene,
    directionalLight: DirectionalLight,
    hemisphereLight: HemisphereLight,
    ambientLight: AmbientLight,
    fog: Fog,
  ) {
    this.scene = scene;
    this.directionalLight = directionalLight;
    this.hemisphereLight = hemisphereLight;
    this.ambientLight = ambientLight;
    this.fog = fog;

    // Store original lighting state
    this.originalLightingState = {
      directionalColor: this.directionalLight.color.clone(),
      directionalIntensity: this.directionalLight.intensity,
      directionalPosition: this.directionalLight.position.clone(),
      hemisphereColor: this.hemisphereLight.color.clone(),
      hemisphereGroundColor: this.hemisphereLight.groundColor.clone(),
      hemisphereIntensity: this.hemisphereLight.intensity,
      ambientColor: this.ambientLight.color.clone(),
      ambientIntensity: this.ambientLight.intensity,
      sceneBackground: (this.scene.background as Color).clone(),
      fogColor: this.fog.color.clone(),
      fogNear: this.fog.near,
      fogFar: this.fog.far,
    };
  }

  /**
   * Update the day/night cycle based on game cycle progress (0-100)
   */
  update(cycleProgress: number): void {
    if (!this.params.enabled) return;

    // Apply cycle speed multiplier for testing
    const adjustedProgress = (cycleProgress * this.params.cycleSpeed) % 100;

    // Get target colors for current time
    const targetColors = this.getInterpolatedTimeColors(adjustedProgress);

    // Smoothly transition current colors toward target colors
    this.currentColors = this.lerpTimeColors(this.currentColors, targetColors, this.params.colorTransitionSpeed);

    // Update lighting with smoothed colors
    this.updateLighting(this.currentColors);

    // Update sun position
    this.updateSunPosition(adjustedProgress);
  }

  /**
   * Get interpolated colors based on cycle progress with smooth transitions
   */
  private getInterpolatedTimeColors(progress: number): TimeOfDayColors {
    // Define key points in the cycle
    const keyPoints = [
      { progress: 0, preset: "deepNight" },
      { progress: 12.5, preset: "dawn" },
      { progress: 37.5, preset: "day" },
      { progress: 62.5, preset: "dusk" },
      { progress: 87.5, preset: "evening" },
      { progress: 100, preset: "deepNight" },
    ];

    // Find the two key points to interpolate between
    let startPoint = keyPoints[0];
    let endPoint = keyPoints[1];

    for (let i = 0; i < keyPoints.length - 1; i++) {
      if (progress >= keyPoints[i].progress && progress <= keyPoints[i + 1].progress) {
        startPoint = keyPoints[i];
        endPoint = keyPoints[i + 1];
        break;
      }
    }

    // Calculate interpolation factor
    const range = endPoint.progress - startPoint.progress;
    const localProgress = progress - startPoint.progress;
    let t = range > 0 ? localProgress / range : 0;

    // Apply smoothing (ease-in-out)
    t = this.smoothStep(t, this.params.transitionSmoothness);

    // Get the two presets to interpolate
    const startColors = this.timeOfDayPresets[startPoint.preset];
    const endColors = this.timeOfDayPresets[endPoint.preset];

    // Interpolate all values
    return {
      skyColor: this.lerpColor(startColors.skyColor, endColors.skyColor, t),
      groundColor: this.lerpColor(startColors.groundColor, endColors.groundColor, t),
      sunColor: this.lerpColor(startColors.sunColor, endColors.sunColor, t),
      ambientColor: this.lerpColor(startColors.ambientColor, endColors.ambientColor, t),
      fogColor: this.lerpColor(startColors.fogColor, endColors.fogColor, t),
      hemisphereIntensity: MathUtils.lerp(startColors.hemisphereIntensity, endColors.hemisphereIntensity, t),
      sunIntensity: MathUtils.lerp(startColors.sunIntensity, endColors.sunIntensity, t),
      ambientIntensity: MathUtils.lerp(startColors.ambientIntensity, endColors.ambientIntensity, t),
      fogNear: MathUtils.lerp(startColors.fogNear, endColors.fogNear, t),
      fogFar: MathUtils.lerp(startColors.fogFar, endColors.fogFar, t),
    };
  }

  /**
   * Smooth step interpolation for natural transitions
   */
  private smoothStep(t: number, smoothness: number): number {
    // Apply smoothstep function based on smoothness parameter
    if (smoothness < 0.01) return t; // Linear

    // Smoothstep: 3t² - 2t³
    const smoothT = t * t * (3 - 2 * t);

    // Blend between linear and smooth based on smoothness parameter
    return MathUtils.lerp(t, smoothT, smoothness);
  }

  /**
   * Interpolate between two hex colors
   */
  private lerpColor(color1: number, color2: number, t: number): number {
    const c1 = new Color(color1);
    const c2 = new Color(color2);
    c1.lerp(c2, t);
    return c1.getHex();
  }

  /**
   * Lerp between two complete time color sets for smooth temporal transitions
   */
  private lerpTimeColors(current: TimeOfDayColors, target: TimeOfDayColors, t: number): TimeOfDayColors {
    return {
      skyColor: this.lerpColor(current.skyColor, target.skyColor, t),
      groundColor: this.lerpColor(current.groundColor, target.groundColor, t),
      sunColor: this.lerpColor(current.sunColor, target.sunColor, t),
      ambientColor: this.lerpColor(current.ambientColor, target.ambientColor, t),
      fogColor: this.lerpColor(current.fogColor, target.fogColor, t),
      hemisphereIntensity: MathUtils.lerp(current.hemisphereIntensity, target.hemisphereIntensity, t),
      sunIntensity: MathUtils.lerp(current.sunIntensity, target.sunIntensity, t),
      ambientIntensity: MathUtils.lerp(current.ambientIntensity, target.ambientIntensity, t),
      fogNear: MathUtils.lerp(current.fogNear, target.fogNear, t),
      fogFar: MathUtils.lerp(current.fogFar, target.fogFar, t),
    };
  }

  /**
   * Update all lighting based on interpolated time colors
   */
  private updateLighting(timeColors: TimeOfDayColors): void {
    // Update scene background (sky)
    (this.scene.background as Color).setHex(timeColors.skyColor);

    // Update directional light (sun/moon)
    this.directionalLight.color.setHex(timeColors.sunColor);
    this.directionalLight.intensity = timeColors.sunIntensity;

    // Update hemisphere light
    this.hemisphereLight.color.setHex(timeColors.skyColor);
    this.hemisphereLight.groundColor.setHex(timeColors.groundColor);
    this.hemisphereLight.intensity = timeColors.hemisphereIntensity;

    // Update ambient light
    this.ambientLight.color.setHex(timeColors.ambientColor);
    this.ambientLight.intensity = timeColors.ambientIntensity;

    // Update fog
    this.fog.color.setHex(timeColors.fogColor);
    this.fog.near = timeColors.fogNear;
    this.fog.far = timeColors.fogFar;
  }

  /**
   * Update sun position based on cycle progress
   * Sun rises from east, peaks at noon, sets in west
   */
  private updateSunPosition(progress: number): void {
    // Convert progress to angle (0-360 degrees)
    // 0 = midnight (below horizon)
    // 25 = sunrise (eastern horizon)
    // 50 = noon (directly above)
    // 75 = sunset (western horizon)
    // 100 = midnight (below horizon)

    const angle = (progress / 100) * Math.PI * 2;

    // Calculate sun position in an arc
    const x = Math.sin(angle) * this.params.sunDistance;
    const y = Math.cos(angle) * this.params.sunHeight;
    const z = Math.cos(angle) * this.params.sunDistance * 0.3; // Slight depth variation

    this.directionalLight.position.set(x, Math.max(y, 0.5), z);
    this.directionalLight.target.position.set(0, 0, 5.2);
    this.directionalLight.target.updateMatrixWorld();
  }

  /**
   * Enable or disable the day/night cycle
   */
  setEnabled(enabled: boolean): void {
    this.params.enabled = enabled;

    if (!enabled) {
      // Restore original lighting
      this.restoreOriginalLighting();
    }
  }

  /**
   * Restore original lighting state
   */
  private restoreOriginalLighting(): void {
    this.directionalLight.color.copy(this.originalLightingState.directionalColor);
    this.directionalLight.intensity = this.originalLightingState.directionalIntensity;
    this.directionalLight.position.copy(this.originalLightingState.directionalPosition);

    this.hemisphereLight.color.copy(this.originalLightingState.hemisphereColor);
    this.hemisphereLight.groundColor.copy(this.originalLightingState.hemisphereGroundColor);
    this.hemisphereLight.intensity = this.originalLightingState.hemisphereIntensity;

    this.ambientLight.color.copy(this.originalLightingState.ambientColor);
    this.ambientLight.intensity = this.originalLightingState.ambientIntensity;

    (this.scene.background as Color).copy(this.originalLightingState.sceneBackground);

    this.fog.color.copy(this.originalLightingState.fogColor);
    this.fog.near = this.originalLightingState.fogNear;
    this.fog.far = this.originalLightingState.fogFar;
  }

  /**
   * Set cycle speed for testing
   */
  setCycleSpeed(speed: number): void {
    this.params.cycleSpeed = Math.max(0.1, Math.min(10, speed));
  }

  /**
   * Get current time of day as string (for debugging/UI)
   */
  getTimeOfDay(progress: number): string {
    if (progress < 12.5) return "Night";
    if (progress < 25) return "Dawn";
    if (progress < 50) return "Day";
    if (progress < 62.5) return "Afternoon";
    if (progress < 75) return "Dusk";
    if (progress < 87.5) return "Evening";
    return "Night";
  }

  /**
   * Add GUI controls for day/night cycle
   */
  addGUIControls(guiFolder: any): void {
    const dayNightFolder = guiFolder.addFolder("Day/Night Cycle");

    dayNightFolder.add(this.params, "enabled").name("Enable Day/Night").onChange((value: boolean) => {
      this.setEnabled(value);
    });

    dayNightFolder.add(this.params, "cycleSpeed", 0.1, 10, 0.1).name("Cycle Speed");

    dayNightFolder.add(this.params, "transitionSmoothness", 0, 1, 0.05).name("Transition Smoothness");

    dayNightFolder
      .add(this.params, "colorTransitionSpeed", 0.01, 1.0, 0.01)
      .name("Color Transition Speed");

    dayNightFolder.add(this.params, "sunHeight", 5, 20, 0.5).name("Sun Height");

    dayNightFolder.add(this.params, "sunDistance", 10, 30, 1).name("Sun Distance");

    // Add manual time control for testing
    const timeControl = { manualProgress: 0 };
    dayNightFolder
      .add(timeControl, "manualProgress", 0, 100, 1)
      .name("Manual Time")
      .onChange((value: number) => {
        if (!this.params.enabled) {
          this.params.enabled = true;
        }
        this.update(value);
      });

    dayNightFolder.close();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.restoreOriginalLighting();
  }
}
