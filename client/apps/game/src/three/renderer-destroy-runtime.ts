import { disposeRendererBackend } from "./renderer-backend-compat";
import type { RendererSurfaceLike } from "./renderer-backend";
import type { RendererBackendV2 } from "./renderer-backend-v2";
import type { RendererInteractionRuntime } from "./renderer-interaction-runtime";
import type { RendererLabelRuntime } from "./renderer-label-runtime";
import type { RendererMonitoringRuntime } from "./renderer-monitoring-runtime";
import type { RendererEffectsBridgeRuntime } from "./renderer-effects-bridge-runtime";
import type { RendererRouteRuntime } from "./renderer-route-runtime";
import { disposeContactShadowResources } from "./utils/contact-shadow";
import { clearBiomeGltfCache } from "./utils/biome-gltf-cache";
import { clearCosmeticAssetCache } from "./cosmetics/asset-cache";
import { destroyTrackedGuiFolders, type TrackableGuiFolder } from "./utils/gui-folder-lifecycle";

type Destroyable = {
  destroy?(): void;
};

interface DestroyRendererRuntimeInput {
  backend?: RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };
  cleanupIntervals: NodeJS.Timeout[];
  controls?: { dispose(): void };
  effectsBridgeRuntime?: Pick<RendererEffectsBridgeRuntime, "dispose">;
  guiFolders: TrackableGuiFolder[];
  handleWindowResize: EventListenerOrEventListenerObject;
  interactionRuntime?: RendererInteractionRuntime;
  labelRuntime?: RendererLabelRuntime;
  monitoringRuntime?: RendererMonitoringRuntime;
  removeWindowListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  renderer?: RendererSurfaceLike;
  routeRuntime?: RendererRouteRuntime;
  scenes: {
    fastTravelScene?: Destroyable;
    hexceptionScene?: Destroyable;
    hudScene?: Destroyable;
    worldmapScene?: Destroyable;
  };
  transitionManager?: Destroyable;
}

export function destroyRendererRuntime(input: DestroyRendererRuntimeInput): void {
  clearRendererCleanupIntervals(input.cleanupIntervals);
  detachRendererSurface(input.renderer);
  disposeRendererResources(input.backend);
  destroyRendererScenes(input.scenes);
  // Phase 5.1: the scene destroys above disposed the shared biome geometry/material;
  // clear the parse cache so a re-created renderer re-parses fresh assets rather than
  // reusing the now-disposed GLTFs.
  clearBiomeGltfCache();
  clearCosmeticAssetCache();
  disposeRendererInteraction(input.interactionRuntime, input.controls);
  destroyRendererTransitionManager(input.transitionManager);
  destroyTrackedGuiFolders(input.guiFolders);
  input.removeWindowListener("resize", input.handleWindowResize);
  disposeSupportRuntimes(input.effectsBridgeRuntime, input.labelRuntime, input.monitoringRuntime, input.routeRuntime);
  disposeContactShadowResources();
}

function clearRendererCleanupIntervals(cleanupIntervals: NodeJS.Timeout[]): void {
  cleanupIntervals.forEach((interval) => clearInterval(interval));
  cleanupIntervals.length = 0;
}

function detachRendererSurface(renderer?: RendererSurfaceLike): void {
  if (renderer?.domElement?.parentElement) {
    renderer.domElement.parentElement.removeChild(renderer.domElement);
  }
}

function disposeRendererResources(
  backend?: RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void },
): void {
  if (!backend) {
    return;
  }

  disposeRendererBackend(backend);
}

function destroyRendererScenes(scenes: DestroyRendererRuntimeInput["scenes"]): void {
  scenes.worldmapScene?.destroy?.();
  scenes.fastTravelScene?.destroy?.();
  scenes.hexceptionScene?.destroy?.();
  scenes.hudScene?.destroy?.();
}

function disposeRendererInteraction(
  interactionRuntime?: RendererInteractionRuntime,
  controls?: { dispose(): void },
): void {
  if (interactionRuntime) {
    interactionRuntime.dispose();
    return;
  }

  controls?.dispose();
}

function destroyRendererTransitionManager(transitionManager?: Destroyable): void {
  transitionManager?.destroy?.();
}

function disposeSupportRuntimes(
  effectsBridgeRuntime?: Pick<RendererEffectsBridgeRuntime, "dispose">,
  labelRuntime?: RendererLabelRuntime,
  monitoringRuntime?: RendererMonitoringRuntime,
  routeRuntime?: RendererRouteRuntime,
): void {
  effectsBridgeRuntime?.dispose();
  labelRuntime?.dispose();
  monitoringRuntime?.dispose();
  routeRuntime?.dispose();
}
