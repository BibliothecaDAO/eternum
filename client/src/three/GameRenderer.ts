import { SetupResult } from "@/dojo/setup";
import _ from "lodash";
import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import Stats from "three/examples/jsm/libs/stats.module";
import { TransitionManager } from "./components/TransitionManager";
import { LocationManager } from "./helpers/LocationManager";
import { SceneManager } from "./SceneManager";
import HexceptionScene from "./scenes/Hexception";
import WorldmapScene from "./scenes/Worldmap";
import { GUIManager } from "./helpers/GUIManager";
import { CSS2DRenderer } from "three-stdlib";
import useUIStore, { AppStore } from "@/hooks/store/useUIStore";
import { SystemManager } from "./systems/SystemManager";

export default class GameRenderer {
  private labelRenderer!: CSS2DRenderer;
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private raycaster!: THREE.Raycaster;
  private mouse!: THREE.Vector2;
  private controls!: MapControls;

  private locationManager!: LocationManager;

  private setupListeners() {
    window.addEventListener("urlChanged", this.handleURLChange);
    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  private handleURLChange = () => {
    this.worldmapScene.moveCameraToURLLocation();
  };

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
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.7;

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
    this.camera.position.set(0, cameraHeight, -cameraDepth);
    this.camera.lookAt(0, 0, 0);
    this.camera.up.set(0, 1, 0);

    GUIManager.add(this, "switchScene");

    // Add new button for moving camera to specific col and row
    const moveCameraFolder = GUIManager.addFolder("Move Camera");
    const moveCameraParams = { col: 0, row: 0 };
    moveCameraFolder.add(moveCameraParams, "col").name("Column");
    moveCameraFolder.add(moveCameraParams, "row").name("Row");
    moveCameraFolder
      .add(
        {
          move: () => this.worldmapScene.moveCameraToColRow(moveCameraParams.col, moveCameraParams.row, 0),
        },
        "move",
      )
      .name("Move Camera");

    // Create an instance of CSS2DRenderer
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.top = "0px";
    this.labelRenderer.domElement.style.pointerEvents = "none";
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
    this.controls.maxDistance = 20;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.target.set(0, 0, 0);
    this.controls.addEventListener(
      "change",
      _.throttle(() => {
        if (this.sceneManager?.currentScene === "worldmap") {
          this.worldmapScene.updateVisibleChunks();
        }
      }, 30),
    );

    this.transitionManager = new TransitionManager(this.renderer);

    this.sceneManager = new SceneManager(this.transitionManager);

    this.systemManager = new SystemManager(this.dojo);

    this.hexceptionScene = new HexceptionScene(this.controls, this.dojo, this.mouse, this.raycaster, this.sceneManager);
    this.sceneManager.addScene("hexception", this.hexceptionScene);

    // Add grid
    this.worldmapScene = new WorldmapScene(this.dojo, this.raycaster, this.controls, this.mouse, this.sceneManager);
    this.worldmapScene.updateVisibleChunks();
    this.sceneManager.addScene("worldmap", this.worldmapScene);

    this.worldmapScene.createGroundMesh();

    this.worldmapScene.moveCameraToURLLocation();

    // Init animation
    this.animate();
  }

  handleKeyEvent(event: KeyboardEvent): void {
    const { key } = event;

    switch (key) {
      case "e":
        break;
      case "Escape":
        if (this.sceneManager?.currentScene === "hexception") {
          this.sceneManager.switchScene("worldmap");
        }
        break;
      default:
        break;
    }
  }

  switchScene() {
    if (this.sceneManager.currentScene === "worldmap") {
      this.sceneManager.switchScene("hexception");
    } else {
      this.sceneManager.switchScene("worldmap");
    }
  }

  onWindowResize() {
    console.log("resize");
    const container = document.getElementById("three-container");
    if (container) {
      const width = container.clientWidth;
      const height = container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    } else {
      // Fallback to window size if container not found
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
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

    if (this.sceneManager.currentScene === "worldmap") {
      this.worldmapScene.update(deltaTime);
      // this.hexGrid.updateVisibleChunks();
      this.renderer.render(this.worldmapScene.getScene(), this.camera);
      this.labelRenderer.render(this.worldmapScene.getScene(), this.camera);
    } else {
      // this.detailedScene.update(deltaTime);
      this.hexceptionScene.update(deltaTime);
      this.renderer.render(this.hexceptionScene.getScene(), this.camera);
      this.labelRenderer.render(this.hexceptionScene.getScene(), this.camera);
    }

    requestAnimationFrame(() => {
      this.animate();
    });
  }
}
