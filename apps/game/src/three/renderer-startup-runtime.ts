import type { SceneName } from "./types";

interface BootstrapRendererStartupRuntimeInput {
  animate: () => void;
  attachInteractionRuntime: () => void;
  document: Document;
  initializeHudScene: () => void;
  initialSceneName: SceneName;
  isDestroyed: boolean;
  prepareScenes: (initialSceneName: SceneName) => void;
  rendererDomElement: HTMLElement;
  syncRouteFromLocation: () => void;
  warn?: (message: string) => void;
}

export function bootstrapRendererStartupRuntime(input: BootstrapRendererStartupRuntimeInput): void {
  if (input.isDestroyed) {
    return;
  }

  mountRendererSurface({
    document: input.document,
    rendererDomElement: input.rendererDomElement,
    warn: input.warn,
  });
  input.attachInteractionRuntime();
  input.initializeHudScene();
  input.prepareScenes(input.initialSceneName);
  input.syncRouteFromLocation();
  input.animate();
}

function mountRendererSurface(input: {
  document: Document;
  rendererDomElement: HTMLElement;
  warn?: (message: string) => void;
}): void {
  input.document.body.style.background = "black";
  const existingCanvas = input.document.getElementById("main-canvas");
  if (existingCanvas) {
    input.warn?.("[GameRenderer] Found existing canvas, removing it to prevent memory leak");
    existingCanvas.remove();
  }

  input.rendererDomElement.id = "main-canvas";
  // The map shakes with the HUD in a moment's screen shake.
  input.rendererDomElement.dataset.screenShake = "";
  input.document.body.appendChild(input.rendererDomElement);
}
