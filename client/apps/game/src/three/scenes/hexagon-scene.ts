import { useUIStore, type AppStore } from "@/hooks/store/use-ui-store";
import { HEX_SIZE, biomeModelPaths } from "@/three/constants";
import { HighlightHexManager } from "@/three/managers/highlight-hex-manager";
import { InputManager } from "@/three/managers/input-manager";
import InstancedBiome from "@/three/managers/instanced-biome";
import { InteractiveHexManager } from "@/three/managers/interactive-hex-manager";
import { type SceneManager } from "@/three/scene-manager";
import { SystemManager } from "@/three/systems/system-manager";
import { GUIManager, LocationManager, transitionDB } from "@/three/utils/";
import { gltfLoader } from "@/three/utils/utils";
import { LeftView, RightView } from "@/types";
import { GRAPHICS_SETTING, GraphicsSettings, IS_FLAT_MODE } from "@/ui/config";
import { type SetupResult } from "@bibliothecadao/dojo";
import { BiomeType, type HexPosition } from "@bibliothecadao/types";
import gsap from "gsap";
import throttle from "lodash/throttle";
import * as THREE from "three";
import { type MapControls } from "three/examples/jsm/controls/MapControls.js";
import { env } from "../../../env";
import { SceneName } from "../types";
import { getWorldPositionForHex } from "../utils";
import { SceneShortcutManager } from "../utils/shortcuts";

export enum CameraView {
  Close = 1,
  Medium = 2,
  Far = 3,
}

export abstract class HexagonScene {
  protected scene!: THREE.Scene;
  protected camera!: THREE.PerspectiveCamera;
  protected inputManager!: InputManager;
  protected shortcutManager!: SceneShortcutManager;
  protected interactiveHexManager!: InteractiveHexManager;
  protected systemManager!: SystemManager;
  protected highlightHexManager!: HighlightHexManager;
  protected locationManager!: LocationManager;
  protected GUIFolder!: any;
  protected biomeModels = new Map<BiomeType, InstancedBiome>();
  protected modelLoadPromises: Array<Promise<void>> = [];
  protected state!: AppStore;
  protected fog!: THREE.Fog;

  protected mainDirectionalLight!: THREE.DirectionalLight;
  protected hemisphereLight!: THREE.HemisphereLight;
  protected lightHelper!: THREE.DirectionalLightHelper;
  protected stormLight!: THREE.PointLight;
  protected ambientPurpleLight!: THREE.AmbientLight;

  private groundMesh!: THREE.Mesh;
  private lightningEndTime: number = 0;
  private originalLightningIntensity: number = 0;
  private originalLightningColor: number = 0;
  private originalStormLightningIntensity: number = 0;
  private cameraViewListeners: Set<(view: CameraView) => void> = new Set();
  private lastLightningTriggerProgress: number = -1;
  private lightningSequenceTimeout: NodeJS.Timeout | null = null;
  private currentStrikeIndex: number = 0;
  private lightningStrikes: Array<{ delay: number; duration: number }> = [
    { delay: 0, duration: 80 },
    { delay: 200, duration: 60 },
    { delay: 450, duration: 100 },
    { delay: 700, duration: 40 },
  ];

  protected cameraDistance = 10; // Maintain the same distance
  protected cameraAngle = Math.PI / 3;
  protected currentCameraView = CameraView.Medium; // Track current camera view position

  constructor(
    protected sceneName: SceneName,
    protected controls: MapControls,
    protected dojo: SetupResult,
    private mouse: THREE.Vector2,
    private raycaster: THREE.Raycaster,
    protected sceneManager: SceneManager,
  ) {
    this.initializeScene();
    this.setupLighting();
    this.setupInputHandlers();
    this.setupGUI();
    this.createGroundMesh();
  }

  private initializeScene(): void {
    this.scene = new THREE.Scene();
    this.camera = this.controls.object as THREE.PerspectiveCamera;
    this.locationManager = new LocationManager();
    this.inputManager = new InputManager(this.sceneName, this.sceneManager, this.raycaster, this.mouse, this.camera);
    this.interactiveHexManager = new InteractiveHexManager(this.scene);
    this.systemManager = new SystemManager(this.dojo);
    this.highlightHexManager = new HighlightHexManager(this.scene);
    this.scene.background = new THREE.Color(0x2a1a3e);
    this.state = useUIStore.getState();
    this.fog = new THREE.Fog(0x2d1b4e, 15, 35);
    if (!IS_FLAT_MODE && GRAPHICS_SETTING === GraphicsSettings.HIGH) {
      // this.scene.fog = this.fog; // Disabled due to zoom level issues
    }

    // subscribe to state changes
    useUIStore.subscribe(
      (state) => ({
        leftNavigationView: state.leftNavigationView,
        rightNavigationView: state.rightNavigationView,
        structureEntityId: state.structureEntityId,
        cycleProgress: state.cycleProgress,
        cycleTime: state.cycleTime,
      }),
      ({ leftNavigationView, rightNavigationView, structureEntityId, cycleProgress, cycleTime }) => {
        this.state.leftNavigationView = leftNavigationView;
        this.state.rightNavigationView = rightNavigationView;
        this.state.structureEntityId = structureEntityId;
        this.state.cycleProgress = cycleProgress;
        this.state.cycleTime = cycleTime;
      },
    );
  }

  private setupLighting(): void {
    this.setupHemisphereLight();
    this.setupDirectionalLight();
    this.setupStormLighting();
    this.setupLightHelper();
  }

  private setupHemisphereLight(): void {
    this.hemisphereLight = new THREE.HemisphereLight(0x6a3a6a, 0xffffff, 1.2);
    this.scene.add(this.hemisphereLight);
  }

  private setupDirectionalLight(): void {
    this.mainDirectionalLight = new THREE.DirectionalLight(0x9966ff, 2.0);
    this.configureDirectionalLight();
    this.scene.add(this.mainDirectionalLight);
    this.scene.add(this.mainDirectionalLight.target);
  }

  private configureDirectionalLight(): void {
    this.mainDirectionalLight.castShadow = true;
    this.mainDirectionalLight.shadow.mapSize.width = 2048;
    this.mainDirectionalLight.shadow.mapSize.height = 2048;
    this.mainDirectionalLight.shadow.camera.left = -22;
    this.mainDirectionalLight.shadow.camera.right = 18;
    this.mainDirectionalLight.shadow.camera.top = 14;
    this.mainDirectionalLight.shadow.camera.bottom = -12;
    this.mainDirectionalLight.shadow.camera.far = 38;
    this.mainDirectionalLight.shadow.camera.near = 8;
    this.mainDirectionalLight.shadow.bias = -0.0285;
    this.mainDirectionalLight.position.set(0, 9, 0);
    this.mainDirectionalLight.target.position.set(0, 0, 5.2);
  }

  private setupStormLighting(): void {
    this.ambientPurpleLight = new THREE.AmbientLight(0x3a1a3a, 0.1);
    this.scene.add(this.ambientPurpleLight);

    this.stormLight = new THREE.PointLight(0xaa77ff, 1.5, 80);
    this.stormLight.position.set(0, 20, 0);
    this.scene.add(this.stormLight);
  }

  private setupLightHelper(): void {
    this.lightHelper = new THREE.DirectionalLightHelper(this.mainDirectionalLight, 1);
    if (env.VITE_PUBLIC_GRAPHICS_DEV == true) this.scene.add(this.lightHelper);
  }

  private setupInputHandlers(): void {
    this.inputManager.addListener("mousemove", throttle(this.handleMouseMove.bind(this), 50));
    this.inputManager.addListener("dblclick", this.handleDoubleClick.bind(this));
    this.inputManager.addListener("click", this.handleClick.bind(this));
    this.inputManager.addListener("contextmenu", this.handleRightClick.bind(this));
  }

  private handleMouseMove(raycaster: THREE.Raycaster): void {
    const hoveredHex = this.interactiveHexManager.onMouseMove(raycaster);
    hoveredHex ? this.onHexagonMouseMove(hoveredHex) : this.onHexagonMouseMove(null);
  }

  private handleDoubleClick(raycaster: THREE.Raycaster): void {
    const clickedHex = this.interactiveHexManager.onClick(raycaster);
    clickedHex && this.onHexagonDoubleClick(clickedHex.hexCoords);
  }

  private handleClick(raycaster: THREE.Raycaster): void {
    const clickedHex = this.interactiveHexManager.onClick(raycaster);
    clickedHex ? this.onHexagonClick(clickedHex.hexCoords) : this.onHexagonClick(null);
  }

  private handleRightClick(raycaster: THREE.Raycaster): void {
    const clickedHex = this.interactiveHexManager.onClick(raycaster);
    clickedHex && this.onHexagonRightClick(clickedHex.hexCoords);
  }

  private setupGUI(): void {
    this.GUIFolder = GUIManager.addFolder(this.sceneName);
    this.setupSceneGUI();
    this.setupHemisphereLightGUI();
    this.setupDirectionalLightGUI();
    this.setupAmbientLightGUI();
    this.setupStormLightGUI();
    this.setupShadowGUI();
    this.setupFogGUI();
  }

  private setupSceneGUI(): void {
    this.GUIFolder.addColor(this.scene, "background");
    this.GUIFolder.close();
  }

  private setupHemisphereLightGUI(): void {
    const hemisphereLightFolder = this.GUIFolder.addFolder("Hemisphere Light");
    hemisphereLightFolder.addColor(this.hemisphereLight, "color");
    hemisphereLightFolder.addColor(this.hemisphereLight, "groundColor");
    hemisphereLightFolder.add(this.hemisphereLight, "intensity", 0, 3, 0.1);
    hemisphereLightFolder.close();
  }

  private setupDirectionalLightGUI(): void {
    const directionalLightFolder = this.GUIFolder.addFolder("Directional Light");
    directionalLightFolder.addColor(this.mainDirectionalLight, "color");
    directionalLightFolder.add(this.mainDirectionalLight.position, "x", -20, 20, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.position, "y", -20, 20, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.position, "z", -20, 20, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight, "intensity", 0, 3, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.target.position, "x", 0, 10, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.target.position, "y", 0, 10, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.target.position, "z", 0, 10, 0.1);
    directionalLightFolder.add(this.scene, "environmentIntensity", 0, 2, 0.01);
    directionalLightFolder.close();
  }

  private setupShadowGUI(): void {
    const shadowFolder = this.GUIFolder.addFolder("Shadow");
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "left", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "right", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "top", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "bottom", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "far", 0, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "near", 0, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow, "bias", -0.1, 0.1, 0.0015);
    shadowFolder.close();
  }

  private setupAmbientLightGUI(): void {
    const ambientLightFolder = this.GUIFolder.addFolder("Ambient Light");
    ambientLightFolder.addColor(this.ambientPurpleLight, "color");
    ambientLightFolder.add(this.ambientPurpleLight, "intensity", 0, 1, 0.01);
    ambientLightFolder.close();
  }

  private setupStormLightGUI(): void {
    const stormLightFolder = this.GUIFolder.addFolder("Storm Light");
    stormLightFolder.addColor(this.stormLight, "color");
    stormLightFolder.add(this.stormLight, "intensity", 0, 5, 0.1);
    stormLightFolder.add(this.stormLight, "distance", 0, 200, 1);
    stormLightFolder.add(this.stormLight.position, "x", -50, 50, 1);
    stormLightFolder.add(this.stormLight.position, "y", 0, 50, 1);
    stormLightFolder.add(this.stormLight.position, "z", -50, 50, 1);
    stormLightFolder.close();
  }

  private setupFogGUI(): void {
    const fogFolder = this.GUIFolder.addFolder("Fog");
    fogFolder.addColor(this.fog, "color").name("Color");
    fogFolder.add(this.fog, "near", 0, 100, 0.1).name("Near");
    fogFolder.add(this.fog, "far", 0, 100, 0.1).name("Far");

    // Add toggle for fog
    const fogParams = { enabled: !IS_FLAT_MODE && GRAPHICS_SETTING === GraphicsSettings.HIGH };
    fogFolder
      .add(fogParams, "enabled")
      .name("Enable Fog")
      .onChange((value: boolean) => {
        this.scene.fog = value ? this.fog : null;
      });

    fogFolder.close();
  }

  private setupGroundMeshGUI(): void {
    const groundMeshFolder = this.GUIFolder.addFolder("Ground Mesh");
    groundMeshFolder.add(this.groundMesh.material, "metalness", 0, 1, 0.01).name("Metalness");
    groundMeshFolder.add(this.groundMesh.material, "roughness", 0, 1, 0.01).name("Roughness");
    groundMeshFolder.close();
  }

  public getScene() {
    return this.scene;
  }

  public getCamera() {
    return this.camera;
  }

  public setEnvironment(texture: THREE.Texture, intensity: number = 1) {
    this.scene.environment = texture;
    this.scene.environmentIntensity = intensity;
  }

  public closeNavigationViews() {
    this.state.setLeftNavigationView(LeftView.None);
    this.state.setRightNavigationView(RightView.None);
  }

  public isNavigationViewOpen() {
    return this.state.leftNavigationView !== LeftView.None || this.state.rightNavigationView !== RightView.None;
  }

  protected hashCoordinates(x: number, y: number): number {
    // Simple hash function to generate a deterministic value between 0 and 1
    const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return hash - Math.floor(hash);
  }

  private getHexFromWorldPosition(position: THREE.Vector3): HexPosition {
    const horizontalSpacing = HEX_SIZE * Math.sqrt(3);
    const verticalSpacing = (HEX_SIZE * 3) / 2;

    // Calculate col first
    const col = Math.round(position.x / horizontalSpacing);

    // Then use col to calculate row
    const row = Math.round(-position.z / verticalSpacing);

    // Adjust x position based on row parity
    const adjustedX = position.x - (row % 2) * (horizontalSpacing / 2);

    // Recalculate col using adjusted x
    const adjustedCol = Math.round(adjustedX / horizontalSpacing);

    return { row, col: adjustedCol };
  }

  getHexagonCoordinates(
    instancedMesh: THREE.InstancedMesh,
    instanceId: number,
  ): HexPosition & { x: number; z: number } {
    const matrix = new THREE.Matrix4();
    instancedMesh.getMatrixAt(instanceId, matrix);
    const position = new THREE.Vector3();
    matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());

    const { row, col } = this.getHexFromWorldPosition(position);

    console.log("row", row, col);

    return { row, col, x: position.x, z: position.z };
  }

  getLocationCoordinates() {
    const col = this.locationManager.getCol()!;
    const row = this.locationManager.getRow()!;
    const { x, z } = getWorldPositionForHex({ col, row });
    return { col, row, x, z };
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

  public moveCameraToXYZ(x: number, y: number, z: number, duration: number = 2) {
    const newTarget = new THREE.Vector3(x, y, z);
    const target = this.controls.target;
    const pos = this.controls.object.position;
    const deltaX = newTarget.x - target.x;
    const deltaZ = newTarget.z - target.z;

    const newPosition = IS_FLAT_MODE
      ? new THREE.Vector3(newTarget.x, pos.y, newTarget.z)
      : new THREE.Vector3(pos.x + deltaX, pos.y, pos.z + deltaZ);

    if (duration) {
      this.cameraAnimate(newPosition, newTarget, duration);
    } else {
      target.copy(newTarget);
      pos.copy(newPosition);
    }

    this.controls.update();
  }

  public moveCameraToColRow(col: number, row: number, duration: number = 2) {
    const { x, y, z } = getWorldPositionForHex({ col, row });

    const newTarget = new THREE.Vector3(x, y, z);

    const target = this.controls.target;
    const pos = this.controls.object.position;

    // go to new target with but keep same view angle
    const deltaX = newTarget.x - target.x;
    const deltaZ = newTarget.z - target.z;

    const newPosition = IS_FLAT_MODE
      ? new THREE.Vector3(newTarget.x, pos.y, newTarget.z)
      : new THREE.Vector3(pos.x + deltaX, pos.y, pos.z + deltaZ);

    if (duration) {
      this.cameraAnimate(newPosition, newTarget, duration);
    } else {
      target.copy(newTarget);
      pos.copy(newPosition);
    }
    this.controls.update();
  }

  loadBiomeModels(maxInstances: number) {
    const loader = gltfLoader;

    for (const [biome, path] of Object.entries(biomeModelPaths)) {
      const loadPromise = new Promise<void>((resolve, reject) => {
        loader.load(
          path,
          (gltf) => {
            const model = gltf.scene as THREE.Group;
            if (biome === "Outline") {
              ((model.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).transparent = true;
              ((model.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.3;
            }
            const tmp = new InstancedBiome(gltf, maxInstances, false, biome);
            this.biomeModels.set(biome as BiomeType, tmp);
            this.scene.add(tmp.group);
            resolve();
          },
          undefined,
          (error) => {
            console.error(`Error loading ${biome} model:`, error);
            reject(error);
          },
        );
      });
      this.modelLoadPromises.push(loadPromise);
    }
  }

  private createGroundMesh() {
    const scale = 60;
    const metalness = 0;
    const roughness = 0.66;

    const geometry = new THREE.PlaneGeometry(2668, 1390.35);
    const texture = new THREE.TextureLoader().load("/textures/paper/worldmap-bg-blitz.png", () => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(scale, scale / 2.5);
    });

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: metalness,
      roughness: roughness,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.set(Math.PI / 2, 0, Math.PI);
    const { x, z } = getWorldPositionForHex({ col: 185, row: 150 });
    mesh.position.set(x, -0.05, z);
    mesh.receiveShadow = true;
    // disable raycast
    mesh.raycast = () => {};

    this.scene.add(mesh);
    this.groundMesh = mesh;
    this.setupGroundMeshGUI();
  }

  update(deltaTime: number): void {
    this.interactiveHexManager.update();
    this.updateLights();
    this.updateHighlightPulse();
    if (this.shouldEnableStormEffects()) {
      this.updateStormEffects();
    }
    this.biomeModels.forEach((biome) => {
      try {
        biome.updateAnimations(deltaTime);
      } catch (error) {
        console.error(`Error updating biome animations:`, error);
      }
    });
  }

  private updateLights = throttle(() => {
    if (this.mainDirectionalLight) {
      const { x, y, z } = this.controls.target;
      this.mainDirectionalLight.position.set(x - 15, y + 13, z + 8);
      this.mainDirectionalLight.target.position.set(x, y, z - 5.2);
      this.mainDirectionalLight.target.updateMatrixWorld();
    }
    if (this.lightHelper) this.lightHelper.update();
  }, 30);

  private updateHighlightPulse(): void {
    const elapsedTime = performance.now() / 1000;
    const pulseFactor = Math.abs(Math.sin(elapsedTime * 2) / 16);
    this.highlightHexManager.updateHighlightPulse(pulseFactor);
  }

  private updateStormEffects(): void {
    const currentTime = performance.now();
    const elapsedTime = currentTime / 1000;

    // Check if lightning should end
    if (this.lightningEndTime > 0 && currentTime >= this.lightningEndTime) {
      this.endLightning();
    }

    // Check for lightning trigger based on cycle timing instead of random
    const cycleProgress = this.state.cycleProgress || 0;
    this.shouldTriggerLightningAtCycleProgress(cycleProgress);

    // Only update normal storm effects if lightning is not active
    if (this.lightningEndTime === 0) {
      const stormIntensity = 1.2 + Math.sin(elapsedTime * 0.3) * 0.4;
      this.stormLight.intensity = stormIntensity;
    }

    const purpleFlicker = 0.08 + Math.sin(elapsedTime * 2) * 0.03;
    this.ambientPurpleLight.intensity = purpleFlicker;

    const hemisphereFlicker = 1.2 + Math.sin(elapsedTime * 1.5) * 0.05;
    this.hemisphereLight.intensity = hemisphereFlicker;
  }

  private startLightningSequence(): void {
    // Clear any existing sequence
    if (this.lightningSequenceTimeout) {
      clearTimeout(this.lightningSequenceTimeout);
    }

    this.currentStrikeIndex = 0;
    this.executeNextStrike();
  }

  private executeNextStrike(): void {
    if (this.currentStrikeIndex >= this.lightningStrikes.length) {
      // Sequence complete
      this.currentStrikeIndex = 0;
      return;
    }

    const strike = this.lightningStrikes[this.currentStrikeIndex];

    // Schedule this strike
    this.lightningSequenceTimeout = setTimeout(() => {
      this.triggerSingleLightningStrike(strike.duration);
      this.currentStrikeIndex++;
      this.executeNextStrike(); // Schedule next strike
    }, strike.delay);
  }

  private triggerSingleLightningStrike(duration: number): void {
    // Store original values only once
    if (this.lightningEndTime === 0) {
      this.originalLightningIntensity = this.mainDirectionalLight.intensity;
      this.originalLightningColor = this.mainDirectionalLight.color.getHex();
      this.originalStormLightningIntensity = this.stormLight.intensity;
    }

    // Apply lightning effect
    this.mainDirectionalLight.intensity = 3.5;
    this.mainDirectionalLight.color.setHex(0xe6ccff);
    this.stormLight.intensity = 4;

    // Set end time for this strike
    this.lightningEndTime = performance.now() + duration;
  }

  private endLightning(): void {
    // Restore original values
    this.mainDirectionalLight.intensity = this.originalLightningIntensity;
    this.mainDirectionalLight.color.setHex(this.originalLightningColor);
    this.stormLight.intensity = this.originalStormLightningIntensity;

    // Reset lightning state
    this.lightningEndTime = 0;
  }

  private shouldTriggerLightningAtCycleProgress(cycleProgress: number): boolean {
    // Trigger lightning only at the start of each cycle (when progress is near 0)
    const tolerance = 2; // 2% tolerance around cycle start

    // Check if we're at the start of a cycle and haven't already triggered for this cycle
    if (cycleProgress < tolerance && this.lastLightningTriggerProgress !== 0) {
      this.lastLightningTriggerProgress = 0;
      // Add 0.5 second delay before starting lightning sequence
      setTimeout(() => {
        this.startLightningSequence();
      }, 500);
      return false; // Don't trigger immediately
    }

    // Reset the trigger flag when we're well into the cycle
    if (cycleProgress > tolerance * 2) {
      this.lastLightningTriggerProgress = -1;
    }

    return false;
  }

  protected shouldEnableStormEffects(): boolean {
    // Override this method in child classes to control storm effects
    return true;
  }

  // Cleanup method for lightning sequence
  protected cleanupLightning(): void {
    if (this.lightningSequenceTimeout) {
      clearTimeout(this.lightningSequenceTimeout);
      this.lightningSequenceTimeout = null;
    }
    // Reset lightning state
    if (this.lightningEndTime > 0) {
      this.endLightning();
    }
  }

  // Abstract methods
  protected abstract onHexagonMouseMove(
    hex: {
      hexCoords: HexPosition;
      position: THREE.Vector3;
    } | null,
  ): void;
  protected abstract onHexagonDoubleClick(hexCoords: HexPosition): void;
  protected abstract onHexagonClick(hexCoords: HexPosition | null): void;
  protected abstract onHexagonRightClick(hexCoords: HexPosition): void;
  public abstract setup(): void;
  public abstract moveCameraToURLLocation(): void;
  public abstract onSwitchOff(): void;

  public getCurrentCameraView(): CameraView {
    return this.currentCameraView;
  }

  // Method to expand labels temporarily during scroll in Medium view
  public expandLabelsTemporarily(): void {
    // Only expand labels if we're in Medium view
    if (this.currentCameraView === CameraView.Medium) {
      // Generate a global transition ID for the scene
      const sceneTransitionId = `scene_${this.sceneName}_medium_transition`;

      // Store current timestamp for Medium view transition
      transitionDB.setMediumViewTransition(sceneTransitionId, "scene", this.sceneName);

      // Notify all listeners to expand the labels
      this.cameraViewListeners.forEach((listener) => {
        // Call with Close view first to force expansion, then back to Medium
        // to start the collapsing timeout
        listener(CameraView.Close);
        listener(CameraView.Medium);
      });

      // Schedule a cleanup for this global scene transition
      transitionDB.scheduleTimeout(
        sceneTransitionId,
        () => {
          // Do nothing in the timeout, just let it expire naturally
        },
        2000,
      );
    }
  }

  public addCameraViewListener(listener: (view: CameraView) => void) {
    this.cameraViewListeners.add(listener);
    // Immediately notify the listener of the current view
    listener(this.currentCameraView);
  }

  public removeCameraViewListener(listener: (view: CameraView) => void) {
    this.cameraViewListeners.delete(listener);
  }

  public changeCameraView(position: CameraView) {
    const target = this.controls.target;
    this.currentCameraView = position;

    switch (position) {
      case CameraView.Close: // Close view
        this.mainDirectionalLight.castShadow = true;
        this.cameraDistance = 10;
        this.cameraAngle = Math.PI / 6; // 30 degrees
        break;
      case CameraView.Medium: // Medium view
        this.mainDirectionalLight.castShadow = true;
        this.cameraDistance = 20;
        this.cameraAngle = Math.PI / 3; // 60 degrees
        break;
      case CameraView.Far: // Far view
        this.mainDirectionalLight.castShadow = false;
        this.cameraDistance = 40;
        this.cameraAngle = (50 * Math.PI) / 180; // 50 degrees
        break;
    }

    const cameraHeight = Math.sin(this.cameraAngle) * this.cameraDistance;
    const cameraDepth = Math.cos(this.cameraAngle) * this.cameraDistance;

    const newPosition = new THREE.Vector3(target.x, target.y + cameraHeight, target.z + cameraDepth);
    this.cameraAnimate(newPosition, target, 1);

    // Notify all listeners of the camera view change
    this.cameraViewListeners.forEach((listener) => listener(position));
  }
}
