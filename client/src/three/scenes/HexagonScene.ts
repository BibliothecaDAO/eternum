import { SetupResult } from "@/dojo/setup";
import gsap from "gsap";
import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { HighlightHexManager } from "../components/HighlightHexManager";
import { InputManager } from "../components/InputManager";
import { InteractiveHexManager } from "../components/InteractiveHexManager";
import { GUIManager } from "../helpers/GUIManager";
import { LocationManager } from "../helpers/LocationManager";
import { SceneManager } from "../SceneManager";

import useUIStore, { AppStore } from "@/hooks/store/useUIStore";
import { HexPosition, SceneName } from "@/types";
import _, { throttle } from "lodash";
import { DRACOLoader, GLTFLoader } from "three-stdlib";
import { BiomeType } from "../components/Biome";
import InstancedModel from "../components/InstancedModel";
import { SystemManager } from "../systems/SystemManager";
import { biomeModelPaths, HEX_HORIZONTAL_SPACING, HEX_SIZE, HEX_VERTICAL_SPACING } from "./constants";
import { getWorldPositionForHex } from "@/ui/utils/utils";

export abstract class HexagonScene {
  protected scene: THREE.Scene;
  protected camera: THREE.PerspectiveCamera;
  protected dojo: SetupResult;
  protected inputManager: InputManager;
  protected interactiveHexManager: InteractiveHexManager;
  protected systemManager: SystemManager;
  protected highlightHexManager: HighlightHexManager;
  protected locationManager!: LocationManager;
  private mainDirectionalLight!: THREE.DirectionalLight;
  private hemisphereLight!: THREE.HemisphereLight;
  private lightHelper!: THREE.DirectionalLightHelper;
  protected GUIFolder: any;
  protected biomeModels: Map<BiomeType, InstancedModel> = new Map();
  protected modelLoadPromises: Promise<void>[] = [];
  protected state: AppStore;
  private hexagonEdges: THREE.Group;

  constructor(
    protected sceneName: SceneName,
    protected controls: MapControls,
    private dojoContext: SetupResult,
    private mouse: THREE.Vector2,
    private raycaster: THREE.Raycaster,
    protected sceneManager: SceneManager,
  ) {
    this.GUIFolder = GUIManager.addFolder(sceneName);
    this.scene = new THREE.Scene();
    this.camera = controls.object as THREE.PerspectiveCamera;
    this.dojo = dojoContext;
    this.locationManager = new LocationManager();
    this.inputManager = new InputManager(this.sceneName, this.sceneManager, this.raycaster, this.mouse, this.camera);
    this.interactiveHexManager = new InteractiveHexManager(this.scene);
    this.systemManager = new SystemManager(this.dojo);
    this.highlightHexManager = new HighlightHexManager(this.scene);
    this.scene.background = new THREE.Color(0x8790a1);
    this.GUIFolder.addColor(this.scene, "background");
    this.GUIFolder.close();

    this.hemisphereLight = new THREE.HemisphereLight(0xf3f3c8, 0xd0e7f0, 2);
    const hemisphereLightFolder = this.GUIFolder.addFolder("Hemisphere Light");
    hemisphereLightFolder.addColor(this.hemisphereLight, "color");
    hemisphereLightFolder.addColor(this.hemisphereLight, "groundColor");
    hemisphereLightFolder.add(this.hemisphereLight, "intensity", 0, 3, 0.1);
    hemisphereLightFolder.close();
    this.scene.add(this.hemisphereLight);

    this.mainDirectionalLight = new THREE.DirectionalLight(0xffffff, 3);
    this.mainDirectionalLight.castShadow = true;
    this.mainDirectionalLight.shadow.mapSize.width = 2048;
    this.mainDirectionalLight.shadow.mapSize.height = 2048;
    this.mainDirectionalLight.shadow.camera.left = -22;
    this.mainDirectionalLight.shadow.camera.right = 18;
    this.mainDirectionalLight.shadow.camera.top = 14;
    this.mainDirectionalLight.shadow.camera.bottom = -12;
    this.mainDirectionalLight.shadow.camera.far = 38;
    this.mainDirectionalLight.shadow.camera.near = 8;
    this.mainDirectionalLight.position.set(0, 9, 0);
    this.mainDirectionalLight.target.position.set(0, 0, 5.2);

    const shadowFolder = this.GUIFolder.addFolder("Shadow");
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "left", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "right", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "top", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "bottom", -50, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "far", 0, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow.camera, "near", 0, 50, 0.1);
    shadowFolder.add(this.mainDirectionalLight.shadow, "bias", -0.001, 0.001, 0.0001);
    shadowFolder.close();

    const directionalLightFolder = this.GUIFolder.addFolder("Directional Light");
    directionalLightFolder.addColor(this.mainDirectionalLight, "color");
    directionalLightFolder.add(this.mainDirectionalLight.position, "x", -20, 20, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.position, "y", -20, 20, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.position, "z", -20, 20, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight, "intensity", 0, 3, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.target.position, "x", 0, 10, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.target.position, "y", 0, 10, 0.1);
    directionalLightFolder.add(this.mainDirectionalLight.target.position, "z", 0, 10, 0.1);
    directionalLightFolder.close();
    this.scene.add(this.mainDirectionalLight);
    this.scene.add(this.mainDirectionalLight.target);

    this.lightHelper = new THREE.DirectionalLightHelper(this.mainDirectionalLight, 1);
    this.scene.add(this.lightHelper);

    this.inputManager.addListener(
      "mousemove",
      throttle((raycaster) => {
        const hoveredHex = this.interactiveHexManager.onMouseMove(raycaster);
        hoveredHex && this.onHexagonMouseMove(hoveredHex);
      }, 50),
    );
    this.inputManager.addListener("dblclick", (raycaster) => {
      const clickedHex = this.interactiveHexManager.onClick(raycaster);
      clickedHex && this.onHexagonDoubleClick(clickedHex.hexCoords);
    });
    this.inputManager.addListener("click", (raycaster) => {
      const clickedHex = this.interactiveHexManager.onClick(raycaster);
      clickedHex && this.onHexagonClick(clickedHex.hexCoords);
    });
    this.inputManager.addListener("contextmenu", (raycaster) => {
      const clickedHex = this.interactiveHexManager.onClick(raycaster);
      clickedHex && this.onHexagonRightClick(clickedHex.hexCoords);
    });

    this.state = useUIStore.getState();
    this.hexagonEdges = new THREE.Group();
    this.scene.add(this.hexagonEdges);
    this.createGroundMesh();
  }

  protected abstract onHexagonMouseMove({
    hexCoords,
    position,
  }: {
    hexCoords: HexPosition;
    position: THREE.Vector3;
  }): void;
  protected abstract onHexagonDoubleClick(hexCoords: HexPosition): void;
  protected abstract onHexagonClick(hexCoords: HexPosition): void;
  protected abstract onHexagonRightClick(hexCoords: HexPosition): void;

  protected addHexagonEdge(edge: THREE.LineSegments) {
    this.hexagonEdges.add(edge);
  }

  protected setHexagonEdges(edges: THREE.Group) {
    this.scene.remove(this.hexagonEdges);
    this.hexagonEdges = edges;
    this.scene.add(this.hexagonEdges);
  }

  protected getHexagonEdges() {
    return this.hexagonEdges;
  }

  public abstract setup(): void;

  public getScene() {
    return this.scene;
  }

  public getCamera() {
    return this.camera;
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

    return { row, col, x: position.x, z: position.z };
  }

  public abstract moveCameraToURLLocation(): void;

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

  private updateLights = _.throttle(() => {
    if (this.mainDirectionalLight) {
      this.mainDirectionalLight.position.set(
        this.controls.target.x + 15,
        this.controls.target.y + 13,
        this.controls.target.z - 8,
      );
      this.mainDirectionalLight.target.position.set(
        this.controls.target.x,
        this.controls.target.y,
        this.controls.target.z + 5.2,
      );
      this.mainDirectionalLight.target.updateMatrixWorld();
    }
  }, 30);

  loadBiomeModels(maxInstances: number) {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/");
    dracoLoader.preload();
    loader.setDRACOLoader(dracoLoader);

    for (const [biome, path] of Object.entries(biomeModelPaths)) {
      const loadPromise = new Promise<void>((resolve, reject) => {
        loader.load(
          path,
          (gltf) => {
            const model = gltf.scene as THREE.Group;

            const tmp = new InstancedModel(model, maxInstances);
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
    const metalness = 0.5;
    const roughness = 0.7;

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
    mesh.rotation.set(Math.PI / 2, 0, 0);
    const { x, z } = getWorldPositionForHex({ col: 185, row: 150 });
    mesh.position.set(x, -0.05, z);
    mesh.receiveShadow = true;
    // disable raycast
    mesh.raycast = () => {};

    this.scene.add(mesh);
  }

  update(deltaTime: number) {
    this.interactiveHexManager.update();

    if (this.mainDirectionalLight) {
      this.mainDirectionalLight.shadow.camera.updateProjectionMatrix();
    }
    if (this.lightHelper) this.lightHelper.update();

    // Update highlight pulse
    const elapsedTime = performance.now() / 1000; // Convert to seconds
    const pulseFactor = Math.abs(Math.sin(elapsedTime * 2) / 16);
    this.highlightHexManager.updateHighlightPulse(pulseFactor);
    this.updateLights();
  }
}
