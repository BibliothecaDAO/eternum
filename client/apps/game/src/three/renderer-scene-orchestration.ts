import type { SetupResult } from "@bibliothecadao/dojo";
import type { Raycaster, Vector2 } from "three";
import type { MapControls } from "three/examples/jsm/controls/MapControls.js";
import type { SceneManager } from "@/three/scene-manager";
import type FastTravelScene from "@/three/scenes/fast-travel";
import type HexceptionScene from "@/three/scenes/hexception";
import type WorldmapScene from "@/three/scenes/worldmap";
import type { TransitionManager } from "@/three/managers/transition-manager";
import type { RendererSurfaceLike } from "./renderer-backend";
import type { RendererEffectsBridgeRuntime } from "./renderer-effects-bridge-runtime";
import type { QualityFeatures } from "./utils/quality-controller";
import {
  bootstrapRendererSceneRuntime,
  createGameRendererSceneRegistry,
  type RendererSceneRegistry,
} from "./renderer-scene-bootstrap";

type GameRendererSceneRegistry = RendererSceneRegistry<
  TransitionManager,
  SceneManager,
  HexceptionScene,
  WorldmapScene,
  FastTravelScene
>;

interface PrepareGameRendererScenesInput {
  applySceneRegistry: (registry: GameRendererSceneRegistry) => void;
  controls: MapControls;
  dojo: SetupResult;
  effectsBridgeRuntime: Pick<
    RendererEffectsBridgeRuntime,
    "applyEnvironment" | "applyQualityFeatures" | "setupPostProcessingEffects" | "subscribeToQualityController"
  >;
  fastTravelEnabled: boolean;
  inputSurface: HTMLElement;
  mouse: Vector2;
  qualityFeatures: QualityFeatures;
  raycaster: Raycaster;
  renderer?: RendererSurfaceLike;
  warn?: (message: string, error: unknown) => void;
}

export function prepareGameRendererScenes(input: PrepareGameRendererScenesInput): void {
  const sceneRegistry = createGameRendererSceneRegistry({
    controls: input.controls,
    dojo: input.dojo,
    fastTravelEnabled: input.fastTravelEnabled,
    inputSurface: input.inputSurface,
    mouse: input.mouse,
    raycaster: input.raycaster,
  });

  input.applySceneRegistry(sceneRegistry);
  bootstrapRendererSceneRuntime({
    effectsBridgeRuntime: input.effectsBridgeRuntime,
    fastTravelScene: sceneRegistry.fastTravelScene,
    hexceptionScene: sceneRegistry.hexceptionScene,
    qualityFeatures: input.qualityFeatures,
    renderer: input.renderer,
    sceneManager: sceneRegistry.sceneManager,
    warn: input.warn,
    worldmapScene: sceneRegistry.worldmapScene,
  });
}
