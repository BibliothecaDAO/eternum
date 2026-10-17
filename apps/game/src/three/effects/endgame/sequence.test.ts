import { afterEach, expect, it } from "vitest";
import type NodeFrame from "three/src/nodes/core/NodeFrame.js";
import { GameEndTimeline, endgameFrame } from "./sequence";
import { advanceGameEnd, mapAnimationTime, resetGameEnd, skipGameEnd } from "./state";

afterEach(resetGameEnd);
it("plays the approved materialisation, contraction, burst and nine-second freeze", () => {
  expect(endgameFrame(null)).toMatchObject({ phase: "live", spread: 0 });
  expect(endgameFrame(0.4)).toMatchObject({ materialisation: 0.5, spread: 0 });
  expect(endgameFrame(1.5)).toMatchObject({ phase: "contracting", contraction: 0.5 });
  expect(endgameFrame(1.999).orbScale).toBeCloseTo(0.06, 2);
  expect(endgameFrame(2.15)).toMatchObject({ phase: "bursting" });
  expect(endgameFrame(4.75)).toMatchObject({ phase: "spreading", spread: 0.5 });
  expect(endgameFrame(9)).toMatchObject({ finished: true, settle: 1, spread: 1 });
  expect(endgameFrame(999)).toEqual(endgameFrame(9));
});
it("starts only on a live-to-ended fact change, not on visiting an ended game", () => {
  const timeline = new GameEndTimeline();
  expect(timeline.observe(1, false, 0).phase).toBe("live");
  expect(timeline.observe(1, true, 0.1)).toMatchObject({ phase: "materialising", seconds: 0.1, finished: false });
  expect(timeline.observe(1, true, 9).finished).toBe(true);
  expect(timeline.observe(2, true, 0)).toMatchObject({ seconds: 9, finished: true });
  expect(new GameEndTimeline().observe(1, true, 0).finished).toBe(true);
});
it("skips immediately, stays final and clears on a new live game", () => {
  const timeline = new GameEndTimeline();
  expect(timeline.skip()).toBe(false);
  timeline.observe(1, false, 0);
  timeline.observe(1, true, 0.4);
  expect(timeline.skip()).toBe(true);
  expect(timeline.frame).toEqual(endgameFrame(9));
  expect(timeline.skip()).toBe(false);
  expect(timeline.observe(1, true, 100)).toEqual(endgameFrame(9));
  expect(timeline.observe(2, false, 0)).toEqual(endgameFrame(null));
});
it("holds the shader clock only after the veil finishes or is skipped", () => {
  const clock = (time: number) => {
    mapAnimationTime.update({ time } as NodeFrame);
    return mapAnimationTime.value;
  };
  advanceGameEnd(1, false, 0);
  expect(clock(12)).toBe(12);
  advanceGameEnd(1, true, 0.1);
  expect(clock(13)).toBe(13);
  skipGameEnd();
  expect(clock(20)).toBe(13);
  advanceGameEnd(2, false, 0);
  expect(clock(21)).toBe(21);
});
