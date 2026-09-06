import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRendererFrameFailureCircuit, runRendererAnimationTick } = await import("./renderer-animation-runtime");

describe("runRendererAnimationTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(
    [60, 120, 144, 165].flatMap((refreshRate) => [30, 60, null].map((targetFPS) => ({ refreshRate, targetFPS }))),
  )("preserves elapsed animation time at $targetFPS FPS on a $refreshRate Hz display", ({ targetFPS, refreshRate }) => {
    let timing = { lastTime: 100, lastFrameTime: 100 };
    let elapsed = 0;
    let frames = 0;
    let renderedAt = 100;
    for (let tick = 1; tick <= refreshRate * 10; tick++) {
      const now = 100 + (tick * 1000) / refreshRate;
      timing = runRendererAnimationTick({
        getCurrentTime: () => now,
        getCycleProgress: () => 0.5,
        isDestroyed: false,
        isLabelRuntimeReady: true,
        ...timing,
        targetFPS,
        requestNextFrame: () => {},
        renderFrame: ({ deltaTime }) => {
          elapsed += deltaTime;
          renderedAt = now;
          frames++;
          return true;
        },
      });
    }
    expect(frames).toBeGreaterThanOrEqual((targetFPS ?? refreshRate) * 10 - 1);
    expect(frames).toBeLessThanOrEqual((targetFPS ?? refreshRate) * 10);
    expect(elapsed).toBeCloseTo((renderedAt - 100) / 1000, 8);
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
      lastFrameTime: 42,
      logDestroyed,
      renderFrame,
      requestNextFrame,
      targetFPS: null,
    });

    expect(lastTime.lastTime).toBe(42);
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
      lastFrameTime: 25,
      renderFrame,
      requestNextFrame,
      targetFPS: null,
    });

    expect(lastTime.lastTime).toBe(25);
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
      lastFrameTime: 0,
      renderFrame,
      requestNextFrame,
      targetFPS: 30,
    });

    expect(lastTime.lastTime).toBe(100);
    expect(renderFrame).not.toHaveBeenCalled();
    expect(requestNextFrame).toHaveBeenCalledTimes(1);
  });

  it("does not clear the failure circuit when a frame declines to render", () => {
    const requestNextFrame = vi.fn();
    const updateStatsPanel = vi.fn();
    const updateControls = vi.fn();
    const renderFrame = vi.fn(() => false);
    const onFrameSuccess = vi.fn();

    const lastTime = runRendererAnimationTick({
      getCurrentTime: () => 116,
      getCycleProgress: () => 0.75,
      isDestroyed: false,
      isLabelRuntimeReady: true,
      lastTime: 100,
      lastFrameTime: 100,
      onFrameSuccess,
      renderFrame,
      requestNextFrame,
      targetFPS: null,
      updateControls,
      updateStatsPanel,
    });

    expect(lastTime.lastTime).toBe(116);
    expect(updateStatsPanel).toHaveBeenCalledTimes(1);
    expect(updateControls).toHaveBeenCalledTimes(1);
    expect(renderFrame).toHaveBeenCalledWith({
      currentTime: 116,
      cycleProgress: 0.75,
      deltaTime: 0.016,
    });
    expect(requestNextFrame).toHaveBeenCalledTimes(1);
    expect(onFrameSuccess).not.toHaveBeenCalled();
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
      lastFrameTime: 100,
      onFrameError,
      onFrameSuccess,
      renderFrame: vi.fn(() => {
        throw frameError;
      }),
      requestNextFrame,
      targetFPS: null,
    });

    expect(lastTime.lastTime).toBe(116);
    expect(onFrameError).toHaveBeenCalledWith(frameError);
    expect(onFrameSuccess).not.toHaveBeenCalled();
    expect(requestNextFrame).toHaveBeenCalledTimes(1);
  });

  it("preserves frame time and scheduling when the error reporter itself throws", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const requestNextFrame = vi.fn();

    const lastTime = runRendererAnimationTick({
      getCurrentTime: () => 116,
      getCycleProgress: () => 0.75,
      isDestroyed: false,
      isLabelRuntimeReady: true,
      lastTime: 100,
      lastFrameTime: 100,
      onFrameError: () => {
        throw new Error("reporter failed");
      },
      renderFrame: () => {
        throw new Error("frame failed");
      },
      requestNextFrame,
      targetFPS: null,
    });

    expect(lastTime.lastTime).toBe(116);
    expect(requestNextFrame).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledWith("[GameRenderer] Failed to report renderer frame error", expect.any(Error));
  });

  it("throttles repeated-frame-error reports without stopping frame attempts", () => {
    const circuit = createRendererFrameFailureCircuit();
    const frameError = new Error("writeBuffer range is invalid");

    expect(circuit.recordFailure(frameError)).toEqual({ repeatCount: 0, shouldReport: true });
    for (let repeatCount = 1; repeatCount < 60; repeatCount += 1) {
      expect(circuit.recordFailure(frameError)).toEqual({ repeatCount, shouldReport: false });
    }
    expect(circuit.recordFailure(frameError)).toEqual({ repeatCount: 60, shouldReport: true });

    for (let repeatCount = 61; repeatCount < 120; repeatCount += 1) {
      expect(circuit.recordFailure(frameError)).toEqual({ repeatCount, shouldReport: false });
    }
    expect(circuit.recordFailure(frameError)).toEqual({ repeatCount: 120, shouldReport: true });

    circuit.recordSuccess();
    expect(circuit.recordFailure(frameError)).toEqual({ repeatCount: 0, shouldReport: true });
  });

  it("retains independent backoff state for alternating failure fingerprints", () => {
    const circuit = createRendererFrameFailureCircuit();
    const uploadError = new Error("upload failed");
    const renderError = new Error("render failed");

    expect(circuit.recordFailure(uploadError)).toEqual({ repeatCount: 0, shouldReport: true });
    expect(circuit.recordFailure(renderError)).toEqual({ repeatCount: 0, shouldReport: true });
    expect(circuit.recordFailure(uploadError)).toEqual({ repeatCount: 1, shouldReport: false });
    expect(circuit.recordFailure(renderError)).toEqual({ repeatCount: 1, shouldReport: false });
  });
});
