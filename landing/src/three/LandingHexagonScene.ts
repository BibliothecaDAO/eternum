import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { BiomeType } from "./components/Biome";
import InstancedBiome from "./components/InstancedBiome";
import { biomeModelPaths } from "./constants";
import { getWorldPositionForHex, gltfLoader } from "./helpers/utils";

export class HexagonScene {
  protected scene!: THREE.Scene;
  protected camera!: THREE.PerspectiveCamera;
  protected biomeModels: Map<BiomeType, InstancedBiome> = new Map();
  protected modelLoadPromises: Promise<void>[] = [];
  protected fog!: THREE.Fog;

  private mainDirectionalLight!: THREE.DirectionalLight;
  private hemisphereLight!: THREE.HemisphereLight;
  private groundMesh!: THREE.Mesh;

  constructor(protected controls: MapControls) {
    this.controls = controls;
    this.initializeScene();
    this.setupLighting();
    this.createGroundMesh();
  }

  private initializeScene(): void {
    this.scene = new THREE.Scene();
    this.camera = this.controls.object as THREE.PerspectiveCamera;
    this.scene.background = new THREE.Color(0x8790a1);
    this.fog = new THREE.Fog(0xffffff, 21, 30);
    this.scene.fog = this.fog;
  }

  private setupLighting(): void {
    this.hemisphereLight = new THREE.HemisphereLight(0xf3f3c8, 0xd0e7f0, 0.3);

    this.mainDirectionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
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

    this.scene.add(this.mainDirectionalLight);
    this.scene.add(this.mainDirectionalLight.target);
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
    mesh.position.set(0, -0.05, 0);
    mesh.receiveShadow = true;

    this.scene.add(mesh);
    this.groundMesh = mesh;
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

  public moveCameraToColRow(col: number, row: number, duration: number = 2) {
    const { x, y, z } = getWorldPositionForHex({ col, row });

    const newTarget = new THREE.Vector3(x, y, z);

    const target = this.controls.target;
    const pos = this.controls.object.position;

    const deltaX = newTarget.x - target.x;
    const deltaZ = newTarget.z - target.z;
    target.set(newTarget.x, newTarget.y, newTarget.z);
    pos.set(pos.x + deltaX, pos.y, pos.z + deltaZ);
    this.controls.update();
  }

  update(deltaTime: number): void {
    this.updateLights();
    this.biomeModels.forEach((biome) => {
      biome.updateAnimations(deltaTime);
    });
  }

  private updateLights(): void {
    if (this.mainDirectionalLight) {
      const { x, y, z } = this.controls.target;
      this.mainDirectionalLight.position.set(x - 15, y + 13, z + 8);
      this.mainDirectionalLight.target.position.set(x, y, z - 5.2);
      this.mainDirectionalLight.target.updateMatrixWorld();
    }
  }
}
