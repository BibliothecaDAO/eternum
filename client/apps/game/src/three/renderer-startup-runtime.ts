interface BootstrapRendererStartupRuntimeInput {
  animate: () => void;
  attachInteractionRuntime: () => void;
  cleanupExpiredTransitions: (maxAgeMs: number) => number;
  debug?: (message: string) => void;
  document: Document;
  initializeHudScene: () => void;
  isDestroyed: boolean;
  prepareScenes: () => void;
  registerCleanupInterval: (intervalId: ReturnType<typeof setInterval>) => void;
  rendererDomElement: HTMLElement;
  setIntervalFn?: typeof setInterval;
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
  registerRendererTransitionCleanupInterval({
    cleanupExpiredTransitions: input.cleanupExpiredTransitions,
    debug: input.debug,
    registerCleanupInterval: input.registerCleanupInterval,
    setIntervalFn: input.setIntervalFn,
  });
  input.attachInteractionRuntime();
  input.initializeHudScene();
  input.prepareScenes();
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
  input.document.body.appendChild(input.rendererDomElement);
}

function registerRendererTransitionCleanupInterval(input: {
  cleanupExpiredTransitions: (maxAgeMs: number) => number;
  debug?: (message: string) => void;
  registerCleanupInterval: (intervalId: ReturnType<typeof setInterval>) => void;
  setIntervalFn?: typeof setInterval;
}): void {
  const setIntervalFn = input.setIntervalFn ?? setInterval;
  const intervalId = setIntervalFn(() => {
    const cleanedCount = input.cleanupExpiredTransitions(10000);
    if (cleanedCount > 0) {
      input.debug?.(`Cleaned up ${cleanedCount} expired transition records`);
    }
  }, 30 * 1000);

  input.registerCleanupInterval(intervalId);
}
