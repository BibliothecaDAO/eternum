import { useUIStore } from "@/hooks/store/use-ui-store";
import { TransitionManager } from "@/three/managers/transition-manager";
import { SceneManager } from "@/three/scene-manager";
import HexceptionScene from "@/three/scenes/hexception";
import HUDScene from "@/three/scenes/hud-scene";
import WorldmapScene from "@/three/scenes/worldmap";
import { GUIManager } from "@/three/utils/";
import {
  CAMERA_CONFIG,
  CAMERA_FAR_PLANE,
  CONTROL_CONFIG,
  POST_PROCESSING_CONFIG,
  type PostProcessingConfig,
} from "@/three/constants";
import { GRAPHICS_SETTING, GraphicsSettings } from "@/ui/config";
import { SetupResult } from "@bibliothecadao/dojo";
import {
    BloomEffect,
    BrightnessContrastEffect,
    ChromaticAberrationEffect,
    Effect,
    EffectComposer,
    EffectPass,
    FXAAEffect,
    HueSaturationEffect,
    RenderPass,
    ToneMappingEffect,
    ToneMappingMode,
    VignetteEffect,
} from "postprocessing";
import {
  ACESFilmicToneMapping,
  CineonToneMapping,
  HalfFloatType,
  LinearToneMapping,
  NoToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Raycaster,
  ReinhardToneMapping,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { CSS2DRenderer } from "three-stdlib";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { env } from "../../env";
import { SceneName } from "./types";
import { transitionDB } from "./utils/";
import { getContactShadowResources } from "./utils/contact-shadow";
import { MaterialPool } from "./utils/material-pool";
import { MemoryMonitor, MemorySpike } from "./utils/memory-monitor";
import { qualityController, type QualityFeatures } from "./utils/quality-controller";

const MEMORY_MONITORING_ENABLED = env.VITE_PUBLIC_ENABLE_MEMORY_MONITORING;
let cachedHDRTarget: WebGLRenderTarget | null = null;
let cachedHDRPromise: Promise<WebGLRenderTarget> | null = null;

const DEFAULT_ENVIRONMENT_INTENSITY: Record<GraphicsSettings, number> = {
  [GraphicsSettings.HIGH]: 0.55,
  [GraphicsSettings.MID]: 0.45,
  [GraphicsSettings.LOW]: 0.25,
};

export default class GameRenderer {
  private labelRenderer!: CSS2DRenderer;
  private labelRendererElement!: HTMLDivElement;
  private renderer!: WebGLRenderer;
  private camera!: PerspectiveCamera;
  private raycaster!: Raycaster;
  private mouse!: Vector2;
  private controls!: MapControls;
  private composer!: EffectComposer;
  private renderPass!: RenderPass;
  private effectPass?: EffectPass;
  private postProcessingConfig?: PostProcessingConfig;
  private toneMappingEffect?: ToneMappingEffect;
  private hueSaturationEffect?: HueSaturationEffect;
  private brightnessContrastEffect?: BrightnessContrastEffect;
  private postProcessingGUIInitialized = false;
  private unsubscribeQualityController?: () => void;
  private lastAppliedQuality?: QualityFeatures;

  // Stats and Monitoring
  private stats!: Stats;
  private memoryMonitor?: MemoryMonitor;
  private memoryStatsElement?: HTMLDivElement;
  private statsDomElement?: HTMLElement;

  // Camera settings
  private cameraDistance = CAMERA_CONFIG.defaultDistance; // Maintain the same distance
  private cameraAngle = CAMERA_CONFIG.defaultAngle;

  // Components
  private transitionManager!: TransitionManager;

  // Scenes
  private worldmapScene!: WorldmapScene;
  private hexceptionScene!: HexceptionScene;
  private hudScene!: HUDScene;

  private lastTime: number = 0;
  private dojo: SetupResult;
  private sceneManager!: SceneManager;
  private graphicsSetting: GraphicsSettings;
  private cleanupIntervals: NodeJS.Timeout[] = [];
  private environmentTarget?: WebGLRenderTarget;
  private unsubscribeEnableMapZoom?: () => void;
  private memoryMonitorTimeoutId?: ReturnType<typeof setTimeout>;
  private readonly handleWindowResize = () => this.onWindowResize();
  private readonly handleDocumentFocus = (event: FocusEvent) => {
    if (event.target instanceof HTMLInputElement && this.controls) {
      this.controls.stopListenToKeyEvents();
    }
  };
  private readonly handleDocumentBlur = (event: FocusEvent) => {
    if (event.target instanceof HTMLInputElement && this.controls) {
      this.controls.listenToKeyEvents(document.body);
    }
  };

  constructor(dojoContext: SetupResult) {
    this.graphicsSetting = GRAPHICS_SETTING;
    this.dojo = dojoContext;

    this.initializeRenderer();
    this.initializeCamera();
    this.initializeRaycaster();
    this.setupGUIControls();

    this.waitForLabelRendererElement()
      .then((labelRendererElement) => {
        this.labelRendererElement = labelRendererElement;
        this.initializeLabelRenderer();
      })
      .catch((error) => {
        console.warn("GameRenderer: Failed to initialize label renderer:", error);
      });
  }

  private initializeRaycaster() {
    this.raycaster = new Raycaster();
    this.mouse = new Vector2();
  }

  private initializeCamera() {
    this.camera = new PerspectiveCamera(
      CAMERA_CONFIG.fov,
      window.innerWidth / window.innerHeight,
      CAMERA_CONFIG.near,
      CAMERA_FAR_PLANE,
    );
    const cameraHeight = Math.sin(this.cameraAngle) * this.cameraDistance;
    const cameraDepth = Math.cos(this.cameraAngle) * this.cameraDistance;
    this.camera.position.set(0, cameraHeight, cameraDepth);
    this.camera.lookAt(0, 0, 0);
    this.camera.up.set(0, 1, 0);
  }

  private setupGUIControls() {
    this.setupSceneSwitchingGUI();
    this.setupCameraMovementGUI();
    this.setupRendererGUI();
  }

  private setupSceneSwitchingGUI() {
    const changeSceneFolder = GUIManager.addFolder("Switch scene");
    const changeSceneParams = { scene: SceneName.WorldMap };
    changeSceneFolder.add(changeSceneParams, "scene", [SceneName.WorldMap, SceneName.Hexception]).name("Scene");
    changeSceneFolder.add({ switchScene: () => this.sceneManager.switchScene(changeSceneParams.scene) }, "switchScene");
    changeSceneFolder.close();
  }

  private setupCameraMovementGUI() {
    const moveCameraFolder = GUIManager.addFolder("Move Camera");
    const moveCameraParams = { col: 0, row: 0, x: 0, y: 0, z: 0 };

    moveCameraFolder.add(moveCameraParams, "col").name("Column");
    moveCameraFolder.add(moveCameraParams, "row").name("Row");
    moveCameraFolder.add(moveCameraParams, "x").name("X");
    moveCameraFolder.add(moveCameraParams, "y").name("Y");
    moveCameraFolder.add(moveCameraParams, "z").name("Z");

    moveCameraFolder
      .add(
        {
          move: () => this.worldmapScene.moveCameraToColRow(moveCameraParams.col, moveCameraParams.row, 0),
        },
        "move",
      )
      .name("Move Camera");

    moveCameraFolder.add(
      {
        move: () => this.worldmapScene.moveCameraToXYZ(moveCameraParams.x, moveCameraParams.y, moveCameraParams.z, 0),
      },
      "move",
    );

    // Add camera view controls
    const cameraViewParams = { view: 2 };
    moveCameraFolder.add(cameraViewParams, "view", [1, 2, 3]).name("Camera View");
    moveCameraFolder
      .add(
        {
          changeView: () => this.worldmapScene.changeCameraView(cameraViewParams.view as 1 | 2 | 3),
        },
        "changeView",
      )
      .name("Change View");

    moveCameraFolder.close();
  }

  private setupRendererGUI() {
    const rendererFolder = GUIManager.addFolder("Renderer");
    rendererFolder
      .add(this.renderer, "toneMapping", {
        "No Tone Mapping": NoToneMapping,
        "Linear Tone Mapping": LinearToneMapping,
        "Reinhard Tone Mapping": ReinhardToneMapping,
        "Cineon Tone Mapping": CineonToneMapping,
        "ACESFilmic Tone Mapping": ACESFilmicToneMapping,
      })
      .name("Tone Mapping");
    rendererFolder.add(this.renderer, "toneMappingExposure", 0, 2).name("Tone Mapping Exposure");
    rendererFolder.close();

    const contactShadowFolder = GUIManager.addFolder("Contact Shadows");
    const { material } = getContactShadowResources();
    const params = { opacity: material.opacity };
    contactShadowFolder.add(params, "opacity", 0, 0.6, 0.01).name("Opacity").onChange((value: number) => {
      material.opacity = value;
    });
    contactShadowFolder.close();
  }

  private initializeLabelRenderer() {
    this.labelRenderer = new CSS2DRenderer({ element: this.labelRendererElement });
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
  }

  private async waitForLabelRendererElement(): Promise<HTMLDivElement> {
    return new Promise((resolve, reject) => {
      const MAX_ATTEMPTS = 300; // ~5 seconds at 60fps
      let attempts = 0;

      const checkElement = () => {
        const element = document.getElementById("labelrenderer") as HTMLDivElement;
        if (element) {
          resolve(element);
        } else if (attempts >= MAX_ATTEMPTS) {
          console.error("GameRenderer: labelrenderer element not found after max attempts");
          reject(new Error("labelrenderer element not found"));
        } else {
          attempts++;
          requestAnimationFrame(checkElement);
        }
      };
      checkElement();
    });
  }

  private initializeRenderer() {
    const isLowGraphics = this.graphicsSetting === GraphicsSettings.LOW;
    this.renderer = new WebGLRenderer({
      powerPreference: "high-performance",
      antialias: false,
      stencil: !isLowGraphics,
      depth: true,
    });

    this.renderer.setPixelRatio(this.getTargetPixelRatio());
    this.renderer.shadowMap.enabled = this.graphicsSetting !== GraphicsSettings.LOW;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    this.renderer.autoClear = false;
    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: HalfFloatType,
    });
  }

  initStats() {
    this.stats = new (Stats as any)();
    document.body.appendChild(this.stats.dom);
    this.statsDomElement = this.stats.dom;

    // Initialize memory monitoring
    this.initMemoryMonitoring();
  }

  public initMemoryMonitoring() {
    if (!MEMORY_MONITORING_ENABLED) {
      return;
    }

    // Check if memory API is supported
    if (!MemoryMonitor.isMemoryAPISupported()) {
      console.warn("Memory monitoring not supported in this browser");
      return;
    }

    // Initialize memory monitor with spike detection
    this.memoryMonitor = new MemoryMonitor({
      spikeThresholdMB: 30, // Alert on 30MB+ spikes during gameplay
      onMemorySpike: (spike: MemorySpike) => {
        console.warn(`🚨 Memory spike in ${spike.context}: +${spike.increaseMB.toFixed(1)}MB`);

        // Additional logging for large spikes
        if (spike.increaseMB > 100) {
          console.error("🔥 Large memory spike detected!", spike);
          // Could trigger additional debugging here
        }
      },
    });

    // Provide renderer reference for better resource tracking
    this.memoryMonitor.setRenderer(this.renderer);
    (window as any).__gameRenderer = this;

    // Create memory stats display element
    this.createMemoryStatsDisplay();

    // Start periodic memory monitoring
    this.startMemoryMonitoring();
  }

  private createMemoryStatsDisplay() {
    this.memoryStatsElement = document.createElement("div");
    this.memoryStatsElement.style.cssText = `
      position: fixed;
      top: 50px;
      left: 0px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      font-family: monospace;
      font-size: 10px;
      padding: 5px;
      border-radius: 3px;
      z-index: 10000;
      min-width: 200px;
    `;
    document.body.appendChild(this.memoryStatsElement);
  }

  private startMemoryMonitoring() {
    const updateMemoryStats = () => {
      if (this.isDestroyed || !this.memoryMonitor || !this.memoryStatsElement) {
        return;
      }

      try {
        const currentScene = this.sceneManager?.getCurrentScene() || "unknown";
        const stats = this.memoryMonitor.getCurrentStats(currentScene);
        const summary = this.memoryMonitor.getSummary();

        // Get material pool stats
        const materialStats = MaterialPool.getInstance().getStats();
        const sharingRatio = materialStats.totalReferences / Math.max(materialStats.uniqueMaterials, 1);

        // Update display
        this.memoryStatsElement.innerHTML = `
          <strong>Memory Monitor</strong><br>
          Heap: ${stats.heapUsedMB}MB / ${stats.heapTotalMB}MB<br>
          Avg: ${summary.averageMB}MB<br>
          Trend: ${summary.trendMBPerSecond > 0 ? "+" : ""}${summary.trendMBPerSecond.toFixed(2)}MB/s<br>
          Spikes: ${summary.spikeCount} (max: ${summary.largestSpikeMB}MB)<br>
          Resources: G:${stats.geometries} M:${stats.materials} T:${stats.textures}<br>
          Materials: ${materialStats.uniqueMaterials} shared (${sharingRatio.toFixed(1)}:1)<br>
          ${stats.memorySpike ? `<span style="color: #ff4444;">⚠ SPIKE: +${stats.spikeIncrease.toFixed(1)}MB</span>` : ""}
        `;

        // Color coding based on memory usage
        const memoryPercent = (stats.heapUsedMB / stats.heapLimitMB) * 100;
        let color = "#00ff00"; // Green
        if (memoryPercent > 70) color = "#ffaa00"; // Orange
        if (memoryPercent > 85) color = "#ff4444"; // Red

        this.memoryStatsElement.style.color = color;
      } catch (error) {
        console.error("Error updating memory stats:", error);
      }

      // Schedule next update (every second)
      this.memoryMonitorTimeoutId = setTimeout(updateMemoryStats, 1000);
    };

    // Start monitoring
    updateMemoryStats();
  }

  initScene() {
    this.setupListeners();

    document.body.style.background = "black";
    this.renderer.domElement.id = "main-canvas";
    document.body.appendChild(this.renderer.domElement);

    // Set up periodic cleanup of the transition database
    const dbCleanupInterval = setInterval(() => {
      // Clean up expired records older than 10 seconds
      const cleanedCount = transitionDB.cleanupExpired(10000);
      if (cleanedCount > 0) {
        console.debug(`Cleaned up ${cleanedCount} expired transition records`);
      }
    }, 30 * 1000); // Run every 30 seconds

    // Store the interval ID for cleanup
    this.cleanupIntervals = this.cleanupIntervals || [];
    this.cleanupIntervals.push(dbCleanupInterval);

    // Adjust OrbitControls for new camera angle
    this.controls = new MapControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = CONTROL_CONFIG.enableRotate;
    const zoomSetting = useUIStore.getState().enableMapZoom;
    console.log(`[GameRenderer] Setting enableZoom to: ${zoomSetting}`);
    this.controls.enableZoom = zoomSetting;
    this.controls.enablePan = CONTROL_CONFIG.enablePan;
    this.controls.panSpeed = CONTROL_CONFIG.panSpeed;
    this.controls.zoomToCursor = CONTROL_CONFIG.zoomToCursor;
    this.controls.minDistance = CONTROL_CONFIG.minDistance;
    this.controls.maxDistance = CONTROL_CONFIG.maxDistance;
    this.controls.enableDamping = CONTROL_CONFIG.enableDamping && this.graphicsSetting === GraphicsSettings.HIGH;
    this.controls.dampingFactor = CONTROL_CONFIG.dampingFactor;
    this.controls.target.set(0, 0, 0);
    this.controls.addEventListener("change", () => {
      if (this.sceneManager?.getCurrentScene() === SceneName.WorldMap) {
        this.worldmapScene.requestChunkRefresh();
      }
    });
    this.controls.keys = {
      LEFT: "KeyA",
      UP: "KeyW",
      RIGHT: "KeyD",
      BOTTOM: "KeyS",
    };
    this.controls.keyPanSpeed = CONTROL_CONFIG.keyPanSpeed;
    this.controls.listenToKeyEvents(document.body);

    // Subscribe to zoom setting changes
    this.unsubscribeEnableMapZoom = useUIStore.subscribe(
      (state) => state.enableMapZoom,
      (enableMapZoom) => {
        console.log(`[GameRenderer] Zoom setting changed to: ${enableMapZoom}`);
        if (this.controls) {
          this.controls.enableZoom = enableMapZoom;
        }
      },
    );

    document.addEventListener("focus", this.handleDocumentFocus, true);
    document.addEventListener("blur", this.handleDocumentBlur, true);

    // Create HUD scene
    this.hudScene = new HUDScene(this.sceneManager, this.controls);

    this.prepareScenes();
    this.handleURLChange();
    // Init animation
    this.animate();
  }

  private setupListeners() {
    window.addEventListener("urlChanged", this.handleURLChange);
    window.addEventListener("popstate", this.handleURLChange);
    window.addEventListener("resize", this.handleWindowResize);
  }

  private handleURLChange = () => {
    const url = new URL(window.location.href);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const sceneSlug = pathSegments.pop();
    const targetScene =
      sceneSlug === SceneName.Hexception || sceneSlug === SceneName.WorldMap
        ? (sceneSlug as SceneName)
        : SceneName.WorldMap;

    if (targetScene === this.sceneManager.getCurrentScene() && targetScene === SceneName.WorldMap) {
      this.sceneManager.moveCameraForScene();
      this.transitionManager?.fadeIn();
    } else {
      this.sceneManager.switchScene(targetScene);
    }
  };

  async prepareScenes() {
    this.initializeSceneManagement();
    this.initializeScenes();
    this.applyEnvironment();
    this.setupPostProcessingEffects();
    this.sceneManager.moveCameraForScene();
    this.applyQualityFeatures(qualityController.getFeatures());
    this.subscribeToQualityController();
  }

  private initializeSceneManagement() {
    this.transitionManager = new TransitionManager(this.renderer);
    this.sceneManager = new SceneManager(this.transitionManager);
  }

  private initializeScenes() {
    // Initialize Hexception scene
    this.hexceptionScene = new HexceptionScene(this.controls, this.dojo, this.mouse, this.raycaster, this.sceneManager);
    this.sceneManager.addScene(SceneName.Hexception, this.hexceptionScene);

    // Initialize WorldMap scene
    this.worldmapScene = new WorldmapScene(this.dojo, this.raycaster, this.controls, this.mouse, this.sceneManager);
    this.sceneManager.addScene(SceneName.WorldMap, this.worldmapScene);

    // Set up render pass
    this.renderPass = new RenderPass(this.hexceptionScene.getScene(), this.camera);
    this.composer.addPass(this.renderPass);
  }

  private setupPostProcessingEffects() {
    const effectsConfig = POST_PROCESSING_CONFIG[this.graphicsSetting];
    if (!effectsConfig) {
      return; // Skip post-processing for low graphics settings
    }
    this.postProcessingConfig = effectsConfig;
    this.toneMappingEffect = this.createToneMappingEffect(effectsConfig);
    this.rebuildPostProcessing(qualityController.getFeatures());
    this.setupPostProcessingGUI(effectsConfig);
  }

  private createToneMappingEffect(config: PostProcessingConfig) {
    const effect = new ToneMappingEffect({
      mode: config.toneMapping.mode,
    });
    const mutableToneMapping = effect as unknown as { exposure: number; whitePoint: number };
    mutableToneMapping.exposure = config.toneMapping.exposure;
    mutableToneMapping.whitePoint = config.toneMapping.whitePoint;

    const folder = GUIManager.addFolder("Tone Mapping");
    folder
      .add(config.toneMapping, "mode", {
        ...ToneMappingMode,
      })
      .onChange((value: ToneMappingMode) => {
        effect.mode = value;
      });

    folder.add(config.toneMapping, "exposure", 0.0, 2.0, 0.01).onChange((value: number) => {
      mutableToneMapping.exposure = value;
    });

    folder.add(config.toneMapping, "whitePoint", 0.0, 2.0, 0.01).onChange((value: number) => {
      mutableToneMapping.whitePoint = value;
    });

    folder.close();

    return effect;
  }

  private setupPostProcessingGUI(config: PostProcessingConfig): void {
    if (this.postProcessingGUIInitialized) {
      return;
    }
    this.postProcessingGUIInitialized = true;

    const folder = GUIManager.addFolder("Color Grade");

    folder.add(config, "saturation", -0.5, 0.5, 0.01).name("Saturation").onChange((value: number) => {
      config.saturation = value;
      if (this.hueSaturationEffect) {
        (this.hueSaturationEffect as unknown as { saturation: number }).saturation = value;
      }
    });

    folder.add(config, "hue", -0.5, 0.5, 0.01).name("Hue").onChange((value: number) => {
      config.hue = value;
      if (this.hueSaturationEffect) {
        (this.hueSaturationEffect as unknown as { hue: number }).hue = value;
      }
    });

    folder.add(config, "brightness", -0.5, 0.5, 0.01).name("Brightness").onChange((value: number) => {
      config.brightness = value;
      if (this.brightnessContrastEffect) {
        (this.brightnessContrastEffect as unknown as { brightness: number }).brightness = value;
      }
    });

    folder.add(config, "contrast", -0.5, 0.5, 0.01).name("Contrast").onChange((value: number) => {
      config.contrast = value;
      if (this.brightnessContrastEffect) {
        (this.brightnessContrastEffect as unknown as { contrast: number }).contrast = value;
      }
    });

    folder.close();
  }

  private createVignetteEffect(config: PostProcessingConfig) {
    const effect = new VignetteEffect({
      darkness: config.vignette.darkness,
      offset: config.vignette.offset,
    });

    const folder = GUIManager.addFolder("Vignette");
    folder.add(config.vignette, "darkness", 0.0, 1.0, 0.01).onChange((value: number) => {
      effect.darkness = value;
    });

    folder.add(config.vignette, "offset", 0.0, 1.0, 0.01).onChange((value: number) => {
      effect.offset = value;
    });

    folder.close();

    return effect;
  }

  private createBloomEffect(intensity: number) {
    return new BloomEffect({
      luminanceThreshold: 1.1,
      mipmapBlur: true,
      intensity,
    });
  }

  applyEnvironment() {
    const pmremGenerator = new PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    const fallbackTarget = pmremGenerator.fromScene(new RoomEnvironment());
    this.setEnvironmentFromTarget(fallbackTarget, 0.1);

    this.loadCachedEnvironmentMap(pmremGenerator)
      .then((target) => {
        this.setEnvironmentFromTarget(target, 0.1);
      })
      .catch((error) => {
        console.error("Failed to load HDR environment map", error);
      })
      .finally(() => {
        pmremGenerator.dispose();
      });
  }

  private setEnvironmentFromTarget(renderTarget: WebGLRenderTarget, intensity: number) {
    const envMap = renderTarget.texture;
    this.hexceptionScene.setEnvironment(envMap, intensity);
    this.worldmapScene.setEnvironment(envMap, intensity);

    if (
      this.environmentTarget &&
      this.environmentTarget !== renderTarget &&
      this.environmentTarget !== cachedHDRTarget
    ) {
      this.environmentTarget.dispose();
    }

    this.environmentTarget = renderTarget;
  }

  private loadCachedEnvironmentMap(pmremGenerator: PMREMGenerator): Promise<WebGLRenderTarget> {
    if (cachedHDRTarget) {
      return Promise.resolve(cachedHDRTarget);
    }

    if (cachedHDRPromise) {
      return cachedHDRPromise;
    }

    const hdriLoader = new RGBELoader();
    cachedHDRPromise = new Promise<WebGLRenderTarget>((resolve, reject) => {
      hdriLoader.load(
        "/textures/environment/models_env.hdr",
        (texture) => {
          const envTarget = pmremGenerator.fromEquirectangular(texture);
          texture.dispose();
          cachedHDRTarget = envTarget;
          cachedHDRPromise = null;
          resolve(envTarget);
        },
        undefined,
        (error) => {
          cachedHDRPromise = null;
          reject(error);
        },
      );
    });

    return cachedHDRPromise;
  }

  private getTargetPixelRatio() {
    const devicePixelRatio = Math.max(window.devicePixelRatio || 1, 1);

    const qualityPixelRatio = this.lastAppliedQuality?.pixelRatio;
    if (qualityPixelRatio !== undefined) {
      return Math.min(devicePixelRatio, qualityPixelRatio);
    }

    switch (this.graphicsSetting) {
      case GraphicsSettings.HIGH:
        return Math.min(devicePixelRatio, 2);
      case GraphicsSettings.MID:
        return Math.min(devicePixelRatio, 1.5);
      default:
        return 1;
    }
  }

  private getTargetFPS(): number | null {
    switch (this.graphicsSetting) {
      case GraphicsSettings.LOW:
        return 30;
      case GraphicsSettings.MID:
        return 45;
      default:
        return null;
    }
  }

  handleKeyEvent(event: KeyboardEvent): void {
    const { key } = event;

    switch (key) {
      case "e":
        break;
      case "Escape":
        if (this.sceneManager?.getCurrentScene() === SceneName.Hexception) {
          this.sceneManager.switchScene(SceneName.WorldMap);
        }
        break;
      default:
        break;
    }
  }

  onWindowResize() {
    const container = document.getElementById("three-container");
    if (container) {
      const width = container.clientWidth;
      const height = container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.composer?.setSize(width, height);
      this.labelRenderer?.setSize(width, height);
      this.hudScene.onWindowResize(width, height);
    } else {
      // Fallback to window size if container not found
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer?.setSize(window.innerWidth, window.innerHeight);
      this.labelRenderer?.setSize(window.innerWidth, window.innerHeight);
      this.hudScene.onWindowResize(window.innerWidth, window.innerHeight);
    }
  }

  animate() {
    // Stop animation if renderer has been destroyed
    if (this.isDestroyed) {
      console.log("GameRenderer destroyed, stopping animation loop");
      return;
    }

    if (!this.labelRenderer) {
      requestAnimationFrame(() => {
        this.animate();
      });
      return;
    }

    const currentTime = performance.now();
    if (this.lastTime === 0) {
      this.lastTime = currentTime;
    }

    const targetFPS = this.getTargetFPS();
    if (targetFPS) {
      const frameTime = 1000 / targetFPS;
      if (currentTime - this.lastTime < frameTime) {
        requestAnimationFrame(() => this.animate());
        return;
      }
    }

    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    qualityController.recordFrame(deltaTime * 1000);

    if (this.stats) this.stats.update();
    if (this.controls) {
      this.controls.update();
    }
    // Clear the renderer at the start of each frame
    this.renderer.clear();

    // Render the current game scene
    if (this.sceneManager?.getCurrentScene() === SceneName.WorldMap) {
      this.worldmapScene.update(deltaTime);
      (this.renderPass as unknown as { scene: unknown }).scene = this.worldmapScene.getScene();
      this.labelRenderer.render(this.worldmapScene.getScene(), this.camera);
    } else {
      this.hexceptionScene.update(deltaTime);
      (this.renderPass as unknown as { scene: unknown }).scene = this.hexceptionScene.getScene();
      this.labelRenderer.render(this.hexceptionScene.getScene(), this.camera);
    }
    this.composer.render();
    // Render the HUD scene without clearing the buffer
    const cycleProgress = useUIStore.getState().cycleProgress || 0;
    this.hudScene.update(deltaTime, cycleProgress);
    this.renderer.clearDepth(); // Clear only the depth buffer
    this.renderer.render(this.hudScene.getScene(), this.hudScene.getCamera());
    this.labelRenderer.render(this.hudScene.getScene(), this.hudScene.getCamera());

    requestAnimationFrame(() => {
      this.animate();
    });
  }

  private isDestroyed = false;

  public destroy(): void {
    // Prevent multiple destroy calls
    if (this.isDestroyed) {
      console.warn("GameRenderer already destroyed, skipping cleanup");
      return;
    }

    this.isDestroyed = true;

    try {
      // Clean up memory monitor timeout
      if (this.memoryMonitorTimeoutId) {
        clearTimeout(this.memoryMonitorTimeoutId);
        this.memoryMonitorTimeoutId = undefined;
      }

      if (this.unsubscribeEnableMapZoom) {
        this.unsubscribeEnableMapZoom();
        this.unsubscribeEnableMapZoom = undefined;
      }
      if (this.unsubscribeQualityController) {
        this.unsubscribeQualityController();
        this.unsubscribeQualityController = undefined;
      }

      // Clean up intervals
      if (this.cleanupIntervals) {
        this.cleanupIntervals.forEach((interval) => clearInterval(interval));
        this.cleanupIntervals = [];
      }

      // Clean up renderer resources
      if (this.renderer?.domElement && this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
      if (this.renderer) {
        this.renderer.dispose();
      }
      if (this.composer) {
        this.composer.dispose();
      }

      // Clean up scenes
      if (this.worldmapScene && typeof this.worldmapScene.destroy === "function") {
        this.worldmapScene.destroy();
      }
      if (this.hexceptionScene && typeof this.hexceptionScene.destroy === "function") {
        this.hexceptionScene.destroy();
      }
      if (this.hudScene && typeof this.hudScene.destroy === "function") {
        this.hudScene.destroy();
      }

      // Clean up controls
      if (this.controls) {
        this.controls.dispose();
      }

      if (this.environmentTarget) {
        if (this.environmentTarget !== cachedHDRTarget) {
          this.environmentTarget.dispose();
        }
        this.environmentTarget = undefined;
      }

      // Remove event listeners
      window.removeEventListener("urlChanged", this.handleURLChange);
      window.removeEventListener("popstate", this.handleURLChange);
      window.removeEventListener("resize", this.handleWindowResize);
      document.removeEventListener("focus", this.handleDocumentFocus, true);
      document.removeEventListener("blur", this.handleDocumentBlur, true);

      // Clean up memory monitoring
      if (this.memoryStatsElement && this.memoryStatsElement.parentNode) {
        this.memoryStatsElement.parentNode.removeChild(this.memoryStatsElement);
      }
      if (this.statsDomElement && this.statsDomElement.parentNode) {
        this.statsDomElement.parentNode.removeChild(this.statsDomElement);
        this.statsDomElement = undefined;
      }
      if (this.labelRendererElement) {
        this.labelRendererElement.replaceChildren();
      }

      console.log("GameRenderer: Destroyed and cleaned up successfully");
    } catch (error) {
      console.error("Error during GameRenderer cleanup:", error);
    }
  }

  private subscribeToQualityController(): void {
    if (this.unsubscribeQualityController) {
      return;
    }
    this.unsubscribeQualityController = qualityController.addEventListener((event) => {
      this.applyQualityFeatures(event.currentFeatures);
    });
  }

  private applyQualityFeatures(features: QualityFeatures): void {
    this.lastAppliedQuality = { ...features };

    const devicePixelRatio = Math.max(window.devicePixelRatio || 1, 1);
    const resolvedPixelRatio = Math.min(devicePixelRatio, features.pixelRatio);
    this.renderer.setPixelRatio(resolvedPixelRatio);
    this.renderer.shadowMap.enabled = features.shadows;

    if (this.postProcessingConfig && this.toneMappingEffect) {
      this.rebuildPostProcessing(features);
    }

    this.worldmapScene?.applyQualityFeatures(features);
    this.hexceptionScene?.applyQualityFeatures(features);

    if (this.composer) {
      this.composer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  private rebuildPostProcessing(features: QualityFeatures): void {
    if (!this.postProcessingConfig || !this.toneMappingEffect) {
      return;
    }

    if (this.effectPass) {
      const passes = (this.composer as any).passes as unknown[] | undefined;
      if (passes) {
        const index = passes.indexOf(this.effectPass);
        if (index !== -1) {
          passes.splice(index, 1);
        }
      }
      this.effectPass.dispose?.();
      this.effectPass = undefined;
    }

    const effects: Effect[] = [this.toneMappingEffect];

    this.hueSaturationEffect = new HueSaturationEffect({
      hue: this.postProcessingConfig.hue,
      saturation: this.postProcessingConfig.saturation,
    });
    effects.push(this.hueSaturationEffect);

    this.brightnessContrastEffect = new BrightnessContrastEffect({
      brightness: this.postProcessingConfig.brightness,
      contrast: this.postProcessingConfig.contrast,
    });
    effects.push(this.brightnessContrastEffect);

    if (features.fxaa) {
      effects.push(new FXAAEffect());
    }
    if (features.bloom) {
      effects.push(this.createBloomEffect(features.bloomIntensity));
    }
    if (features.vignette) {
      effects.push(
        new VignetteEffect({
          darkness: this.postProcessingConfig.vignette.darkness,
          offset: this.postProcessingConfig.vignette.offset,
        }),
      );
    }

    // Subtle chromatic aberration for cinematic lens effect (HIGH quality only)
    if (features.vignette) {
      effects.push(
        new ChromaticAberrationEffect({
          offset: new Vector2(0.0008, 0.0008),
          radialModulation: true,
          modulationOffset: 0.3,
        }),
      );
    }

    this.effectPass = new EffectPass(this.camera, ...effects);
    this.composer.addPass(this.effectPass);
  }
}
