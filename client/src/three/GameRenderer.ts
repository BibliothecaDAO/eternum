import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import WorldmapScene from "./scenes/Worldmap";
import HexceptionScene from "./scenes/Hexception";
import { SetupResult } from "@/dojo/setup";
import { ThreeStore, useThreeStore } from "@/hooks/store/useThreeStore";
import { InputManager } from "./components/InputManager";
import { TransitionManager } from "./components/Transition";
import _ from "lodash";
import gsap from "gsap";
import { LocationManager } from "./helpers/LocationManager";
import GUI from "lil-gui";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { FELT_CENTER } from "@/ui/config";
import { StructureSystem } from "./systems/StructureSystem";
import { ArmySystem } from "./systems/ArmySystem";

const horizontalSpacing = Math.sqrt(3);
const verticalSpacing = 3 / 2;

export default class GameRenderer {
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private raycaster!: THREE.Raycaster;
  private mouse!: THREE.Vector2;
  private controls!: MapControls;

  private locationManager!: LocationManager;

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

  private currentScene: "worldmap" | "hexception" = "worldmap";

  private lastTime: number = 0;

  private dojo: SetupResult;

  private gui: GUI = new GUI();

  constructor(dojoContext: SetupResult, initialState: ThreeStore) {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.7;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.inputManager = new InputManager(this.currentScene);
    this.initListeners();

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

    const buttonsFolder = this.gui.addFolder("Buttons");
    buttonsFolder.add(this, "goToRandomColRow");
    buttonsFolder.add(this, "moveCameraToURLLocation");
    buttonsFolder.add(this, "switchScene");
  }

  initStats() {
    this.stats = new (Stats as any)();
    document.body.appendChild(this.stats.dom);
  }

  initScene() {
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
        this.worldmapScene.updateVisibleChunks();
        this.worldmapScene.updateLights(this.controls.target);
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
    this.worldmapScene = new WorldmapScene(this.dojo, this.raycaster, this.controls, this.mouse, this.state, this.gui);
    this.worldmapScene.updateVisibleChunks();

    this.transitionManager = new TransitionManager(this.renderer);

    this.moveCameraToURLLocation();

    // Init animation
    this.animate();

    const structureSystem = new StructureSystem(this.dojo, this.worldmapScene);
    structureSystem.setupSystem();

    const armySystem = new ArmySystem(this.dojo, this.worldmapScene);
    armySystem.setupSystem();
  }

  private moveCameraToURLLocation() {
    const col = this.locationManager.getCol();
    const row = this.locationManager.getRow();
    console.log("debug 1", col, row);
    if (col && row) {
      console.log("debug 2");
      this.moveCameraToColRow(col, row, 0);
    }
  }

  private goToRandomColRow() {
    const col = Math.floor(Math.random() * 50) + FELT_CENTER;
    const row = Math.floor(Math.random() * 50) + FELT_CENTER;
    this.moveCameraToColRow(col, row);
  }

  private moveCameraToColRow(col: number, row: number, duration: number = 2) {
    console.log("debug 3");
    const colOffset = col;
    const rowOffset = row;
    const newTargetX = colOffset * horizontalSpacing + (rowOffset % 2) * (horizontalSpacing / 2);
    const newTargetZ = -rowOffset * verticalSpacing;
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

  // Add this new method
  private transitionToHexByCoordinates(row: number, col: number) {
    // this.transitionToDetailedScene(row, col);
  }

  onMouseMove(event: MouseEvent) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  initListeners(): void {
    this.inputManager.initListeners(
      this.onWindowResize.bind(this),
      this.onHexClick.bind(this),
      this.onMouseMove.bind(this),
      // todo: add double click handler
      this.onDoubleClick.bind(this),
      this.transitionToMainScene.bind(this),
    );
  }

  onHexClick() {
    console.log("clicked");
  }

  onDoubleClick() {
    if (this.currentScene === "worldmap") {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.worldmapScene.scene.children, true);
      if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        if (clickedObject instanceof THREE.InstancedMesh) {
          const instanceId = intersects[0].instanceId;
          if (instanceId !== undefined) {
            const { row, col, x, z } = this.worldmapScene.getHexagonCoordinates(clickedObject, instanceId);
            this.locationManager.addRowColToQueryString(row, col);
            this.transitionToDetailedScene(row, col, x, z);
          }
        }
      }
    }
  }

  getLocationCoordinates() {
    const col = this.locationManager.getCol()!;
    const row = this.locationManager.getRow()!;
    const x = col * horizontalSpacing + (row % 2) * (horizontalSpacing / 2);
    const z = -row * verticalSpacing;
    return { col, row, x, z };
  }

  switchScene() {
    if (this.currentScene === "worldmap") {
      const { row, col, x, z } = this.getLocationCoordinates();
      this.transitionToDetailedScene(row, col, x, z);
    } else {
      this.transitionToMainScene();
    }
  }

  transitionToDetailedScene(row: number, col: number, x: number, z: number) {
    // this.detailedScene.setup(row, col);
    // this.currentScene = "detailed";
    this.transitionManager.fadeOut(() => {
      this.currentScene = "hexception";
      // Reset camera and controls
      this.hexceptionScene.setup(row, col);
      this.camera.position.set(
        0,
        Math.sin(this.cameraAngle) * this.cameraDistance,
        -Math.cos(this.cameraAngle) * this.cameraDistance,
      );
      this.camera.lookAt(0, 0, 0);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
      this.transitionManager.fadeIn();
      this.inputManager.updateCurrentScene("detailed");
    });
  }

  transitionToMainScene() {
    //this.currentScene = "main";

    this.transitionManager.fadeOut(() => {
      this.currentScene = "worldmap";

      this.moveCameraToColRow(this.hexceptionScene.getCenterColRow()[0], this.hexceptionScene.getCenterColRow()[1], 0);

      this.transitionManager.fadeIn();
      this.inputManager.updateCurrentScene("main");
    });
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

    if (this.currentScene === "worldmap") {
      this.worldmapScene.update(deltaTime);
      // this.hexGrid.updateVisibleChunks();
      this.worldmapScene.contextMenuManager.checkHexagonHover();
      this.renderer.render(this.worldmapScene.scene, this.camera);
    } else {
      // this.detailedScene.update(deltaTime);
      this.renderer.render(this.hexceptionScene.scene, this.camera);
    }

    requestAnimationFrame(() => {
      this.animate();
    });
  }
}
