import { CameraView } from "@/three/scenes/hexagon-scene";
import type { Camera, Scene } from "three";
import { renderRendererBackendFrame } from "./renderer-backend-compat";
import { setRendererDiagnosticSceneName } from "./renderer-diagnostics";
import type { RendererBackendV2, RendererOverlayPass } from "./renderer-backend-v2";
import type { RendererSurfaceLike } from "./renderer-backend";
import type { RendererLabelCadenceView, RendererLabelRuntime } from "./renderer-label-runtime";
import { SceneName } from "./types";

interface RendererFrameSceneController {
  getCurrentCameraView(): CameraView | undefined;
  getInteractionOverlayScene(): Scene;
  getScene(): Scene;
  hasActiveLabelAnimations(): boolean;
  setWeatherAtmosphereState(weatherState: unknown): void;
  update(deltaTime: number): void;
}

interface RendererFrameHudController {
  getCamera(): Camera;
  getScene(): Scene;
  getWeatherState(): unknown;
  hasActiveLabelAnimations(): boolean;
  update(deltaTime: number, cycleProgress: number): void;
}

interface ResolvedRendererFrame {
  cadenceView: RendererLabelCadenceView;
  labelsActive: boolean;
  overlayPasses: RendererOverlayPass[];
  scene: Scene;
  sceneController: RendererFrameSceneController;
  sceneName: SceneName;
}

interface RunRendererFrameInput {
  backend: RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };
  camera: Camera;
  captureStatsSample: () => void;
  currentScene: SceneName | undefined;
  currentTime: number;
  cycleProgress: number;
  deltaTime: number;
  effectsBridgeRuntime?: Pick<{ updateWeatherPostProcessing(): void }, "updateWeatherPostProcessing">;
  fastTravelScene?: RendererFrameSceneController;
  hexceptionScene: RendererFrameSceneController;
  hudScene: RendererFrameHudController;
  labelRuntime: Pick<RendererLabelRuntime, "render" | "shouldRender">;
  worldmapScene: RendererFrameSceneController;
}

export function runRendererFrame(input: RunRendererFrameInput): boolean {
  const weatherState = advanceHudAndResolveWeatherState(input);
  applyWeatherAtmosphereState({
    fastTravelScene: input.fastTravelScene,
    hexceptionScene: input.hexceptionScene,
    weatherState,
    worldmapScene: input.worldmapScene,
  });

  const resolvedFrame = resolveRendererFrame({
    camera: input.camera,
    currentScene: input.currentScene,
    fastTravelScene: input.fastTravelScene,
    hexceptionScene: input.hexceptionScene,
    hudScene: input.hudScene,
    worldmapScene: input.worldmapScene,
  });
  if (!resolvedFrame) {
    return false;
  }

  resolvedFrame.sceneController.update(input.deltaTime);

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
  input.effectsBridgeRuntime?.updateWeatherPostProcessing();
  input.captureStatsSample();

  return true;
}

function advanceHudAndResolveWeatherState(
  input: Pick<RunRendererFrameInput, "cycleProgress" | "deltaTime" | "hudScene">,
): unknown {
  input.hudScene.update(input.deltaTime, input.cycleProgress);
  return input.hudScene.getWeatherState();
}

function applyWeatherAtmosphereState(input: {
  fastTravelScene?: RendererFrameSceneController;
  hexceptionScene: RendererFrameSceneController;
  weatherState: unknown;
  worldmapScene: RendererFrameSceneController;
}): void {
  input.worldmapScene.setWeatherAtmosphereState(input.weatherState);
  input.fastTravelScene?.setWeatherAtmosphereState(input.weatherState);
  input.hexceptionScene.setWeatherAtmosphereState(input.weatherState);
}

function resolveRendererFrame(input: {
  camera: Camera;
  currentScene: SceneName | undefined;
  fastTravelScene?: RendererFrameSceneController;
  hexceptionScene: RendererFrameSceneController;
  hudScene: RendererFrameHudController;
  worldmapScene: RendererFrameSceneController;
}): ResolvedRendererFrame | null {
  if (!input.currentScene) {
    return null;
  }

  const sceneController = resolveActiveSceneController({
    currentScene: input.currentScene,
    fastTravelScene: input.fastTravelScene,
    hexceptionScene: input.hexceptionScene,
    worldmapScene: input.worldmapScene,
  });
  const labelState = resolveRendererFrameLabelState({
    currentScene: input.currentScene,
    fastTravelScene: input.fastTravelScene,
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
  fastTravelScene?: RendererFrameSceneController;
  hexceptionScene: RendererFrameSceneController;
  worldmapScene: RendererFrameSceneController;
}): RendererFrameSceneController {
  const isWorldMap = input.currentScene === SceneName.WorldMap;
  const isFastTravel = input.currentScene === SceneName.FastTravel && Boolean(input.fastTravelScene);

  if (isWorldMap) {
    return input.worldmapScene;
  }

  if (isFastTravel && input.fastTravelScene) {
    return input.fastTravelScene;
  }

  return input.hexceptionScene;
}

function resolveRendererFrameLabelState(input: {
  currentScene: SceneName;
  fastTravelScene?: RendererFrameSceneController;
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
  } else if (input.currentScene === SceneName.FastTravel && input.fastTravelScene) {
    view = input.fastTravelScene.getCurrentCameraView();
    labelsActive = input.fastTravelScene.hasActiveLabelAnimations();
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
  ];
}

function renderResolvedRendererFrame(input: {
  backend: RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };
  camera: Camera;
  hudScene: RendererFrameHudController;
  labelRuntime: Pick<RendererLabelRuntime, "render">;
  resolvedFrame: ResolvedRendererFrame;
  shouldRenderLabels: boolean;
}): void {
  if (input.shouldRenderLabels) {
    input.labelRuntime.render(input.resolvedFrame.scene, input.camera);
  }

  renderRendererBackendFrame(input.backend, {
    mainCamera: input.camera,
    mainScene: input.resolvedFrame.scene,
    overlayPasses: input.resolvedFrame.overlayPasses,
    sceneName: input.resolvedFrame.sceneName,
  });
  setRendererDiagnosticSceneName(input.resolvedFrame.sceneName);

  if (input.shouldRenderLabels) {
    input.labelRuntime.render(input.hudScene.getScene(), input.hudScene.getCamera());
  }
}
