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

  constructor(sceneManager: SceneManager, controls: MapControls) {
    this.scene = new THREE.Scene();
    this.sceneManager = sceneManager;
    this.controls = controls;
    this.camera = this.createOrthographicCamera();
    this.GUIFolder = GUIManager.addFolder("HUD");

    this.navigator = new Navigator(this.scene, this.controls, this.GUIFolder);
    const navigatorParams = { col: 269, row: 153 };
    this.GUIFolder.add(navigatorParams, "col").name("Col");
    this.GUIFolder.add(navigatorParams, "row").name("Row");
    this.GUIFolder.add(
      {
        setNavigationTarget: () => this.navigator.setNavigationTarget(navigatorParams.col, navigatorParams.row),
      },
      "setNavigationTarget",
    ).name("Navigate to Col Row");
    this.GUIFolder.close();
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
    camera.position.set(0, 0, 10);
    return camera;
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
