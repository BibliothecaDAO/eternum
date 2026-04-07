import type { SetupResult } from "@bibliothecadao/dojo";
import type { Raycaster, Vector2 } from "three";
import type { MapControls } from "three/examples/jsm/controls/MapControls.js";
import type { RendererEffectsBridgeRuntime } from "./renderer-effects-bridge-runtime";
import {
  bootstrapRendererSceneRuntime,
  createGameRendererSceneRegistry,
  type RendererSceneRegistry,
} from "./renderer-scene-bootstrap";

interface PrepareGameRendererScenesInput<
  TTransitionManager,
  TSceneManager extends { moveCameraForScene(): void },
  THexceptionScene,
  TWorldmapScene,
  TFastTravelScene,
  TQualityFeatures,
> {
  applySceneRegistry: (
    registry: RendererSceneRegistry<
      TTransitionManager,
      TSceneManager,
      THexceptionScene,
      TWorldmapScene,
      TFastTravelScene
    >,
  ) => void;
  controls: MapControls;
  dojo: SetupResult;
  effectsBridgeRuntime: Pick<
    RendererEffectsBridgeRuntime,
    "applyEnvironment" | "applyQualityFeatures" | "setupPostProcessingEffects" | "subscribeToQualityController"
  >;
  fastTravelEnabled: boolean;
  inputSurface: HTMLElement;
  mouse: Vector2;
  qualityFeatures: TQualityFeatures;
  raycaster: Raycaster;
  requestScenePrewarm: (scene: unknown) => void;
}

export function prepareGameRendererScenes<
  TTransitionManager,
  TSceneManager extends { moveCameraForScene(): void },
  THexceptionScene,
  TWorldmapScene,
  TFastTravelScene,
  TQualityFeatures,
>(
  input: PrepareGameRendererScenesInput<
    TTransitionManager,
    TSceneManager,
    THexceptionScene,
    TWorldmapScene,
    TFastTravelScene,
    TQualityFeatures
  >,
): void {
  const sceneRegistry = createGameRendererSceneRegistry({
    controls: input.controls,
    dojo: input.dojo,
    fastTravelEnabled: input.fastTravelEnabled,
    inputSurface: input.inputSurface,
    mouse: input.mouse,
    raycaster: input.raycaster,
  }) as RendererSceneRegistry<TTransitionManager, TSceneManager, THexceptionScene, TWorldmapScene, TFastTravelScene>;

  input.applySceneRegistry(sceneRegistry);
  bootstrapRendererSceneRuntime({
    effectsBridgeRuntime: input.effectsBridgeRuntime,
    fastTravelScene: sceneRegistry.fastTravelScene,
    hexceptionScene: sceneRegistry.hexceptionScene,
    qualityFeatures: input.qualityFeatures,
    requestScenePrewarm: input.requestScenePrewarm as never,
    sceneManager: sceneRegistry.sceneManager,
    worldmapScene: sceneRegistry.worldmapScene,
  });
}
