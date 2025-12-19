import { useUIStore, type AppStore } from "@/hooks/store/use-ui-store";
import { sqlApi } from "@/services/api";
import { CAMERA_CONFIG, FOG_CONFIG, HEX_SIZE, biomeModelPaths } from "@/three/constants";
import { DayNightCycleManager } from "@/three/effects/day-night-cycle";
import { HighlightHexManager } from "@/three/managers/highlight-hex-manager";
import { InputManager } from "@/three/managers/input-manager";
import InstancedBiome from "@/three/managers/instanced-biome";
import { InteractiveHexManager } from "@/three/managers/interactive-hex-manager";
import { ThunderBoltManager } from "@/three/managers/thunderbolt-manager";
import { type SceneManager } from "@/three/scene-manager";
import { AnimationVisibilityContext } from "@/three/types/animation";
import { CentralizedVisibilityManager, getVisibilityManager } from "@/three/utils/centralized-visibility-manager";
import { GUIManager, LocationManager } from "@/three/utils/";
import { FrustumManager } from "@/three/utils/frustum-manager";
import { MatrixPool } from "@/three/utils/matrix-pool";
import { PerformanceMonitor } from "@/three/utils/performance-monitor";
import { gltfLoader } from "@/three/utils/utils";
import type { QualityFeatures } from "@/three/utils/quality-controller";
import { LeftView } from "@/types";
import { GRAPHICS_SETTING, GraphicsSettings, IS_FLAT_MODE } from "@/ui/config";
import { type SetupResult } from "@bibliothecadao/dojo";
import { WorldUpdateListener } from "@bibliothecadao/eternum";
import { BiomeType, type HexPosition } from "@bibliothecadao/types";
import gsap from "gsap";
import throttle from "lodash/throttle";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  DirectionalLightHelper,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Raycaster,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
} from "three";
import { type MapControls } from "three/examples/jsm/controls/MapControls.js";
import { env } from "../../../env";
import { SceneName } from "../types";
import { getHexForWorldPosition, getWorldPositionForHex } from "../utils";
import { SceneShortcutManager } from "../utils/shortcuts";

export enum CameraView {
  Close = 1,
  Medium = 2,
  Far = 3,
}

export abstract class HexagonScene {
  protected scene!: Scene;
  protected camera!: PerspectiveCamera;
  protected inputManager!: InputManager;
  protected shortcutManager!: SceneShortcutManager;
  protected interactiveHexManager!: InteractiveHexManager;
  protected worldUpdateListener!: WorldUpdateListener;
  protected highlightHexManager!: HighlightHexManager;
  protected locationManager!: LocationManager;
  protected frustumManager!: FrustumManager;
  protected visibilityManager!: CentralizedVisibilityManager;
  protected thunderBoltManager!: ThunderBoltManager;
  protected dayNightCycleManager!: DayNightCycleManager;
  protected GUIFolder!: any;
  protected biomeModels = new Map<BiomeType, InstancedBiome>();
  protected modelLoadPromises: Array<Promise<void>> = [];
  protected state!: AppStore;
  protected fog!: Fog;

  protected mainDirectionalLight!: DirectionalLight;
  protected hemisphereLight!: HemisphereLight;
  protected lightHelper!: DirectionalLightHelper;
  protected stormLight!: PointLight;
  protected ambientPurpleLight!: AmbientLight;

  private stormAmbientBaseIntensity?: number;
  private stormHemisphereBaseIntensity?: number;

  private groundMesh!: Mesh;
  private uiStateUnsubscribe?: () => void;
  private lightningEndTime: number = 0;
  private originalLightningIntensity: number = 0;
  private originalLightningColor: number = 0;
  private originalStormLightningIntensity: number = 0;
  private cameraViewListeners: Set<(view: CameraView) => void> = new Set();
  private lastLightningTriggerProgress: number = -1;
  private lightningSequenceTimeout: NodeJS.Timeout | null = null;
  private currentStrikeIndex: number = 0;
  private lightningStrikes: Array<{ delay: number; duration: number }> = [
    { delay: 0, duration: 80 },
    { delay: 200, duration: 60 },
    { delay: 450, duration: 100 },
    { delay: 700, duration: 40 },
  ];

  protected cameraDistance = CAMERA_CONFIG.defaultDistance; // Maintain the same distance
  protected cameraAngle = CAMERA_CONFIG.defaultAngle;
  protected currentCameraView = CameraView.Medium; // Track current camera view position
  private animationCameraTarget: Vector3 = new Vector3();
  private animationVisibilityContext?: AnimationVisibilityContext;
  private readonly animationVisibilityDistance = 140;
  protected shadowsEnabledByQuality = true;
  protected shadowMapSizeByQuality = 2048;
  private lastClipNear = 0;
  private lastClipFar = 0;
  private fogEnabledByQuality = false;
  private fogEnabledByUser = false;

  // Performance tuning options (optimized defaults for better FPS)
  protected biomeShadowsEnabled = false;
  protected biomeAnimationsEnabled = false;
  protected animationDistanceThreshold = 80; // Distance beyond which animations are skipped
  private lastFogNear = 0;
  private lastFogFar = 0;

  constructor(
    protected sceneName: SceneName,
    protected controls: MapControls,
    protected dojo: SetupResult,
    private mouse: Vector2,
    private raycaster: Raycaster,
    protected sceneManager: SceneManager,
  ) {
    this.initializeScene();
    this.frustumManager = new FrustumManager(this.camera, this.controls);
    // Initialize centralized visibility manager (singleton)
    this.visibilityManager = getVisibilityManager({
      debug: false,
      animationMaxDistance: this.animationVisibilityDistance,
    });
    this.visibilityManager.initialize(this.camera, this.controls);
    this.setupLighting();
    this.setupInputHandlers();
    this.setupGUI();
    this.createGroundMesh();
  }

  private notifyControlsChanged(): void {
    this.controls.update();
    const distance = this.controls.object.position.distanceTo(this.controls.target);
    this.updateCameraClipPlanesForDistance(distance);
    this.updateFogForDistance(distance);
    this.updateOutlineOpacityForDistance(distance);
    this.controls.dispatchEvent({ type: "change" });
    this.frustumManager?.forceUpdate();
    this.visibilityManager?.markDirty();
  }

  private initializeScene(): void {
    this.scene = new Scene();
    this.camera = this.controls.object as PerspectiveCamera;
    this.locationManager = new LocationManager();
    this.inputManager = new InputManager(this.sceneName, this.sceneManager, this.raycaster, this.mouse, this.camera);
    this.interactiveHexManager = new InteractiveHexManager(this.scene);
    this.worldUpdateListener = new WorldUpdateListener(this.dojo, sqlApi);
    this.highlightHexManager = new HighlightHexManager(this.scene);
    this.thunderBoltManager = new ThunderBoltManager(this.scene, this.controls);
    this.scene.background = new Color(0x2a1a3e);
    this.state = useUIStore.getState();
    this.fog = new Fog(FOG_CONFIG.color, FOG_CONFIG.near, FOG_CONFIG.far);
    this.fogEnabledByQuality = !IS_FLAT_MODE && GRAPHICS_SETTING !== GraphicsSettings.LOW;
    this.fogEnabledByUser = false;
    if (this.fogEnabledByQuality && this.fogEnabledByUser) {
      this.scene.fog = this.fog;
      const initialDistance = this.controls.object.position.distanceTo(this.controls.target);
      this.updateFogForDistance(initialDistance);
    }

    // subscribe to state changes
    this.uiStateUnsubscribe = useUIStore.subscribe(
      (state) => ({
        leftNavigationView: state.leftNavigationView,
        structureEntityId: state.structureEntityId,
        cycleProgress: state.cycleProgress,
        cycleTime: state.cycleTime,
      }),
      ({ leftNavigationView, structureEntityId, cycleProgress, cycleTime }) => {
        this.state.leftNavigationView = leftNavigationView;
        this.state.structureEntityId = structureEntityId;
        this.state.cycleProgress = cycleProgress;
        this.state.cycleTime = cycleTime;
      },
    );
  }

  protected disposeStateSyncSubscription(): void {
    if (!this.uiStateUnsubscribe) {
      return;
    }

    try {
      this.uiStateUnsubscribe();
    } catch (error) {
      console.warn("[HexagonScene] Failed to unsubscribe UI state listener", error);
    } finally {
      this.uiStateUnsubscribe = undefined;
    }
  }

  private setupLighting(): void {
    this.setupHemisphereLight();
    this.setupDirectionalLight();
    this.setupStormLighting();
    this.setupLightHelper();
    this.setupDayNightCycle();
  }

  private setupHemisphereLight(): void {
    this.hemisphereLight = new HemisphereLight(0x6a3a6a, 0xffffff, 1.2);
    this.scene.add(this.hemisphereLight);
  }

  private setupDirectionalLight(): void {
    this.mainDirectionalLight = new DirectionalLight(0x9966ff, 2.0);
    this.configureDirectionalLight();
    this.scene.add(this.mainDirectionalLight);
    this.scene.add(this.mainDirectionalLight.target);
  }

  private configureDirectionalLight(): void {
    this.mainDirectionalLight.castShadow = this.shadowsEnabledByQuality;
    this.mainDirectionalLight.shadow.mapSize.width = this.shadowMapSizeByQuality;
    this.mainDirectionalLight.shadow.mapSize.height = this.shadowMapSizeByQuality;
    this.mainDirectionalLight.shadow.camera.left = -20;
    this.mainDirectionalLight.shadow.camera.right = 20;
    this.mainDirectionalLight.shadow.camera.top = 13;
    this.mainDirectionalLight.shadow.camera.bottom = -13;
    this.mainDirectionalLight.shadow.camera.far = 38;
    this.mainDirectionalLight.shadow.camera.near = 8;
    this.mainDirectionalLight.shadow.bias = -0.02;
    this.mainDirectionalLight.position.set(-15, 13, 8);
    this.mainDirectionalLight.target.position.set(0, 0, -5.2);
  }

  private setupStormLighting(): void {
    this.ambientPurpleLight = new AmbientLight(0x3a1a3a, 0.1);
    this.scene.add(this.ambientPurpleLight);

    this.stormLight = new PointLight(0xaa77ff, 1.5, 80);
    this.stormLight.position.set(0, 20, 0);
    this.scene.add(this.stormLight);
  }

  private setupLightHelper(): void {
    this.lightHelper = new DirectionalLightHelper(this.mainDirectionalLight, 1);
    if (env.VITE_PUBLIC_GRAPHICS_DEV == true) this.scene.add(this.lightHelper);
  }

  private setupDayNightCycle(): void {
    this.dayNightCycleManager = new DayNightCycleManager(
      this.scene,
      this.mainDirectionalLight,
      this.hemisphereLight,
      this.ambientPurpleLight,
      this.fog,
    );
  }

  private setupInputHandlers(): void {
    this.inputManager.addListener("mousemove", throttle(this.handleMouseMove.bind(this), 50));
    this.inputManager.addListener("dblclick", this.handleDoubleClick.bind(this));
    this.inputManager.addListener("click", this.handleClick.bind(this));
    this.inputManager.addListener("contextmenu", this.handleRightClick.bind(this));
  }

  private handleMouseMove(_event: MouseEvent, raycaster: Raycaster): void {
    const hoveredHex = this.interactiveHexManager.onMouseMove(raycaster);
    if (hoveredHex) {
      this.onHexagonMouseMove(hoveredHex);
    } else {
      this.onHexagonMouseMove(null);
    }
  }

  private handleDoubleClick(_event: MouseEvent, raycaster: Raycaster): void {
    useUIStore.getState().closeContextMenu();
    const clickedHex = this.interactiveHexManager.onClick(raycaster);
    if (clickedHex) {
      this.onHexagonDoubleClick(clickedHex.hexCoords);
    }
  }

  private handleClick(_event: MouseEvent, raycaster: Raycaster): void {
    useUIStore.getState().closeContextMenu();
    const clickedHex = this.interactiveHexManager.onClick(raycaster);
    if (clickedHex) {
      this.onHexagonClick(clickedHex.hexCoords);
    } else {
      this.onHexagonClick(null);
    }
  }

  private handleRightClick(event: MouseEvent, raycaster: Raycaster): void {
    const store = useUIStore.getState();
    store.closeContextMenu();
    const clickedHex = this.interactiveHexManager.onClick(raycaster);
    if (clickedHex) {
      this.onHexagonRightClick(event, clickedHex.hexCoords);
    } else {
      this.onHexagonRightClick(event, null);
    }
  }

  private setupGUI(): void {
    this.GUIFolder = GUIManager.addFolder(this.sceneName);
    this.setupSceneGUI();
    this.setupHemisphereLightGUI();
    this.setupDirectionalLightGUI();
    this.setupAmbientLightGUI();
    this.setupStormLightGUI();
    this.setupShadowGUI();
    this.setupFogGUI();
    this.setupPerformanceGUI();
    this.thunderBoltManager.setupGUI(this.GUIFolder);
    this.dayNightCycleManager.addGUIControls(this.GUIFolder);
  }

  private setupSceneGUI(): void {
    this.GUIFolder.addColor(this.scene, "background");
    this.GUIFolder.close();
  }

  private setupHemisphereLightGUI(): void {
    const hemisphereLightFolder = this.GUIFolder.addFolder("Hemisphere Light");
    hemisphereLightFolder.addColor(this.hemisphereLight, "color");
    hemisphereLightFolder.addColor(this.hemisphereLight, "groundColor");
    hemisphereLightFolder.add(this.hemisphereLight, "intensity", 0, 3, 0.1);
    hemisphereLightFolder.close();
  }

  private setupDirectionalLightGUI(): void {
    const directionalLightFolder = this.GUIFolder.addFolder("Directional Light");
    directionalLightFolder.addColor(this.mainDirectionalLight, "color");
    directionalLightFolder.add(this.mainDirectionalLight.position, "x", -20, 20, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.position, "y", -20, 20, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.position, "z", -20, 20, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight, "intensity", 0, 3, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.target.position, "x", 0, 10, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.target.position, "y", 0, 10, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.target.position, "z", 0, 10, 0.1);
    directionalLightFolder.add(this.scene, "environmentIntensity", 0, 2, 0.01);
    directionalLightFolder.close();
  }

  private setupShadowGUI(): void {
    const shadowFolder = this.GUIFolder.addFolder("Shadow");
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "left", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "right", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "top", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "bottom", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "far", 0, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "near", 0, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow, "bias", -0.1, 0.1, 0.0015);
    shadowFolder.close();
  }

  private setupAmbientLightGUI(): void {
    const ambientLightFolder = this.GUIFolder.addFolder("Ambient Light");
    ambientLightFolder.addColor(this.ambientPurpleLight, "color");
    ambientLightFolder.add(this.ambientPurpleLight, "intensity", 0, 1, 0.01);
    ambientLightFolder.close();
  }

  private setupStormLightGUI(): void {
    const stormLightFolder = this.GUIFolder.addFolder("Storm Light");
    stormLightFolder.addColor(this.stormLight, "color");
    stormLightFolder.add(this.stormLight, "intensity", 0, 5, 0.1);
    stormLightFolder.add(this.stormLight, "distance", 0, 200, 1);
    stormLightFolder.add(this.stormLight.position, "x", -50, 50, 1);
    stormLightFolder.add(this.stormLight.position, "y", 0, 50, 1);
    stormLightFolder.add(this.stormLight.position, "z", -50, 50, 1);
    stormLightFolder.close();
  }

  private setupFogGUI(): void {
    const fogFolder = this.GUIFolder.addFolder("Fog");
    fogFolder.addColor(this.fog, "color").name("Color");
    fogFolder.add(this.fog, "near", 0, 100, 0.1).name("Near");
    fogFolder.add(this.fog, "far", 0, 100, 0.1).name("Far");

    // Add toggle for fog
    const fogParams = { enabled: this.fogEnabledByUser };
    fogFolder
      .add(fogParams, "enabled")
      .name("Enable Fog")
      .onChange((value: boolean) => {
        this.fogEnabledByUser = value;
        const distance = this.controls.object.position.distanceTo(this.controls.target);
        this.updateFogForDistance(distance);
      });

    fogFolder.close();
  }

  private setupPerformanceGUI(): void {
    const perfFolder = this.GUIFolder.addFolder("Performance");

    // Performance monitoring toggle
    const perfParams = {
      enabled: PerformanceMonitor.isEnabled(),
      simulatedHexes: PerformanceMonitor.getSimulatedHexCount(),
      logReport: () => {
        const matrixStats = MatrixPool.getInstance().getStats();
        PerformanceMonitor.logSummary(matrixStats);
      },
      exploreAllHexes: () => {
        this.simulateHexExploration(5000);
      },
      exploreHexes1k: () => {
        this.simulateHexExploration(1000);
      },
      exploreHexes9k: () => {
        this.simulateHexExploration(9000);
      },
      clearSimulation: () => {
        this.clearHexSimulation();
      },
    };

    perfFolder
      .add(perfParams, "enabled")
      .name("Enable Monitoring")
      .onChange((value: boolean) => {
        PerformanceMonitor.setEnabled(value);
      });

    perfFolder
      .add(perfParams, "simulatedHexes", 0, 15000, 100)
      .name("Simulated Hexes")
      .onChange((value: number) => {
        PerformanceMonitor.setSimulatedHexCount(value);
      });

    perfFolder.add(perfParams, "logReport").name("Log Performance Report");
    perfFolder.add(perfParams, "exploreHexes1k").name("Simulate 1K Hexes");
    perfFolder.add(perfParams, "exploreAllHexes").name("Simulate 5K Hexes");
    perfFolder.add(perfParams, "exploreHexes9k").name("Simulate 9K Hexes");
    perfFolder.add(perfParams, "clearSimulation").name("Clear Simulation");

    // Phase 1 Performance Optimizations
    const optimizeFolder = perfFolder.addFolder("Optimizations");

    optimizeFolder
      .add(this, "biomeShadowsEnabled")
      .name("Biome Shadows")
      .onChange((value: boolean) => {
        this.setBiomeShadowsEnabled(value);
      });

    optimizeFolder
      .add(this, "biomeAnimationsEnabled")
      .name("Biome Animations")
      .onChange((value: boolean) => {
        console.log(`[Performance] Biome animations: ${value}`);
      });

    optimizeFolder
      .add(this, "animationDistanceThreshold", 20, 200, 10)
      .name("Anim Distance")
      .onChange((value: number) => {
        console.log(`[Performance] Animation distance threshold: ${value}`);
      });

    // Stats button
    const statsParams = {
      logStats: () => {
        this.logRenderStats();
      },
    };
    optimizeFolder.add(statsParams, "logStats").name("Log Render Stats");

    optimizeFolder.open();
    perfFolder.close();
  }

  /**
   * Log rendering statistics for debugging performance
   */
  protected logRenderStats(): void {
    let totalMeshes = 0;
    let totalInstances = 0;
    let activeBiomes = 0;

    console.group("Render Stats");

    this.biomeModels.forEach((biome, biomeType) => {
      const meshCount = biome.instancedMeshes.length;
      let biomeInstances = 0;

      biome.instancedMeshes.forEach((mesh) => {
        biomeInstances += mesh.count;
      });

      if (biomeInstances > 0) {
        activeBiomes++;
        console.log(`${biomeType}: ${meshCount} meshes, ${biomeInstances} instances`);
      }

      totalMeshes += meshCount;
      totalInstances += biomeInstances;
    });

    console.log("---");
    console.log(`Total: ${activeBiomes} active biomes, ${totalMeshes} meshes, ${totalInstances} instances`);
    console.log(`Estimated draw calls: ${totalMeshes} (each InstancedMesh = 1 draw call)`);
    console.groupEnd();
  }

  /**
   * Enable or disable shadow casting on all biome meshes.
   * Disabling shadows can improve GPU performance by ~30-50%.
   */
  protected setBiomeShadowsEnabled(enabled: boolean): void {
    console.log(`[Performance] Biome shadows: ${enabled}`);
    this.biomeShadowsEnabled = enabled;
    this.biomeModels.forEach((biome) => {
      biome.setShadowsEnabled(enabled);
    });
  }

  /**
   * Simulate hex exploration for performance testing
   * For WorldMap: renders a large grid of hexes centered on current camera target
   * For Hexception: adds hexes to the persistent collection
   */
  protected simulateHexExploration(hexCount: number): void {
    console.log(`Simulating exploration of ${hexCount} hexes...`);
    PerformanceMonitor.begin("simulateHexExploration");
    PerformanceMonitor.setSimulatedHexCount(hexCount);
    PerformanceMonitor.setSimulating(true);

    // Calculate grid dimensions to approximate hexCount
    // For a square-ish grid: width * height ≈ hexCount
    const gridSize = Math.ceil(Math.sqrt(hexCount));

    // Get current camera target position for centering
    const target = this.controls.target;
    const centerHex = this.getHexFromWorldPosition(target);

    if (this.sceneName === SceneName.Hexception) {
      // For Hexception (persistent mode): use addHex + renderAllHexes
      const hexes: Array<{ col: number; row: number }> = [];
      let col = 0;
      let row = 0;
      let direction = 0;
      let ringSize = 1;
      let stepsInCurrentDirection = 0;
      let directionsCompleted = 0;

      hexes.push({ col: centerHex.col, row: centerHex.row });

      const directions = [
        { col: 1, row: 0 },
        { col: 0, row: 1 },
        { col: -1, row: 1 },
        { col: -1, row: 0 },
        { col: 0, row: -1 },
        { col: 1, row: -1 },
      ];

      col = centerHex.col;
      row = centerHex.row;

      while (hexes.length < hexCount) {
        col += directions[direction].col;
        row += directions[direction].row;
        hexes.push({ col, row });
        stepsInCurrentDirection++;

        if (stepsInCurrentDirection >= ringSize) {
          stepsInCurrentDirection = 0;
          direction = (direction + 1) % 6;
          directionsCompleted++;

          if (directionsCompleted >= 6) {
            directionsCompleted = 0;
            ringSize++;
          }
        }
      }

      hexes.forEach((hex) => {
        this.interactiveHexManager.addHex(hex);
      });
      this.interactiveHexManager.renderAllHexes();
    } else {
      // For WorldMap (non-persistent mode): use updateVisibleHexes with large window
      // This simulates having many hexes in the render window
      this.interactiveHexManager.updateVisibleHexes(centerHex.row, centerHex.col, gridSize, gridSize);
    }

    const duration = PerformanceMonitor.end("simulateHexExploration");
    console.log(`Simulated ${hexCount} hexes (${gridSize}x${gridSize} grid) in ${duration.toFixed(2)}ms`);

    // Log matrix pool stats
    const matrixStats = MatrixPool.getInstance().getStats();
    console.log(
      `Matrix Pool: ${matrixStats.inUse} in use, ${matrixStats.totalAllocated} allocated (${matrixStats.memoryEstimateMB.toFixed(2)}MB)`,
    );
  }

  /**
   * Clear simulated hex exploration
   */
  protected clearHexSimulation(): void {
    console.log("Clearing hex simulation...");
    PerformanceMonitor.setSimulatedHexCount(0);
    PerformanceMonitor.setSimulating(false);
    this.interactiveHexManager.clearHexes();
  }

  private setupGroundMeshGUI(): void {
    const groundMeshFolder = this.GUIFolder.addFolder("Ground Mesh");
    groundMeshFolder.add(this.groundMesh.material, "metalness", 0, 1, 0.01).name("Metalness");
    groundMeshFolder.add(this.groundMesh.material, "roughness", 0, 1, 0.01).name("Roughness");
    groundMeshFolder.close();
  }

  public getScene() {
    return this.scene;
  }

  public getCamera() {
    return this.camera;
  }

  public getThunderBoltManager(): ThunderBoltManager {
    return this.thunderBoltManager;
  }

  public setEnvironment(texture: Texture, intensity: number = 1) {
    this.scene.environment = texture;
    this.scene.environmentIntensity = intensity;
  }

  public closeNavigationViews() {
    this.state.setLeftNavigationView(LeftView.None);
  }

  public applyQualityFeatures(features: QualityFeatures): void {
    const shadowsEnabledChanged = this.shadowsEnabledByQuality !== features.shadows;
    this.shadowsEnabledByQuality = features.shadows;
    if (features.shadowMapSize > 0) {
      this.shadowMapSizeByQuality = features.shadowMapSize;
    }

    const nextFogQualityEnabled = !IS_FLAT_MODE && features.pixelRatio > 1;
    if (nextFogQualityEnabled !== this.fogEnabledByQuality) {
      this.fogEnabledByQuality = nextFogQualityEnabled;
      if (!this.fogEnabledByQuality) {
        this.scene.fog = null;
      }
    }

    if (this.mainDirectionalLight) {
      this.mainDirectionalLight.castShadow = this.shadowsEnabledByQuality && this.currentCameraView !== CameraView.Far;
      if (this.shadowMapSizeByQuality > 0) {
        this.mainDirectionalLight.shadow.mapSize.set(this.shadowMapSizeByQuality, this.shadowMapSizeByQuality);
      }
    }

    if (features.animationFPS > 0) {
      this.biomeModels.forEach((model) => {
        model.setAnimationFPS?.(features.animationFPS);
      });
    }

    if (shadowsEnabledChanged) {
      this.cameraViewListeners.forEach((listener) => listener(this.currentCameraView));
    }

    const distance = this.controls.object.position.distanceTo(this.controls.target);
    this.updateFogForDistance(distance);
  }

  public isNavigationViewOpen() {
    return this.state.leftNavigationView !== LeftView.None;
  }

  protected hashCoordinates(x: number, y: number): number {
    // Simple hash function to generate a deterministic value between 0 and 1
    const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return hash - Math.floor(hash);
  }

  private getHexFromWorldPosition(position: Vector3): HexPosition {
    const horizontalSpacing = HEX_SIZE * Math.sqrt(3);
    const verticalSpacing = (HEX_SIZE * 3) / 2;

    // Then use col to calculate row
    const row = Math.round(-position.z / verticalSpacing);

    // Adjust x position based on row parity
    const adjustedX = position.x - (row % 2) * (horizontalSpacing / 2);

    // Recalculate col using adjusted x
    const adjustedCol = Math.round(adjustedX / horizontalSpacing);

    return { row, col: adjustedCol };
  }

  getHexagonCoordinates(instancedMesh: InstancedMesh, instanceId: number): HexPosition & { x: number; z: number } {
    const matrixPool = MatrixPool.getInstance();
    const matrix = matrixPool.getMatrix();
    instancedMesh.getMatrixAt(instanceId, matrix);
    const position = new Vector3();
    matrix.decompose(position, new Quaternion(), new Vector3());

    const { row, col } = this.getHexFromWorldPosition(position);

    console.log("row", row, col);

    // Release matrix back to pool
    matrixPool.releaseMatrix(matrix);

    return { row, col, x: position.x, z: position.z };
  }

  getLocationCoordinates() {
    const col = this.locationManager.getCol()!;
    const row = this.locationManager.getRow()!;
    const { x, z } = getWorldPositionForHex({ col, row });
    return { col, row, x, z };
  }

  cameraAnimate(newPosition: Vector3, newTarget: Vector3, transitionDuration: number, onFinish?: () => void) {
    const camera = this.controls.object;
    const target = this.controls.target;
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(target);

    const duration = transitionDuration || 2;

    const onUpdate = () => {
      this.notifyControlsChanged();
    };

    gsap.timeline().to(camera.position, {
      duration,
      repeat: 0,
      x: newPosition.x,
      y: newPosition.y,
      z: newPosition.z,
      ease: "power3.inOut",
      onUpdate,
      onComplete: () => {
        onFinish?.();
      },
    });

    gsap.timeline().to(
      target,
      {
        duration,
        repeat: 0,
        x: newTarget.x,
        y: newTarget.y,
        z: newTarget.z,
        ease: "power3.inOut",
        onUpdate,
      },
      "<",
    );
  }

  public moveCameraToXYZ(x: number, y: number, z: number, duration: number = 2) {
    const newTarget = new Vector3(x, y, z);
    const target = this.controls.target;
    const pos = this.controls.object.position;
    const deltaX = newTarget.x - target.x;
    const deltaZ = newTarget.z - target.z;

    const newPosition = IS_FLAT_MODE
      ? new Vector3(newTarget.x, pos.y, newTarget.z)
      : new Vector3(pos.x + deltaX, pos.y, pos.z + deltaZ);

    if (duration) {
      this.cameraAnimate(newPosition, newTarget, duration);
    } else {
      target.copy(newTarget);
      pos.copy(newPosition);
      this.notifyControlsChanged();
    }
  }

  public moveCameraToColRow(col: number, row: number, duration: number = 2) {
    const { x, y, z } = getWorldPositionForHex({ col, row });

    const newTarget = new Vector3(x, y, z);

    const target = this.controls.target;
    const pos = this.controls.object.position;

    // go to new target with but keep same view angle
    const deltaX = newTarget.x - target.x;
    const deltaZ = newTarget.z - target.z;

    const newPosition = IS_FLAT_MODE
      ? new Vector3(newTarget.x, pos.y, newTarget.z)
      : new Vector3(pos.x + deltaX, pos.y, pos.z + deltaZ);

    if (duration) {
      this.cameraAnimate(newPosition, newTarget, duration);
    } else {
      target.copy(newTarget);
      pos.copy(newPosition);
      this.notifyControlsChanged();
    }
  }

  public getCameraTargetPosition(): Vector3 {
    return this.controls.target.clone();
  }

  public getCameraTargetHex(): HexPosition {
    return getHexForWorldPosition(this.controls.target);
  }

  loadBiomeModels(maxInstances: number) {
    const loader = gltfLoader;

    for (const [biome, path] of Object.entries(biomeModelPaths)) {
      const loadPromise = new Promise<void>((resolve, reject) => {
        loader.load(
          path,
          (gltf) => {
            const model = gltf.scene as Group;
            if (biome === "Outline") {
              ((model.children[0] as Mesh).material as MeshStandardMaterial).transparent = true;
              ((model.children[0] as Mesh).material as MeshStandardMaterial).opacity = 0.3;
            }
            const tmp = new InstancedBiome(gltf, maxInstances, false, biome);
            this.biomeModels.set(biome as BiomeType, tmp);
            this.onBiomeModelLoaded(tmp);
            this.scene.add(tmp.group);
            resolve();
          },
          undefined,
          (error) => {
            console.error(`Error loading ${biome} model:`, error);
            reject(error);
          },
        );
      });
      this.modelLoadPromises.push(loadPromise);
    }
  }

  private createGroundMesh() {
    const scale = 60;
    const metalness = 0;
    const roughness = 0.66;

    const geometry = new PlaneGeometry(2668, 1390.35);
    const texture = new TextureLoader().load("/textures/paper/worldmap-bg-blitz.png", () => {
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.repeat.set(scale, scale / 2.5);
      texture.anisotropy = 4; // Sharper terrain at tilted viewing angles
    });

    const material = new MeshStandardMaterial({
      map: texture,
      metalness: metalness,
      roughness: roughness,
      side: DoubleSide,
    });

    const mesh = new Mesh(geometry, material);
    mesh.rotation.set(Math.PI / 2, 0, Math.PI);
    const { x, z } = getWorldPositionForHex({ col: 185, row: 150 });
    mesh.position.set(x, -0.05, z);
    mesh.receiveShadow = true;
    // disable raycast
    mesh.raycast = () => {};

    this.scene.add(mesh);
    this.groundMesh = mesh;
    this.setupGroundMeshGUI();
  }

  protected shouldUpdateBiomeAnimations(): boolean {
    return this.biomeAnimationsEnabled;
  }

  protected onBiomeModelLoaded(_model: InstancedBiome): void {
    // Derived scenes can override to configure biome meshes on load.
  }

  update(deltaTime: number): void {
    PerformanceMonitor.recordFrame();
    PerformanceMonitor.begin("scene.update");

    PerformanceMonitor.begin("interactiveHexManager.update");
    this.interactiveHexManager.update();
    PerformanceMonitor.end("interactiveHexManager.update");

    this.updateLights();
    this.updateHighlightPulse();
    this.thunderBoltManager.update();

    if (this.shouldEnableStormEffects()) {
      this.updateStormEffects();
    }

    if (this.shouldUpdateBiomeAnimations()) {
      PerformanceMonitor.begin("biomeAnimations.total");
      const animationContext = this.getAnimationVisibilityContext();
      this.biomeModels.forEach((biome, biomeType) => {
        try {
          PerformanceMonitor.begin(`biome.${biomeType}`);
          biome.updateAnimations(deltaTime, animationContext);
          PerformanceMonitor.end(`biome.${biomeType}`);
        } catch (error) {
          console.error(`Error updating biome animations:`, error);
        }
      });
      PerformanceMonitor.end("biomeAnimations.total");
    }

    PerformanceMonitor.end("scene.update");
  }

  protected updateOutlineOpacityForDistance(distance: number): void {
    const outlineKey = "Outline" as unknown as BiomeType;
    const outlineModel = this.biomeModels.get(outlineKey);
    if (!outlineModel) {
      return;
    }

    const minDistance = 10;
    const maxDistance = 40;
    const t = Math.min(1, Math.max(0, (distance - minDistance) / (maxDistance - minDistance)));
    const opacity = 0.04 + t * 0.06;

    outlineModel.instancedMeshes.forEach((mesh) => {
      const material = mesh.material as MeshStandardMaterial;
      material.transparent = true;
      material.opacity = opacity;
    });
  }

  protected getAnimationVisibilityContext(): AnimationVisibilityContext | undefined {
    this.animationCameraTarget.copy(this.controls.target);

    // Begin frame for centralized visibility manager (computes all visibility once)
    this.visibilityManager?.beginFrame();

    if (!this.animationVisibilityContext) {
      this.animationVisibilityContext = {
        visibilityManager: this.visibilityManager,
        frustumManager: this.frustumManager, // Keep for backward compatibility
        cameraPosition: this.animationCameraTarget,
        maxDistance: this.animationDistanceThreshold, // Use configurable threshold
      };
    } else {
      this.animationVisibilityContext.visibilityManager = this.visibilityManager;
      this.animationVisibilityContext.frustumManager = this.frustumManager;
      this.animationVisibilityContext.maxDistance = this.animationDistanceThreshold;
    }

    return this.animationVisibilityContext;
  }

  private updateLights = throttle(() => {
    // Only manually update lights if day/night cycle is not managing them
    if (this.mainDirectionalLight && !this.dayNightCycleManager?.params?.enabled) {
      const { x, y, z } = this.controls.target;
      this.mainDirectionalLight.position.set(x - 15, y + 13, z + 8);
      this.mainDirectionalLight.target.position.set(x, y, z - 5.2);
      this.mainDirectionalLight.target.updateMatrixWorld();
    }
    if (this.lightHelper) this.lightHelper.update();
  }, 30);

  private updateHighlightPulse(): void {
    const elapsedTime = performance.now() / 1000;
    const pulseFactor = Math.abs(Math.sin(elapsedTime * 2) / 16);
    this.highlightHexManager.updateHighlightPulse(pulseFactor);
  }

  private updateStormEffects(): void {
    const currentTime = performance.now();
    const elapsedTime = currentTime / 1000;

    // Check if lightning should end
    if (this.lightningEndTime > 0 && currentTime >= this.lightningEndTime) {
      this.endLightning();
    }

    // Check for lightning trigger based on cycle timing instead of random
    const cycleProgress = this.state.cycleProgress || 0;
    this.shouldTriggerLightningAtCycleProgress(cycleProgress);

    // Update day/night cycle with camera target for proper light positioning
    const cameraTarget = this.controls.target;
    this.dayNightCycleManager.update(cycleProgress, cameraTarget);

    // Apply weather modulation during storm periods (cycleProgress < 20)
    // This darkens the sky, increases fog, and reduces sun intensity
    const stormPeriod = cycleProgress < 20;
    if (stormPeriod) {
      // Calculate storm intensity based on how deep into the storm period we are
      // Peak intensity at cycleProgress = 10, fading at edges
      const stormDepth = 1 - Math.abs(cycleProgress - 10) / 10;
      const skyDarkness = stormDepth * 0.6;
      const fogDensity = stormDepth * 0.5;
      const sunOcclusion = stormDepth * 0.7;

      this.dayNightCycleManager.applyWeatherModulation(skyDarkness, fogDensity, sunOcclusion);
    }

    // Make storm light follow camera to avoid shadow/light direction mismatch
    // Position above and slightly behind camera target for consistent fill lighting
    this.stormLight.position.set(cameraTarget.x, cameraTarget.y + 25, cameraTarget.z + 5);

    // Only update normal storm effects if lightning is not active
    // Reduced base intensity to avoid overpowering directional light shadows
    // Also scale storm light with storm period intensity
    if (this.lightningEndTime === 0) {
      const baseStormIntensity = stormPeriod ? 0.6 : 0.2;
      const stormIntensity = baseStormIntensity + Math.sin(elapsedTime * 0.3) * 0.15;
      this.stormLight.intensity = stormIntensity;
    }

    // Keep fill lights restrained for readability; apply subtle flicker relative to the current base.
    const dayNightEnabled = this.dayNightCycleManager?.params?.enabled === true;

    const ambientBase = dayNightEnabled
      ? this.ambientPurpleLight.intensity
      : (this.stormAmbientBaseIntensity ?? this.ambientPurpleLight.intensity);
    const hemisphereBase = dayNightEnabled
      ? this.hemisphereLight.intensity
      : (this.stormHemisphereBaseIntensity ?? this.hemisphereLight.intensity);

    if (dayNightEnabled) {
      this.stormAmbientBaseIntensity = ambientBase;
      this.stormHemisphereBaseIntensity = hemisphereBase;
    } else {
      this.stormAmbientBaseIntensity ??= ambientBase;
      this.stormHemisphereBaseIntensity ??= hemisphereBase;
    }

    const ambientFlicker = 1 + Math.sin(elapsedTime * 2) * 0.06;
    this.ambientPurpleLight.intensity = ambientBase * ambientFlicker;

    const hemisphereFlicker = 1 + Math.sin(elapsedTime * 1.5) * 0.06;
    this.hemisphereLight.intensity = hemisphereBase * hemisphereFlicker;
  }

  private startLightningSequence(): void {
    // Clear any existing sequence
    if (this.lightningSequenceTimeout) {
      clearTimeout(this.lightningSequenceTimeout);
    }

    this.currentStrikeIndex = 0;
    this.executeNextStrike();
  }

  private executeNextStrike(): void {
    if (this.currentStrikeIndex >= this.lightningStrikes.length) {
      // Sequence complete
      this.currentStrikeIndex = 0;
      return;
    }

    const strike = this.lightningStrikes[this.currentStrikeIndex];

    // Schedule this strike
    this.lightningSequenceTimeout = setTimeout(() => {
      this.triggerSingleLightningStrike(strike.duration);
      this.currentStrikeIndex++;
      this.executeNextStrike(); // Schedule next strike
    }, strike.delay);
  }

  private triggerSingleLightningStrike(duration: number): void {
    // Store original values only once
    if (this.lightningEndTime === 0) {
      this.originalLightningIntensity = this.mainDirectionalLight.intensity;
      this.originalLightningColor = this.mainDirectionalLight.color.getHex();
      this.originalStormLightningIntensity = this.stormLight.intensity;
    }

    // Apply lightning effect
    this.mainDirectionalLight.intensity = 3.5;
    this.mainDirectionalLight.color.setHex(0xe6ccff);
    this.stormLight.intensity = 4;

    // Spawn thunder bolts around center
    this.thunderBoltManager.spawnThunderBolts();

    // Set end time for this strike
    this.lightningEndTime = performance.now() + duration;
  }

  private endLightning(): void {
    // Restore original values
    this.mainDirectionalLight.intensity = this.originalLightningIntensity;
    this.mainDirectionalLight.color.setHex(this.originalLightningColor);
    this.stormLight.intensity = this.originalStormLightningIntensity;

    // Reset lightning state
    this.lightningEndTime = 0;
  }

  private shouldTriggerLightningAtCycleProgress(cycleProgress: number): boolean {
    // Trigger lightning only at the start of each cycle (when progress is near 0)
    const tolerance = 20; // 15% tolerance around cycle start to catch larger tick jumps

    // Check if we're at the start of a cycle and haven't already triggered for this cycle
    if (cycleProgress < tolerance && this.lastLightningTriggerProgress !== 0) {
      this.lastLightningTriggerProgress = 0;
      // Add 0.5 second delay before starting lightning sequence
      setTimeout(() => {
        this.startLightningSequence();
      }, 2000);
      return false; // Don't trigger immediately
    }

    // Reset the trigger flag when we're well into the cycle
    if (cycleProgress > tolerance * 2) {
      this.lastLightningTriggerProgress = -1;
    }

    return false;
  }

  protected shouldEnableStormEffects(): boolean {
    // Override this method in child classes to control storm effects
    return true;
  }

  // Cleanup method for lightning sequence
  protected cleanupLightning(): void {
    if (this.lightningSequenceTimeout) {
      clearTimeout(this.lightningSequenceTimeout);
      this.lightningSequenceTimeout = null;
    }
    // Reset lightning state
    if (this.lightningEndTime > 0) {
      this.endLightning();
    }
    // Cleanup thunder bolts
    this.thunderBoltManager.cleanup();
  }

  // Abstract methods
  public destroy(): void {
    console.log(`[HexagonScene] Destroying scene: ${this.sceneName}`);

    this.cleanupLightning();
    this.disposeStateSyncSubscription();

    // Dispose of biome models
    this.biomeModels.forEach((biome) => {
      biome.dispose();
    });
    this.biomeModels.clear();

    // Dispose of ground mesh
    if (this.groundMesh) {
      this.scene.remove(this.groundMesh);
      this.groundMesh.geometry.dispose();
      if (Array.isArray(this.groundMesh.material)) {
        this.groundMesh.material.forEach((m) => m.dispose());
      } else {
        this.groundMesh.material.dispose();
      }
      // @ts-ignore
      this.groundMesh = null;
    }

    // Clean up managers
    if (this.interactiveHexManager) {
      this.interactiveHexManager.destroy();
    }
    if (this.highlightHexManager) {
      this.highlightHexManager.dispose();
    }
    if (this.thunderBoltManager) {
      this.thunderBoltManager.cleanup();
    }
    if (this.dayNightCycleManager) {
      this.dayNightCycleManager.dispose();
    }
    if (this.inputManager) {
      this.inputManager.destroy();
    }

    // Clean up shortcuts
    if (this.shortcutManager) {
      this.shortcutManager.cleanup();
    }

    // Remove lights
    if (this.hemisphereLight) {
      this.scene.remove(this.hemisphereLight);
      // @ts-ignore
      this.hemisphereLight.dispose?.();
    }
    if (this.mainDirectionalLight) {
      this.scene.remove(this.mainDirectionalLight);
      this.scene.remove(this.mainDirectionalLight.target);
      this.mainDirectionalLight.dispose();
      if (this.mainDirectionalLight.shadow?.map) {
        this.mainDirectionalLight.shadow.map.dispose();
      }
    }
    if (this.stormLight) {
      this.scene.remove(this.stormLight);
      this.stormLight.dispose();
    }
    if (this.ambientPurpleLight) {
      this.scene.remove(this.ambientPurpleLight);
      this.ambientPurpleLight.dispose();
    }

    // Clean up light helper
    if (this.lightHelper) {
      this.scene.remove(this.lightHelper);
      this.lightHelper.dispose();
    }

    // Clean up GUI folder if it exists
    if (this.GUIFolder) {
      this.GUIFolder.destroy();
    }

    // Clear listeners
    this.cameraViewListeners.clear();

    // Clean up any pending promises or model loading
    this.modelLoadPromises = [];

    // Finally, clear the scene
    this.scene.clear();

    console.log(`[HexagonScene] Destroyed ${this.sceneName}`);
  }

  protected abstract onHexagonMouseMove(
    hex: {
      hexCoords: HexPosition;
      position: Vector3;
    } | null,
  ): void;
  protected abstract onHexagonDoubleClick(hexCoords: HexPosition): void;
  protected abstract onHexagonClick(hexCoords: HexPosition | null): void;
  protected abstract onHexagonRightClick(event: MouseEvent, hexCoords: HexPosition | null): void;
  public abstract setup(): void | Promise<void>;
  public abstract moveCameraToURLLocation(): void;
  public abstract onSwitchOff(): void;

  public getCurrentCameraView(): CameraView {
    return this.currentCameraView;
  }

  public getShadowsEnabledByQuality(): boolean {
    return this.shadowsEnabledByQuality;
  }

  public addCameraViewListener(listener: (view: CameraView) => void) {
    console.log("HexagonScene addCameraViewListener:", this.currentCameraView, "->", listener);
    this.cameraViewListeners.add(listener);
    // Immediately notify the listener of the current view
    listener(this.currentCameraView);
  }

  public removeCameraViewListener(listener: (view: CameraView) => void) {
    this.cameraViewListeners.delete(listener);
  }

  public changeCameraView(position: CameraView) {
    console.log("HexagonScene changeCameraView:", this.currentCameraView, "->", position);
    const previousView = this.currentCameraView;
    const target = this.controls.target;
    this.currentCameraView = position;

    switch (position) {
      case CameraView.Close: // Close view
        this.mainDirectionalLight.castShadow = this.shadowsEnabledByQuality;
        this.mainDirectionalLight.shadow.bias = -0.02;
        this.cameraDistance = 10;
        this.cameraAngle = Math.PI / 6; // 30 degrees
        break;
      case CameraView.Medium: // Medium view
        this.mainDirectionalLight.castShadow = this.shadowsEnabledByQuality;
        this.mainDirectionalLight.shadow.bias = -0.015;
        this.cameraDistance = 20;
        this.cameraAngle = Math.PI / 3; // 60 degrees
        break;
      case CameraView.Far: // Far view
        this.mainDirectionalLight.castShadow = false;
        this.cameraDistance = 40;
        this.cameraAngle = (50 * Math.PI) / 180; // 50 degrees
        break;
    }

    const cameraHeight = Math.sin(this.cameraAngle) * this.cameraDistance;
    const cameraDepth = Math.cos(this.cameraAngle) * this.cameraDistance;

    const newPosition = new Vector3(target.x, target.y + cameraHeight, target.z + cameraDepth);
    const viewDelta = Math.abs(position - previousView);
    const duration = viewDelta > 0 ? 0.6 + viewDelta * 0.4 : 0.6;
    this.updateOutlineOpacityForDistance(this.cameraDistance);
    this.updateCameraClipPlanesForDistance(this.cameraDistance);
    this.updateFogForDistance(this.cameraDistance);
    this.cameraAnimate(newPosition, target, duration);

    // Notify all listeners of the camera view change
    this.cameraViewListeners.forEach((listener) => listener(position));
  }

  private updateCameraClipPlanesForDistance(distance: number): void {
    const minNear = 0.1;
    const maxNear = 1.5;
    const minFar = 50;
    const maxFar = 140;
    const farMultiplier = 3.5;

    const desiredNear = Math.min(maxNear, Math.max(minNear, distance * 0.02));
    const desiredFar = Math.min(maxFar, Math.max(minFar, distance * farMultiplier));

    if (Math.abs(desiredNear - this.lastClipNear) < 0.005 && Math.abs(desiredFar - this.lastClipFar) < 0.5) {
      return;
    }

    this.camera.near = desiredNear;
    this.camera.far = desiredFar;
    this.camera.updateProjectionMatrix();
    this.lastClipNear = desiredNear;
    this.lastClipFar = desiredFar;
  }

  private updateFogForDistance(distance: number): void {
    if (!this.fogEnabledByQuality || !this.fogEnabledByUser || this.currentCameraView === CameraView.Close) {
      if (this.scene.fog) {
        this.scene.fog = null;
      }
      return;
    }

    if (!this.scene.fog) {
      this.scene.fog = this.fog;
    }

    const clipFar = Math.min(this.camera.far, distance * 3.5);
    const startFactor = this.currentCameraView === CameraView.Medium ? 0.35 : 0.45;
    const endFactor = this.currentCameraView === CameraView.Medium ? 0.85 : 0.9;

    const desiredNear = Math.max(FOG_CONFIG.near, clipFar * startFactor);
    const desiredFar = Math.max(desiredNear + 1, clipFar * endFactor);

    if (Math.abs(desiredNear - this.lastFogNear) < 0.5 && Math.abs(desiredFar - this.lastFogFar) < 0.5) {
      return;
    }

    this.fog.near = desiredNear;
    this.fog.far = desiredFar;
    this.lastFogNear = desiredNear;
    this.lastFogFar = desiredFar;
  }
}
