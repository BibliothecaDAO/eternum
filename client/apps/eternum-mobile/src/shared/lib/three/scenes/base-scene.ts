import { sqlApi } from "@/app/services/api";
import useStore from "@/shared/store";
import { WorldUpdateListener } from "@bibliothecadao/eternum";
import { DojoResult } from "@bibliothecadao/react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GUIManager } from "../helpers/gui-manager";
import { FXManager } from "./fx-manager";
import { TileRenderer } from "./tile-renderer";
import { getWorldPositionForHex } from "./utils";

export abstract class BaseScene {
  protected scene: THREE.Scene;
  protected dojo: DojoResult;
  protected systemManager: WorldUpdateListener;
  protected tileRenderer: TileRenderer;
  protected fxManager: FXManager;
  protected raycaster: THREE.Raycaster;
  protected controls?: OrbitControls;
  protected GUIFolder: any;
  protected sceneId: string;

  // Lighting components
  protected ambientLight!: THREE.AmbientLight;
  protected directionalLight!: THREE.DirectionalLight;
  protected lightHelper?: THREE.DirectionalLightHelper;

  // Ground mesh background
  protected groundMesh?: THREE.Mesh;

  // Reusable objects to avoid creation in loops
  protected tempVector3 = new THREE.Vector3();
  protected tempColor = new THREE.Color();
  protected tempQuaternion = new THREE.Quaternion();
  protected tempMatrix = new THREE.Matrix4();

  constructor(dojo: DojoResult, sceneId?: string, controls?: OrbitControls) {
    this.dojo = dojo;
    this.controls = controls;
    this.sceneId = sceneId || "BaseScene";
    this.scene = new THREE.Scene();
    this.systemManager = new WorldUpdateListener(this.dojo.setup, sqlApi);
    this.tileRenderer = new TileRenderer(this.scene);
    this.fxManager = new FXManager(this.scene);
    this.raycaster = new THREE.Raycaster();

    this.initializeScene();
    this.setupLighting();
    this.createGroundMesh();
    this.setupGUI(this.sceneId);
    useStore.subscribe(
      (state) => ({
        account: state.account,
      }),
      (account) => {
        // this.systemManager.setLoggedInAccount(BigInt(account?.account?.address || "0"));
      },
    );
  }

  protected initializeScene(): void {
    this.scene.background = new THREE.Color(0x8790a1);
  }

  protected setupLighting(): void {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(10, 10, 5);
    this.directionalLight.castShadow = true;
    this.scene.add(this.directionalLight);
  }

  protected createGroundMesh(): void {
    const scale = 60;
    const metalness = 0;
    const roughness = 0.66;

    const geometry = new THREE.PlaneGeometry(2668, 1390.35);
    const texture = new THREE.TextureLoader().load("/images/worldmap-bg.png", () => {
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
    mesh.raycast = () => {};

    this.scene.add(mesh);
    this.groundMesh = mesh;
  }

  protected setupGUI(sceneId?: string): void {
    const folderName = sceneId || "BaseScene";

    // Check if folder already exists and remove it to prevent duplicates
    const existingFolder = GUIManager.folders.find((folder: any) => folder._title === folderName);
    if (existingFolder) {
      existingFolder.destroy();
    }

    this.GUIFolder = GUIManager.addFolder(folderName);
    this.setupSceneGUI();
    this.setupLightingGUI();
    this.setupGroundMeshGUI();
  }

  protected setupSceneGUI(): void {
    this.GUIFolder.addColor(this.scene, "background").name("Background Color");
    this.GUIFolder.close();
  }

  protected setupLightingGUI(): void {
    const ambientLightFolder = this.GUIFolder.addFolder("Ambient Light");
    ambientLightFolder.addColor(this.ambientLight, "color").name("Color");
    ambientLightFolder.add(this.ambientLight, "intensity", 0, 3, 0.1).name("Intensity");
    ambientLightFolder.close();

    const directionalLightFolder = this.GUIFolder.addFolder("Directional Light");
    directionalLightFolder.addColor(this.directionalLight, "color").name("Color");
    directionalLightFolder.add(this.directionalLight.position, "x", -20, 20, 0.1).name("Position X");
    directionalLightFolder.add(this.directionalLight.position, "y", -20, 20, 0.1).name("Position Y");
    directionalLightFolder.add(this.directionalLight.position, "z", -20, 20, 0.1).name("Position Z");
    directionalLightFolder.add(this.directionalLight, "intensity", 0, 3, 0.1).name("Intensity");
    directionalLightFolder.close();
  }

  protected setupGroundMeshGUI(): void {
    if (!this.groundMesh) return;

    const groundMeshFolder = this.GUIFolder.addFolder("Ground Mesh");
    groundMeshFolder.add(this.groundMesh.material, "metalness", 0, 1, 0.01).name("Metalness");
    groundMeshFolder.add(this.groundMesh.material, "roughness", 0, 1, 0.01).name("Roughness");
    groundMeshFolder.close();
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getDojo(): DojoResult {
    return this.dojo;
  }

  public getSystemManager(): SystemManager {
    return this.systemManager;
  }

  public getTileRenderer(): TileRenderer {
    return this.tileRenderer;
  }

  public getFXManager(): FXManager {
    return this.fxManager;
  }

  public getRaycaster(): THREE.Raycaster {
    return this.raycaster;
  }

  public getGroundMesh(): THREE.Mesh | undefined {
    return this.groundMesh;
  }

  public abstract update(camera: THREE.Camera): void;

  public abstract handleClick(mouse: THREE.Vector2, camera: THREE.Camera): void;

  public dispose(): void {
    this.tileRenderer.dispose();
    this.fxManager.destroy();

    // Dispose GUI folder
    if (this.GUIFolder) {
      this.GUIFolder.destroy();
      this.GUIFolder = null;
    }

    if (this.groundMesh) {
      this.scene.remove(this.groundMesh);
      this.groundMesh.geometry.dispose();
      if (Array.isArray(this.groundMesh.material)) {
        this.groundMesh.material.forEach((material) => material.dispose());
      } else {
        this.groundMesh.material.dispose();
      }
    }

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });

    this.scene.clear();
  }
}
