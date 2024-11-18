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
import HexceptionScene from "./LandingHexceptionScene";

export default class Renderer {
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private controls!: MapControls;
  private composer!: EffectComposer;
  private renderPass!: RenderPass;
  private scene!: HexceptionScene;

  // Camera settings
  private cameraDistance = Math.sqrt(2 * 7 * 7);
  private cameraAngle = 60 * (Math.PI / 180);

  private lastTime: number = 0;

  constructor() {
    this.initializeRenderer();
    this.setupCamera();
    this.setupControls();
    this.initializeScene();
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
    this.renderer.setPixelRatio(0.75);
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
    this.scene = new HexceptionScene(this.controls);
    document.body.prepend(this.renderer.domElement);
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
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.panSpeed = 1;
    this.controls.zoomToCursor = true;
    this.controls.minDistance = 17;
    this.controls.maxDistance = 17;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.target.set(0, 0, 0);
  }

  private setupPostProcessing() {
    this.renderPass = new RenderPass(this.scene.getScene(), this.camera);
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
      this.scene.setEnvironment(envMap, 0.7);
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
    this.scene.update(deltaTime);
    this.renderer.clear();
    this.composer.render();

    requestAnimationFrame(() => this.animate());
  }
}
