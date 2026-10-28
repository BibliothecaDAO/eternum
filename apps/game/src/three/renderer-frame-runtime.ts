import { advanceGameEnd } from "./effects/endgame/state";
import { setEndgameView } from "./effects/endgame/field";
import type { endgameFrame } from "./effects/endgame/sequence";
import { CameraView } from "@/three/scenes/camera-view";
import type { Camera, Scene } from "three";
import { runWithFrameWorkOwner } from "./frame-work-owner";
import { setRendererDiagnosticSceneName } from "./renderer-diagnostics";
import type { RendererBackend, RendererOverlayPass } from "./renderer-backend";
import type { RendererSurfaceLike } from "./renderer-backend";
import type { RendererLabelCadenceView, RendererLabelRuntime } from "./renderer-label-runtime";
import { SceneName } from "./types";

interface RendererFrameSceneController {
  getCurrentCameraView(): CameraView | undefined;
  getInteractionOverlayScene(): Scene;
  /** A reward staged over everything (the world map's chest), drawn last; none while nothing is staged. */
  getRewardStagePasses(): RendererOverlayPass[];
  getScene(): Scene;
  hasActiveLabelAnimations(): boolean;
  onFrameRendered?(atMs: number): void;
  isReadyToRender?(): boolean;
  setWeatherAtmosphereState(weatherState: unknown): void;
  setAnimationsPaused?(paused: boolean): void;
  update(deltaTime: number): void;
}

interface RendererFrameHudController {
  getCamera(): Camera;
  getScene(): Scene;
  getWeatherState(): unknown;
  hasActiveLabelAnimations(): boolean;
  update(deltaTime: number, cycleProgress: number): void;
}

type RendererWeatherState = {
  intensity: number;
  stormIntensity: number;
};

interface ResolvedRendererFrame {
  cadenceView: RendererLabelCadenceView;
  labelsActive: boolean;
  overlayPasses: RendererOverlayPass[];
  scene: Scene;
  sceneController: RendererFrameSceneController;
  sceneName: SceneName;
}

interface RunRendererFrameInput {
  backend: RendererBackend & { renderer: RendererSurfaceLike };
  camera: Camera;
  captureStatsSample: () => void;
  currentScene: SceneName | undefined;
  currentTime: number;
  cycleProgress: number;
  deltaTime: number;
  gameEnd: { gameId: number; ended: boolean; frontier: boolean };
  hexceptionScene: RendererFrameSceneController;
  hudScene: RendererFrameHudController;
  labelRuntime: Pick<RendererLabelRuntime, "render" | "shouldRender">;
  now?: () => number;
  worldmapScene: RendererFrameSceneController & {
    advanceGameEnd(frame: ReturnType<typeof endgameFrame>, delta: number): void;
  };
}

export function runRendererFrame(input: RunRendererFrameInput): boolean {
  const endgame = advanceGameEnd(input.gameEnd.gameId, input.gameEnd.ended, input.deltaTime);
  input.worldmapScene.advanceGameEnd(endgame, input.deltaTime);
  setEndgameView(input.currentScene === SceneName.WorldMap, input.gameEnd.frontier, endgame.spread);
  const weatherState = advanceHudAndResolveWeatherState({ ...input, animationsPaused: endgame.finished });
  const resolvedFrame = resolveRendererFrame({
    camera: input.camera,
    currentScene: input.currentScene,
    hexceptionScene: input.hexceptionScene,
    hudScene: input.hudScene,
    worldmapScene: input.worldmapScene,
  });
  if (!resolvedFrame) {
    return false;
  }

  resolvedFrame.sceneController.setAnimationsPaused?.(endgame.finished);
  resolvedFrame.sceneController.setWeatherAtmosphereState(weatherState);
  resolvedFrame.sceneController.update(input.deltaTime);
  // Keep the transition frame while asynchronous preparation owns the incoming scene.
  // Drawing it now would synchronously compile pipelines that are still being prepared.
  if (resolvedFrame.sceneController.isReadyToRender?.() === false) return false;

  const shouldRenderLabels = input.labelRuntime.shouldRender({
    cadenceView: resolvedFrame.cadenceView,
    labelsActive: resolvedFrame.labelsActive,
    now: input.currentTime,
  });

  renderResolvedRendererFrame({
    backend: input.backend,
    camera: input.camera,
    hudScene: input.hudScene,
    labelRuntime: input.labelRuntime,
    resolvedFrame,
    shouldRenderLabels,
  });
  resolvedFrame.sceneController.onFrameRendered?.(input.now?.() ?? performance.now());
  input.captureStatsSample();

  return true;
}

function advanceHudAndResolveWeatherState(
  input: Pick<RunRendererFrameInput, "cycleProgress" | "deltaTime" | "hudScene"> & { animationsPaused: boolean },
): RendererWeatherState {
  if (!input.animationsPaused) input.hudScene.update(input.deltaTime, input.cycleProgress);
  return input.hudScene.getWeatherState() as RendererWeatherState;
}

function resolveRendererFrame(input: {
  camera: Camera;
  currentScene: SceneName | undefined;
  hexceptionScene: RendererFrameSceneController;
  hudScene: RendererFrameHudController;
  worldmapScene: RendererFrameSceneController;
}): ResolvedRendererFrame | null {
  if (!input.currentScene) {
    return null;
  }

  const sceneController = resolveActiveSceneController({
    currentScene: input.currentScene,
    hexceptionScene: input.hexceptionScene,
    worldmapScene: input.worldmapScene,
  });
  const labelState = resolveRendererFrameLabelState({
    currentScene: input.currentScene,
    hexceptionScene: input.hexceptionScene,
    hudScene: input.hudScene,
    worldmapScene: input.worldmapScene,
  });

  return {
    cadenceView: labelState.cadenceView,
    labelsActive: labelState.labelsActive,
    overlayPasses: resolveRendererFrameOverlayPasses({
      camera: input.camera,
      hudScene: input.hudScene,
      sceneController,
    }),
    scene: sceneController.getScene(),
    sceneController,
    sceneName: input.currentScene,
  };
}

function resolveActiveSceneController(input: {
  currentScene: SceneName;
  hexceptionScene: RendererFrameSceneController;
  worldmapScene: RendererFrameSceneController;
}): RendererFrameSceneController {
  const isWorldMap = input.currentScene === SceneName.WorldMap;

  if (isWorldMap) {
    return input.worldmapScene;
  }

  return input.hexceptionScene;
}

function resolveRendererFrameLabelState(input: {
  currentScene: SceneName;
  hexceptionScene: RendererFrameSceneController;
  hudScene: RendererFrameHudController;
  worldmapScene: RendererFrameSceneController;
}): {
  cadenceView: RendererLabelCadenceView;
  labelsActive: boolean;
} {
  let view: CameraView | undefined;
  let labelsActive = false;

  if (input.currentScene === SceneName.WorldMap) {
    view = input.worldmapScene.getCurrentCameraView();
    labelsActive = input.worldmapScene.hasActiveLabelAnimations();
  } else if (input.currentScene === SceneName.Hexception) {
    view = input.hexceptionScene.getCurrentCameraView();
    labelsActive = input.hexceptionScene.hasActiveLabelAnimations();
  }

  if (input.hudScene.hasActiveLabelAnimations()) {
    labelsActive = true;
  }

  return {
    cadenceView: resolveRendererFrameCadenceView(view),
    labelsActive,
  };
}

function resolveRendererFrameCadenceView(view: CameraView | undefined): RendererLabelCadenceView {
  switch (view) {
    case CameraView.Close:
      return "close";
    case CameraView.Medium:
      return "medium";
    case CameraView.Far:
      return "far";
    default:
      return undefined;
  }
}

function resolveRendererFrameOverlayPasses(input: {
  camera: Camera;
  hudScene: RendererFrameHudController;
  sceneController: RendererFrameSceneController;
}): RendererOverlayPass[] {
  return [
    {
      camera: input.camera,
      name: "world-interaction",
      scene: input.sceneController.getInteractionOverlayScene(),
    },
    {
      camera: input.hudScene.getCamera(),
      name: "hud",
      scene: input.hudScene.getScene(),
    },
    ...input.sceneController.getRewardStagePasses(),
  ];
}

function renderResolvedRendererFrame(input: {
  backend: RendererBackend & { renderer: RendererSurfaceLike };
  camera: Camera;
  hudScene: RendererFrameHudController;
  labelRuntime: Pick<RendererLabelRuntime, "render">;
  resolvedFrame: ResolvedRendererFrame;
  shouldRenderLabels: boolean;
}): void {
  if (input.shouldRenderLabels) {
    input.labelRuntime.render(input.resolvedFrame.scene, input.camera);
  }

  runWithFrameWorkOwner("render:backend", () =>
    input.backend.renderFrame({
      mainCamera: input.camera,
      mainScene: input.resolvedFrame.scene,
      overlayPasses: input.resolvedFrame.overlayPasses,
      sceneName: input.resolvedFrame.sceneName,
    }),
  );
  setRendererDiagnosticSceneName(input.resolvedFrame.sceneName);

  if (input.shouldRenderLabels) {
    input.labelRuntime.render(input.hudScene.getScene(), input.hudScene.getCamera());
  }
}
