import { resolvePlayRouteTarget } from "@/play/navigation/play-route-target";
import { SceneName } from "./types";

export interface RendererRouteRuntime {
  dispose(): void;
  start(): void;
  syncFromLocation(href?: string): void;
}

interface CreateRendererRouteRuntimeInput {
  fadeIn: () => void;
  getCurrentScene: () => SceneName | undefined;
  markLabelsDirty: () => void;
  moveCameraForScene: () => void;
  switchScene: (sceneName: SceneName) => void;
}

export function createRendererRouteRuntime(input: CreateRendererRouteRuntimeInput): RendererRouteRuntime {
  return new GameRendererRouteRuntime(input);
}

export function resolveRendererRouteSceneFromHref(input: { href: string }): SceneName {
  const url = new URL(input.href);

  return resolvePlayRouteTarget({
    pathname: url.pathname,
    search: url.search,
  }).scene as SceneName;
}

class GameRendererRouteRuntime implements RendererRouteRuntime {
  private isListening = false;
  private syncedHref: string | null = null;
  private readonly handleRouteEvent = () => {
    this.syncFromLocation();
  };
  /**
   * A history step is a route change only when it lands on another address. A step between entries of one address
   * (a sheet closing steps back off its own entry) leaves the scene, its camera and the selection where they are.
   */
  private readonly handleHistoryStep = () => {
    if (window.location.href !== this.syncedHref) this.syncFromLocation();
  };

  constructor(private readonly input: CreateRendererRouteRuntimeInput) {}

  public start(): void {
    if (this.isListening) {
      return;
    }

    window.addEventListener("urlChanged", this.handleRouteEvent);
    window.addEventListener("popstate", this.handleHistoryStep);
    this.isListening = true;
  }

  public syncFromLocation(href: string = window.location.href): void {
    this.syncedHref = href;
    const targetScene = resolveRendererRouteSceneFromHref({
      href,
    });

    if (this.shouldMoveCameraForActiveRoute(targetScene)) {
      this.input.moveCameraForScene();
      this.input.fadeIn();
    } else {
      this.input.switchScene(targetScene);
    }

    this.input.markLabelsDirty();
  }

  public dispose(): void {
    if (!this.isListening) {
      return;
    }

    window.removeEventListener("urlChanged", this.handleRouteEvent);
    window.removeEventListener("popstate", this.handleHistoryStep);
    this.isListening = false;
  }

  private shouldMoveCameraForActiveRoute(targetScene: SceneName): boolean {
    if (targetScene !== this.input.getCurrentScene()) {
      return false;
    }

    return targetScene === SceneName.WorldMap;
  }
}
