import { TravelPaths } from "@/dojo/modelManager/ArmyMovementManager";
import { SetupResult } from "@/dojo/setup";
import { ThreeStore, useThreeStore } from "@/hooks/store/useThreeStore";
import gsap from "gsap";
import GUI from "lil-gui";
import _ from "lodash";
import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import Stats from "three/examples/jsm/libs/stats.module";
import { InputManager } from "./components/InputManager";
import { TransitionManager } from "./components/TransitionManager";
import { LocationManager } from "./helpers/LocationManager";
import { MouseHandler } from "./MouseHandler";
import { SceneManager } from "./SceneManager";
import HexceptionScene from "./scenes/Hexception";
import WorldmapScene from "./scenes/Worldmap";
import { GUIManager } from "./helpers/GUIManager";

export const HEX_SIZE = 1;
export const HEX_HORIZONTAL_SPACING = HEX_SIZE * Math.sqrt(3);
export const HEX_VERTICAL_SPACING = (HEX_SIZE * 3) / 2;

export default class GameRenderer {
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private raycaster!: THREE.Raycaster;
  private mouse!: THREE.Vector2;
  private controls!: MapControls;

  private locationManager!: LocationManager;

  private setupURLChangeListener() {
    window.addEventListener("urlChanged", this.handleURLChange);
  }

  private handleURLChange = () => {
    this.moveCameraToURLLocation();
  };

  // Store
  private state: ThreeStore;
  private unsubscribe: () => void;

  // Stats
  private stats!: any;
  private lerpFactor = 0.9;

  // Camera settings
  private cameraDistance = Math.sqrt(2 * 7 * 7); // Maintain the same distance
  private cameraAngle = 60 * (Math.PI / 180); // 75 degrees in radians

  // Components

  // Managers
  private inputManager!: InputManager;
  private transitionManager!: TransitionManager;

  // Scenes
  private worldmapScene!: WorldmapScene;
  private hexceptionScene!: HexceptionScene;

  // private currentScene: "worldmap" | "hexception" = "worldmap";

  private lastTime: number = 0;

  private dojo: SetupResult;

  private travelPaths: TravelPaths | undefined;

  private mouseHandler!: MouseHandler;
  private sceneManager!: SceneManager;

  constructor(dojoContext: SetupResult, initialState: ThreeStore) {
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

    this.state = initialState;
    this.unsubscribe = useThreeStore.subscribe((state) => {
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

    const buttonsFolder = GUIManager.addFolder("Buttons");
    buttonsFolder.add(this, "goToRandomColRow");
    buttonsFolder.add(this, "moveCameraToURLLocation");
    buttonsFolder.add(this, "switchScene");

    // Add new button for moving camera to specific col and row
    const moveCameraFolder = GUIManager.addFolder("Move Camera");
    const moveCameraParams = { col: 0, row: 0 };
    moveCameraFolder.add(moveCameraParams, "col").name("Column");
    moveCameraFolder.add(moveCameraParams, "row").name("Row");
    moveCameraFolder
      .add(
        {
          move: () => this.moveCameraToColRow(moveCameraParams.col, moveCameraParams.row, 0),
        },
        "move",
      )
      .name("Move Camera");
  }

  initStats() {
    this.stats = new (Stats as any)();
    document.body.appendChild(this.stats.dom);
  }

  initScene() {
    this.setupURLChangeListener();

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
          this.worldmapScene.updateLights(this.controls.target);
        }
      }, 30),
    );

    // Change camera settings for 75-degree view
    this.hexceptionScene = new HexceptionScene(
      this.state,
      this.renderer,
      this.camera,
      this.dojo,
      this.mouse,
      this.raycaster,
    );

    // Add grid
    this.worldmapScene = new WorldmapScene(this.dojo, this.raycaster, this.controls, this.mouse, this.state);
    this.worldmapScene.updateVisibleChunks();

    this.worldmapScene.createGroundMesh();

    this.transitionManager = new TransitionManager(this.renderer);

    this.moveCameraToURLLocation();

    this.sceneManager = new SceneManager(
      this.cameraAngle,
      this.cameraDistance,
      this.camera,
      this.controls,
      this.transitionManager,
    );
    this.sceneManager.initScene(this.hexceptionScene);

    this.inputManager = new InputManager();

    this.mouseHandler = new MouseHandler(
      this.dojo,
      this.state,
      this.raycaster,
      this.mouse,
      this.camera,
      this.travelPaths,
      this.sceneManager,
      this.locationManager,
    );
    this.mouseHandler.initScene(this.worldmapScene);

    // Init animation
    this.animate();
  }

  private moveCameraToURLLocation() {
    const col = this.locationManager.getCol();
    const row = this.locationManager.getRow();
    if (col && row) {
      this.moveCameraToColRow(col, row, 0);
    }
  }

  private moveCameraToColRow(col: number, row: number, duration: number = 2) {
    const colOffset = col;
    const rowOffset = row;
    const newTargetX = colOffset * HEX_HORIZONTAL_SPACING + (rowOffset % 2) * (HEX_HORIZONTAL_SPACING / 2);
    const newTargetZ = -rowOffset * HEX_VERTICAL_SPACING;
    const newTargetY = 0;

    const newTarget = new THREE.Vector3(newTargetX, newTargetY, newTargetZ);

    const target = this.controls.target;
    const pos = this.controls.object.position;

    // go to new target with but keep same view angle
    const deltaX = newTarget.x - target.x;
    const deltaZ = newTarget.z - target.z;
    if (duration) {
      this.cameraAnimate(new THREE.Vector3(pos.x + deltaX, pos.y, pos.z + deltaZ), newTarget, duration);
    } else {
      target.set(newTarget.x, newTarget.y, newTarget.z);
      pos.set(pos.x + deltaX, pos.y, pos.z + deltaZ);
    }
    // target.set(newTarget.x, newTarget.y, newTarget.z);
    // pos.set(pos.x + deltaX, pos.y, pos.z + deltaZ);
    this.controls.update();
  }

  initListeners(): void {
    this.inputManager.initListeners(
      this.onWindowResize.bind(this),
      this.mouseHandler.onMouseMove.bind(this.mouseHandler),
      this.mouseHandler.onDoubleClick.bind(this.mouseHandler),
      this.sceneManager.transitionToMainScene.bind(this),
      this.mouseHandler.onClick.bind(this.mouseHandler),
      this.mouseHandler.onRightClick.bind(this.mouseHandler),
      this.handleKeyEvent.bind(this.handleKeyEvent),
    );
  }

  handleKeyEvent(event: KeyboardEvent): void {
    const { key } = event;

    switch (key) {
      case "e":
        break;
      case "Escape":
        if (this.sceneManager?.currentScene === "hexception") {
          this.sceneManager.transitionToMainScene();
        }
        break;
      default:
        break;
    }
  }

  getLocationCoordinates() {
    const col = this.locationManager.getCol()!;
    const row = this.locationManager.getRow()!;
    const x = col * HEX_HORIZONTAL_SPACING + (row % 2) * (HEX_HORIZONTAL_SPACING / 2);
    const z = -row * HEX_VERTICAL_SPACING;
    return { col, row, x, z };
  }

  switchScene() {
    if (this.sceneManager.currentScene === "worldmap") {
      const { row, col, x, z } = this.getLocationCoordinates();
      this.inputManager.removeListeners();
      this.sceneManager.transitionToDetailedScene(row, col, x, z);
    } else {
      this.initListeners();
      this.sceneManager.transitionToMainScene();
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
    } else {
      // Fallback to window size if container not found
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  cameraAnimate(
    newPosition: THREE.Vector3,
    newTarget: THREE.Vector3,
    transitionDuration: number,
    onFinish?: () => void,
  ) {
    const camera = this.controls.object;
    const target = this.controls.target;
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(target);

    const duration = transitionDuration || 2;

    gsap.timeline().to(camera.position, {
      duration,
      repeat: 0,
      x: newPosition.x,
      y: newPosition.y,
      z: newPosition.z,
      ease: "power3.inOut",
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
      },
      "<",
    );
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
      this.worldmapScene.contextMenuManager.checkHexagonHover();
      this.renderer.render(this.worldmapScene.scene, this.camera);
    } else {
      // this.detailedScene.update(deltaTime);
      this.hexceptionScene.update(deltaTime);
      this.renderer.render(this.hexceptionScene.scene, this.camera);
    }

    requestAnimationFrame(() => {
      this.animate();
    });
  }
}
