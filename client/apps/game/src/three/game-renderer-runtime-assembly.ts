import type { GraphicsSettings } from "@/ui/config";
import HUDScene from "@/three/scenes/hud-scene";
import type { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { createRendererControlBridgeRuntime } from "./renderer-control-bridge-runtime";
import { createRendererEffectsBridgeRuntime } from "./renderer-effects-bridge-runtime";
import { createRendererEffectsRuntime } from "./renderer-effects-runtime";
import type { RendererLabelRuntime } from "./renderer-label-runtime";
import { createRendererMonitoringRuntime } from "./renderer-monitoring-runtime";
import { createRendererRouteRuntime } from "./renderer-route-runtime";
import { createRendererRuntimeAssembly } from "./renderer-runtime-assembly";
import type { RendererBackendV2 } from "./renderer-backend-v2";
import type { RendererSessionRuntime } from "./renderer-session-runtime";
import type { RendererSupportRuntimeRegistry } from "./renderer-support-runtime-registry";
import { qualityController } from "./utils/quality-controller";
import { getContactShadowResources } from "./utils/contact-shadow";
import type { TrackableGuiFolder } from "./utils/gui-folder-lifecycle";
import type { SceneManager } from "@/three/scene-manager";
import type FastTravelScene from "@/three/scenes/fast-travel";
import type HexceptionScene from "@/three/scenes/hexception";
import type WorldmapScene from "@/three/scenes/worldmap";
import type { TransitionManager } from "@/three/managers/transition-manager";
import type { RendererSurfaceLike } from "./renderer-backend";

type RendererBackendRuntime = RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };

export interface GameRendererRuntimeState {
  backend?: RendererBackendRuntime;
  controls?: MapControls;
  fastTravelScene?: FastTravelScene;
  hexceptionScene?: HexceptionScene;
  hudScene?: HUDScene;
  labelRuntime?: RendererLabelRuntime;
  renderer?: RendererSurfaceLike;
  sceneManager?: SceneManager;
  transitionManager?: TransitionManager;
  worldmapScene?: WorldmapScene;
}

interface CreateGameRendererRuntimeAssemblyInput {
  addWindowListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  createFolder: (name: string) => TrackableGuiFolder;
  fastTravelEnabled: () => boolean;
  graphicsSetting: GraphicsSettings;
  isGraphicsDevEnabled: boolean;
  isMemoryMonitoringEnabled: boolean;
  isMobileDevice: boolean;
  rendererOwner: object;
  resolvePixelRatio: (pixelRatio: number) => number;
  resolveRuntimeState: () => GameRendererRuntimeState;
  windowObject: Window;
  windowResizeListener: EventListenerOrEventListenerObject;
}

export interface GameRendererRuntimeAssembly {
  sessionRuntime: RendererSessionRuntime<HUDScene>;
  supportRuntimeRegistry: RendererSupportRuntimeRegistry;
}

export function createGameRendererRuntimeAssembly(
  input: CreateGameRendererRuntimeAssemblyInput,
): GameRendererRuntimeAssembly {
  return createRendererRuntimeAssembly({
    addWindowListener: input.addWindowListener,
    createControlBridgeRuntime: () => createGameRendererControlBridgeRuntime(input),
    createEffectsBridgeRuntime: () => createGameRendererEffectsBridgeRuntime(input),
    createHudScene: () => createGameRendererHudScene(input.resolveRuntimeState()),
    createMonitoringRuntime: () => createGameRendererMonitoringRuntime(input),
    createRouteRuntime: () => createGameRendererRouteRuntime(input),
    windowResizeListener: input.windowResizeListener,
  });
}

function createGameRendererControlBridgeRuntime(input: CreateGameRendererRuntimeAssemblyInput) {
  return createRendererControlBridgeRuntime({
    changeCameraView: (view) => {
      input.resolveRuntimeState().worldmapScene?.changeCameraView(view);
    },
    createFolder: input.createFolder,
    fastTravelEnabled: input.fastTravelEnabled,
    getCurrentScene: () => input.resolveRuntimeState().sceneManager?.getCurrentScene(),
    getRenderer: () => input.resolveRuntimeState().renderer,
    markLabelsDirty: () => {
      input.resolveRuntimeState().labelRuntime?.markDirty();
    },
    moveCameraToColRow: (col, row, duration) => {
      input.resolveRuntimeState().worldmapScene?.moveCameraToColRow(col, row, duration);
    },
    moveCameraToXYZ: (x, y, z, duration) => {
      input.resolveRuntimeState().worldmapScene?.moveCameraToXYZ(x, y, z, duration);
    },
    requestFastTravelSceneRefresh: () => {
      input.resolveRuntimeState().fastTravelScene?.requestSceneRefresh();
    },
    switchScene: (sceneName) => {
      input.resolveRuntimeState().sceneManager?.switchScene(sceneName);
    },
    updateContactShadowOpacity: (opacity) => {
      getContactShadowResources().material.opacity = opacity;
    },
  });
}

function createGameRendererEffectsBridgeRuntime(input: CreateGameRendererRuntimeAssemblyInput) {
  return createRendererEffectsBridgeRuntime({
    addQualityListener: (listener) => qualityController.addEventListener(listener),
    createEffectsRuntime: () => {
      const runtimeState = input.resolveRuntimeState();

      return createRendererEffectsRuntime({
        backend: runtimeState.backend as RendererBackendRuntime,
        createFolder: input.createFolder,
        graphicsSetting: input.graphicsSetting,
        isMobileDevice: input.isMobileDevice,
        resolvePixelRatio: input.resolvePixelRatio,
        scenes: {
          fastTravelScene: runtimeState.fastTravelScene,
          hexceptionScene: runtimeState.hexceptionScene as HexceptionScene,
          worldmapScene: runtimeState.worldmapScene as WorldmapScene,
        },
      });
    },
    resolveQualityFeatures: () => qualityController.getFeatures(),
    resolveWeatherState: () => input.resolveRuntimeState().hudScene?.getWeatherManager?.()?.getState(),
  });
}

function createGameRendererHudScene(runtimeState: GameRendererRuntimeState): HUDScene {
  return new HUDScene(runtimeState.sceneManager as SceneManager, runtimeState.controls as MapControls);
}

function createGameRendererMonitoringRuntime(input: CreateGameRendererRuntimeAssemblyInput) {
  return createRendererMonitoringRuntime({
    debugWindow: input.windowObject,
    getSceneName: () => input.resolveRuntimeState().sceneManager?.getCurrentScene() || "unknown",
    isGraphicsDevEnabled: input.isGraphicsDevEnabled,
    isMemoryMonitoringEnabled: input.isMemoryMonitoringEnabled,
    renderer: input.resolveRuntimeState().renderer as RendererSurfaceLike,
    rendererOwner: input.rendererOwner,
  });
}

function createGameRendererRouteRuntime(input: CreateGameRendererRuntimeAssemblyInput) {
  return createRendererRouteRuntime({
    fadeIn: () => {
      input.resolveRuntimeState().transitionManager?.fadeIn();
    },
    fastTravelEnabled: input.fastTravelEnabled,
    getCurrentScene: () => input.resolveRuntimeState().sceneManager?.getCurrentScene(),
    hasFastTravelScene: () => Boolean(input.resolveRuntimeState().fastTravelScene),
    markLabelsDirty: () => {
      input.resolveRuntimeState().labelRuntime?.markDirty();
    },
    moveCameraForScene: () => {
      input.resolveRuntimeState().sceneManager?.moveCameraForScene();
    },
    switchScene: (sceneName) => {
      input.resolveRuntimeState().sceneManager?.switchScene(sceneName);
    },
  });
}
