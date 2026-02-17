import { TransitionManager } from "@/three/managers/transition-manager";
import { HexagonScene } from "@/three/scenes/hexagon-scene";
import { SceneName } from "./types";

export class SceneManager {
  private currentScene: SceneName | undefined = undefined;
  private scenes = new Map<SceneName, HexagonScene>();
  private transitionInProgress = false;
  private transitionRequestToken = 0;
  private pendingSceneName: SceneName | undefined = undefined;
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
    if (!scene) return;

    this.transitionRequestToken += 1;
    this.pendingSceneName = sceneName;

    if (this.transitionInProgress) return;
    this.startPendingTransition();
  }

  private startPendingTransition() {
    const pendingSceneName = this.pendingSceneName;
    if (!pendingSceneName) return;

    const pendingScene = this.scenes.get(pendingSceneName);
    if (!pendingScene) {
      this.pendingSceneName = undefined;
      return;
    }

    const transitionToken = this.transitionRequestToken;
    this.pendingSceneName = undefined;

    const previousScene = this.currentScene ? this.scenes.get(this.currentScene) : undefined;
    previousScene?.onSwitchOff();

    this.transitionInProgress = true;
    this.transitionManager.fadeOut(async () => {
      await this.completeTransition(pendingSceneName, pendingScene, transitionToken);
    });
  }

  private async completeTransition(sceneName: SceneName, scene: HexagonScene, transitionToken: number) {
    const isSuperseded = () => transitionToken !== this.transitionRequestToken;

    try {
      if (isSuperseded()) return;

      this._updateCurrentScene(sceneName);
      if (scene.setup) {
        await scene.setup();
      }
    } catch (error) {
      console.error(`[SceneManager] Failed to set up scene ${sceneName}`, error);
    } finally {
      if (!isSuperseded()) {
        this.moveCameraForScene();
        this.transitionManager.fadeIn();
      }

      this.transitionInProgress = false;

      if (this.pendingSceneName) {
        this.startPendingTransition();
      }
    }
  }

  moveCameraForScene() {
    const scene = this.scenes.get(this.currentScene!);
    if (scene) {
      scene.moveCameraToURLLocation();
    }
  }
}
