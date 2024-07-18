import { PerspectiveCamera } from "three";
import HexceptionScene from "./scenes/Hexception";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { TransitionManager } from "./components/TransitionManager";

export class SceneManager {
  public hexceptionScene: HexceptionScene | undefined;
  public currentScene: "worldmap" | "hexception" = "worldmap";
  constructor(
    private cameraAngle: number,
    private cameraDistance: number,
    private camera: PerspectiveCamera,
    private controls: MapControls,
    private transitionManager: TransitionManager,
  ) {}

  initScene(hexceptionScene: HexceptionScene) {
    this.hexceptionScene = hexceptionScene;
  }

  _updateCurrentScene(newScene: "worldmap" | "hexception") {
    this.currentScene = newScene;
  }

  transitionToDetailedScene(row: number, col: number, x: number, z: number) {
    this._checkIfSceneIsInitialized();
    this.transitionManager.fadeOut(() => {
      // Reset camera and controls
      console.log({ hexceptionScene: this.hexceptionScene });
      this.hexceptionScene!.setup(row, col);
      this.camera.position.set(
        0,
        Math.sin(this.cameraAngle) * this.cameraDistance,
        -Math.cos(this.cameraAngle) * this.cameraDistance,
      );
      this.camera.lookAt(0, 0, 0);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
      this.transitionManager.fadeIn();
      this._updateCurrentScene("hexception");
    });
  }

  transitionToMainScene() {
    this._checkIfSceneIsInitialized();
    this.transitionManager.fadeOut(() => {
      const [col, row] = this.hexceptionScene!.getCenterColRow();
      this._moveCameraToColRow(col, row, 0);
      this.transitionManager.fadeIn();
      this._updateCurrentScene("worldmap");
    });
  }

  private _checkIfSceneIsInitialized() {
    if (!this.hexceptionScene) throw new Error("Scene not initialized");
  }

  // create a CameraManager class
  private _moveCameraToColRow(col: number, row: number, duration: number) {
    // Implementation of camera movement
  }
}
