// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rendererInitScene = vi.fn(async () => undefined);
const rendererInitStats = vi.fn();
const rendererDestroy = vi.fn();

const MockGameRenderer = vi.fn().mockImplementation(() => ({
  destroy: rendererDestroy,
  initScene: rendererInitScene,
  initStats: rendererInitStats,
}));

vi.mock("../three/game-renderer", () => ({
  default: MockGameRenderer,
}));

type MockBeforeUnloadHandler = ((event: Event) => void) | null;

const createMockWindow = () => {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  return {
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const handlers = listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
      handlers.add(listener);
      listeners.set(type, handlers);
    }),
    dispatch(type: string) {
      const handlers = listeners.get(type);
      if (!handlers) {
        return;
      }

      for (const handler of handlers) {
        const event = { type } as Event;
        if (typeof handler === "function") {
          handler(event);
          continue;
        }

        handler.handleEvent(event);
      }
    },
    onbeforeunload: null as MockBeforeUnloadHandler,
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.get(type)?.delete(listener);
    }),
  };
};

const { initializeGameRenderer } = await import("./game-renderer");

describe("initializeGameRenderer session ownership", () => {
  beforeEach(() => {
    rendererInitScene.mockClear();
    rendererInitStats.mockClear();
    rendererDestroy.mockClear();
    MockGameRenderer.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps renderer cleanup inside the session instead of exposing it on window", async () => {
    const mockWindow = createMockWindow();
    vi.stubGlobal("window", mockWindow);

    const cleanup = await initializeGameRenderer({} as never, false);

    expect(MockGameRenderer).toHaveBeenCalledTimes(1);
    expect(rendererInitScene).toHaveBeenCalledTimes(1);
    expect((window as { __cleanupGameRenderer?: unknown }).__cleanupGameRenderer).toBeUndefined();

    cleanup();
  });
});
