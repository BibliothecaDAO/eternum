import { useUIStore } from "@/hooks/store/use-ui-store";
import { RainEffect } from "@/three/effects/rain-effect";
import { AmbienceManager } from "@/three/managers/ambience-manager";
import { Navigator } from "@/three/managers/navigator";
import { WeatherManager, type WeatherState } from "@/three/managers/weather-manager";
import { SceneManager } from "@/three/scene-manager";
import { AmbientParticleSystem } from "@/three/systems/ambient-particle-system";
import { GRAPHICS_DEV_GUI_ENABLED, createGuiFolder } from "@/three/utils/gui-manager";
import { clampCycleProgress } from "@/utils/cycle-progress";
import { AmbientLight, HemisphereLight, OrthographicCamera, Scene, Vector3 } from "three";
import { MapControls } from "three/addons/controls/MapControls.js";

type GUIController = {
  updateDisplay?: () => void;
};

const DEBUG_TIME_DISPLAY_SYNC_EPSILON = 0.05;

export default class HUDScene {
  private scene: Scene;
  private camera: OrthographicCamera;
  private sceneManager: SceneManager;
  private controls: MapControls;
  private GUIFolder: any | null = null;
  private navigator: Navigator;
  private ambientLight!: AmbientLight;
  private hemisphereLight!: HemisphereLight;
  private rainEffect!: RainEffect;
  private weatherManager!: WeatherManager;
  private ambienceManager!: AmbienceManager;
  private ambientParticles?: AmbientParticleSystem;
  private navigationTargetUnsubscribe: (() => void) | null = null;
  private cycleProgress: number = 0;
  private particleSpawnCenter: Vector3 = new Vector3();
  private readonly debugTimeControls = {
    overrideTime: false,
    dayProgress: 0,
  };
  private debugTimeOverrideController: GUIController | null = null;
  private debugTimeProgressController: GUIController | null = null;

  constructor(sceneManager: SceneManager, controls: MapControls) {
    this.scene = new Scene();
    this.sceneManager = sceneManager;
    this.controls = controls;
    this.camera = this.createOrthographicCamera();

    this.navigator = new Navigator(this.scene, this.controls);
    this.setupGraphicsDevControls();

    this.addAmbientLight();
    this.addHemisphereLight();
    this.rainEffect = new RainEffect(this.scene);

    // Initialize weather and ambience systems
    this.weatherManager = new WeatherManager(this.scene, this.rainEffect);

    this.ambienceManager = new AmbienceManager();
    this.setupGraphicsDevEffectControls();

    this.ambientParticles = new AmbientParticleSystem(this.scene);

    // Store subscription reference for cleanup
    this.navigationTargetUnsubscribe = useUIStore.subscribe(
      (state) => state.navigationTarget,
      (target) => {
        const currentTarget = this.navigator.getNavigationTarget();
        if (target && target.col !== currentTarget?.col && target.row !== currentTarget?.row) {
          this.setNavigationTarget(target.col, target.row);
        } else {
          this.navigator.clearNavigationTarget();
        }
      },
    );
  }

  private setupGraphicsDevControls(): void {
    if (!GRAPHICS_DEV_GUI_ENABLED) {
      return;
    }

    try {
      this.GUIFolder = createGuiFolder("HUD");
      this.setupNavigatorGuiControls();
      this.GUIFolder.close();
    } catch {
      this.GUIFolder = null;
    }
  }

  private setupNavigatorGuiControls(): void {
    if (!this.GUIFolder) {
      return;
    }

    const navigatorParams = { col: 269, row: 143 };

    this.GUIFolder.add(navigatorParams, "col").name("Col");
    this.GUIFolder.add(navigatorParams, "row").name("Row");
    this.GUIFolder.add(
      {
        setNavigationTarget: () => this.navigator.setNavigationTarget(navigatorParams.col, navigatorParams.row),
      },
      "setNavigationTarget",
    ).name("Navigate to Col Row");
  }

  private setupGraphicsDevEffectControls(): void {
    if (!this.GUIFolder) {
      return;
    }

    try {
      this.rainEffect.addGUIControls(this.GUIFolder);
      this.weatherManager.addGUIControls(this.GUIFolder);
      this.ambienceManager.addGUIControls(this.GUIFolder);
      this.addDebugTimeControls();
    } catch {
      // Dev GUI failures must not block HUD startup.
    }
  }

  private createOrthographicCamera(): OrthographicCamera {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10;
    const camera = new OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000,
    );

    const cameraDistance = Math.sqrt(2 * 7 * 7);
    const cameraAngle = 60 * (Math.PI / 180);
    const cameraHeight = Math.sin(cameraAngle) * cameraDistance;
    const cameraDepth = Math.cos(cameraAngle) * cameraDistance;

    camera.position.set(0, cameraHeight, cameraDepth);
    camera.lookAt(0, 0, 0);
    camera.up.set(0, 1, 0);

    return camera;
  }

  private addAmbientLight() {
    this.ambientLight = new AmbientLight(0xf3c99f, 3.5);
    this.scene.add(this.ambientLight);

    this.GUIFolder?.add(this.ambientLight, "intensity", 0, 10).name("Ambient Light Intensity");
  }

  private addHemisphereLight() {
    this.hemisphereLight = new HemisphereLight(0xf3c99f, 0xffffff, 0.5);
    this.hemisphereLight.position.set(0, 20, 0);
    this.scene.add(this.hemisphereLight);

    this.GUIFolder?.add(this.hemisphereLight, "intensity", 0, 5).name("Hemisphere Light Intensity");
    this.GUIFolder?.add(this.hemisphereLight.position, "x", -10, 10).name("Hemisphere Light X");
    this.GUIFolder?.add(this.hemisphereLight.position, "y", -10, 10).name("Hemisphere Light Y");
    this.GUIFolder?.add(this.hemisphereLight.position, "z", -10, 10).name("Hemisphere Light Z");
  }

  private addDebugTimeControls() {
    if (!this.GUIFolder) {
      return;
    }

    const timeFolder = this.GUIFolder.addFolder("Time Scrubber");

    this.debugTimeOverrideController = timeFolder
      .add(this.debugTimeControls, "overrideTime")
      .name("Override Time")
      .onChange((enabled: boolean) => this.setDebugTimeOverride(enabled));

    this.debugTimeProgressController = timeFolder
      .add(this.debugTimeControls, "dayProgress", 0, 100, 0.1)
      .name("Day Progress")
      .onChange((value: number) => this.previewDebugTime(value));

    timeFolder.close();
  }

  private setDebugTimeOverride(enabled: boolean) {
    this.debugTimeControls.overrideTime = enabled;

    if (enabled) {
      this.applyDebugCycleProgress(this.debugTimeControls.dayProgress);
      return;
    }

    useUIStore.getState().setDebugCycleProgressOverride(null);
  }

  private previewDebugTime(value: number) {
    const progress = clampCycleProgress(value);
    this.debugTimeControls.dayProgress = progress;
    this.debugTimeControls.overrideTime = true;
    this.debugTimeOverrideController?.updateDisplay?.();
    this.applyDebugCycleProgress(progress);
  }

  private applyDebugCycleProgress(progress: number) {
    this.cycleProgress = progress;
    useUIStore.getState().setDebugCycleProgressOverride(progress);
  }

  private syncDebugTimeControls(cycleProgress: number) {
    if (this.debugTimeControls.overrideTime) {
      return;
    }

    const progress = clampCycleProgress(cycleProgress);
    if (Math.abs(this.debugTimeControls.dayProgress - progress) < DEBUG_TIME_DISPLAY_SYNC_EPSILON) {
      return;
    }

    this.debugTimeControls.dayProgress = progress;
    this.debugTimeProgressController?.updateDisplay?.();
  }

  getScene(): Scene {
    return this.scene;
  }

  getCamera(): OrthographicCamera {
    return this.camera;
  }

  getWeatherManager(): WeatherManager {
    return this.weatherManager;
  }

  getWeatherState(): WeatherState {
    return this.weatherManager.getState();
  }

  public hasActiveLabelAnimations(): boolean {
    return this.navigator?.hasActiveLabel() ?? false;
  }

  update(deltaTime: number, cycleProgress?: number) {
    this.navigator.update();

    // Update weather system (handles rain, wind, transitions)
    this.weatherManager.update(deltaTime, this.camera.position);

    // Track cycle progress for ambience
    if (cycleProgress !== undefined) {
      this.cycleProgress = cycleProgress;
      this.syncDebugTimeControls(cycleProgress);
    }

    // Get current weather state
    const weatherState = this.weatherManager.getState();
    const currentWeatherType = this.weatherManager.getCurrentWeather();

    // Drive time-of-day and weather layer scheduling in a single pass.
    this.ambienceManager.update(
      this.cycleProgress,
      currentWeatherType,
      deltaTime,
      weatherState.intensity,
      weatherState.stormIntensity,
    );

    // Update ambient particles (dust motes, fireflies) when the scene owns them.
    if (this.ambientParticles) {
      if (cycleProgress !== undefined) {
        this.ambientParticles.setTimeProgress(cycleProgress);
      }

      // Pass wind to ambient particles
      const windState = this.weatherManager.getWindState();
      this.ambientParticles.setWind(windState.direction, windState.effectiveSpeed);

      // Fade out ambient particles during weather
      this.ambientParticles.setWeatherIntensity(weatherState.intensity);

      // Update particle positions (follow camera)
      this.particleSpawnCenter.set(this.camera.position.x, this.camera.position.y - 5, this.camera.position.z);
      this.ambientParticles.update(deltaTime, this.particleSpawnCenter);
    }
  }

  onWindowResize(width: number, height: number) {
    const aspect = width / height;
    const frustumSize = 10;
    this.camera.left = (frustumSize * aspect) / -2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = frustumSize / -2;
    this.camera.updateProjectionMatrix();
  }

  setNavigationTarget(col: number, row: number) {
    this.navigator.setNavigationTarget(col, row);
  }

  public destroy(): void {
    // CRITICAL: Unsubscribe from store to prevent memory leaks
    if (this.navigationTargetUnsubscribe) {
      this.navigationTargetUnsubscribe();
      this.navigationTargetUnsubscribe = null;
    }

    // Clean up navigator (if it has a destroy method)
    if (this.navigator && "destroy" in this.navigator && typeof (this.navigator as any).destroy === "function") {
      (this.navigator as any).destroy();
    }

    useUIStore.getState().setDebugCycleProgressOverride(null);

    // Clean up rain effect resources
    if (this.rainEffect) {
      this.rainEffect.dispose();
    }

    // Clean up weather manager
    if (this.weatherManager) {
      this.weatherManager.dispose();
    }

    // Clean up ambience manager
    if (this.ambienceManager) {
      this.ambienceManager.dispose();
    }

    // Clean up ambient particles
    if (this.ambientParticles) {
      this.ambientParticles.dispose();
    }

    // Clean up lights
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
    }
    if (this.hemisphereLight) {
      this.scene.remove(this.hemisphereLight);
    }

    // Clean up GUI folder (if it has a destroy method)
    if (this.GUIFolder && "destroy" in this.GUIFolder && typeof this.GUIFolder.destroy === "function") {
      this.GUIFolder.destroy();
    }

    // Clear scene
    this.scene.clear();
  }
}
