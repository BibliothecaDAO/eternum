import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import HexagonMap from "./objects/HexagonMap";

import DetailedHexScene from "./objects/Hexception";
import { SetupResult } from "@/dojo/setup";

export default class Demo {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  private lightAmbient!: THREE.AmbientLight;
  private lightPoint!: THREE.DirectionalLight;
  private lightPoint2!: THREE.DirectionalLight;

  private controls!: OrbitControls;
  private stats!: any;
  private lerpFactor = 0.9;

  private cameraDistance = Math.sqrt(2 * 10 * 10); // Maintain the same distance
  private cameraAngle = 60 * (Math.PI / 180); // 75 degrees in radians

  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  private hexGrid!: HexagonMap;

  private detailedScene!: DetailedHexScene;

  private currentScene: "main" | "detailed" = "main";

  private lastTime: number = 0;

  private dojo: SetupResult;

  constructor(dojoContext: SetupResult) {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.dojo = dojoContext;
  }

  initStats() {
    this.stats = new (Stats as any)();
    document.body.appendChild(this.stats.dom);
  }

  initScene() {
    this.scene = new THREE.Scene();

    // Change camera settings for 75-degree view
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
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

    document.body.appendChild(this.renderer.domElement);

    // Adjust OrbitControls for new camera angle
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = true;
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.panSpeed = 1.5;
    this.controls.screenSpacePanning = true;
    this.controls.target.set(0, 0, 0);

    this.lightAmbient = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(this.lightAmbient);

    // Adjust point lights for new camera angle
    const shadowIntensity = 1;

    this.lightPoint = new THREE.DirectionalLight(0xffffff);
    this.lightPoint.position.set(0, cameraHeight + 5, -cameraDepth + 5);
    this.lightPoint.castShadow = true;
    this.lightPoint.intensity = shadowIntensity;
    this.scene.add(this.lightPoint);

    this.lightPoint2 = new THREE.DirectionalLight(0xffffff);
    this.lightPoint2.position.set(0, cameraHeight - 5, -cameraDepth - 5);
    this.lightPoint2.intensity = 1 - shadowIntensity;
    this.lightPoint2.castShadow = false;
    this.scene.add(this.lightPoint2);

    const mapSize = 1024;
    const cameraNear = 0.5;
    const cameraFar = 500;
    this.lightPoint.shadow.mapSize.width = mapSize;
    this.lightPoint.shadow.mapSize.height = mapSize;
    this.lightPoint.shadow.camera.near = cameraNear;
    this.lightPoint.shadow.camera.far = cameraFar;

    const cameraHelper = new THREE.CameraHelper(this.lightPoint.shadow.camera);
    this.scene.add(cameraHelper);

    const cameraHelper2 = new THREE.CameraHelper(this.lightPoint2.shadow.camera);
    this.scene.add(cameraHelper2);

    this.detailedScene = new DetailedHexScene(this.renderer, this.camera, this.dojo);

    // Add grid
    this.hexGrid = new HexagonMap(this.scene, this.dojo, this.raycaster, this.camera, this.mouse);
    this.hexGrid.updateVisibleChunks();

    // Init animation
    this.animate();
  }

  onMouseMove(event: MouseEvent) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  initListeners() {
    window.addEventListener("resize", this.onWindowResize.bind(this), false);

    window.addEventListener("keydown", (event) => {
      const { key } = event;

      switch (key) {
        case "e":
          const win = window.open("", "Canvas Image");

          const { domElement } = this.renderer;

          // Makse sure scene is rendered.
          this.renderer.render(this.scene, this.camera);

          const src = domElement.toDataURL();

          if (!win) return;

          win.document.write(`<img src='${src}' width='${domElement.width}' height='${domElement.height}'>`);
          break;

        default:
          break;
      }
    });

    window.addEventListener("mousemove", this.onMouseMove.bind(this), false);

    window.addEventListener("dblclick", this.onHexClick.bind(this), false);

    window.addEventListener("keydown", (event) => {
      const { key } = event;

      switch (key) {
        case "e":
          // ... existing code for 'e' key ...
          break;
        case "Escape":
          if (this.currentScene === "detailed") {
            this.transitionToMainScene();
          }
          break;
        default:
          break;
      }
    });
  }

  onHexClick(event: MouseEvent) {
    if (this.currentScene === "main") {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.scene.children, true);
      if (intersects.length > 0) {
        const clickedHex = intersects[0].object;

        console.log("Hex clicked:", clickedHex);
        this.transitionToDetailedScene(clickedHex);
      }
    }
  }

  transitionToDetailedScene(clickedHex: THREE.Object3D) {
    console.log("Transitioning to detailed scene");
    this.fadeOut(() => {
      this.currentScene = "detailed";
      console.log("Current scene changed to:", this.currentScene);
      this.detailedScene.setup(clickedHex);
      this.fadeIn();
    });
  }

  private transitionToMainScene() {
    console.log("Transitioning to main scene");
    this.fadeOut(() => {
      this.currentScene = "main";
      console.log("Current scene changed to:", this.currentScene);
      this.fadeIn();
    });
  }

  fadeOut(onComplete: () => void) {
    let opacity = 1;
    const startTime = performance.now();
    const duration = 500; // 500ms for the fade

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      opacity = 1 - Math.min(elapsed / duration, 1);
      this.renderer.domElement.style.opacity = opacity.toString();

      if (elapsed < duration) {
        requestAnimationFrame(animate);
      } else {
        this.renderer.domElement.style.opacity = "0";
        onComplete();
      }
    };

    requestAnimationFrame(animate);
  }

  fadeIn() {
    let opacity = 0;
    const startTime = performance.now();
    const duration = 500; // 500ms for the fade

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      opacity = Math.min(elapsed / duration, 1);
      this.renderer.domElement.style.opacity = opacity.toString();

      if (elapsed < duration) {
        requestAnimationFrame(animate);
      } else {
        this.renderer.domElement.style.opacity = "1";
      }
    };

    requestAnimationFrame(animate);
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

      // // Calculate the camera offset based on the fixed angle and distance
      // const cameraHeight = Math.sin(this.cameraAngle) * this.cameraDistance;
      // const cameraDepth = Math.cos(this.cameraAngle) * this.cameraDistance;
      // const offset = new THREE.Vector3(0, cameraHeight, -cameraDepth);

      // // Calculate the desired camera position
      // const desiredCameraPosition = new THREE.Vector3().copy(this.controls.target).add(offset);

      // // Lerp the camera position
      // this.camera.position.lerp(desiredCameraPosition, this.lerpFactor);

      // // Calculate the desired controls target
      // const desiredControlsTarget = new THREE.Vector3(this.camera.position.x, 0, this.camera.position.z + cameraDepth);

      // // Lerp the controls target
      // this.controls.target.lerp(desiredControlsTarget, this.lerpFactor);

      // // Look at the target
      // this.camera.lookAt(this.controls.target);

      // // Update light positions to follow the camera
      // const lightOffset1 = new THREE.Vector3(0, 5, 5);
      // const lightOffset2 = new THREE.Vector3(0, -5, -5);
      // this.lightPoint.position.copy(this.camera.position).add(lightOffset1);
      // this.lightPoint2.position.copy(this.camera.position).add(lightOffset2);
    }

    if (this.currentScene === "main") {
      // this.hexGrid.update(deltaTime);
      // this.hexGrid.updateVisibleChunks();
      // this.hexGrid.contextMenuManager.checkHexagonHover();
      this.renderer.render(this.scene, this.camera);
    } else {
      //this.detailedScene.update(deltaTime);
      this.renderer.render(this.detailedScene.scene, this.camera);
    }
  }
}
