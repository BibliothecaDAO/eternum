import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRendererFrameFailureCircuit, resolveRendererPacedFps, runRendererAnimationTick } =
  await import("./renderer-animation-runtime");

describe("resolveRendererPacedFps", () => {
  it("caps every mode at 60fps and drops idle Battery to 30", () => {
    const quality = { pacing: { idleAfterMs: 2_000, idleFps: null, maxFps: 60 } };
    const battery = { pacing: { idleAfterMs: 2_000, idleFps: 30, maxFps: 60 } };

    expect(resolveRendererPacedFps({ currentTime: 10_000, lastInteractionTime: 0, profile: quality })).toBe(60);
    expect(resolveRendererPacedFps({ currentTime: 1_999, lastInteractionTime: 0, profile: battery })).toBe(60);
    expect(resolveRendererPacedFps({ currentTime: 2_000, lastInteractionTime: 0, profile: battery })).toBe(30);
    expect(resolveRendererPacedFps({ currentTime: 2_001, lastInteractionTime: 2_000, profile: battery })).toBe(60);
  });
});

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

  it("reports a thrown frame and always schedules the next tick", () => {
    const frameError = new Error("writeBuffer range is invalid");
    const onFrameError = vi.fn();
    const onFrameSuccess = vi.fn();
    const requestNextFrame = vi.fn();

    const lastTime = runRendererAnimationTick({
      getCurrentTime: () => 116,
      getCycleProgress: () => 0.75,
      isDestroyed: false,
      isLabelRuntimeReady: true,
      lastTime: 100,
      onFrameError,
      onFrameSuccess,
      renderFrame: vi.fn(() => {
        throw frameError;
      }),
      requestNextFrame,
      targetFPS: null,
    });

    expect(lastTime).toBe(116);
    expect(onFrameError).toHaveBeenCalledWith(frameError);
    expect(onFrameSuccess).not.toHaveBeenCalled();
    expect(requestNextFrame).toHaveBeenCalledTimes(1);
  });

  it("throttles repeated-frame-error reports without stopping frame attempts", () => {
    const circuit = createRendererFrameFailureCircuit();
    const frameError = new Error("writeBuffer range is invalid");

    expect(circuit.recordFailure(frameError)).toEqual({ repeatCount: 0, shouldReport: true });
    for (let repeatCount = 1; repeatCount < 60; repeatCount += 1) {
      expect(circuit.recordFailure(frameError)).toEqual({ repeatCount, shouldReport: false });
    }
    expect(circuit.recordFailure(frameError)).toEqual({ repeatCount: 60, shouldReport: true });

    circuit.recordSuccess();
    expect(circuit.recordFailure(frameError)).toEqual({ repeatCount: 0, shouldReport: true });
  });
});
