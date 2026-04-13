import { resolvePlayRouteTarget } from "@/play/navigation/play-route-target";
import { SceneName } from "./types";

export interface RendererRouteRuntime {
  dispose(): void;
  start(): void;
  syncFromLocation(href?: string): void;
}

interface CreateRendererRouteRuntimeInput {
  fadeIn: () => void;
  fastTravelEnabled: () => boolean;
  getCurrentScene: () => SceneName | undefined;
  hasFastTravelScene: () => boolean;
  markLabelsDirty: () => void;
  moveCameraForScene: () => void;
  switchScene: (sceneName: SceneName) => void;
}

export function createRendererRouteRuntime(input: CreateRendererRouteRuntimeInput): RendererRouteRuntime {
  return new GameRendererRouteRuntime(input);
}

class GameRendererRouteRuntime implements RendererRouteRuntime {
  private isListening = false;
  private readonly handleRouteEvent = () => {
    this.syncFromLocation();
  };

  constructor(private readonly input: CreateRendererRouteRuntimeInput) {}

  public start(): void {
    if (this.isListening) {
      return;
    }

    window.addEventListener("urlChanged", this.handleRouteEvent);
    window.addEventListener("popstate", this.handleRouteEvent);
    this.isListening = true;
  }

  public syncFromLocation(href: string = window.location.href): void {
    const url = new URL(href);
    const targetScene = resolvePlayRouteTarget(
      {
        pathname: url.pathname,
        search: url.search,
      },
      {
        fastTravelEnabled: this.input.fastTravelEnabled(),
      },
    ).scene as SceneName;

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
    window.removeEventListener("popstate", this.handleRouteEvent);
    this.isListening = false;
  }

  private shouldMoveCameraForActiveRoute(targetScene: SceneName): boolean {
    if (targetScene !== this.input.getCurrentScene()) {
      return false;
    }

    return (
      targetScene === SceneName.WorldMap || (targetScene === SceneName.FastTravel && this.input.hasFastTravelScene())
    );
  }
}
