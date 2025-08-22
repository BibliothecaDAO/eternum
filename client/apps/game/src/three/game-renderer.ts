import { useUIStore } from "@/hooks/store/use-ui-store";
import { TransitionManager } from "@/three/managers/transition-manager";
import { SceneManager } from "@/three/scene-manager";
import HexceptionScene from "@/three/scenes/hexception";
import HUDScene from "@/three/scenes/hud-scene";
import WorldmapScene from "@/three/scenes/worldmap";
import { GUIManager } from "@/three/utils/";
import { GRAPHICS_SETTING, GraphicsSettings, IS_FLAT_MODE } from "@/ui/config";
import { SetupResult } from "@bibliothecadao/dojo";
import throttle from "lodash/throttle";
import {
  BloomEffect,
  BrightnessContrastEffect,
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
  Vector2,
  WebGLRenderer,
} from "three";
import { CSS2DRenderer } from "three-stdlib";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { SceneName } from "./types";
import { transitionDB } from "./utils/";
import { MaterialPool } from "./utils/material-pool";
import { MemoryMonitor, MemorySpike } from "./utils/memory-monitor";

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

  // Stats and Monitoring
  private stats!: Stats;
  private memoryMonitor!: MemoryMonitor;
  private memoryStatsElement!: HTMLDivElement;

  // Camera settings
  private cameraDistance = 10; // Maintain the same distance
  private cameraAngle = Math.PI / 3;

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

  constructor(dojoContext: SetupResult) {
    this.graphicsSetting = GRAPHICS_SETTING;
    this.dojo = dojoContext;

    this.initializeRenderer();
    this.initializeCamera();
    this.initializeRaycaster();
    this.setupGUIControls();

    this.waitForLabelRendererElement().then((labelRendererElement) => {
      this.labelRendererElement = labelRendererElement;
      this.initializeLabelRenderer();
    });
  }

  private initializeRaycaster() {
    this.raycaster = new Raycaster();
    this.mouse = new Vector2();
  }

  private initializeCamera() {
    this.camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, IS_FLAT_MODE ? 50 : 30);
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
  }

  private initializeLabelRenderer() {
    this.labelRenderer = new CSS2DRenderer({ element: this.labelRendererElement });
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
  }

  private async waitForLabelRendererElement(): Promise<HTMLDivElement> {
    return new Promise((resolve) => {
      const checkElement = () => {
        const element = document.getElementById("labelrenderer") as HTMLDivElement;
        if (element) {
          resolve(element);
        } else {
          requestAnimationFrame(checkElement);
        }
      };
      checkElement();
    });
  }

  private initializeRenderer() {
    this.renderer = new WebGLRenderer({
      powerPreference: "high-performance",
      antialias: false,
      stencil: this.graphicsSetting === GraphicsSettings.LOW,
      depth: this.graphicsSetting === GraphicsSettings.LOW,
    });
    this.renderer.setPixelRatio(this.graphicsSetting !== GraphicsSettings.HIGH ? 0.75 : window.devicePixelRatio);
    this.renderer.shadowMap.enabled = this.graphicsSetting !== GraphicsSettings.LOW;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    this.renderer.autoClear = false;
    //this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: HalfFloatType,
    });
  }

  initStats() {
    this.stats = new (Stats as any)();
    document.body.appendChild(this.stats.dom);

    // Initialize memory monitoring
    this.initMemoryMonitoring();
  }

  public initMemoryMonitoring() {
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
      setTimeout(updateMemoryStats, 1000);
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
    this.controls.enableRotate = false;
    const zoomSetting = useUIStore.getState().enableMapZoom;
    console.log(`[GameRenderer] Setting enableZoom to: ${zoomSetting}`);
    this.controls.enableZoom = zoomSetting;
    this.controls.enablePan = true;
    this.controls.panSpeed = 1;
    this.controls.zoomToCursor = true;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 20;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.target.set(0, 0, 0);
    if (this.graphicsSetting !== GraphicsSettings.HIGH) {
      this.controls.enableDamping = false;
    }
    this.controls.addEventListener(
      "change",
      throttle(() => {
        if (this.sceneManager?.getCurrentScene() === SceneName.WorldMap) {
          this.worldmapScene.updateVisibleChunks();

          // Expand labels temporarily when panning in Medium view
          this.worldmapScene.expandLabelsTemporarily();
        }
      }, 30),
    );
    this.controls.keys = {
      LEFT: "KeyA",
      UP: "KeyW",
      RIGHT: "KeyD",
      BOTTOM: "KeyS",
    };
    this.controls.keyPanSpeed = 75.0;
    this.controls.listenToKeyEvents(document.body);

    // Subscribe to zoom setting changes
    useUIStore.subscribe(
      (state) => state.enableMapZoom,
      (enableMapZoom) => {
        console.log(`[GameRenderer] Zoom setting changed to: ${enableMapZoom}`);
        if (this.controls) {
          this.controls.enableZoom = enableMapZoom;
        }
      },
    );

    document.addEventListener(
      "focus",
      (event) => {
        // check if the focused element is input
        if (event.target instanceof HTMLInputElement) {
          this.controls.stopListenToKeyEvents();
        }
      },
      true,
    );

    document.addEventListener(
      "blur",
      (event) => {
        // check if the focused element is input
        if (event.target instanceof HTMLInputElement) {
          this.controls.listenToKeyEvents(document.body);
        }
      },
      true,
    );

    // Create HUD scene
    this.hudScene = new HUDScene(this.sceneManager, this.controls);

    this.prepareScenes();
    // Init animation
    this.animate();
  }

  private setupListeners() {
    window.addEventListener("urlChanged", this.handleURLChange);
    window.addEventListener("popstate", this.handleURLChange);
    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  private handleURLChange = () => {
    const url = new URL(window.location.href);

    const scene = url.pathname.split("/").pop();

    if (scene === this.sceneManager.getCurrentScene() && this.sceneManager.getCurrentScene() === SceneName.WorldMap) {
      this.sceneManager.moveCameraForScene();
    } else {
      this.sceneManager.switchScene(scene as SceneName);
    }
  };

  async prepareScenes() {
    this.initializeSceneManagement();
    this.initializeScenes();
    this.applyEnvironment();
    this.setupPostProcessingEffects();
    this.sceneManager.moveCameraForScene();
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
    this.worldmapScene.updateVisibleChunks();
    this.sceneManager.addScene(SceneName.WorldMap, this.worldmapScene);

    // Set up render pass
    this.renderPass = new RenderPass(this.hexceptionScene.getScene(), this.camera);
    this.composer.addPass(this.renderPass);
  }

  private setupPostProcessingEffects() {
    if (GRAPHICS_SETTING === GraphicsSettings.LOW) {
      return; // Skip post-processing for low graphics settings
    }

    // Create effects configuration object
    const effectsConfig = this.createEffectsConfiguration();

    // Create and configure all effects
    const effects = [
      this.createToneMappingEffect(effectsConfig),
      new FXAAEffect(),
      this.createBloomEffect(),
      // this.createHueSaturationEffect(effectsConfig),
      // this.createBrightnessContrastEffect(effectsConfig),
      this.createVignetteEffect(effectsConfig),
    ];

    // Add all effects in a single pass
    this.composer.addPass(new EffectPass(this.camera, ...effects));
  }

  private createEffectsConfiguration() {
    return {
      brightness: 0,
      contrast: 0,
      hue: 0,
      saturation: 0.6,
      toneMapping: {
        mode: ToneMappingMode.OPTIMIZED_CINEON,
        exposure: 0.7,
        whitePoint: 1.2,
      },
      vignette: {
        darkness: 0.9,
        offset: 0.35,
      },
    };
  }

  private createBrightnessContrastEffect(config: any) {
    const effect = new BrightnessContrastEffect({
      brightness: config.brightness,
      contrast: config.contrast,
    });

    const folder = GUIManager.addFolder("BrightnesContrastt");
    folder
      .add(config, "brightness")
      .name("Brightness")
      .min(-1)
      .max(1)
      .step(0.01)
      .onChange((value: number) => {
        effect.brightness = value;
      });
    folder
      .add(config, "contrast")
      .name("Contrast")
      .min(-1)
      .max(1)
      .step(0.01)
      .onChange((value: number) => {
        effect.contrast = value;
      });

    return effect;
  }

  private createHueSaturationEffect(config: any) {
    const effect = new HueSaturationEffect({
      hue: config.hue,
      saturation: config.saturation,
    });

    const folder = GUIManager.addFolder("Hue & Saturation");
    folder
      .add(config, "hue")
      .name("Hue")
      .min(-Math.PI)
      .max(Math.PI)
      .step(0.01)
      .onChange((value: number) => {
        effect.hue = value;
      });
    folder
      .add(config, "saturation")
      .name("Saturation")
      .min(-1)
      .max(1)
      .step(0.01)
      .onChange((value: number) => {
        effect.saturation = value;
      });

    return effect;
  }

  private createToneMappingEffect(config: any) {
    const effect = new ToneMappingEffect({
      mode: config.toneMapping.mode,
    });

    const folder = GUIManager.addFolder("Tone Mapping");
    folder
      .add(config.toneMapping, "mode", {
        ...ToneMappingMode,
      })
      .onChange((value: ToneMappingMode) => {
        effect.mode = value;
      });

    folder.add(config.toneMapping, "exposure", 0.0, 2.0, 0.01).onChange((value: number) => {
      // @ts-ignore
      effect.exposure = value;
    });

    folder.add(config.toneMapping, "whitePoint", 0.0, 2.0, 0.01).onChange((value: number) => {
      // @ts-ignore
      effect.whitePoint = value;
    });

    folder.close();

    return effect;
  }

  private createVignetteEffect(config: any) {
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

  private createBloomEffect() {
    return new BloomEffect({
      luminanceThreshold: 1.1,
      mipmapBlur: true,
      intensity: 0.25,
    });
  }

  applyEnvironment() {
    const pmremGenerator = new PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnvironment = pmremGenerator.fromScene(new RoomEnvironment()).texture;
    const hdriLoader = new RGBELoader();
    const hdriTexture = hdriLoader.load("/textures/environment/models_env.hdr", (texture) => {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      texture.dispose();
      this.hexceptionScene.setEnvironment(envMap, 0.1);
      this.worldmapScene.setEnvironment(envMap, 0.1);
    });
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
      this.labelRenderer?.setSize(width, height);
      this.hudScene.onWindowResize(width, height);
    } else {
      // Fallback to window size if container not found
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
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
    const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds

    // Skip frame if not enough time has passed (for 30 FPS)
    if (this.graphicsSetting !== GraphicsSettings.HIGH) {
      const frameTime = 1000 / 120; // 33.33ms for 30 FPS
      if (currentTime - this.lastTime < frameTime) {
        requestAnimationFrame(() => this.animate());
        return;
      }
    }

    this.lastTime = currentTime;

    if (this.stats) this.stats.update();
    if (this.controls) {
      this.controls.update();
    }
    // Clear the renderer at the start of each frame
    this.renderer.clear();

    // Render the current game scene
    if (this.sceneManager?.getCurrentScene() === SceneName.WorldMap) {
      this.worldmapScene.update(deltaTime);
      // @ts-ignore
      this.renderPass.scene = this.worldmapScene.getScene();
      this.labelRenderer.render(this.worldmapScene.getScene(), this.camera);
    } else {
      this.hexceptionScene.update(deltaTime);
      // @ts-ignore
      this.renderPass.scene = this.hexceptionScene.getScene();
      this.labelRenderer.render(this.hexceptionScene.getScene(), this.camera);
    }
    this.composer.render();
    // Render the HUD scene without clearing the buffer
    this.hudScene.update(deltaTime);
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
      // Clean up intervals
      if (this.cleanupIntervals) {
        this.cleanupIntervals.forEach((interval) => clearInterval(interval));
        this.cleanupIntervals = [];
      }

      // Clean up renderer resources
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

      // Remove event listeners
      window.removeEventListener("urlChanged", this.handleURLChange);
      window.removeEventListener("popstate", this.handleURLChange);
      window.removeEventListener("resize", this.onWindowResize.bind(this));

      // Clean up memory monitoring
      if (this.memoryStatsElement && this.memoryStatsElement.parentNode) {
        this.memoryStatsElement.parentNode.removeChild(this.memoryStatsElement);
      }

      console.log("GameRenderer: Destroyed and cleaned up successfully");
    } catch (error) {
      console.error("Error during GameRenderer cleanup:", error);
    }
  }
}
