import { TransitionManager } from "@/three/managers/transition-manager";
import { HexagonScene, type SceneSetupContext } from "@/three/scenes/hexagon-scene";
import { runWithFrameWorkOwner } from "@/three/frame-work-owner";
import { formatReadableErrorForConsole } from "@/utils/error-message";
import {
  resolvePendingTransitionStart,
  resolveSceneSwitchRequest,
  resolveTransitionFinalizePlan,
} from "./scene-manager-transition-policy";
import { SceneName } from "./types";

type SceneSetupResult = { succeeded: true } | { error: unknown; succeeded: false };

interface SceneSetupOwnership {
  context: SceneSetupContext;
  release: () => void;
}

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
    previousScene?.deactivateInputSurface?.();
    previousScene?.onSwitchOff(sceneNameToTransition);

    this.transitionInProgress = true;
    const fadeOutCompletion = this.transitionManager.fadeOut();
    const setupOwnership = this.createSetupOwnership(transitionToken);
    const sceneSetupCompletion = this.setupScene(sceneNameToTransition, pendingScene, setupOwnership.context);
    void this.completeTransition(
      sceneNameToTransition,
      pendingScene,
      transitionToken,
      setupOwnership,
      fadeOutCompletion,
      sceneSetupCompletion,
    );
  }

  private createSetupOwnership(transitionToken: number): SceneSetupOwnership {
    let released = false;

    return {
      context: {
        isCurrent: () =>
          !released && this.transitionManager.isActive() && transitionToken === this.transitionRequestToken,
      },
      release: () => {
        released = true;
      },
    };
  }

  private async setupScene(
    sceneName: SceneName,
    scene: HexagonScene,
    setupContext: SceneSetupContext,
  ): Promise<SceneSetupResult> {
    try {
      if (scene.setup) {
        await runWithFrameWorkOwner(`scene:${sceneName}:setup`, () => scene.setup!(setupContext));
      }
      return { succeeded: true };
    } catch (error) {
      return { error, succeeded: false };
    }
  }

  private async completeTransition(
    sceneName: SceneName,
    scene: HexagonScene,
    transitionToken: number,
    setupOwnership: SceneSetupOwnership,
    fadeOutCompletion: Promise<boolean>,
    sceneSetupCompletion: Promise<SceneSetupResult>,
  ) {
    const previousSceneName = this.currentScene;
    let setupSucceeded = false;
    let shouldFinalize = false;

    try {
      const [fadeOutCompleted, setupResult] = await Promise.all([fadeOutCompletion, sceneSetupCompletion]);
      if (!fadeOutCompleted) {
        if (this.transitionManager.isActive()) {
          this.switchOffUnownedScene(scene, this.pendingSceneName ?? previousSceneName);
          this.finishCanceledTransition();
        }
        return;
      }
      // Renderer teardown destroys scenes before it deactivates transitions.
      // Do not run reusable-scene lifecycle hooks after that destruction boundary.
      if (!this.transitionManager.isActive()) return;
      shouldFinalize = true;

      if (this.getTransitionFinalizePlan(transitionToken).isSuperseded) {
        this.switchOffUnownedScene(scene, this.pendingSceneName ?? previousSceneName);
        return;
      }
      if (!setupResult.succeeded) {
        this.switchOffUnownedScene(scene, previousSceneName);
        console.error(
          `[SceneManager] Failed to set up scene ${sceneName}: ${formatReadableErrorForConsole(setupResult.error)}`,
        );
        return;
      }

      this._updateCurrentScene(sceneName);
      scene.activateInputSurface?.();
      setupSucceeded = true;
    } catch (error) {
      console.error(`[SceneManager] Failed to set up scene ${sceneName}: ${formatReadableErrorForConsole(error)}`);
    } finally {
      if (!setupSucceeded) {
        setupOwnership.release();
      }
      if (shouldFinalize) {
        this.finalizeTransition(transitionToken, setupSucceeded, previousSceneName);
      }
    }
  }

  private switchOffUnownedScene(scene: HexagonScene, nextSceneName: SceneName | undefined) {
    scene.onSwitchOff(nextSceneName);
  }

  private finishCanceledTransition() {
    this.transitionInProgress = false;
    if (this.pendingSceneName) {
      this.startPendingTransition();
    }
  }

  private finalizeTransition(
    transitionToken: number,
    setupSucceeded: boolean,
    previousSceneName: SceneName | undefined,
  ) {
    const finalizePlan = this.getTransitionFinalizePlan(transitionToken);
    if (finalizePlan.shouldRunPostSetupEffects && (setupSucceeded || previousSceneName !== undefined)) {
      this.moveCameraForScene();
      this.transitionManager.fadeIn();
    }

    this.transitionInProgress = false;

    if (finalizePlan.shouldStartPendingTransition) {
      this.startPendingTransition();
    }
  }

  private getTransitionFinalizePlan(transitionToken: number) {
    return resolveTransitionFinalizePlan({
      transitionToken,
      latestTransitionRequestToken: this.transitionRequestToken,
      hasPendingScene: Boolean(this.pendingSceneName),
    });
  }

  moveCameraForScene() {
    const scene = this.scenes.get(this.currentScene!);
    if (scene) {
      scene.moveCameraToURLLocation();
    }
  }
}
