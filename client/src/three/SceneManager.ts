import { SceneName } from "@/types";
import { TransitionManager } from "./components/TransitionManager";
import { HexagonScene } from "./scenes/HexagonScene";

export class SceneManager {
  private currentScene: SceneName | undefined = undefined;
  private scenes = new Map<SceneName, HexagonScene>();
  constructor(private transitionManager: TransitionManager) {}

  getCurrentScene() {
    return this.currentScene;
  }

  getSceneByName(name: SceneName) {
    return this.scenes.get(name);
  }

  _updateCurrentScene(name: SceneName) {
    this.currentScene = name;
  }

  addScene(newScene: SceneName, scene: HexagonScene) {
    this.scenes.set(newScene, scene);
  }

  switchScene(sceneName: SceneName) {
    const scene = this.scenes.get(sceneName);
    if (scene) {
      const previousScene = this.scenes.get(this.currentScene!);
      if (previousScene) {
        previousScene.onSwitchOff();
      }
      this.transitionManager.fadeOut(() => {
        this._updateCurrentScene(sceneName);
        if (scene.setup) {
          scene.setup();
        }
        this.transitionManager.fadeIn();
      });
    }
    this.moveCameraForScene();
  }

  moveCameraForScene() {
    const scene = this.scenes.get(this.currentScene!);
    if (scene) {
      scene.moveCameraToURLLocation();
    }
  }
}
