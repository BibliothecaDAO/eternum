import { beforeEach, describe, expect, it, vi } from "vitest";

const { runRendererAnimationTick } = await import("./renderer-animation-runtime");

describe("runRendererAnimationTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stops the loop immediately when the renderer is destroyed", () => {
    const logDestroyed = vi.fn();
    const requestNextFrame = vi.fn();
    const renderFrame = vi.fn();

    const lastTime = runRendererAnimationTick({
      getCurrentTime: () => 100,
      getCycleProgress: () => 0.5,
      isDestroyed: true,
      isLabelRuntimeReady: true,
      lastTime: 42,
      logDestroyed,
      renderFrame,
      requestNextFrame,
      targetFPS: null,
    });

    expect(lastTime).toBe(42);
    expect(logDestroyed).toHaveBeenCalledWith("GameRenderer destroyed, stopping animation loop");
    expect(renderFrame).not.toHaveBeenCalled();
    expect(requestNextFrame).not.toHaveBeenCalled();
  });

  it("waits for label runtime readiness before rendering", () => {
    const requestNextFrame = vi.fn();
    const renderFrame = vi.fn();

    const lastTime = runRendererAnimationTick({
      getCurrentTime: () => 100,
      getCycleProgress: () => 0.5,
      isDestroyed: false,
      isLabelRuntimeReady: false,
      lastTime: 25,
      renderFrame,
      requestNextFrame,
      targetFPS: null,
    });

    expect(lastTime).toBe(25);
    expect(renderFrame).not.toHaveBeenCalled();
    expect(requestNextFrame).toHaveBeenCalledTimes(1);
  });

  it("throttles capped frames and carries forward the initialized frame time", () => {
    const requestNextFrame = vi.fn();
    const renderFrame = vi.fn();

    const lastTime = runRendererAnimationTick({
      getCurrentTime: () => 100,
      getCycleProgress: () => 0.5,
      isDestroyed: false,
      isLabelRuntimeReady: true,
      lastTime: 0,
      renderFrame,
      requestNextFrame,
      targetFPS: 30,
    });

    expect(lastTime).toBe(100);
    expect(renderFrame).not.toHaveBeenCalled();
    expect(requestNextFrame).toHaveBeenCalledTimes(1);
  });

  it("updates the panel, controls, and frame render before scheduling the next tick", () => {
    const requestNextFrame = vi.fn();
    const updateStatsPanel = vi.fn();
    const updateControls = vi.fn();
    const renderFrame = vi.fn(() => false);

    const lastTime = runRendererAnimationTick({
      getCurrentTime: () => 116,
      getCycleProgress: () => 0.75,
      isDestroyed: false,
      isLabelRuntimeReady: true,
      lastTime: 100,
      renderFrame,
      requestNextFrame,
      targetFPS: null,
      updateControls,
      updateStatsPanel,
    });

    expect(lastTime).toBe(116);
    expect(updateStatsPanel).toHaveBeenCalledTimes(1);
    expect(updateControls).toHaveBeenCalledTimes(1);
    expect(renderFrame).toHaveBeenCalledWith({
      currentTime: 116,
      cycleProgress: 0.75,
      deltaTime: 0.016,
    });
    expect(requestNextFrame).toHaveBeenCalledTimes(1);
  });
});
