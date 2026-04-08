import { TransitionManager } from "@/three/managers/transition-manager";
import { SceneManager } from "@/three/scene-manager";
import FastTravelScene from "@/three/scenes/fast-travel";
import HexceptionScene from "@/three/scenes/hexception";
import WorldmapScene from "@/three/scenes/worldmap";
import type { SetupResult } from "@bibliothecadao/dojo";
import type { Camera, Object3D, Object3DEventMap, Raycaster, Vector2 } from "three";
import type { MapControls } from "three/examples/jsm/controls/MapControls.js";
import type { RendererSurfaceLike } from "./renderer-backend";
import { SceneName } from "./types";
import { requestRendererScenePrewarm } from "./webgpu-postprocess-policy";

interface SceneInputSurfaceOwner {
  setInputSurface(surface: HTMLElement): void;
}

interface SceneManagerLike<TScene> {
  addScene(name: SceneName, scene: TScene): void;
  moveCameraForScene(): void;
}

type PrewarmableScene = {
  getCamera(): Camera;
  getScene(): Object3D<Object3DEventMap>;
};

export interface RendererSceneRegistry<
  TTransitionManager,
  TSceneManager,
  THexceptionScene,
  TWorldmapScene,
  TFastTravelScene = THexceptionScene,
> {
  fastTravelScene?: TFastTravelScene;
  hexceptionScene: THexceptionScene;
  sceneManager: TSceneManager;
  transitionManager: TTransitionManager;
  worldmapScene: TWorldmapScene;
}

interface CreateRendererSceneRegistryInput<
  TControls,
  TDojo,
  TMouse,
  TRaycaster,
  TTransitionManager,
  TSceneManager extends SceneManagerLike<THexceptionScene | TWorldmapScene | TFastTravelScene>,
  THexceptionScene extends SceneInputSurfaceOwner,
  TWorldmapScene extends SceneInputSurfaceOwner,
  TFastTravelScene extends SceneInputSurfaceOwner,
> {
  controls: TControls;
  createFastTravelScene?: (input: {
    controls: TControls;
    dojo: TDojo;
    mouse: TMouse;
    raycaster: TRaycaster;
    sceneManager: TSceneManager;
  }) => TFastTravelScene;
  createHexceptionScene: (input: {
    controls: TControls;
    dojo: TDojo;
    mouse: TMouse;
    raycaster: TRaycaster;
    sceneManager: TSceneManager;
  }) => THexceptionScene;
  createSceneManager: (transitionManager: TTransitionManager) => TSceneManager;
  createTransitionManager: () => TTransitionManager;
  createWorldmapScene: (input: {
    controls: TControls;
    dojo: TDojo;
    mouse: TMouse;
    raycaster: TRaycaster;
    sceneManager: TSceneManager;
  }) => TWorldmapScene;
  dojo: TDojo;
  fastTravelEnabled: boolean;
  inputSurface: HTMLElement;
  mouse: TMouse;
  raycaster: TRaycaster;
}

interface BootstrapRendererSceneRuntimeInput<
  TSceneManager extends Pick<SceneManagerLike<unknown>, "moveCameraForScene">,
  TEffectsBridgeRuntime extends {
    applyEnvironment(): void;
    applyQualityFeatures(features: TQualityFeatures): void;
    setupPostProcessingEffects(): void;
    subscribeToQualityController(): void;
  },
  THexceptionScene extends PrewarmableScene,
  TWorldmapScene extends PrewarmableScene,
  TFastTravelScene extends PrewarmableScene,
  TQualityFeatures,
> {
  effectsBridgeRuntime: TEffectsBridgeRuntime;
  fastTravelScene?: TFastTravelScene;
  hexceptionScene: THexceptionScene;
  qualityFeatures: TQualityFeatures;
  renderer?: RendererSurfaceLike;
  sceneManager: TSceneManager;
  warn?: (message: string, error: unknown) => void;
  worldmapScene: TWorldmapScene;
}

export function createRendererSceneRegistry<
  TControls,
  TDojo,
  TMouse,
  TRaycaster,
  TTransitionManager,
  TSceneManager extends SceneManagerLike<THexceptionScene | TWorldmapScene | TFastTravelScene>,
  THexceptionScene extends SceneInputSurfaceOwner,
  TWorldmapScene extends SceneInputSurfaceOwner,
  TFastTravelScene extends SceneInputSurfaceOwner,
>(
  input: CreateRendererSceneRegistryInput<
    TControls,
    TDojo,
    TMouse,
    TRaycaster,
    TTransitionManager,
    TSceneManager,
    THexceptionScene,
    TWorldmapScene,
    TFastTravelScene
  >,
): RendererSceneRegistry<TTransitionManager, TSceneManager, THexceptionScene, TWorldmapScene, TFastTravelScene> {
  const transitionManager = input.createTransitionManager();
  const sceneManager = input.createSceneManager(transitionManager);
  const hexceptionScene = input.createHexceptionScene({
    controls: input.controls,
    dojo: input.dojo,
    mouse: input.mouse,
    raycaster: input.raycaster,
    sceneManager,
  });
  const worldmapScene = input.createWorldmapScene({
    controls: input.controls,
    dojo: input.dojo,
    mouse: input.mouse,
    raycaster: input.raycaster,
    sceneManager,
  });

  attachRendererSceneToSurface(hexceptionScene, input.inputSurface);
  attachRendererSceneToSurface(worldmapScene, input.inputSurface);
  sceneManager.addScene(SceneName.Hexception, hexceptionScene);
  sceneManager.addScene(SceneName.WorldMap, worldmapScene);

  let fastTravelScene: TFastTravelScene | undefined;
  if (input.fastTravelEnabled && input.createFastTravelScene) {
    fastTravelScene = input.createFastTravelScene({
      controls: input.controls,
      dojo: input.dojo,
      mouse: input.mouse,
      raycaster: input.raycaster,
      sceneManager,
    });
    attachRendererSceneToSurface(fastTravelScene, input.inputSurface);
    sceneManager.addScene(SceneName.FastTravel, fastTravelScene);
  }

  return {
    fastTravelScene,
    hexceptionScene,
    sceneManager,
    transitionManager,
    worldmapScene,
  };
}

export function createGameRendererSceneRegistry(input: {
  controls: MapControls;
  dojo: SetupResult;
  fastTravelEnabled: boolean;
  inputSurface: HTMLElement;
  mouse: Vector2;
  raycaster: Raycaster;
}): RendererSceneRegistry<TransitionManager, SceneManager, HexceptionScene, WorldmapScene, FastTravelScene> {
  return createRendererSceneRegistry({
    controls: input.controls,
    createFastTravelScene: ({ controls, dojo, mouse, raycaster, sceneManager }) =>
      new FastTravelScene(dojo, raycaster, controls, mouse, sceneManager),
    createHexceptionScene: ({ controls, dojo, mouse, raycaster, sceneManager }) =>
      new HexceptionScene(controls, dojo, mouse, raycaster, sceneManager),
    createSceneManager: (transitionManager) => new SceneManager(transitionManager),
    createTransitionManager: () => new TransitionManager(),
    createWorldmapScene: ({ controls, dojo, mouse, raycaster, sceneManager }) =>
      new WorldmapScene(dojo, raycaster, controls, mouse, sceneManager),
    dojo: input.dojo,
    fastTravelEnabled: input.fastTravelEnabled,
    inputSurface: input.inputSurface,
    mouse: input.mouse,
    raycaster: input.raycaster,
  });
}

export function bootstrapRendererSceneRuntime<
  TSceneManager extends Pick<SceneManagerLike<unknown>, "moveCameraForScene">,
  TEffectsBridgeRuntime extends {
    applyEnvironment(): void;
    applyQualityFeatures(features: TQualityFeatures): void;
    setupPostProcessingEffects(): void;
    subscribeToQualityController(): void;
  },
  THexceptionScene extends PrewarmableScene,
  TWorldmapScene extends PrewarmableScene,
  TFastTravelScene extends PrewarmableScene,
  TQualityFeatures,
>(
  input: BootstrapRendererSceneRuntimeInput<
    TSceneManager,
    TEffectsBridgeRuntime,
    THexceptionScene,
    TWorldmapScene,
    TFastTravelScene,
    TQualityFeatures
  >,
): void {
  prewarmRendererBootstrapScenes({
    fastTravelScene: input.fastTravelScene,
    hexceptionScene: input.hexceptionScene,
    renderer: input.renderer,
    warn: input.warn,
    worldmapScene: input.worldmapScene,
  });
  input.effectsBridgeRuntime.applyEnvironment();
  input.effectsBridgeRuntime.setupPostProcessingEffects();
  input.sceneManager.moveCameraForScene();
  input.effectsBridgeRuntime.applyQualityFeatures(input.qualityFeatures);
  input.effectsBridgeRuntime.subscribeToQualityController();
}

function attachRendererSceneToSurface(scene: SceneInputSurfaceOwner, inputSurface: HTMLElement): void {
  scene.setInputSurface(inputSurface);
}

function prewarmRendererBootstrapScenes(input: {
  fastTravelScene?: PrewarmableScene;
  hexceptionScene: PrewarmableScene;
  renderer?: RendererSurfaceLike;
  warn?: (message: string, error: unknown) => void;
  worldmapScene: PrewarmableScene;
}): void {
  void prewarmRendererScene({
    renderer: input.renderer,
    scene: input.worldmapScene,
    warn: input.warn,
  });
  void prewarmRendererScene({
    renderer: input.renderer,
    scene: input.hexceptionScene,
    warn: input.warn,
  });
  void prewarmRendererScene({
    renderer: input.renderer,
    scene: input.fastTravelScene,
    warn: input.warn,
  });
}

async function prewarmRendererScene(input: {
  renderer?: RendererSurfaceLike;
  scene?: PrewarmableScene;
  warn?: (message: string, error: unknown) => void;
}): Promise<void> {
  if (!input.scene) {
    return;
  }

  try {
    await requestRendererScenePrewarm(input.renderer, input.scene.getScene(), input.scene.getCamera());
  } catch (error) {
    input.warn?.("GameRenderer: Scene prewarm failed", error);
  }
}
