import { afterEach, describe, expect, it, vi } from "vitest";

import { markPresentedResults, presentResult, presentUncovered } from "./presented-results";

const presentedMarks = () =>
  performance
    .getEntriesByType("mark")
    .map((mark) => mark.name)
    .filter((name) => name.startsWith("presented:"));

afterEach(() => {
  performance.clearMarks();
  vi.unstubAllGlobals();
});

describe("presented results", () => {
  it("marks a queued result only once a frame has been rendered", () => {
    presentResult("walk:201");
    expect(presentedMarks()).toEqual([]);

    markPresentedResults();
    expect(presentedMarks()).toEqual(["presented:walk:201"]);
  });

  it("marks each result once, with the frame after it was queued", () => {
    presentResult("building:10,8:37");
    markPresentedResults();
    markPresentedResults();
    presentResult("explore:655,49");
    markPresentedResults();

    expect(presentedMarks()).toEqual(["presented:building:10,8:37", "presented:explore:655,49"]);
  });

  it("marks an uncovered result at the start of the frame after the one that paints it", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    presentUncovered("entered");
    frames.shift()!(1000);
    expect(presentedMarks()).toEqual([]);

    frames.shift()!(1100);
    const [mark] = performance.getEntriesByName("presented:entered");
    expect(mark?.startTime).toBe(1100);
  });
});
