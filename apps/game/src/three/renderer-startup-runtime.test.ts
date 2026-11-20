// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const { bootstrapRendererStartupRuntime } = await import("./renderer-startup-runtime");

describe("bootstrapRendererStartupRuntime", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("removes a stale main canvas before mounting the renderer surface", () => {
    const staleCanvas = document.createElement("canvas");
    staleCanvas.id = "main-canvas";
    document.body.appendChild(staleCanvas);
    const nextCanvas = document.createElement("canvas");

    bootstrapRendererStartupRuntime({
      animate: vi.fn(),
      attachInteractionRuntime: vi.fn(),
      document,
      initializeHudScene: vi.fn(),
      initialSceneName: "map" as never,
      isDestroyed: false,
      prepareScenes: vi.fn(),
      rendererDomElement: nextCanvas,
      syncRouteFromLocation: vi.fn(),
      warn: vi.fn(),
    });

    expect(staleCanvas.isConnected).toBe(false);
    expect(nextCanvas.id).toBe("main-canvas");
    expect(nextCanvas.parentElement).toBe(document.body);
    expect(document.body.style.background).toBe("black");
  });

  it("runs startup steps in order after mounting the surface", () => {
    const calls: string[] = [];

    bootstrapRendererStartupRuntime({
      animate: () => calls.push("animate"),
      attachInteractionRuntime: () => calls.push("attachInteraction"),
      document,
      initializeHudScene: () => calls.push("initializeHud"),
      initialSceneName: "map" as never,
      isDestroyed: false,
      prepareScenes: (sceneName) => calls.push(`prepareScenes:${sceneName}`),
      rendererDomElement: document.createElement("canvas"),
      syncRouteFromLocation: () => calls.push("syncRoute"),
      warn: vi.fn(),
    });

    expect(calls).toEqual(["attachInteraction", "initializeHud", "prepareScenes:map", "syncRoute", "animate"]);
  });

  it("passes the route-selected initial scene into scene preparation", () => {
    const prepareScenes = vi.fn();

    bootstrapRendererStartupRuntime({
      animate: vi.fn(),
      attachInteractionRuntime: vi.fn(),
      document,
      initializeHudScene: vi.fn(),
      initialSceneName: "hex" as never,
      isDestroyed: false,
      prepareScenes,
      rendererDomElement: document.createElement("canvas"),
      syncRouteFromLocation: vi.fn(),
      warn: vi.fn(),
    });

    expect(prepareScenes).toHaveBeenCalledWith("hex");
  });

  it("skips startup work entirely when destruction wins the race", () => {
    const attachInteractionRuntime = vi.fn();

    bootstrapRendererStartupRuntime({
      animate: vi.fn(),
      attachInteractionRuntime,
      document,
      initializeHudScene: vi.fn(),
      initialSceneName: "map" as never,
      isDestroyed: true,
      prepareScenes: vi.fn(),
      rendererDomElement: document.createElement("canvas"),
      syncRouteFromLocation: vi.fn(),
      warn: vi.fn(),
    });

    expect(attachInteractionRuntime).not.toHaveBeenCalled();
    expect(document.body.childElementCount).toBe(0);
  });
});
