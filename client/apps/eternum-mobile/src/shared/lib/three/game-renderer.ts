import { DojoResult } from "@bibliothecadao/react";
import * as THREE from "three";
import { CSS2DRenderer } from "three-stdlib";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CAMERA_CONFIG, CONTROLS_CONFIG, RENDERER_CONFIG } from "./constants";
import { GUIManager } from "./helpers/gui-manager";
import { BaseScene } from "./scenes/base-scene";
import { GenericScene } from "./scenes/generic-scene";
import { WorldmapScene } from "./scenes/worldmap-scene";
import { Position } from "./types/position";

export class GameRenderer {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private labelRenderer!: CSS2DRenderer;
  private labelRendererElement!: HTMLDivElement;
  private currentScene: string;
  private scenes: Map<string, THREE.Scene>;
  private sceneInstances: Map<string, BaseScene>; // Store scene class instances
  private controls: OrbitControls;
  private animationId: number | null = null;
  private isDisposed = false;
  private mouse: THREE.Vector2;
  private boundClickHandler: ((event: MouseEvent) => void) | null = null;
  private dojo: DojoResult;
  private moveCameraFolder: any = null; // Store reference to GUI folder

  constructor(canvas: HTMLCanvasElement, dojo: DojoResult) {
    this.scenes = new Map();
    this.sceneInstances = new Map();
    this.currentScene = "worldmap";
    this.mouse = new THREE.Vector2();
    this.dojo = dojo;

    // Initialize Three.js components
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera();
    this.renderer = new THREE.WebGLRenderer();
    this.controls = new OrbitControls(this.camera, canvas);

    this.waitForLabelRendererElement()
      .then((labelRendererElement) => {
        console.debug("[GameRenderer] Label renderer element promise resolved");
        this.labelRendererElement = labelRendererElement;
        this.initializeLabelRenderer();
      })
      .catch((error) => {
        console.error("[GameRenderer] Failed to initialize label renderer:", error);
      });

    this.init(canvas);
  }

  private async waitForLabelRendererElement(): Promise<HTMLDivElement> {
    console.debug("[GameRenderer] Waiting for labelrenderer element...");
    return new Promise((resolve) => {
      const checkElement = () => {
        const element = document.getElementById("labelrenderer") as HTMLDivElement;
        if (element) {
          console.debug("[GameRenderer] Found labelrenderer element:", element);
          resolve(element);
        } else {
          console.debug("[GameRenderer] labelrenderer element not found, retrying...");
          requestAnimationFrame(checkElement);
        }
      };
      checkElement();
    });
  }

  private initializeLabelRenderer() {
    console.debug("[GameRenderer] Initializing CSS2DRenderer with element:", this.labelRendererElement);
    this.labelRenderer = new CSS2DRenderer({ element: this.labelRendererElement });
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    console.debug(
      "[GameRenderer] CSS2DRenderer initialized successfully, size:",
      window.innerWidth,
      "x",
      window.innerHeight,
    );
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
      this.setupCameraMovementGUI();
    } catch (error) {
      console.error("Failed to initialize GameRenderer:", error);
      throw error;
    }
  }

  private setupEventListeners(canvas: HTMLCanvasElement): void {
    // Remove any existing click listeners to prevent duplicates
    if (this.boundClickHandler) {
      canvas.removeEventListener("click", this.boundClickHandler);
    }

    // Create bound handler to ensure proper removal later
    this.boundClickHandler = (event: MouseEvent) => this.handleClick(event);

    // Handle click events
    canvas.addEventListener("click", this.boundClickHandler);
    // canvas.addEventListener("touchend", (event) => this.handleTouch(event));
  }

  private handleClick(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.processClick();
  }

  // private handleTouch(event: TouchEvent): void {
  //   if (event.changedTouches.length > 0) {
  //     const touch = event.changedTouches[0];
  //     const rect = this.renderer.domElement.getBoundingClientRect();
  //     this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
  //     this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

  //     this.processClick();
  //   }
  // }

  private processClick(): void {
    console.log("handleClick fired");

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
    this.renderer.setClearColor(0x000000, 0.5);
  }

  private setupCamera(): void {
    const { position, lookAt, near, far, left, right, top, bottom } = CAMERA_CONFIG;

    this.camera = new THREE.OrthographicCamera(left, right, top, bottom, near, far);
    this.camera.position.set(position[0], position[1], position[2]);
    this.camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
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

  private setupCameraMovementGUI() {
    const folderName = "Move Camera";

    // Check if folder already exists and remove it to prevent duplicates
    const existingFolder = GUIManager.folders.find((folder: any) => folder._title === folderName);
    if (existingFolder) {
      existingFolder.destroy();
    }

    this.moveCameraFolder = GUIManager.addFolder(folderName);
    const moveCameraParams = { col: 0, row: 0, x: 0, y: 0, z: 0 };

    this.moveCameraFolder.add(moveCameraParams, "col").name("Column");
    this.moveCameraFolder.add(moveCameraParams, "row").name("Row");
    this.moveCameraFolder.add(moveCameraParams, "x").name("X");
    this.moveCameraFolder.add(moveCameraParams, "y").name("Y");
    this.moveCameraFolder.add(moveCameraParams, "z").name("Z");

    this.moveCameraFolder
      .add(
        {
          move: () => {
            const worldmapScene = this.sceneInstances.get("worldmap") as WorldmapScene;
            worldmapScene
              ?.getHexagonMap()
              .moveCameraToColRow(moveCameraParams.col, moveCameraParams.row, this.controls);
          },
        },
        "move",
      )
      .name("Move Camera");

    this.moveCameraFolder.close();
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
      sceneInstance = new WorldmapScene(this.dojo, this.controls);
    } else {
      sceneInstance = new GenericScene(sceneId, this.dojo, this.controls);
    }

    this.scenes.set(sceneId, sceneInstance.getScene());
    this.sceneInstances.set(sceneId, sceneInstance);
  }

  public moveCameraToStructure(structurePosition: { x: number; y: number }): void {
    const worldmapScene = this.sceneInstances.get("worldmap") as WorldmapScene;
    if (!worldmapScene) return;

    const position = new Position(structurePosition);
    const normalized = position.getNormalized();

    worldmapScene.getHexagonMap().moveCameraToColRow(normalized.x, normalized.y, this.controls);
  }

  public switchScene(sceneId: string): void {
    if (!this.scenes.has(sceneId)) {
      console.warn(`Scene ${sceneId} not found, creating it...`);
      this.createScene(sceneId);
    }

    this.currentScene = sceneId;
    this.scene = this.scenes.get(sceneId)!;

    this.controls.target.set(0, 0, 0);

    this.camera.position.set(0, 10, 0);
    this.camera.lookAt(0, 0, 0);

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
    this.labelRenderer?.setSize(width, height);
    this.render();
  }

  public render(): void {
    if (this.isDisposed) return;
    this.renderer.render(this.scene, this.camera);
    if (this.labelRenderer) {
      this.labelRenderer.render(this.scene, this.camera);
    } else {
      console.debug("[GameRenderer] Label renderer not available for rendering");
    }
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

  public getDojo(): DojoResult {
    return this.dojo;
  }

  public getLabelRenderer(): CSS2DRenderer | undefined {
    return this.labelRenderer;
  }

  public dispose(): void {
    this.isDisposed = true;
    this.stopRenderLoop();

    // Dispose GUI folder
    if (this.moveCameraFolder) {
      this.moveCameraFolder.destroy();
      this.moveCameraFolder = null;
    }

    // Remove event listeners
    if (this.boundClickHandler) {
      this.renderer.domElement.removeEventListener("click", this.boundClickHandler);
      this.boundClickHandler = null;
    }

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

    // Dispose label renderer
    if (this.labelRenderer) {
      this.labelRenderer.domElement.remove();
    }
  }
}
