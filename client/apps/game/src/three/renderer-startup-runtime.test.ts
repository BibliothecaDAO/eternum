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
      cleanupExpiredTransitions: vi.fn(() => 0),
      document,
      initializeHudScene: vi.fn(),
      isDestroyed: false,
      prepareScenes: vi.fn(),
      registerCleanupInterval: vi.fn(),
      rendererDomElement: nextCanvas,
      setIntervalFn: vi.fn(() => 1 as never),
      syncRouteFromLocation: vi.fn(),
      warn: vi.fn(),
    });

    expect(staleCanvas.isConnected).toBe(false);
    expect(nextCanvas.id).toBe("main-canvas");
    expect(nextCanvas.parentElement).toBe(document.body);
    expect(document.body.style.background).toBe("black");
  });

  it("registers transition cleanup polling and logs only when expired records are removed", () => {
    const registerCleanupInterval = vi.fn();
    const debug = vi.fn();
    const setIntervalFn = vi.fn((callback: () => void) => {
      callback();
      return 42 as never;
    });

    bootstrapRendererStartupRuntime({
      animate: vi.fn(),
      attachInteractionRuntime: vi.fn(),
      cleanupExpiredTransitions: vi.fn(() => 2),
      debug,
      document,
      initializeHudScene: vi.fn(),
      isDestroyed: false,
      prepareScenes: vi.fn(),
      registerCleanupInterval,
      rendererDomElement: document.createElement("canvas"),
      setIntervalFn,
      syncRouteFromLocation: vi.fn(),
      warn: vi.fn(),
    });

    expect(setIntervalFn).toHaveBeenCalledTimes(1);
    expect(registerCleanupInterval).toHaveBeenCalledWith(42);
    expect(debug).toHaveBeenCalledWith("Cleaned up 2 expired transition records");
  });

  it("runs startup steps in order after mounting the surface", () => {
    const calls: string[] = [];

    bootstrapRendererStartupRuntime({
      animate: () => calls.push("animate"),
      attachInteractionRuntime: () => calls.push("attachInteraction"),
      cleanupExpiredTransitions: () => 0,
      document,
      initializeHudScene: () => calls.push("initializeHud"),
      isDestroyed: false,
      prepareScenes: () => calls.push("prepareScenes"),
      registerCleanupInterval: () => calls.push("registerInterval"),
      rendererDomElement: document.createElement("canvas"),
      setIntervalFn: ((callback: () => void) => {
        calls.push("setInterval");
        return 7 as never;
      }) as typeof setInterval,
      syncRouteFromLocation: () => calls.push("syncRoute"),
      warn: vi.fn(),
    });

    expect(calls).toEqual([
      "setInterval",
      "registerInterval",
      "attachInteraction",
      "initializeHud",
      "prepareScenes",
      "syncRoute",
      "animate",
    ]);
  });

  it("skips startup work entirely when destruction wins the race", () => {
    const attachInteractionRuntime = vi.fn();

    bootstrapRendererStartupRuntime({
      animate: vi.fn(),
      attachInteractionRuntime,
      cleanupExpiredTransitions: vi.fn(() => 0),
      document,
      initializeHudScene: vi.fn(),
      isDestroyed: true,
      prepareScenes: vi.fn(),
      registerCleanupInterval: vi.fn(),
      rendererDomElement: document.createElement("canvas"),
      setIntervalFn: vi.fn(() => 1 as never),
      syncRouteFromLocation: vi.fn(),
      warn: vi.fn(),
    });

    expect(attachInteractionRuntime).not.toHaveBeenCalled();
    expect(document.body.childElementCount).toBe(0);
  });
});
