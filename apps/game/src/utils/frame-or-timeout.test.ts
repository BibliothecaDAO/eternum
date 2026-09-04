import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestFrameOrTimeout } from "./frame-or-timeout";

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
    requestFrameOrTimeout(callback, 100);
    frames[0](0);
    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("runs on the timer when frames stop, as in a hidden tab", () => {
    const callback = vi.fn();
    requestFrameOrTimeout(callback, 100);
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
    frames[0](0);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cancels both paths", () => {
    const callback = vi.fn();
    const cancel = requestFrameOrTimeout(callback, 100);
    cancel();
    frames[0](0);
    vi.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();
  });
});
