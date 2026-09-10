import { describe, expect, it } from "vitest";

import {
  TouchGestureRecognizer,
  type ScheduleTimer,
  type TouchGesture,
  type TouchPointerSample,
} from "./touch-gesture-recognizer";

function createHarness() {
  const gestures: TouchGesture[] = [];
  const pendingTimers: Array<{ fn: () => void; ms: number; cancelled: boolean }> = [];
  const schedule: ScheduleTimer = (fn, ms) => {
    const timer = { fn, ms, cancelled: false };
    pendingTimers.push(timer);
    return () => {
      timer.cancelled = true;
    };
  };
  const recognizer = new TouchGestureRecognizer((gesture) => gestures.push(gesture), schedule);

  const feed = (kind: TouchPointerSample["kind"], pointerId: number, x: number, y: number, time: number) =>
    recognizer.feed({ kind, pointerId, x, y, time });

  const fireLongPressTimer = () => {
    const timer = pendingTimers.find((entry) => !entry.cancelled);
    if (!timer) {
      return;
    }
    timer.cancelled = true;
    timer.fn();
  };

  return { gestures, feed, fireLongPressTimer, pendingTimers, recognizer };
}

describe("TouchGestureRecognizer", () => {
  it("emits a tap for a short still press", () => {
    const harness = createHarness();

    harness.feed("down", 1, 100, 100, 0);
    harness.feed("move", 1, 104, 103, 20);
    harness.feed("up", 1, 104, 103, 80);

    expect(harness.gestures).toEqual([{ kind: "tap", x: 104, y: 103 }]);
  });

  it("does not emit a tap once the pointer moved past the slop", () => {
    const harness = createHarness();

    harness.feed("down", 1, 100, 100, 0);
    harness.feed("move", 1, 130, 100, 20);
    harness.feed("up", 1, 130, 100, 80);

    expect(harness.gestures).toEqual([]);
  });

  it("emits a long press after the hold timer and treats the release as not a tap", () => {
    const harness = createHarness();

    harness.feed("down", 1, 50, 60, 0);
    expect(harness.pendingTimers[0].ms).toBe(500);

    harness.fireLongPressTimer();
    harness.feed("up", 1, 52, 61, 700);

    expect(harness.gestures).toEqual([{ kind: "long-press", x: 50, y: 60 }]);
  });

  it("cancels the long press when the pointer moves past the slop", () => {
    const harness = createHarness();

    harness.feed("down", 1, 50, 60, 0);
    harness.feed("move", 1, 80, 60, 100);
    harness.fireLongPressTimer();
    harness.feed("up", 1, 80, 60, 700);

    expect(harness.pendingTimers[0].cancelled).toBe(true);
    expect(harness.gestures).toEqual([]);
  });

  it("emits tap then double-tap for two taps close in time and space", () => {
    const harness = createHarness();

    harness.feed("down", 1, 100, 100, 0);
    harness.feed("up", 1, 100, 100, 50);
    harness.feed("down", 2, 110, 105, 200);
    harness.feed("up", 2, 110, 105, 250);

    expect(harness.gestures).toEqual([
      { kind: "tap", x: 100, y: 100 },
      { kind: "tap", x: 110, y: 105 },
      { kind: "double-tap", x: 110, y: 105 },
    ]);
  });

  it("does not chain a third tap into another double-tap", () => {
    const harness = createHarness();

    harness.feed("down", 1, 100, 100, 0);
    harness.feed("up", 1, 100, 100, 50);
    harness.feed("down", 2, 100, 100, 200);
    harness.feed("up", 2, 100, 100, 250);
    harness.feed("down", 3, 100, 100, 400);
    harness.feed("up", 3, 100, 100, 450);

    expect(harness.gestures.filter((gesture) => gesture.kind === "double-tap")).toHaveLength(1);
  });

  it("does not emit double-tap when the second tap is too late or too far", () => {
    const late = createHarness();
    late.feed("down", 1, 100, 100, 0);
    late.feed("up", 1, 100, 100, 50);
    late.feed("down", 2, 100, 100, 400);
    late.feed("up", 2, 100, 100, 450);
    expect(late.gestures.map((gesture) => gesture.kind)).toEqual(["tap", "tap"]);

    const far = createHarness();
    far.feed("down", 1, 100, 100, 0);
    far.feed("up", 1, 100, 100, 50);
    far.feed("down", 2, 140, 100, 200);
    far.feed("up", 2, 140, 100, 250);
    expect(far.gestures.map((gesture) => gesture.kind)).toEqual(["tap", "tap"]);
  });

  it("cancels tap and long press when a second pointer lands, and emits pinch steps on movement", () => {
    const harness = createHarness();

    harness.feed("down", 1, 100, 100, 0);
    harness.feed("down", 2, 200, 100, 30);
    expect(harness.pendingTimers[0].cancelled).toBe(true);

    harness.feed("move", 2, 300, 100, 60);
    harness.fireLongPressTimer();
    harness.feed("up", 1, 100, 100, 200);
    harness.feed("up", 2, 300, 100, 210);

    expect(harness.gestures).toEqual([{ kind: "pinch", scale: 2, centerX: 200, centerY: 100 }]);
  });

  it("emits pinch scale relative to the previous sample, not the initial spread", () => {
    const harness = createHarness();

    harness.feed("down", 1, 0, 0, 0);
    harness.feed("down", 2, 100, 0, 10);
    harness.feed("move", 2, 200, 0, 20);
    harness.feed("move", 2, 150, 0, 30);

    expect(harness.gestures).toEqual([
      { kind: "pinch", scale: 2, centerX: 100, centerY: 0 },
      { kind: "pinch", scale: 0.75, centerX: 75, centerY: 0 },
    ]);
  });

  it("recognizes a fresh tap after a pinch has fully ended", () => {
    const harness = createHarness();

    harness.feed("down", 1, 0, 0, 0);
    harness.feed("down", 2, 100, 0, 10);
    harness.feed("up", 2, 100, 0, 50);
    harness.feed("up", 1, 0, 0, 60);
    harness.feed("down", 3, 20, 20, 500);
    harness.feed("up", 3, 20, 20, 550);

    expect(harness.gestures).toEqual([{ kind: "tap", x: 20, y: 20 }]);
  });

  it("drops the press on cancel without emitting", () => {
    const harness = createHarness();

    harness.feed("down", 1, 0, 0, 0);
    harness.feed("cancel", 1, 0, 0, 10);
    harness.fireLongPressTimer();

    expect(harness.gestures).toEqual([]);
  });

  it("reset cancels a pending long press", () => {
    const harness = createHarness();

    harness.feed("down", 1, 0, 0, 0);
    harness.recognizer.reset();
    harness.fireLongPressTimer();

    expect(harness.gestures).toEqual([]);
  });
});
