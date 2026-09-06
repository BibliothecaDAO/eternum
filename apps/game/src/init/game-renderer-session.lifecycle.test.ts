// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("../three/game-renderer", () => ({
  default: class MockGameRenderer {},
}));

const { createGameRendererSession } = await import("./game-renderer-session");

type MockBeforeUnloadHandler = ((event: Event) => void) | null;

const createMockWindow = () => {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  return {
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const handlers = listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
      handlers.add(listener);
      listeners.set(type, handlers);
    }),
    onbeforeunload: null as MockBeforeUnloadHandler,
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.get(type)?.delete(listener);
    }),
    trigger(type: string) {
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
  };
};

describe("game renderer session lifecycle", () => {
  it("restores browser cleanup ownership when the session is disposed", async () => {
    const renderer = {
      destroy: vi.fn(),
      initScene: vi.fn(async () => undefined),
      initStats: vi.fn(),
    };
    const previousBeforeUnload = vi.fn();
    const mockWindow = createMockWindow();
    mockWindow.onbeforeunload = previousBeforeUnload;

    const session = createGameRendererSession({
      createRenderer: () => renderer,
      enableDevTools: true,
      setupResult: {} as never,
      windowObject: mockWindow,
    });

    expect(renderer.initScene).not.toHaveBeenCalled();
    await session.initialize();
    expect(renderer.initScene).toHaveBeenCalledTimes(1);
    expect(renderer.initStats).toHaveBeenCalledTimes(1);
    expect(mockWindow.addEventListener).toHaveBeenCalledWith("pagehide", expect.any(Function));
    expect(mockWindow.onbeforeunload).not.toBe(previousBeforeUnload);

    session.cleanup();

    expect(renderer.destroy).toHaveBeenCalledTimes(1);
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith("pagehide", expect.any(Function));
    expect(mockWindow.onbeforeunload).toBe(previousBeforeUnload);
  });

  it("owns cleanup before scene initialization and refuses to start after cancellation", async () => {
    const renderer = { destroy: vi.fn(), initScene: vi.fn(), initStats: vi.fn() };
    const session = createGameRendererSession({
      createRenderer: () => renderer,
      enableDevTools: false,
      setupResult: {} as never,
      windowObject: createMockWindow(),
    });
    session.cleanup();
    session.cleanup();
    await expect(session.initialize()).rejects.toThrow("disposed before");
    expect(renderer.initScene).not.toHaveBeenCalled();
    expect(renderer.destroy).toHaveBeenCalledTimes(1);
  });

  it("releases the renderer and browser handlers when scene initialization fails", async () => {
    const error = new Error("device initialization failed");
    const renderer = { destroy: vi.fn(), initScene: vi.fn().mockRejectedValue(error), initStats: vi.fn() };
    const windowObject = createMockWindow();
    const session = createGameRendererSession({
      createRenderer: () => renderer,
      enableDevTools: true,
      setupResult: {} as never,
      windowObject,
    });
    await expect(session.initialize()).rejects.toBe(error);
    expect(renderer.destroy).toHaveBeenCalledTimes(1);
    expect(renderer.initStats).not.toHaveBeenCalled();
    expect(windowObject.onbeforeunload).toBeNull();
  });

  it("runs the previous unload handler before destroying the renderer", async () => {
    const renderer = {
      destroy: vi.fn(),
      initScene: vi.fn(async () => undefined),
      initStats: vi.fn(),
    };
    const previousBeforeUnload = vi.fn();
    const mockWindow = createMockWindow();
    mockWindow.onbeforeunload = previousBeforeUnload;

    await createGameRendererSession({
      createRenderer: () => renderer,
      enableDevTools: false,
      setupResult: {} as never,
      windowObject: mockWindow,
    });

    mockWindow.onbeforeunload?.({ type: "beforeunload" } as Event);

    expect(previousBeforeUnload).toHaveBeenCalledTimes(1);
    expect(renderer.destroy).toHaveBeenCalledTimes(1);
  });
});
