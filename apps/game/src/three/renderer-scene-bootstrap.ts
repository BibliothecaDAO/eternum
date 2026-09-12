import { TransitionManager } from "@/three/managers/transition-manager";
import { SceneManager } from "@/three/scene-manager";
import HexceptionScene from "@/three/scenes/hexception";
import WorldmapScene from "@/three/scenes/worldmap";
import type { SetupResult } from "@bibliothecadao/dojo";
import type { Raycaster, Vector2 } from "three";
import type { MapControls } from "three/addons/controls/MapControls.js";
import type { PipelineCompiler } from "./pipeline-compiler";
import { SceneName } from "./types";

interface SceneInputSurfaceOwner {
  setInputSurface(surface: HTMLElement): void;
}

interface SceneManagerLike<TScene> {
  addScene(name: SceneName, scene: TScene): void;
  moveCameraForScene(): void;
}

export interface RendererSceneRegistry<TTransitionManager, TSceneManager, THexceptionScene, TWorldmapScene> {
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
  TSceneManager extends SceneManagerLike<THexceptionScene | TWorldmapScene>,
  THexceptionScene extends SceneInputSurfaceOwner,
  TWorldmapScene extends SceneInputSurfaceOwner,
> {
  controls: TControls;
  createHexceptionScene: (input: {
    compilePipelines: PipelineCompiler;
    controls: TControls;
    dojo: TDojo;
    mouse: TMouse;
    raycaster: TRaycaster;
    sceneManager: TSceneManager;
  }) => THexceptionScene;
  createSceneManager: (transitionManager: TTransitionManager) => TSceneManager;
  createTransitionManager: () => TTransitionManager;
  createWorldmapScene: (input: {
    compilePipelines: PipelineCompiler;
    controls: TControls;
    dojo: TDojo;
    markLabelsDirty: () => void;
    mouse: TMouse;
    raycaster: TRaycaster;
    sceneManager: TSceneManager;
  }) => TWorldmapScene;
  dojo: TDojo;
  compilePipelines?: PipelineCompiler;
  inputSurface: HTMLElement;
  markLabelsDirty?: () => void;
  mouse: TMouse;
  raycaster: TRaycaster;
}

interface BootstrapRendererSceneRuntimeInput<
  TSceneManager extends Pick<SceneManagerLike<unknown>, "moveCameraForScene">,
  TEffectsBridgeRuntime extends {
    applyEnvironment(): void;
    applyRenderVisualProfile(features: TRenderVisualProfile): void;
    setupPostProcessingEffects(): void;
  },
  TRenderVisualProfile,
> {
  effectsBridgeRuntime: TEffectsBridgeRuntime;
  renderVisuals: TRenderVisualProfile;
  sceneManager: TSceneManager;
}

function createRendererSceneRegistry<
  TControls,
  TDojo,
  TMouse,
  TRaycaster,
  TTransitionManager,
  TSceneManager extends SceneManagerLike<THexceptionScene | TWorldmapScene>,
  THexceptionScene extends SceneInputSurfaceOwner,
  TWorldmapScene extends SceneInputSurfaceOwner,
>(
  input: CreateRendererSceneRegistryInput<
    TControls,
    TDojo,
    TMouse,
    TRaycaster,
    TTransitionManager,
    TSceneManager,
    THexceptionScene,
    TWorldmapScene
  >,
): RendererSceneRegistry<TTransitionManager, TSceneManager, THexceptionScene, TWorldmapScene> {
  const transitionManager = input.createTransitionManager();
  const sceneManager = input.createSceneManager(transitionManager);
  const hexceptionScene = input.createHexceptionScene({
    compilePipelines: input.compilePipelines ?? (async () => {}),
    controls: input.controls,
    dojo: input.dojo,
    mouse: input.mouse,
    raycaster: input.raycaster,
    sceneManager,
  });
  const worldmapScene = input.createWorldmapScene({
    compilePipelines: input.compilePipelines ?? (async () => {}),
    controls: input.controls,
    dojo: input.dojo,
    markLabelsDirty: input.markLabelsDirty ?? (() => {}),
    mouse: input.mouse,
    raycaster: input.raycaster,
    sceneManager,
  });

  attachRendererSceneToSurface(hexceptionScene, input.inputSurface);
  attachRendererSceneToSurface(worldmapScene, input.inputSurface);
  sceneManager.addScene(SceneName.Hexception, hexceptionScene);
  sceneManager.addScene(SceneName.WorldMap, worldmapScene);

  return {
    hexceptionScene,
    sceneManager,
    transitionManager,
    worldmapScene,
  };
}

export function createGameRendererSceneRegistry(input: {
  compilePipelines?: PipelineCompiler;
  controls: MapControls;
  dojo: SetupResult;
  inputSurface: HTMLElement;
  markLabelsDirty?: () => void;
  mouse: Vector2;
  raycaster: Raycaster;
}): RendererSceneRegistry<TransitionManager, SceneManager, HexceptionScene, WorldmapScene> {
  return createRendererSceneRegistry({
    compilePipelines: input.compilePipelines,
    controls: input.controls,
    createHexceptionScene: ({ compilePipelines, controls, dojo, mouse, raycaster, sceneManager }) =>
      new HexceptionScene(controls, dojo, mouse, raycaster, sceneManager, compilePipelines),
    createSceneManager: (transitionManager) => new SceneManager(transitionManager),
    createTransitionManager: () => new TransitionManager(),
    createWorldmapScene: ({ compilePipelines, controls, dojo, markLabelsDirty, mouse, raycaster, sceneManager }) =>
      new WorldmapScene(dojo, raycaster, controls, mouse, sceneManager, markLabelsDirty, compilePipelines),
    dojo: input.dojo,
    inputSurface: input.inputSurface,
    markLabelsDirty: input.markLabelsDirty,
    mouse: input.mouse,
    raycaster: input.raycaster,
  });
}

export function bootstrapRendererSceneRuntime<
  TSceneManager extends Pick<SceneManagerLike<unknown>, "moveCameraForScene">,
  TEffectsBridgeRuntime extends {
    applyEnvironment(): void;
    applyRenderVisualProfile(features: TRenderVisualProfile): void;
    setupPostProcessingEffects(): void;
  },
  TRenderVisualProfile,
>(input: BootstrapRendererSceneRuntimeInput<TSceneManager, TEffectsBridgeRuntime, TRenderVisualProfile>): void {
  input.effectsBridgeRuntime.applyEnvironment();
  input.effectsBridgeRuntime.setupPostProcessingEffects();
  input.sceneManager.moveCameraForScene();
  input.effectsBridgeRuntime.applyRenderVisualProfile(input.renderVisuals);
}

function attachRendererSceneToSurface(scene: SceneInputSurfaceOwner, inputSurface: HTMLElement): void {
  scene.setInputSurface(inputSurface);
}
