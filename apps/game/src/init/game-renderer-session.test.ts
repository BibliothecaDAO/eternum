import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { describe, expect, it, vi } from "vitest";

import { createGameRendererSession } from "./game-renderer-session";

vi.mock("../three/game-renderer", () => ({ default: class {} }));

const setupResult = {} as GameClientSetup;

function fakeWindow() {
  return { addEventListener: vi.fn(), onbeforeunload: null, removeEventListener: vi.fn() };
}

function fakeRenderer() {
  return { destroy: vi.fn(), initScene: vi.fn(async () => {}), initStats: vi.fn() };
}

describe("createGameRendererSession", () => {
  it("runs the renderer it is given instead of the game's own, with the game's setup", async () => {
    const renderer = fakeRenderer();
    const createRenderer = vi.fn(() => renderer);
    const session = createGameRendererSession({
      createRenderer,
      enableDevTools: false,
      setupResult,
      windowObject: fakeWindow(),
    });

    await session.initialize();

    expect(createRenderer).toHaveBeenCalledWith(setupResult);
    expect(renderer.initScene).toHaveBeenCalledTimes(1);
    expect(renderer.initStats).not.toHaveBeenCalled();
  });

  it("opens the renderer's monitors only with the dev tools, and starts its scene once however often asked", async () => {
    const renderer = fakeRenderer();
    const session = createGameRendererSession({
      createRenderer: () => renderer,
      enableDevTools: true,
      setupResult,
      windowObject: fakeWindow(),
    });

    await Promise.all([session.initialize(), session.initialize()]);

    expect(renderer.initScene).toHaveBeenCalledTimes(1);
    expect(renderer.initStats).toHaveBeenCalledTimes(1);
  });

  it("destroys the renderer once on cleanup and gives the page its unload handler back", () => {
    const renderer = fakeRenderer();
    const windowObject = fakeWindow();
    const session = createGameRendererSession({
      createRenderer: () => renderer,
      enableDevTools: false,
      setupResult,
      windowObject,
    });

    session.cleanup();
    session.cleanup();

    expect(renderer.destroy).toHaveBeenCalledTimes(1);
    expect(windowObject.onbeforeunload).toBeNull();
    expect(windowObject.removeEventListener).toHaveBeenCalledWith("pagehide", expect.any(Function));
  });

  it("destroys a renderer whose scene fails to start, and passes the failure on", async () => {
    const renderer = fakeRenderer();
    renderer.initScene.mockRejectedValueOnce(new Error("no GPU"));
    const session = createGameRendererSession({
      createRenderer: () => renderer,
      enableDevTools: false,
      setupResult,
      windowObject: fakeWindow(),
    });

    await expect(session.initialize()).rejects.toThrow("no GPU");
    expect(renderer.destroy).toHaveBeenCalledTimes(1);
  });
});
