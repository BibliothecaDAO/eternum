import { type SetupResult } from "@/dojo/setup";
import useUIStore, { type AppStore } from "@/hooks/store/useUIStore";
import { type HexPosition, type SceneName } from "@/types";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { RightView } from "@/ui/modules/navigation/RightNavigationModule";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import gsap from "gsap";
import throttle from "lodash/throttle";
import * as THREE from "three";
import { type MapControls } from "three/examples/jsm/controls/MapControls";
import { env } from "../../../env";
import { type SceneManager } from "../SceneManager";
import { type BiomeType } from "../components/Biome";
import { HighlightHexManager } from "../components/HighlightHexManager";
import { InputManager } from "../components/InputManager";
import InstancedBiome from "../components/InstancedBiome";
import { InteractiveHexManager } from "../components/InteractiveHexManager";
import { GUIManager } from "../helpers/GUIManager";
import { LocationManager } from "../helpers/LocationManager";
import { gltfLoader } from "../helpers/utils";
import { SystemManager } from "../systems/SystemManager";
import { HEX_SIZE, biomeModelPaths } from "./constants";
export abstract class HexagonScene {
  protected scene!: THREE.Scene;
  protected camera!: THREE.PerspectiveCamera;
  protected inputManager!: InputManager;
  protected interactiveHexManager!: InteractiveHexManager;
  protected systemManager!: SystemManager;
  protected highlightHexManager!: HighlightHexManager;
  protected locationManager!: LocationManager;
  protected GUIFolder!: any;
  protected biomeModels = new Map<BiomeType, InstancedBiome>();
  protected modelLoadPromises: Array<Promise<void>> = [];
  protected state!: AppStore;
  protected fog!: THREE.Fog;

  private mainDirectionalLight!: THREE.DirectionalLight;
  private hemisphereLight!: THREE.HemisphereLight;
  private lightHelper!: THREE.DirectionalLightHelper;

  private groundMesh!: THREE.Mesh;

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
    this.scene.background = new THREE.Color(0x8790a1);
    this.state = useUIStore.getState();
    this.fog = new THREE.Fog(0xffffff, 21, 30);
    this.scene.fog = this.fog;

    // subscribe to state changes
    useUIStore.subscribe(
      (state) => ({
        leftNavigationView: state.leftNavigationView,
        rightNavigationView: state.rightNavigationView,
      }),
      ({ leftNavigationView, rightNavigationView }) => {
        this.state.leftNavigationView = leftNavigationView;
        this.state.rightNavigationView = rightNavigationView;
      },
    );
  }

  private setupLighting(): void {
    this.setupHemisphereLight();
    this.setupDirectionalLight();
    this.setupLightHelper();
  }

  private setupHemisphereLight(): void {
    this.hemisphereLight = new THREE.HemisphereLight(0xf3f3c8, 0xd0e7f0, 0.3);
    //this.scene.add(this.hemisphereLight);
  }

  private setupDirectionalLight(): void {
    this.mainDirectionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
    this.configureDirectionalLight();
    this.scene.add(this.mainDirectionalLight);
    this.scene.add(this.mainDirectionalLight.target);
  }

  private configureDirectionalLight(): void {
    this.mainDirectionalLight.castShadow = true;
    this.mainDirectionalLight.shadow.mapSize.width = 1024;
    this.mainDirectionalLight.shadow.mapSize.height = 1024;
    this.mainDirectionalLight.shadow.camera.left = -22;
    this.mainDirectionalLight.shadow.camera.right = 18;
    this.mainDirectionalLight.shadow.camera.top = 14;
    this.mainDirectionalLight.shadow.camera.bottom = -12;
    this.mainDirectionalLight.shadow.camera.far = 38;
    this.mainDirectionalLight.shadow.camera.near = 8;
    this.mainDirectionalLight.shadow.bias = -0.0015;
    this.mainDirectionalLight.position.set(0, 9, 0);
    this.mainDirectionalLight.target.position.set(0, 0, 5.2);
  }

  private setupLightHelper(): void {
    this.lightHelper = new THREE.DirectionalLightHelper(this.mainDirectionalLight, 1);
    if (env.VITE_PUBLIC_DEV == true) this.scene.add(this.lightHelper);
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
    this.setupShadowGUI();
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
    directionalLightFolder.add(this.scene, "environmentIntensity", 0, 2, 0.1);
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

    // go to new target but keep same view angle
    const deltaX = newTarget.x - target.x;
    const deltaZ = newTarget.z - target.z;
    if (duration) {
      this.cameraAnimate(new THREE.Vector3(pos.x + deltaX, pos.y, pos.z + deltaZ), newTarget, duration);
    } else {
      target.set(newTarget.x, newTarget.y, newTarget.z);
      pos.set(pos.x + deltaX, pos.y, pos.z + deltaZ);
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
    if (duration) {
      this.cameraAnimate(new THREE.Vector3(pos.x + deltaX, pos.y, pos.z + deltaZ), newTarget, duration);
    } else {
      target.set(newTarget.x, newTarget.y, newTarget.z);
      pos.set(pos.x + deltaX, pos.y, pos.z + deltaZ);
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
    const roughness = 0.1;

    const geometry = new THREE.PlaneGeometry(2668, 1390.35);
    const texture = new THREE.TextureLoader().load("/textures/paper/worldmap-bg.png", () => {
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
}
