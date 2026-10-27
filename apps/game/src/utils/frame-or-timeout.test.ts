import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextFrameOrTimeout, requestFrameOrTimeout } from "./frame-or-timeout";

describe("requestFrameOrTimeout", () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    vi.useFakeTimers();
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      frames[handle - 1] = () => undefined;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("runs on the frame and drops the timer", () => {
    const callback = vi.fn();
    requestFrameOrTimeout(callback);
    frames[0](0);
    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("runs on the timer when frames stop, as in a hidden tab", () => {
    const callback = vi.fn();
    requestFrameOrTimeout(callback);
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
    frames[0](0);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cancels both paths", () => {
    const callback = vi.fn();
    const cancel = requestFrameOrTimeout(callback);
    cancel();
    frames[0](0);
    vi.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();
  });

  it("settles a manager's chunk update on the frame, as the scene draws it", async () => {
    const settled = vi.fn();
    void nextFrameOrTimeout().then(settled);
    frames[0](0);
    await Promise.resolve();
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("settles it without a frame in a hidden tab, well inside the chunk catch-up's 12 s deadline", async () => {
    const settled = vi.fn();
    void nextFrameOrTimeout().then(settled);
    await vi.advanceTimersByTimeAsync(99);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalledTimes(1);
  });
});
