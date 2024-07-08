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

const horizontalSpacing = Math.sqrt(3);
const verticalSpacing = 3 / 2;

type LightTypes = "pmrem" | "hemisphere";
export default class Demo {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private lightAmbient!: THREE.AmbientLight;
  private mainDirectionalLight!: THREE.DirectionalLight;
  private lightPoint2!: THREE.DirectionalLight;
  private controls!: MapControls;
  private pmremGenerator!: THREE.PMREMGenerator;

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
  private hexGrid!: WorldmapScene;

  // Managers
  private inputManager!: InputManager;
  private transitionManager!: TransitionManager;

  // Scenes
  private detailedScene!: HexceptionScene;

  private currentScene: "main" | "detailed" = "main";
  private lightType: LightTypes = "hemisphere";

  private lastTime: number = 0;

  private dojo: SetupResult;

  private gui: GUI = new GUI();

  private lightHelper!: THREE.DirectionalLightHelper;

  constructor(dojoContext: SetupResult, initialState: ThreeStore) {
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
  }

  initStats() {
    this.stats = new (Stats as any)();
    document.body.appendChild(this.stats.dom);
  }

  initScene() {
    this.scene = new THREE.Scene();
    // Change camera settings for 75-degree view
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 30);
    const cameraHeight = Math.sin(this.cameraAngle) * this.cameraDistance;
    const cameraDepth = Math.cos(this.cameraAngle) * this.cameraDistance;
    this.camera.position.set(0, cameraHeight, -cameraDepth);
    this.camera.lookAt(0, 0, 0);
    this.camera.up.set(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer();
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.7;

    if (this.lightType === "pmrem") {
      this.scene.environment = this.pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    }

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
        this.hexGrid.updateVisibleChunks();
        if (this.mainDirectionalLight) {
          const target = this.controls.target;
          this.mainDirectionalLight.position.set(target.x, target.y + 9, target.z);
          this.mainDirectionalLight.target.position.set(target.x, target.y, target.z + 5.2);
          this.mainDirectionalLight.target.updateMatrixWorld();
        }
      }, 100),
    );

    // Adjust point lights for new camera angle
    this.lightAmbient = new THREE.AmbientLight(0xffffff, 0.5);
    const ambientFolder = this.gui.addFolder("Ambient Light");
    ambientFolder.addColor(this.lightAmbient, "color");
    ambientFolder.add(this.lightAmbient, "intensity", 0, 3, 0.1);
    //this.scene.add(this.lightAmbient);

    if (this.lightType === "hemisphere") {
      const hemisphereLight = new THREE.HemisphereLight(0xf3f3c8, 0xd0e7f0, 2);
      const hemisphereLightFolder = this.gui.addFolder("Hemisphere Light");
      hemisphereLightFolder.addColor(hemisphereLight, "color");
      hemisphereLightFolder.addColor(hemisphereLight, "groundColor");
      hemisphereLightFolder.add(hemisphereLight, "intensity", 0, 3, 0.1);
      this.scene.add(hemisphereLight);

      this.mainDirectionalLight = new THREE.DirectionalLight(0xffffff, 3);
      this.mainDirectionalLight.castShadow = true;
      this.mainDirectionalLight.shadow.mapSize.width = 2048;
      this.mainDirectionalLight.shadow.mapSize.height = 2048;
      this.mainDirectionalLight.shadow.camera.left = -24;
      this.mainDirectionalLight.shadow.camera.right = 20;
      this.mainDirectionalLight.shadow.camera.top = 11;
      this.mainDirectionalLight.shadow.camera.bottom = -12;
      this.mainDirectionalLight.position.set(0, 9, 0);
      this.mainDirectionalLight.target.position.set(0, 0, 5.2);
      const shadowFolder = this.gui.addFolder("Shadow");
      shadowFolder.add(this.mainDirectionalLight.shadow.camera, "left", -50, 50, 0.1);
      shadowFolder.add(this.mainDirectionalLight.shadow.camera, "right", -50, 50, 0.1);
      shadowFolder.add(this.mainDirectionalLight.shadow.camera, "top", -50, 50, 0.1);
      shadowFolder.add(this.mainDirectionalLight.shadow.camera, "bottom", -50, 50, 0.1);
      const directionalLightFolder = this.gui.addFolder("Directional Light");
      directionalLightFolder.addColor(this.mainDirectionalLight, "color");
      directionalLightFolder.add(this.mainDirectionalLight.position, "x", -20, 20, 0.1);
      directionalLightFolder.add(this.mainDirectionalLight.position, "y", -20, 20, 0.1);
      directionalLightFolder.add(this.mainDirectionalLight.position, "z", -20, 20, 0.1);
      directionalLightFolder.add(this.mainDirectionalLight, "intensity", 0, 3, 0.1);
      directionalLightFolder.add(this.mainDirectionalLight.target.position, "x", 0, 10, 0.1);
      directionalLightFolder.add(this.mainDirectionalLight.target.position, "y", 0, 10, 0.1);
      directionalLightFolder.add(this.mainDirectionalLight.target.position, "z", 0, 10, 0.1);
      this.scene.add(this.mainDirectionalLight);
      this.scene.add(this.mainDirectionalLight.target);

      this.lightHelper = new THREE.DirectionalLightHelper(this.mainDirectionalLight, 1);
      this.scene.add(this.lightHelper);
    }

    const buttonsFolder = this.gui.addFolder("Buttons");
    buttonsFolder.add(this, "goToRandomColRow");
    buttonsFolder.add(this, "moveCameraToURLLocation");
    buttonsFolder.add(this, "switchScene");

    this.detailedScene = new HexceptionScene(
      this.state,
      this.renderer,
      this.camera,
      this.dojo,
      this.mouse,
      this.raycaster,
    );

    // Add grid
    this.hexGrid = new WorldmapScene(this.scene, this.dojo, this.raycaster, this.controls, this.mouse, this.state);
    this.hexGrid.updateVisibleChunks();

    this.transitionManager = new TransitionManager(this.renderer);

    this.moveCameraToURLLocation();

    // Init animation
    this.animate();
  }

  private moveCameraToURLLocation() {
    const col = this.locationManager.getCol();
    const row = this.locationManager.getRow();
    console.log("debug 1", col, row);
    if (col && row) {
      console.log("debug 2");
      this.moveCameraToColRow(col, row);
    }
  }

  private goToRandomColRow() {
    const col = Math.floor(Math.random() * 50) + FELT_CENTER;
    const row = Math.floor(Math.random() * 50) + FELT_CENTER;
    this.moveCameraToColRow(col, row);
  }

  private moveCameraToColRow(col: number, row: number) {
    console.log("debug 3");
    const newTargetX = (col - FELT_CENTER) * horizontalSpacing + ((row - FELT_CENTER) % 2) * (horizontalSpacing / 2);
    const newTargetZ = -(row - FELT_CENTER) * verticalSpacing;
    const newTargetY = 0;

    const newTarget = new THREE.Vector3(newTargetX, newTargetY, newTargetZ);

    const target = this.controls.target;
    const pos = this.controls.object.position;

    // go to new target with but keep same view angle
    const deltaX = newTarget.x - target.x;
    const deltaZ = newTarget.z - target.z;

    this.cameraAnimate(new THREE.Vector3(pos.x + deltaX, pos.y, pos.z + deltaZ), newTarget, 2);
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
    if (this.currentScene === "main") {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.scene.children, true);
      if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        if (clickedObject instanceof THREE.InstancedMesh) {
          const instanceId = intersects[0].instanceId;
          if (instanceId !== undefined) {
            const { row, col, x, z } = this.hexGrid.getHexagonCoordinates(clickedObject, instanceId);
            this.transitionToDetailedScene(row, col, x, z);
          }
        }
      }
    }
  }

  getLocationCoordinates() {
    const col = this.locationManager.getCol()!;
    const row = this.locationManager.getRow()!;
    const x = (col - FELT_CENTER) * horizontalSpacing + ((row - FELT_CENTER) % 2) * (horizontalSpacing / 2);
    const z = -(row - FELT_CENTER) * verticalSpacing;
    return { col, row, x, z };
  }

  switchScene() {
    if (this.currentScene === "main") {
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
      this.currentScene = "detailed";
      // Reset camera and controls
      this.detailedScene.setup(row, col);
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
      this.currentScene = "main";

      this.camera.position.set(
        0,
        Math.sin(this.cameraAngle) * this.cameraDistance,
        -Math.cos(this.cameraAngle) * this.cameraDistance,
      );
      this.camera.lookAt(0, 0, 0);
      this.controls.target.set(0, 0, 0);
      this.controls.update();

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
    if (this.mainDirectionalLight) {
      this.mainDirectionalLight.shadow.camera.updateProjectionMatrix();
    }
    if (this.lightHelper) this.lightHelper.update();

    if (this.currentScene === "main") {
      this.hexGrid.update(deltaTime);
      // this.hexGrid.updateVisibleChunks();
      this.hexGrid.contextMenuManager.checkHexagonHover();
      this.renderer.render(this.scene, this.camera);
    } else {
      // this.detailedScene.update(deltaTime);
      this.renderer.render(this.detailedScene.scene, this.camera);
    }

    requestAnimationFrame(() => {
      this.animate();
    });
  }
}
