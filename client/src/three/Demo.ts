import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import HexagonMap from "./objects/HexagonMap";

import DetailedHexScene from "./objects/Hexception";
import { SetupResult } from "@/dojo/setup";
import { ThreeStore, useThreeStore } from "@/hooks/store/useThreeStore";
import { InputManager } from "./components/InputManager";
import { TransitionManager } from "./components/Transition";
import _ from "lodash";
import gsap from "gsap";
import { LocationManager } from "./helpers/LocationManager";

export default class Demo {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private lightAmbient!: THREE.AmbientLight;
  private lightPoint!: THREE.DirectionalLight;
  private lightPoint2!: THREE.DirectionalLight;
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
  private hexGrid!: HexagonMap;

  // Managers
  private inputManager!: InputManager;
  private transitionManager!: TransitionManager;

  // Scenes
  private detailedScene!: DetailedHexScene;

  private currentScene: "main" | "detailed" = "main";
  private lastTime: number = 0;

  private dojo: SetupResult;

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
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

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
    this.controls.target.set(0, 0, 0);
    this.controls.addEventListener(
      "change",
      _.throttle(() => {
        this.hexGrid.updateVisibleChunks();
      }, 100),
    );

    // Adjust point lights for new camera angle
    this.lightAmbient = new THREE.AmbientLight(0xffffff, 3);
    this.scene.add(this.lightAmbient);

    const shadowIntensity = 0.9;
    const lightColor = 0xffffff;

    // this.lightPoint = new THREE.DirectionalLight(lightColor, shadowIntensity);
    // this.lightPoint.position.set(50, 100, 50);
    // this.lightPoint.castShadow = true;
    // this.scene.add(this.lightPoint);

    // this.lightPoint2 = new THREE.DirectionalLight(lightColor, 0.4);
    // this.lightPoint2.position.set(-50, 100, -50);
    // this.lightPoint2.castShadow = false;
    // this.scene.add(this.lightPoint2);

    // // Improve shadow quality
    // const mapSize = 2048;
    // const cameraNear = 1;
    // const cameraFar = 500;
    // this.lightPoint.shadow.mapSize.width = mapSize;
    // this.lightPoint.shadow.mapSize.height = mapSize;
    // this.lightPoint.shadow.camera.near = cameraNear;
    // this.lightPoint.shadow.camera.far = cameraFar;
    // this.lightPoint.shadow.bias = -0.001;

    // // Adjust shadow camera frustum
    // const d = 200;
    // this.lightPoint.shadow.camera.left = -d;
    // this.lightPoint.shadow.camera.right = d;
    // this.lightPoint.shadow.camera.top = d;
    // this.lightPoint.shadow.camera.bottom = -d;
    // const cameraHelper = new THREE.CameraHelper(this.lightPoint.shadow.camera);
    // this.scene.add(cameraHelper);

    // const cameraHelper2 = new THREE.CameraHelper(this.lightPoint2.shadow.camera);
    // this.scene.add(cameraHelper2);

    this.detailedScene = new DetailedHexScene(
      this.state,
      this.renderer,
      this.camera,
      this.dojo,
      this.mouse,
      this.raycaster,
    );

    // Add grid
    this.hexGrid = new HexagonMap(this.scene, this.dojo, this.raycaster, this.controls, this.mouse, this.state);
    this.hexGrid.updateVisibleChunks();

    this.transitionManager = new TransitionManager(this.renderer);

    this.checkInitialLocation();

    // Init animation
    this.animate();
  }

  private checkInitialLocation() {
    // const location = this.locationManager.getCol();
    // if (this.locationManager.getCol() && this.locationManager.getRow()) {
    //   // Delay the transition to ensure the scene is fully loaded
    //   setTimeout(() => {
    //     this.transitionToHexByCoordinates(this.locationManager.getRow()!, this.locationManager.getCol()!);
    //   }, 1000); // Adjust the delay as needed
    // }
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

  transitionToDetailedScene(row: number, col: number, x: number, z: number) {
    this.cameraAnimate(new THREE.Vector3(x + 2, 4, z + 2), new THREE.Vector3(x, 0, z), 2, () => {
      setTimeout(() => {
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
      }, 50);
    });
    setTimeout(() => {
      this.transitionManager.fadeOut(() => {});
    }, 1500);
  }

  transitionToMainScene() {
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

    requestAnimationFrame(() => {
      this.animate();
    });

    if (this.stats) this.stats.update();

    if (this.controls) {
      this.controls.update();
      // Look at the target
      // this.camera.lookAt(this.controls.target);

      // Update light positions to follow the camera
      // const lightOffset1 = new THREE.Vector3(0, 5, 5);
      // const lightOffset2 = new THREE.Vector3(0, -5, -5);
      // this.lightPoint.position.copy(this.camera.position).add(lightOffset1);
      // this.lightPoint2.position.copy(this.camera.position).add(lightOffset2);
    }

    if (this.currentScene === "main") {
      this.hexGrid.update(deltaTime);
      // this.hexGrid.updateVisibleChunks();
      this.hexGrid.contextMenuManager.checkHexagonHover();
      this.renderer.render(this.scene, this.camera);
    } else {
      // this.detailedScene.update(deltaTime);
      this.renderer.render(this.detailedScene.scene, this.camera);
    }
  }
}
