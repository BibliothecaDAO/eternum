import { TransitionManager } from "@/three/managers/transition-manager";
import { HexagonScene } from "@/three/scenes/hexagon-scene";
import { SceneName } from "./types";

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
    console.log("[SceneManager] switchScene to:", sceneName, "from:", this.currentScene);
    const scene = this.scenes.get(sceneName);
    if (!scene) {
      console.log("[SceneManager] Scene not found:", sceneName);
      return;
    }

    const previousScene = this.scenes.get(this.currentScene!);
    previousScene?.onSwitchOff();

    this.transitionManager.fadeOut(async () => {
      this._updateCurrentScene(sceneName);

      try {
        console.log("[SceneManager] Running scene.setup() for", sceneName);
        if (scene.setup) {
          await scene.setup();
        }
        console.log("[SceneManager] scene.setup() complete for", sceneName);
      } catch (error) {
        console.error(`[SceneManager] Failed to set up scene ${sceneName}`, error);
      } finally {
        this.moveCameraForScene();
        console.log("[SceneManager] Calling fadeIn for", sceneName);
        this.transitionManager.fadeIn();
      }
    });
  }

  moveCameraForScene() {
    const scene = this.scenes.get(this.currentScene!);
    if (scene) {
      scene.moveCameraToURLLocation();
    }
  }
}
