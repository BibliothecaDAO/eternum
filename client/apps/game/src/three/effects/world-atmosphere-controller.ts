import type GUI from "lil-gui";
import {
  Scene,
  DirectionalLight,
  HemisphereLight,
  AmbientLight,
  Color,
  Fog,
  Vector3,
  MathUtils,
  Object3D,
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

interface WorldAtmosphereParams {
  enabled: boolean;
  cycleSpeed: number; // Multiplier for testing (1.0 = normal)
  sunHeight: number;
  sunDistance: number;
  transitionSmoothness: number; // 0-1, higher = smoother
  colorTransitionSpeed: number; // How fast colors transition (0.01-1.0)
  sunPositionEasing: number; // How fast sun follows camera (0.01-1.0)
  progressSmoothing: number; // How quickly progress eases toward target (0-1)
}

interface WorldAtmosphereUpdateOptions {
  snap?: boolean;
}

interface AtmosphereProgressFrame {
  progress: number;
  snapVisualState: boolean;
}

const DAY_PHASE_PROGRESS = {
  dawn: 100 / 6,
  morning: 100 / 3,
  afternoon: 50,
  lateAfternoon: 175 / 3,
  dusk: (100 / 6) * 4,
  evening: (100 / 6) * 5,
} as const;

const VISIBILITY_FLOORS = {
  ambientIntensity: 0.48,
  hemisphereIntensity: 0.95,
  sunIntensity: 1.55,
  moonRimIntensity: 0.26,
} as const;

const WEATHER_LIMITS = {
  maxWeatherDimming: 0.24,
  maxFogTintBlend: 0.38,
  maxHaze: 0.45,
  maxKeyLightDimming: 0.2,
} as const;

const KEY_LIGHT_MIN_HEIGHT_RATIO = 0.58;
const PREVIEW_SNAP_PROGRESS_THRESHOLD = 1.5;

export class WorldAtmosphereController {
  private scene: Scene;
  private directionalLight: DirectionalLight;
  private moonRimLight: DirectionalLight;
  private moonRimTarget: Object3D;
  private hemisphereLight: HemisphereLight;
  private ambientLight: AmbientLight;
  private fog: Fog;
  public params: WorldAtmosphereParams = {
    enabled: true,
    cycleSpeed: 1.0,
    sunHeight: 12,
    sunDistance: 15,
    transitionSmoothness: 0.45,
    colorTransitionSpeed: 0.02, // Smooth color transitions
    sunPositionEasing: 0.1, // Smooth sun movement when camera pans
    progressSmoothing: 0.02, // Slow progress easing for gradual day changes
  };

  // Current color state (for smooth transitions)
  private currentColors: TimeOfDayColors = {
    skyColor: 0x344562,
    groundColor: 0x405477,
    sunColor: 0x7b5fd6,
    ambientColor: 0x7891c4,
    fogColor: 0x536b8c,
    hemisphereIntensity: 1.05,
    sunIntensity: 1.85,
    ambientIntensity: 0.56,
    fogNear: 15,
    fogFar: 45,
  };

  // Current sun position state (for smooth camera tracking)
  private currentSunPosition: Vector3 = new Vector3(0, 12, 0);
  private currentSunTarget: Vector3 = new Vector3(0, 0, 5.2);
  private readonly targetSunPosition: Vector3 = new Vector3();
  private readonly targetSunTarget: Vector3 = new Vector3();
  private readonly tempColor1: Color = new Color();
  private readonly tempColor2: Color = new Color();
  private readonly tempHSL: { h: number; s: number; l: number } = { h: 0, s: 0, l: 0 };
  private readonly moonRimDirection: Vector3 = new Vector3();
  private readonly moonRimPosition: Vector3 = new Vector3();
  private readonly stormTint: Color = new Color(0x606880);
  private readonly lastUpdateSkyColor: Color = new Color();
  private readonly lastUpdateFogColor: Color = new Color();
  private lastUpdateDirIntensity: number = 0;
  private lastUpdateHemiIntensity: number = 0;
  private lastUpdateAmbientIntensity: number = 0;
  private lastUpdateMoonRimIntensity: number = 0;
  private lastWeatherAdjustedHemiIntensity: number = 0;
  private lastWeatherAdjustedAmbientIntensity: number = 0;
  private currentAngle: number = 0; // Track smoothed angular progress
  private isProgressInitialized: boolean = false;
  private readonly fullRotation: number = Math.PI * 2;
  private isDisposed = false;

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
  };

  // Color stops for the six in-game day phases.
  private readonly timeOfDayPresets: { [key: string]: TimeOfDayColors } = {
    deepNight: {
      // 0, 100
      skyColor: 0x344562,
      groundColor: 0x405477,
      sunColor: 0x9b7ee8,
      ambientColor: 0x7891c4,
      fogColor: 0x536b8c,
      hemisphereIntensity: 1.05,
      sunIntensity: 1.85,
      ambientIntensity: 0.56,
      fogNear: 15,
      fogFar: 56,
    },
    dawn: {
      // 16.7
      skyColor: 0xffba8a,
      groundColor: 0x9f7188,
      sunColor: 0xffd0a5,
      ambientColor: 0xb994b2,
      fogColor: 0xd4a8b0,
      hemisphereIntensity: 1.45,
      sunIntensity: 3.05,
      ambientIntensity: 0.6,
      fogNear: 22,
      fogFar: 58,
    },
    morning: {
      // 33.3
      skyColor: 0xb7dcff,
      groundColor: 0xd8c7a9,
      sunColor: 0xfff5d5,
      ambientColor: 0xffecd3,
      fogColor: 0xd2e5f4,
      hemisphereIntensity: 2.15,
      sunIntensity: 3.8,
      ambientIntensity: 0.76,
      fogNear: 30,
      fogFar: 82,
    },
    day: {
      // 50
      skyColor: 0xb8d8f2,
      groundColor: 0xd6c7ad,
      sunColor: 0xfff2dc,
      ambientColor: 0xf2dfc7,
      fogColor: 0xd2e2f0,
      hemisphereIntensity: 2.18,
      sunIntensity: 3.55,
      ambientIntensity: 0.74,
      fogNear: 32,
      fogFar: 82,
    },
    afternoon: {
      // 58.3
      skyColor: 0xb4cee8,
      groundColor: 0xcab89f,
      sunColor: 0xffd8aa,
      ambientColor: 0xecc8b0,
      fogColor: 0xcbd2dc,
      hemisphereIntensity: 1.92,
      sunIntensity: 3.05,
      ambientIntensity: 0.68,
      fogNear: 28,
      fogFar: 72,
    },
    dusk: {
      // 66.7
      skyColor: 0xff9f72,
      groundColor: 0x9a6682,
      sunColor: 0xffbd8e,
      ambientColor: 0xc591aa,
      fogColor: 0xd39aab,
      hemisphereIntensity: 1.55,
      sunIntensity: 2.85,
      ambientIntensity: 0.6,
      fogNear: 24,
      fogFar: 62,
    },
    evening: {
      // 83.3
      skyColor: 0x667fb8,
      groundColor: 0x53617e,
      sunColor: 0xd4e0ff,
      ambientColor: 0x8aa2d2,
      fogColor: 0x637da5,
      hemisphereIntensity: 1.3,
      sunIntensity: 2.05,
      ambientIntensity: 0.62,
      fogNear: 20,
      fogFar: 54,
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

    this.moonRimLight = new DirectionalLight(0x9cb6ff, 0);
    this.moonRimLight.castShadow = false;
    this.moonRimTarget = new Object3D();
    this.scene.add(this.moonRimTarget);
    this.moonRimLight.target = this.moonRimTarget;
    this.moonRimLight.position.copy(this.directionalLight.position);
    this.scene.add(this.moonRimLight);

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
    };
  }

  /**
   * Update the world atmosphere based on game cycle progress (0-100)
   * @param cycleProgress - Game cycle progress (0-100)
   * @param cameraTarget - Optional camera target position to offset sun position
   */
  update(cycleProgress: number, cameraTarget?: Vector3, options: WorldAtmosphereUpdateOptions = {}): void {
    if (!this.params.enabled) return;

    // Apply cycle speed multiplier for testing
    const adjustedProgress = (cycleProgress * this.params.cycleSpeed) % 100;
    const progressFrame = this.resolveAtmosphereProgress(adjustedProgress, options.snap === true);

    // Get target colors for current time, then grade nighttime toward cooler tones
    const interpolatedColors = this.getInterpolatedTimeColors(progressFrame.progress);
    const targetColors = this.applyNightTemperatureGrading(interpolatedColors, progressFrame.progress);

    // Smoothly transition current colors toward target colors
    this.currentColors = progressFrame.snapVisualState
      ? targetColors
      : this.lerpTimeColors(this.currentColors, targetColors, this.params.colorTransitionSpeed);

    // Update lighting with smoothed colors
    this.updateLighting(this.currentColors);

    // Store baseline values so applyWeatherModulation can darken non-destructively
    this.lastUpdateSkyColor.copy(this.scene.background as Color);
    this.lastUpdateFogColor.copy(this.fog.color);
    this.lastUpdateDirIntensity = this.directionalLight.intensity;
    this.lastUpdateHemiIntensity = this.hemisphereLight.intensity;
    this.lastUpdateAmbientIntensity = this.ambientLight.intensity;
    this.lastWeatherAdjustedHemiIntensity = this.lastUpdateHemiIntensity;
    this.lastWeatherAdjustedAmbientIntensity = this.lastUpdateAmbientIntensity;

    // Update sun position (relative to camera target if provided)
    this.updateSunPosition(progressFrame.progress, cameraTarget, progressFrame.snapVisualState);
    this.updateMoonRimLighting(progressFrame.progress, cameraTarget);
  }

  private resolveAtmosphereProgress(adjustedProgress: number, forceSnap: boolean): AtmosphereProgressFrame {
    const targetAngle = (adjustedProgress / 100) * this.fullRotation;
    const shouldSnap = forceSnap || !this.isProgressInitialized || this.shouldSnapToProgress(targetAngle);

    if (shouldSnap) {
      this.currentAngle = targetAngle;
      this.isProgressInitialized = true;
    } else {
      this.currentAngle = this.lerpAngle(this.currentAngle, targetAngle, this.params.progressSmoothing);
    }

    const normalizedAngle = MathUtils.euclideanModulo(this.currentAngle, this.fullRotation);
    return {
      progress: (normalizedAngle / this.fullRotation) * 100,
      snapVisualState: shouldSnap,
    };
  }

  private shouldSnapToProgress(targetAngle: number): boolean {
    const delta = Math.abs(this.getShortestAngleDelta(this.currentAngle, targetAngle));
    const progressDelta = (delta / this.fullRotation) * 100;
    return progressDelta >= PREVIEW_SNAP_PROGRESS_THRESHOLD;
  }

  /**
   * Get interpolated colors based on cycle progress with smooth transitions
   */
  private getInterpolatedTimeColors(progress: number): TimeOfDayColors {
    // Define key points in the cycle
    const keyPoints = [
      { progress: 0, preset: "deepNight" },
      { progress: DAY_PHASE_PROGRESS.dawn, preset: "dawn" },
      { progress: DAY_PHASE_PROGRESS.morning, preset: "morning" },
      { progress: DAY_PHASE_PROGRESS.afternoon, preset: "day" },
      { progress: DAY_PHASE_PROGRESS.lateAfternoon, preset: "afternoon" },
      { progress: DAY_PHASE_PROGRESS.dusk, preset: "dusk" },
      { progress: DAY_PHASE_PROGRESS.evening, preset: "evening" },
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
    this.tempColor1.setHex(color1);
    this.tempColor2.setHex(color2);
    this.tempColor1.lerp(this.tempColor2, t);
    return this.tempColor1.getHex();
  }

  /**
   * Keep night readable by pushing the palette cooler rather than darker.
   */
  private applyNightTemperatureGrading(colors: TimeOfDayColors, progress: number): TimeOfDayColors {
    const nightToneFactor = this.resolveNightToneFactor(progress);
    if (nightToneFactor <= 0) {
      return colors;
    }

    const tintStrength = 0.16 + nightToneFactor * 0.24;
    const saturationScale = 1 - nightToneFactor * 0.18;

    return {
      ...colors,
      skyColor: colors.skyColor,
      groundColor: this.applyCoolTint(colors.groundColor, 0x4f638f, tintStrength * 0.75, saturationScale * 0.95),
      sunColor: this.applyCoolTint(colors.sunColor, 0xc9d8ff, tintStrength * 0.85, saturationScale),
      ambientColor: this.applyCoolTint(colors.ambientColor, 0x8099d9, tintStrength, saturationScale),
      fogColor: colors.fogColor,
    };
  }

  private resolveNightToneFactor(progress: number): number {
    if (progress <= 25) {
      return MathUtils.clamp((25 - progress) / 25, 0, 1);
    }

    if (progress >= 75) {
      return MathUtils.clamp((progress - 75) / 25, 0, 1);
    }

    return 0;
  }

  private applyCoolTint(
    baseColorHex: number,
    tintColorHex: number,
    tintStrength: number,
    saturationScale: number,
  ): number {
    this.tempColor1.setHex(baseColorHex);
    this.tempColor2.setHex(tintColorHex);
    this.tempColor1.lerp(this.tempColor2, MathUtils.clamp(tintStrength, 0, 1));

    this.tempColor1.getHSL(this.tempHSL);
    this.tempColor1.setHSL(this.tempHSL.h, MathUtils.clamp(this.tempHSL.s * saturationScale, 0, 1), this.tempHSL.l);

    return this.tempColor1.getHex();
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
    const readableTimeColors = this.applyVisibilityFloors(timeColors);

    // Update scene background (sky)
    (this.scene.background as Color).setHex(readableTimeColors.skyColor);

    // Update directional light (sun/moon)
    this.directionalLight.color.setHex(readableTimeColors.sunColor);
    this.directionalLight.intensity = readableTimeColors.sunIntensity;

    // Update hemisphere light
    this.hemisphereLight.color.setHex(readableTimeColors.skyColor);
    this.hemisphereLight.groundColor.setHex(readableTimeColors.groundColor);
    this.hemisphereLight.intensity = readableTimeColors.hemisphereIntensity;

    // Update ambient light
    this.ambientLight.color.setHex(readableTimeColors.ambientColor);
    this.ambientLight.intensity = readableTimeColors.ambientIntensity;

    // Update fog
    this.fog.color.setHex(readableTimeColors.fogColor);
  }

  private applyVisibilityFloors(timeColors: TimeOfDayColors): TimeOfDayColors {
    return {
      ...timeColors,
      ambientIntensity: Math.max(timeColors.ambientIntensity, VISIBILITY_FLOORS.ambientIntensity),
      hemisphereIntensity: Math.max(timeColors.hemisphereIntensity, VISIBILITY_FLOORS.hemisphereIntensity),
      sunIntensity: Math.max(timeColors.sunIntensity, VISIBILITY_FLOORS.sunIntensity),
    };
  }

  /**
   * Update key-light position based on cycle progress.
   * @param progress - Cycle progress (0-100)
   * @param cameraTarget - Optional camera target to offset sun position
   */
  private updateSunPosition(progress: number, cameraTarget?: Vector3, snapPosition: boolean = false): void {
    // Convert progress to angle (0-360 degrees)
    // 0 = moonlit night
    // 25 = sunrise (eastern horizon)
    // 50 = noon (directly above)
    // 75 = sunset (western horizon)
    // 100 = moonlit night

    // Offset angle by π so that:
    // - progress=0 (midnight): cos(π) = -1
    // - progress=50 (noon): cos(0) = 1 → sun at peak
    const angle = (progress / 100) * Math.PI * 2 + Math.PI;

    // Keep low-angle phases readable and avoid hard shadow-map curtains near the viewport edge.
    const offsetX = Math.sin(angle) * this.params.sunDistance;
    const offsetY = Math.max(Math.abs(Math.cos(angle)) * this.params.sunHeight, this.getMinimumKeyLightHeight());
    const offsetZ = -Math.cos(angle) * this.params.sunDistance * 0.3; // Slight depth variation

    // Calculate target sun position and target
    const targetSunPosition = this.targetSunPosition;
    const targetSunTarget = this.targetSunTarget;

    if (cameraTarget) {
      targetSunPosition.set(
        cameraTarget.x + offsetX,
        cameraTarget.y + Math.max(offsetY, 0.5),
        cameraTarget.z + offsetZ,
      );
      targetSunTarget.set(cameraTarget.x, cameraTarget.y, cameraTarget.z + 5.2);
    } else {
      // Default behavior - sun at world origin
      targetSunPosition.set(offsetX, Math.max(offsetY, 0.5), offsetZ);
      targetSunTarget.set(0, 0, 5.2);
    }

    if (snapPosition) {
      this.currentSunPosition.copy(targetSunPosition);
      this.currentSunTarget.copy(targetSunTarget);
    } else {
      // Smoothly lerp current sun position toward target
      this.currentSunPosition.lerp(targetSunPosition, this.params.sunPositionEasing);
      this.currentSunTarget.lerp(targetSunTarget, this.params.sunPositionEasing);
    }

    // Apply smoothed position to light
    this.directionalLight.position.copy(this.currentSunPosition);
    this.directionalLight.target.position.copy(this.currentSunTarget);
    this.directionalLight.target.updateMatrixWorld();
  }

  private getMinimumKeyLightHeight(): number {
    return this.params.sunHeight * KEY_LIGHT_MIN_HEIGHT_RATIO;
  }

  private updateMoonRimLighting(progress: number, cameraTarget?: Vector3): void {
    const nightToneFactor = this.resolveNightToneFactor(progress);
    if (nightToneFactor <= 0) {
      this.moonRimLight.intensity = 0;
      this.lastUpdateMoonRimIntensity = 0;
      return;
    }

    const rimIntensity = Math.max(
      VISIBILITY_FLOORS.moonRimIntensity,
      MathUtils.lerp(VISIBILITY_FLOORS.moonRimIntensity, 0.56, nightToneFactor),
    );
    this.moonRimLight.intensity = rimIntensity;
    this.lastUpdateMoonRimIntensity = rimIntensity;
    this.moonRimLight.color.setHex(this.lerpColor(0x88a9ff, 0xccdbff, nightToneFactor));

    const rimAnchor = cameraTarget ?? this.currentSunTarget;
    this.moonRimDirection.copy(rimAnchor).sub(this.currentSunPosition);
    this.moonRimDirection.y = Math.max(this.moonRimDirection.y, 0.15);

    if (this.moonRimDirection.lengthSq() < 0.0001) {
      this.moonRimDirection.set(0.7, 0.25, 0.7);
    }

    this.moonRimDirection.normalize();

    const rimDistance = this.params.sunDistance * (0.65 + nightToneFactor * 0.25);
    const rimHeight = this.params.sunHeight * (0.22 + nightToneFactor * 0.08);

    this.moonRimPosition.copy(rimAnchor).addScaledVector(this.moonRimDirection, rimDistance);
    this.moonRimPosition.y = rimAnchor.y + rimHeight;

    this.moonRimLight.position.copy(this.moonRimPosition);
    this.moonRimTarget.position.set(rimAnchor.x, rimAnchor.y + 1.2, rimAnchor.z + 5.2);
    this.moonRimTarget.updateMatrixWorld();
  }

  /**
   * Apply weather modulation to lighting
   * Call this after update() to overlay weather effects on the current atmosphere
   *
   * @param skyDarkness - How much to darken the sky (0-1)
   * @param fogDensity - How much to increase fog density (0-1)
   * @param sunOcclusion - How much clouds block the sun (0-1)
   * @param ambientBoost - How much weather should brighten shadows (0-1)
   */
  applyWeatherModulation(skyDarkness: number, fogDensity: number, sunOcclusion: number = 0, ambientBoost = 0): void {
    if (!this.params.enabled) return;

    const haze = MathUtils.clamp(fogDensity, 0, WEATHER_LIMITS.maxHaze);
    const keyLightDimming = MathUtils.clamp(sunOcclusion, 0, 1) * WEATHER_LIMITS.maxKeyLightDimming;
    const shadowLift = MathUtils.clamp(ambientBoost, 0, 1);

    const weatherDimming = MathUtils.clamp(skyDarkness, 0, 1) * WEATHER_LIMITS.maxWeatherDimming;
    const darkenFactor = 1 - weatherDimming;
    (this.scene.background as Color).copy(this.lastUpdateSkyColor).multiplyScalar(darkenFactor);

    const reductionFactor = 1 - keyLightDimming;
    this.directionalLight.intensity = Math.max(
      VISIBILITY_FLOORS.sunIntensity,
      this.lastUpdateDirIntensity * reductionFactor,
    );
    this.hemisphereLight.intensity = Math.max(
      VISIBILITY_FLOORS.hemisphereIntensity,
      this.lastUpdateHemiIntensity + shadowLift,
    );
    this.ambientLight.intensity = Math.max(
      VISIBILITY_FLOORS.ambientIntensity,
      this.lastUpdateAmbientIntensity + shadowLift,
    );
    this.lastWeatherAdjustedHemiIntensity = this.hemisphereLight.intensity;
    this.lastWeatherAdjustedAmbientIntensity = this.ambientLight.intensity;

    if (this.lastUpdateMoonRimIntensity > 0) {
      this.moonRimLight.intensity = Math.max(
        VISIBILITY_FLOORS.moonRimIntensity,
        this.lastUpdateMoonRimIntensity * reductionFactor,
      );
    } else {
      this.moonRimLight.intensity = 0;
    }

    const fogTintBlend = Math.min(haze, WEATHER_LIMITS.maxFogTintBlend);
    this.fog.color.copy(this.lastUpdateFogColor).lerp(this.stormTint, fogTintBlend);
  }

  /**
   * Enable or disable the atmosphere controller
   */
  setEnabled(enabled: boolean): void {
    this.params.enabled = enabled;

    if (!enabled) {
      // Restore original lighting
      this.restoreOriginalLighting();
      this.isProgressInitialized = false;
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
    this.moonRimLight.intensity = 0;
    this.lastWeatherAdjustedHemiIntensity = this.hemisphereLight.intensity;
    this.lastWeatherAdjustedAmbientIntensity = this.ambientLight.intensity;
    this.isProgressInitialized = false;
  }

  /**
   * Return the ambient-light intensity from the current atmosphere frame.
   * Storm-flicker code reads this instead of the live light value so weather
   * boosts are preserved without compounding drift.
   */
  getLastAmbientIntensity(): number {
    return this.lastWeatherAdjustedAmbientIntensity;
  }

  /**
   * Return the hemisphere-light intensity from the current atmosphere frame.
   * Storm-flicker code reads this instead of the live light value so weather
   * boosts are preserved without compounding drift.
   */
  getLastHemisphereIntensity(): number {
    return this.lastWeatherAdjustedHemiIntensity;
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
    if (progress < DAY_PHASE_PROGRESS.dawn) return "Night";
    if (progress < DAY_PHASE_PROGRESS.morning) return "Dawn";
    if (progress < DAY_PHASE_PROGRESS.afternoon) return "Day";
    if (progress < DAY_PHASE_PROGRESS.dusk) return "Afternoon";
    if (progress < DAY_PHASE_PROGRESS.evening) return "Dusk";
    return "Evening";
  }

  /**
   * Add GUI controls for world atmosphere
   */
  addGUIControls(guiFolder: GUI): void {
    const atmosphereFolder = guiFolder.addFolder("World Atmosphere");

    atmosphereFolder
      .add(this.params, "enabled")
      .name("Enable Atmosphere")
      .onChange((value: boolean) => {
        this.setEnabled(value);
      });

    atmosphereFolder.add(this.params, "cycleSpeed", 0.1, 10, 0.1).name("Cycle Speed");

    atmosphereFolder.add(this.params, "transitionSmoothness", 0, 1, 0.05).name("Transition Smoothness");

    atmosphereFolder.add(this.params, "colorTransitionSpeed", 0.01, 1.0, 0.01).name("Color Transition Speed");

    atmosphereFolder.add(this.params, "sunPositionEasing", 0.01, 1.0, 0.01).name("Sun Position Easing");

    atmosphereFolder.add(this.params, "sunHeight", 5, 20, 0.5).name("Sun Height");

    atmosphereFolder.add(this.params, "sunDistance", 10, 30, 1).name("Sun Distance");

    atmosphereFolder.add(this.params, "progressSmoothing", 0.001, 0.5, 0.001).name("Progress Smoothing");

    // Add manual time control for testing
    const timeControl = { manualProgress: 0 };
    atmosphereFolder
      .add(timeControl, "manualProgress", 0, 100, 1)
      .name("Manual Time")
      .onChange((value: number) => {
        if (!this.params.enabled) {
          this.params.enabled = true;
        }
        this.update(value);
      });

    atmosphereFolder.close();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.isDisposed) {
      console.warn("WorldAtmosphereController already disposed, skipping cleanup");
      return;
    }
    this.isDisposed = true;

    this.restoreOriginalLighting();
    this.scene.remove(this.moonRimLight);
    this.scene.remove(this.moonRimTarget);
  }

  /**
   * Interpolate between two angles while respecting wrap-around
   */
  private lerpAngle(current: number, target: number, t: number): number {
    return current + this.getShortestAngleDelta(current, target) * MathUtils.clamp(t, 0, 1);
  }

  private getShortestAngleDelta(current: number, target: number): number {
    return MathUtils.euclideanModulo(target - current + Math.PI, this.fullRotation) - Math.PI;
  }
}
