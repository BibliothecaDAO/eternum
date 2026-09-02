import type { SetupResult } from "@bibliothecadao/dojo";
import type { Raycaster, Vector2 } from "three";
import type { MapControls } from "three/addons/controls/MapControls.js";
import type { SceneManager } from "@/three/scene-manager";
import type FastTravelScene from "@/three/scenes/fast-travel";
import type HexceptionScene from "@/three/scenes/hexception";
import type WorldmapScene from "@/three/scenes/worldmap";
import type { TransitionManager } from "@/three/managers/transition-manager";
import type { PipelineCompiler } from "@/three/pipeline-compiler";
import type { RendererEffectsBridgeRuntime } from "./renderer-effects-bridge-runtime";
import type { RenderVisualProfile } from "./render-profile";
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
    "applyEnvironment" | "applyRenderVisualProfile" | "setupPostProcessingEffects"
  >;
  fastTravelEnabled: boolean;
  inputSurface: HTMLElement;
  compilePipelines?: PipelineCompiler;
  markLabelsDirty?: () => void;
  mouse: Vector2;
  renderVisuals: RenderVisualProfile;
  raycaster: Raycaster;
}

export function prepareGameRendererScenes(input: PrepareGameRendererScenesInput): void {
  const sceneRegistry = createGameRendererSceneRegistry({
    compilePipelines: input.compilePipelines,
    controls: input.controls,
    dojo: input.dojo,
    fastTravelEnabled: input.fastTravelEnabled,
    inputSurface: input.inputSurface,
    markLabelsDirty: input.markLabelsDirty,
    mouse: input.mouse,
    raycaster: input.raycaster,
  });

  input.applySceneRegistry(sceneRegistry);
  bootstrapRendererSceneRuntime({
    effectsBridgeRuntime: input.effectsBridgeRuntime,
    renderVisuals: input.renderVisuals,
    sceneManager: sceneRegistry.sceneManager,
  });
}
