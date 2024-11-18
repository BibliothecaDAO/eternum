import {
  BloomEffect,
  BrightnessContrastEffect,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  RenderPass,
} from "postprocessing";
import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

export default class Renderer {
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private controls!: MapControls;
  private composer!: EffectComposer;
  private renderPass!: RenderPass;
  private scene!: THREE.Scene;

  // Camera settings
  private cameraDistance = Math.sqrt(2 * 7 * 7);
  private cameraAngle = 60 * (Math.PI / 180);

  private lastTime: number = 0;

  constructor() {
    this.initializeRenderer();
    this.initializeScene();
    this.setupCamera();
    this.setupControls();
    this.setupPostProcessing();
    this.setupListeners();
    this.applyEnvironment();
    this.animate();
  }

  private initializeRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: "high-performance",
      antialias: false,
      stencil: false,
      depth: false,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.autoClear = false;

    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
    });
  }

  private initializeScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const cube = new THREE.Mesh(geometry, material);
    this.scene.add(cube);
    document.body.appendChild(this.renderer.domElement);
  }

  private setupCamera() {
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 30);
    const cameraHeight = Math.sin(this.cameraAngle) * this.cameraDistance;
    const cameraDepth = Math.cos(this.cameraAngle) * this.cameraDistance;
    this.camera.position.set(0, cameraHeight, cameraDepth);
    this.camera.lookAt(0, 0, 0);
    this.camera.up.set(0, 1, 0);
  }

  private setupControls() {
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
  }

  private setupPostProcessing() {
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    const BCEffect = new BrightnessContrastEffect({
      brightness: -0.1,
      contrast: 0,
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

  private applyEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    const hdriLoader = new RGBELoader();
    hdriLoader.load("/textures/environment/models_env.hdr", (texture) => {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      texture.dispose();
      this.scene.environment = envMap;
      this.scene.background = envMap;
    });
  }

  private setupListeners() {
    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  private onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  animate() {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.controls.update();
    this.renderer.clear();
    this.composer.render();

    requestAnimationFrame(() => this.animate());
  }

  // Method to add meshes to the scene
  addToScene(mesh: THREE.Object3D) {
    this.scene.add(mesh);
  }
}
