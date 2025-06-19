import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CAMERA_CONFIG, CONTROLS_CONFIG, RENDERER_CONFIG } from "./constants";
import { BaseScene } from "./scenes/base-scene";
import { GenericScene } from "./scenes/generic-scene";
import { WorldmapScene } from "./scenes/worldmap-scene";

export class GameRenderer {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private currentScene: string;
  private scenes: Map<string, THREE.Scene>;
  private sceneInstances: Map<string, BaseScene>; // Store scene class instances
  private controls: OrbitControls;
  private animationId: number | null = null;
  private isDisposed = false;
  private mouse: THREE.Vector2;

  constructor(canvas: HTMLCanvasElement) {
    this.scenes = new Map();
    this.sceneInstances = new Map();
    this.currentScene = "worldmap";
    this.mouse = new THREE.Vector2();

    // Initialize Three.js components
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera();
    this.renderer = new THREE.WebGLRenderer();
    this.controls = new OrbitControls(this.camera, canvas);

    this.init(canvas);
  }

  private init(canvas: HTMLCanvasElement): void {
    try {
      this.setupRenderer(canvas);
      this.setupCamera();
      this.setupControls();
      this.setupLighting();
      this.setupEventListeners(canvas);
      this.createDefaultScenes();
      this.switchScene(this.currentScene);
    } catch (error) {
      console.error("Failed to initialize GameRenderer:", error);
      throw error;
    }
  }

  private setupEventListeners(canvas: HTMLCanvasElement): void {
    // Handle click events
    canvas.addEventListener("click", (event) => this.handleClick(event));
    canvas.addEventListener("touchend", (event) => this.handleTouch(event));
  }

  private handleClick(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.processClick();
  }

  private handleTouch(event: TouchEvent): void {
    if (event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

      this.processClick();
    }
  }

  private processClick(): void {
    // Handle click for current scene
    const currentSceneInstance = this.sceneInstances.get(this.currentScene);
    if (currentSceneInstance && currentSceneInstance.handleClick) {
      currentSceneInstance.handleClick(this.mouse, this.camera);
    }
  }

  private setupRenderer(canvas: HTMLCanvasElement): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      ...RENDERER_CONFIG,
    });

    // Mobile optimization
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setClearColor(0x000000, 0);
  }

  private setupCamera(): void {
    const { position, lookAt, near, far, left, right, top, bottom } = CAMERA_CONFIG;

    this.camera = new THREE.OrthographicCamera(left, right, top, bottom, near, far);
    this.camera.position.set(...position);
    this.camera.lookAt(...lookAt);
    this.camera.updateProjectionMatrix();
  }

  private setupControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // Apply mobile-optimized controls configuration
    Object.assign(this.controls, CONTROLS_CONFIG);

    // Additional mobile optimizations
    this.controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    this.controls.addEventListener("change", () => {
      this.render();
      this.updateCurrentScene();
    });
  }

  private updateCurrentScene(): void {
    // Update current scene - scene handles its own logic
    const currentSceneInstance = this.sceneInstances.get(this.currentScene);
    if (currentSceneInstance) {
      currentSceneInstance.update(this.camera);
    }
  }

  private setupLighting(): void {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Directional light for shadows and depth
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
  }

  private createDefaultScenes(): void {
    this.createScene("worldmap");
    this.createScene("detail");
    this.createScene("test");
  }

  public createScene(sceneId: string): void {
    let sceneInstance: BaseScene;

    if (sceneId === "worldmap") {
      // Use the dedicated WorldmapScene class
      sceneInstance = new WorldmapScene();
    } else {
      // Use the generic scene for other scenes
      sceneInstance = new GenericScene(sceneId);
    }

    this.scenes.set(sceneId, sceneInstance.getScene());
    this.sceneInstances.set(sceneId, sceneInstance);
  }

  public switchScene(sceneId: string): void {
    if (!this.scenes.has(sceneId)) {
      console.warn(`Scene ${sceneId} not found, creating it...`);
      this.createScene(sceneId);
    }

    this.currentScene = sceneId;
    this.scene = this.scenes.get(sceneId)!;

    // Update controls target to new scene
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    this.render();
  }

  public resize(): void {
    if (this.isDisposed) return;

    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.camera.left = -width / 100;
    this.camera.right = width / 100;
    this.camera.top = height / 100;
    this.camera.bottom = -height / 100;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.render();
  }

  public render(): void {
    if (this.isDisposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  public startRenderLoop(): void {
    if (this.isDisposed) return;

    const animate = () => {
      if (this.isDisposed) return;

      this.animationId = requestAnimationFrame(animate);
      this.controls.update();
      this.render();
    };

    animate();
  }

  public stopRenderLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public getCurrentScene(): string {
    return this.currentScene;
  }

  public getAvailableScenes(): string[] {
    return Array.from(this.scenes.keys());
  }

  public dispose(): void {
    this.isDisposed = true;
    this.stopRenderLoop();

    // Dispose of scene instances
    this.sceneInstances.forEach((sceneInstance) => {
      sceneInstance.dispose();
    });

    // Dispose of Three.js resources
    this.scenes.forEach((scene) => {
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    });

    this.controls.dispose();
    this.renderer.dispose();
  }
}
