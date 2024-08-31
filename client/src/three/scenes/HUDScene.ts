import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { SceneManager } from "../SceneManager";

export default class HUDScene {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private sceneManager: SceneManager;
  private controls: MapControls;

  constructor(sceneManager: SceneManager, controls: MapControls) {
    this.scene = new THREE.Scene();
    this.sceneManager = sceneManager;
    this.camera = this.createOrthographicCamera();
    this.initHUD();
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

  private initHUD() {
    // Add HUD elements here
    const arrowGeometry = new THREE.ConeGeometry(0.2, 0.5, 32);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.set(-4, -2, 0);
    arrow.rotation.z = Math.PI / 4;
    this.scene.add(arrow);
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.OrthographicCamera {
    return this.camera;
  }

  update(deltaTime: number) {
    // Update HUD elements if needed
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
}
