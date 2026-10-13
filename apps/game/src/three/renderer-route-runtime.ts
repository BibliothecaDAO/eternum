import { resolvePlayRouteTarget } from "@/play/navigation/play-route-target";
import { SCENE_ADDRESS_EVENT } from "@/scene-address";
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
  /**
   * Gives the page to the renderer or takes it back: its canvas in the document and its loop running, or neither. The
   * renderer outlives its route (a return to the match needs no reload), so outside a match it must not be on the page.
   */
  ownPage: (owns: boolean) => void;
  switchScene: (sceneName: SceneName) => void;
}

export function createRendererRouteRuntime(input: CreateRendererRouteRuntimeInput): RendererRouteRuntime {
  return new GameRendererRouteRuntime(input);
}

export function resolveRendererRouteSceneFromHref(input: { href: string }): SceneName {
  return resolveRendererRoute(input.href).scene;
}

/** The scene an address names, and whether it is a match's own address: only there does the renderer own the page. */
const resolveRendererRoute = (href: string): { scene: SceneName; inMatch: boolean } => {
  const url = new URL(href);
  const target = resolvePlayRouteTarget({ pathname: url.pathname, search: url.search });
  return { scene: target.scene as SceneName, inMatch: target.playRoute !== null };
};

class GameRendererRouteRuntime implements RendererRouteRuntime {
  private isListening = false;
  private syncedHref: string | null = null;
  /** Whether the renderer has the page; unknown until the first address is read. */
  private ownsPage: boolean | null = null;
  private readonly handleRouteEvent = () => {
    this.syncFromLocation();
  };
  /**
   * The scene's frame arrived at an address or left it. Leaving a match gives the page back; arriving in one takes it
   * and reads the address. An address change inside a match is the route event's to answer, not this one's.
   */
  private readonly handleSceneAddress = () => {
    const wasOwned = this.ownsPage;
    const owns = this.syncPageOwnership(window.location.href);
    if (owns && !wasOwned) this.syncFromLocation();
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
    window.addEventListener(SCENE_ADDRESS_EVENT, this.handleSceneAddress);
    this.isListening = true;
  }

  public syncFromLocation(href: string = window.location.href): void {
    this.syncedHref = href;
    // Outside a match there is no scene to show: the page goes back to the app and nothing else moves.
    if (!this.syncPageOwnership(href)) return;
    const targetScene = resolveRendererRoute(href).scene;

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
    window.removeEventListener(SCENE_ADDRESS_EVENT, this.handleSceneAddress);
    this.isListening = false;
  }

  /** The one decision of who has the page: the renderer inside a match, the app everywhere else. */
  private syncPageOwnership(href: string): boolean {
    const owns = resolveRendererRoute(href).inMatch;
    if (owns !== this.ownsPage) {
      this.ownsPage = owns;
      this.input.ownPage(owns);
    }
    return owns;
  }

  private shouldMoveCameraForActiveRoute(targetScene: SceneName): boolean {
    if (targetScene !== this.input.getCurrentScene()) {
      return false;
    }

    return targetScene === SceneName.WorldMap;
  }
}
