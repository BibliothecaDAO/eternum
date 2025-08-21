import { useUIStore } from "@/hooks/store/use-ui-store";
import { RainEffect } from "@/three/effects/rain-effect";
import { Navigator } from "@/three/managers/navigator";
import { SceneManager } from "@/three/scene-manager";
import { GUIManager } from "@/three/utils/";
import { Scene, OrthographicCamera, AmbientLight, HemisphereLight, Color } from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";

export default class HUDScene {
  private scene: Scene;
  private camera: OrthographicCamera;
  private sceneManager: SceneManager;
  private controls: MapControls;
  private GUIFolder: any;
  private navigator: Navigator;
  private ambientLight!: AmbientLight;
  private hemisphereLight!: HemisphereLight;
  private rainEffect!: RainEffect;

  constructor(sceneManager: SceneManager, controls: MapControls) {
    this.scene = new Scene();
    this.sceneManager = sceneManager;
    this.controls = controls;
    this.camera = this.createOrthographicCamera();
    this.GUIFolder = GUIManager.addFolder("HUD");

    this.navigator = new Navigator(this.scene, this.controls, this.GUIFolder);
    const navigatorParams = { col: 269, row: 143 };

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
    this.addHemisphereLight();
    this.rainEffect = new RainEffect(this.scene);
    this.rainEffect.addGUIControls(this.GUIFolder);

    useUIStore.subscribe(
      (state) => state.navigationTarget,
      (target) => {
        const currentTarget = this.navigator.getNavigationTarget();
        if (target && target.col !== currentTarget?.col && target.row !== currentTarget?.row) {
          this.setNavigationTarget(target.col, target.row);
        } else {
          this.navigator.clearNavigationTarget();
        }
      },
    );
  }

  private createOrthographicCamera(): OrthographicCamera {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10;
    const camera = new OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000,
    );

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
    this.ambientLight = new AmbientLight(0xf3c99f, 3.5);
    this.scene.add(this.ambientLight);

    this.GUIFolder.add(this.ambientLight, "intensity", 0, 10).name("Ambient Light Intensity");
  }

  private addHemisphereLight() {
    this.hemisphereLight = new HemisphereLight(0xf3c99f, 0xffffff, 0.5);
    this.hemisphereLight.position.set(0, 20, 0);
    this.scene.add(this.hemisphereLight);

    this.GUIFolder.add(this.hemisphereLight, "intensity", 0, 5).name("Hemisphere Light Intensity");
    this.GUIFolder.add(this.hemisphereLight.position, "x", -10, 10).name("Hemisphere Light X");
    this.GUIFolder.add(this.hemisphereLight.position, "y", -10, 10).name("Hemisphere Light Y");
    this.GUIFolder.add(this.hemisphereLight.position, "z", -10, 10).name("Hemisphere Light Z");
  }

  getScene(): Scene {
    return this.scene;
  }

  getCamera(): OrthographicCamera {
    return this.camera;
  }

  update(deltaTime: number) {
    this.navigator.update();
    this.rainEffect.update(deltaTime);
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

  public destroy(): void {
    // Clean up navigator (if it has a destroy method)
    if (this.navigator && "destroy" in this.navigator && typeof (this.navigator as any).destroy === "function") {
      (this.navigator as any).destroy();
    }

    // Clean up rain effect (if it has a destroy method)
    if (this.rainEffect && "destroy" in this.rainEffect && typeof (this.rainEffect as any).destroy === "function") {
      (this.rainEffect as any).destroy();
    }

    // Clean up lights
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
    }
    if (this.hemisphereLight) {
      this.scene.remove(this.hemisphereLight);
    }

    // Clean up GUI folder (if it has a destroy method)
    if (this.GUIFolder && "destroy" in this.GUIFolder && typeof this.GUIFolder.destroy === "function") {
      this.GUIFolder.destroy();
    }

    // Clear scene
    this.scene.clear();

    console.log("HUDScene: Destroyed and cleaned up");
  }
}
