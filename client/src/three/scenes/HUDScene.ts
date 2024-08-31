import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { SceneManager } from "../SceneManager";
import { Navigator } from "../components/Navigator";
import { GUIManager } from "../helpers/GUIManager";

export default class HUDScene {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private sceneManager: SceneManager;
  private controls: MapControls;
  private GUIFolder: any;
  private navigator: Navigator;
  private ambientLight!: THREE.AmbientLight;
  private directionalLight!: THREE.DirectionalLight;

  constructor(sceneManager: SceneManager, controls: MapControls) {
    this.scene = new THREE.Scene();
    this.sceneManager = sceneManager;
    this.controls = controls;
    this.camera = this.createOrthographicCamera();
    this.GUIFolder = GUIManager.addFolder("HUD");

    this.navigator = new Navigator(this.scene, this.controls, this.GUIFolder);
    const navigatorParams = { col: 269, row: 143 };
    //this.navigator.setNavigationTarget(navigatorParams.col, navigatorParams.row);
    this.GUIFolder.add(navigatorParams, "col").name("Col");
    this.GUIFolder.add(navigatorParams, "row").name("Row");
    this.GUIFolder.add(
      {
        setNavigationTarget: () => this.navigator.setNavigationTarget(navigatorParams.col, navigatorParams.row),
      },
      "setNavigationTarget",
    ).name("Navigate to Col Row");
    this.GUIFolder.close();

    this.addAmbientLight();
    this.addDirectionalLight();
  }

  private createOrthographicCamera(): THREE.OrthographicCamera {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10;
    const camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000,
    );

    // Set camera position and orientation similar to GameRenderer
    const cameraDistance = Math.sqrt(2 * 7 * 7);
    const cameraAngle = 60 * (Math.PI / 180);
    const cameraHeight = Math.sin(cameraAngle) * cameraDistance;
    const cameraDepth = Math.cos(cameraAngle) * cameraDistance;

    camera.position.set(0, cameraHeight, cameraDepth);
    camera.lookAt(0, 0, 0);
    camera.up.set(0, 1, 0);

    return camera;
  }

  private addAmbientLight() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(this.ambientLight);

    // Add GUI control for ambient light intensity
    this.GUIFolder.add(this.ambientLight, "intensity", 0, 1).name("Ambient Light Intensity");
  }

  private addDirectionalLight() {
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    this.directionalLight.position.set(0, 0, 5);
    this.scene.add(this.directionalLight.target);
    this.directionalLight.target.position.set(0, 8, 0);
    this.scene.add(this.directionalLight);

    // Add GUI controls for directional light
    this.GUIFolder.add(this.directionalLight, "intensity", 0, 5).name("Directional Light Intensity");
    this.GUIFolder.add(this.directionalLight.position, "x", -10, 10).name("Dir. Light X");
    this.GUIFolder.add(this.directionalLight.position, "y", -10, 10).name("Dir. Light Y");
    this.GUIFolder.add(this.directionalLight.position, "z", -10, 10).name("Dir. Light Z");
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.OrthographicCamera {
    return this.camera;
  }

  update(deltaTime: number) {
    // Update HUD elements if needed
    this.navigator.update();
  }

  onWindowResize(width: number, height: number) {
    const aspect = width / height;
    const frustumSize = 10;
    this.camera.left = (frustumSize * aspect) / -2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = frustumSize / -2;
    this.camera.updateProjectionMatrix();
  }

  setNavigationTarget(col: number, row: number) {
    this.navigator.setNavigationTarget(col, row);
  }
}
