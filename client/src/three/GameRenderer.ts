import { SetupResult } from "@/dojo/setup";
import useUIStore, { AppStore } from "@/hooks/store/useUIStore";
import { SceneName } from "@/types";
import _ from "lodash";
import * as THREE from "three";
import { CSS2DRenderer } from "three-stdlib";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import Stats from "three/examples/jsm/libs/stats.module";
import { TransitionManager } from "./components/TransitionManager";
import { GUIManager } from "./helpers/GUIManager";
import { LocationManager } from "./helpers/LocationManager";
import { SceneManager } from "./SceneManager";
import HexceptionScene from "./scenes/Hexception";
import HUDScene from "./scenes/HUDScene";
import WorldmapScene from "./scenes/Worldmap";
import { SystemManager } from "./systems/SystemManager";

export default class GameRenderer {
  private labelRenderer!: CSS2DRenderer;
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private raycaster!: THREE.Raycaster;
  private mouse!: THREE.Vector2;
  private controls!: MapControls;

  private locationManager!: LocationManager;

  // Store
  private state: AppStore;
  private unsubscribe: () => void;

  // Stats
  private stats!: any;
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

  constructor(dojoContext: SetupResult) {
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: "high-performance",
      antialias: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.7;
    this.renderer.autoClear = false;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.state = useUIStore.getState();
    this.unsubscribe = useUIStore.subscribe((state) => {
      this.state = state;
    });

    this.dojo = dojoContext;
    this.locationManager = new LocationManager();

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
    // Create an instance of CSS2DRenderer
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.top = "0px";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    this.labelRenderer.domElement.style.zIndex = "10";
    document.body.appendChild(this.labelRenderer.domElement);
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
    this.controls.addEventListener(
      "change",
      _.throttle(() => {
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

  renderModels() {
    this.transitionManager = new TransitionManager(this.renderer);

    this.sceneManager = new SceneManager(this.transitionManager);

    this.systemManager = new SystemManager(this.dojo);

    this.hexceptionScene = new HexceptionScene(this.controls, this.dojo, this.mouse, this.raycaster, this.sceneManager);
    this.sceneManager.addScene(SceneName.Hexception, this.hexceptionScene);

    // Add grid
    this.worldmapScene = new WorldmapScene(this.dojo, this.raycaster, this.controls, this.mouse, this.sceneManager);
    this.worldmapScene.updateVisibleChunks();
    this.sceneManager.addScene(SceneName.WorldMap, this.worldmapScene);

    this.sceneManager.moveCameraForScene();
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
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
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
      this.renderer.render(this.worldmapScene.getScene(), this.camera);
      this.labelRenderer.render(this.worldmapScene.getScene(), this.camera);
    } else {
      this.hexceptionScene.update(deltaTime);
      this.renderer.render(this.hexceptionScene.getScene(), this.camera);
      this.labelRenderer.render(this.hexceptionScene.getScene(), this.camera);
    }

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
