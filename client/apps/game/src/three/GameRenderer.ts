import { SetupResult } from "@/dojo/setup";
import useUIStore, { AppStore } from "@/hooks/store/useUIStore";
import { SceneName } from "@/types";
import { GRAPHICS_SETTING, GraphicsSettings } from "@/ui/config";
import throttle from "lodash/throttle";
import {
  BloomEffect,
  BrightnessContrastEffect,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  RenderPass,
} from "postprocessing";
import * as THREE from "three";
import { CSS2DRenderer } from "three-stdlib";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment";
import Stats from "three/examples/jsm/libs/stats.module";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { SceneManager } from "./SceneManager";
import { TransitionManager } from "./components/TransitionManager";
import { GUIManager } from "./helpers/GUIManager";
import { LocationManager } from "./helpers/LocationManager";
import HUDScene from "./scenes/HUDScene";
import HexceptionScene from "./scenes/Hexception";
import WorldmapScene from "./scenes/Worldmap";
import { SystemManager } from "./systems/SystemManager";

export default class GameRenderer {
  private labelRenderer!: CSS2DRenderer;
  private labelRendererElement!: HTMLDivElement;
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private raycaster!: THREE.Raycaster;
  private mouse!: THREE.Vector2;
  private controls!: MapControls;
  private composer!: EffectComposer;
  private renderPass!: RenderPass;

  private locationManager!: LocationManager;

  // Store
  private state: AppStore;
  private unsubscribe: () => void;

  // Stats
  private stats!: Stats;
  private lerpFactor = 0.9;

  // Camera settings
  private cameraDistance = Math.sqrt(2 * 7 * 7); // Maintain the same distance
  private cameraAngle = 60 * (Math.PI / 180); // 75 degrees in radians

  // Components

  private transitionManager!: TransitionManager;

  // Scenes
  private worldmapScene!: WorldmapScene;
  private hexceptionScene!: HexceptionScene;
  private hudScene!: HUDScene;

  // private currentScene: "worldmap" | "hexception" = "worldmap";

  private lastTime: number = 0;

  private dojo: SetupResult;

  private sceneManager!: SceneManager;
  private systemManager!: SystemManager;

  private graphicsSetting: GraphicsSettings;

  constructor(dojoContext: SetupResult) {
    this.graphicsSetting = GRAPHICS_SETTING;
    this.initializeRenderer();
    this.dojo = dojoContext;
    this.locationManager = new LocationManager();

    // Ensure we keep the raycaster and mouse
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Store
    this.state = useUIStore.getState();
    this.unsubscribe = useUIStore.subscribe((state) => {
      this.state = state;
    });

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 30);
    const cameraHeight = Math.sin(this.cameraAngle) * this.cameraDistance;
    const cameraDepth = Math.cos(this.cameraAngle) * this.cameraDistance;
    this.camera.position.set(0, cameraHeight, cameraDepth);
    this.camera.lookAt(0, 0, 0);
    this.camera.up.set(0, 1, 0);

    const changeSceneFolder = GUIManager.addFolder("Switch scene");
    const changeSceneParams = { scene: SceneName.WorldMap };
    changeSceneFolder.add(changeSceneParams, "scene", [SceneName.WorldMap, SceneName.Hexception]).name("Scene");
    changeSceneFolder.add({ switchScene: () => this.sceneManager.switchScene(changeSceneParams.scene) }, "switchScene");
    changeSceneFolder.close();
    // Add new button for moving camera to specific col and row
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
    moveCameraFolder.close();

    const rendererFolder = GUIManager.addFolder("Renderer");
    rendererFolder
      .add(this.renderer, "toneMapping", {
        "No Tone Mapping": THREE.NoToneMapping,
        "Linear Tone Mapping": THREE.LinearToneMapping,
        "Reinhard Tone Mapping": THREE.ReinhardToneMapping,
        "Cineon Tone Mapping": THREE.CineonToneMapping,
        "ACESFilmic Tone Mapping": THREE.ACESFilmicToneMapping,
      })
      .name("Tone Mapping");
    rendererFolder.add(this.renderer, "toneMappingExposure", 0, 2).name("Tone Mapping Exposure");
    rendererFolder.close();

    this.waitForLabelRendererElement().then((labelRendererElement) => {
      this.labelRendererElement = labelRendererElement;
      this.initializeLabelRenderer();
    });
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
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: "high-performance",
      antialias: false,
      stencil: this.graphicsSetting === GraphicsSettings.LOW,
      depth: this.graphicsSetting === GraphicsSettings.LOW,
    });
    this.renderer.setPixelRatio(this.graphicsSetting !== GraphicsSettings.HIGH ? 0.75 : window.devicePixelRatio);
    this.renderer.shadowMap.enabled = this.graphicsSetting !== GraphicsSettings.LOW;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.autoClear = false;
    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
    });
  }

  initStats() {
    this.stats = new (Stats as any)();

    document.body.appendChild(this.stats.dom);
  }

  initScene() {
    this.setupListeners();

    document.body.style.background = "black";
    document.body.appendChild(this.renderer.domElement);

    // Adjust OrbitControls for new camera angle
    this.controls = new MapControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = false;
    this.controls.enableZoom = true;
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

    this.renderModels();
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

  async renderModels() {
    this.transitionManager = new TransitionManager(this.renderer);

    this.sceneManager = new SceneManager(this.transitionManager);

    this.systemManager = new SystemManager(this.dojo);

    this.hexceptionScene = new HexceptionScene(this.controls, this.dojo, this.mouse, this.raycaster, this.sceneManager);
    this.sceneManager.addScene(SceneName.Hexception, this.hexceptionScene);

    // Add grid
    this.worldmapScene = new WorldmapScene(this.dojo, this.raycaster, this.controls, this.mouse, this.sceneManager);
    this.worldmapScene.updateVisibleChunks();
    this.sceneManager.addScene(SceneName.WorldMap, this.worldmapScene);
    this.applyEnvironment();

    this.renderPass = new RenderPass(this.hexceptionScene.getScene(), this.camera);
    this.composer.addPass(this.renderPass);

    const obj = { brightness: -0.1, contrast: 0 };
    const folder = GUIManager.addFolder("BrightnesContrastt");
    if (GRAPHICS_SETTING !== GraphicsSettings.LOW) {
      const BCEffect = new BrightnessContrastEffect({
        brightness: obj.brightness,
        contrast: obj.contrast,
      });

      folder
        .add(obj, "brightness")
        .name("Brightness")
        .min(-1)
        .max(1)
        .step(0.01)
        .onChange((value: number) => {
          BCEffect.brightness = value;
        });
      folder
        .add(obj, "contrast")
        .name("Contrast")
        .min(-1)
        .max(1)
        .step(0.01)
        .onChange((value: number) => {
          BCEffect.contrast = value;
        });

      this.composer.addPass(
        new EffectPass(
          this.camera,

          new FXAAEffect(),
          new BloomEffect({
            luminanceThreshold: 1.1,
            mipmapBlur: true,
            intensity: 0.25,
          }),
          BCEffect,
        ),
      );
    }

    this.sceneManager.moveCameraForScene();
  }

  applyEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnvironment = pmremGenerator.fromScene(new RoomEnvironment()).texture;
    const hdriLoader = new RGBELoader();
    const hdriTexture = hdriLoader.load("/textures/environment/models_env.hdr", (texture) => {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      texture.dispose();
      this.hexceptionScene.setEnvironment(envMap, 0.7);
      this.worldmapScene.setEnvironment(envMap, 0.7);
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
      this.labelRenderer.setSize(width, height);
      this.hudScene.onWindowResize(width, height);
    } else {
      // Fallback to window size if container not found
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
      this.hudScene.onWindowResize(window.innerWidth, window.innerHeight);
    }
  }

  animate() {
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
      const frameTime = 1000 / 30; // 33.33ms for 30 FPS
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
}
