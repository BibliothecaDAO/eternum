import { HexPosition, SceneName } from "@/types";
import { TransitionManager } from "./components/TransitionManager";
import { HexagonScene } from "./scenes/HexagonScene";

export class SceneManager {
  private currentScene: SceneName = SceneName.Hexception;
  private scenes = new Map<SceneName, HexagonScene>();
  constructor(private transitionManager: TransitionManager) {}

  getCurrentScene() {
    return this.currentScene;
  }

  _updateCurrentScene(name: SceneName) {
    this.currentScene = name;
  }

  addScene(newScene: SceneName, scene: HexagonScene) {
    this.scenes.set(newScene, scene);
  }

  switchScene(sceneName: SceneName, hexCoords?: HexPosition) {
    const scene = this.scenes.get(sceneName);

    if (scene) {
      this._updateCurrentScene(sceneName);

      this.scenes.get(this.getCurrentScene())?.changeScene(sceneName);
      this.transitionManager.fadeOut(() => {
        if (scene.setup && hexCoords) {
          scene.setup(hexCoords);
        }
        this.transitionManager.fadeIn();
      });
    }
  }

  moveCameraForScene() {
    const scene = this.scenes.get(this.currentScene);
    if (scene) {
      scene.moveCameraToURLLocation();
    }
  }
}
