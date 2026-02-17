import { TransitionManager } from "@/three/managers/transition-manager";
import { HexagonScene } from "@/three/scenes/hexagon-scene";
import {
  resolvePendingTransitionStart,
  resolveSceneSwitchRequest,
  resolveTransitionFinalizePlan,
} from "./scene-manager-transition-policy";
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
    const decision = resolveSceneSwitchRequest({
      requestedSceneName: sceneName,
      hasRequestedScene: Boolean(scene),
      transitionRequestToken: this.transitionRequestToken,
      transitionInProgress: this.transitionInProgress,
      pendingSceneName: this.pendingSceneName,
    });

    this.transitionRequestToken = decision.nextTransitionRequestToken;
    this.pendingSceneName = decision.nextPendingSceneName;

    if (!decision.shouldStartPendingTransition) return;
    this.startPendingTransition();
  }

  private startPendingTransition() {
    const pendingSceneName = this.pendingSceneName;
    const pendingScene = pendingSceneName ? this.scenes.get(pendingSceneName) : undefined;
    const decision = resolvePendingTransitionStart({
      pendingSceneName,
      hasPendingScene: Boolean(pendingScene),
      transitionRequestToken: this.transitionRequestToken,
    });

    this.pendingSceneName = decision.nextPendingSceneName;
    const sceneNameToTransition = decision.sceneNameToTransition;
    const transitionToken = decision.transitionToken;
    if (!decision.shouldStartTransition) return;
    if (!pendingScene || !sceneNameToTransition || transitionToken === undefined) {
      return;
    }

    const previousScene = this.currentScene ? this.scenes.get(this.currentScene) : undefined;
    previousScene?.onSwitchOff();

    this.transitionInProgress = true;
    this.transitionManager.fadeOut(async () => {
      await this.completeTransition(sceneNameToTransition, pendingScene, transitionToken);
    });
  }

  private async completeTransition(sceneName: SceneName, scene: HexagonScene, transitionToken: number) {
    const resolveFinalizePlan = () =>
      resolveTransitionFinalizePlan({
        transitionToken,
        latestTransitionRequestToken: this.transitionRequestToken,
        hasPendingScene: Boolean(this.pendingSceneName),
      });

    try {
      if (resolveFinalizePlan().isSuperseded) return;

      this._updateCurrentScene(sceneName);
      if (scene.setup) {
        await scene.setup();
      }
    } catch (error) {
      console.error(`[SceneManager] Failed to set up scene ${sceneName}`, error);
    } finally {
      const finalizePlan = resolveFinalizePlan();
      if (finalizePlan.shouldRunPostSetupEffects) {
        this.moveCameraForScene();
        this.transitionManager.fadeIn();
      }

      this.transitionInProgress = false;

      if (finalizePlan.shouldStartPendingTransition) {
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
