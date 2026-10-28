import { describe, expect, it } from "vitest";

import { clickToResultTable, framesBetween, measureClickToResult } from "./click-latency.mjs";

/** A frame every 16 ms from 0 to `until`. */
const framesTo = (until, every = 16) => ({
  frames: Array.from({ length: Math.floor(until / every) + 1 }, (_, index) => index * every),
});

/** A send the client reported, stage by stage, with the facts Herald brought for it. */
const send = ({ command, answered, diff, applied }) => ({
  operation: "send",
  surface: "unattributed",
  transactionHash: "0xabc",
  phases: { diff_received: diff, store_applied: applied },
  send: {
    key: "1:1",
    stages: [
      { stage: "command", at: command },
      { stage: "answered", at: answered },
    ],
  },
});

describe("measureClickToResult", () => {
  it("cuts a press to its exact presented result at each mark the client recorded", () => {
    const measured = measureClickToResult({
      since: 90,
      probe: {
        inputs: [
          { type: "keydown", t: 95 },
          { type: "pointerdown", t: 100 },
        ],
        ...framesTo(800),
        marks: [{ name: "presented:explore:655,49", t: 704 }],
      },
      actionLatency: { clientActions: [send({ command: 112, answered: 140, diff: 600, applied: 630 })] },
      result: { presented: "explore:655,49" },
    });

    expect(measured.missing).toEqual([]);
    expect(measured.segments).toEqual({ handled: 12, sent: 28, confirmed: 460, applied: 30, drawn: 74 });
    expect(measured.totalMs).toBe(604);
    expect(measured.frames).toEqual({ covered: true, count: 38, worstMs: 16 });
  });

  it("takes the press just before the command, not an earlier one in the step", () => {
    const measured = measureClickToResult({
      since: 0,
      probe: {
        inputs: [
          { type: "pointerdown", t: 10 },
          { type: "pointerdown", t: 300 },
        ],
        ...framesTo(900),
        marks: [{ name: "presented:walk:201", t: 800 }],
      },
      actionLatency: { clientActions: [send({ command: 305, answered: 320, diff: 700, applied: 710 })] },
      result: { presented: "walk:201" },
    });

    expect(measured.marks.click).toBe(300);
    expect(measured.totalMs).toBe(500);
  });

  it("never takes another target's result, or one presented before the press, as this action's", () => {
    const measured = measureClickToResult({
      since: 0,
      probe: {
        inputs: [{ type: "pointerdown", t: 50 }],
        ...framesTo(600),
        marks: [
          { name: "presented:building:10,8:37", t: 20 },
          { name: "presented:building:11,8:37", t: 450 },
          { name: "presented:building:10,8:38", t: 460 },
        ],
      },
      actionLatency: { clientActions: [send({ command: 60, answered: 70, diff: 400, applied: 420 })] },
      result: { presented: "building:10,8:37" },
    });

    expect(measured.missing).toEqual(["visible"]);
    expect(measured.totalMs).toBeNull();
  });

  it("times a watched page condition from the frame callback that first saw it hold", () => {
    const measured = measureClickToResult({
      since: 0,
      probe: {
        inputs: [{ type: "pointerdown", t: 50 }],
        ...framesTo(600),
        watched: [{ name: "level-up", t: 432, at: 440 }],
      },
      actionLatency: { clientActions: [send({ command: 60, answered: 70, diff: 400, applied: 420 })] },
      result: { watch: "level-up" },
    });

    expect(measured.marks.visible).toBe(440);
    expect(measured.segments.drawn).toBe(20);
  });

  it("names a mark the client never reached and leaves its segments out", () => {
    const measured = measureClickToResult({
      since: 0,
      probe: { inputs: [{ type: "pointerdown", t: 50 }], ...framesTo(600), watched: [] },
      actionLatency: { clientActions: [send({ command: 60, answered: 70, diff: undefined, applied: undefined })] },
      result: { watch: "level-up" },
    });

    expect(measured.missing).toEqual(["diff", "applied", "visible"]);
    expect(measured.segments).toEqual({ handled: 10, sent: 10 });
    expect(measured.totalMs).toBeNull();
    expect(measured.frames.covered).toBe(false);
  });

  it("finds no click when nothing was pressed in the step", () => {
    expect(
      measureClickToResult({
        since: 100,
        probe: { inputs: [{ type: "pointerdown", t: 50 }], frames: [] },
        actionLatency: { clientActions: [] },
        result: { presented: "walk:201" },
      }),
    ).toEqual({ missing: ["click"] });
  });
});

describe("framesBetween", () => {
  it("is not covered when no frame reaches the result", () => {
    // Frames stop at 1022 while the result is at 1500: what the player saw then was never observed.
    expect(framesBetween([990, 1006, 1022], 1000, 1500).covered).toBe(false);
  });

  it("is not covered when no frame starts before the press", () => {
    expect(framesBetween([1010, 1026, 1042], 1000, 1030).covered).toBe(false);
  });

  it("counts the long frame that crosses the result", () => {
    // Frames every 16 ms to 1984, then one at 10000: the result at 2005 waited on that 8 s frame.
    const frames = [...framesTo(1998).frames.filter((frame) => frame >= 990), 10_000];
    expect(framesBetween(frames, 1000, 2005)).toMatchObject({ covered: true, worstMs: 8016 });
  });
});

describe("clickToResultTable", () => {
  const spread = (median, min, max, n = 3) => ({ n, median, min, max });

  it("lays out each timed action's segments and total per mode", () => {
    const table = clickToResultTable({
      "webgpu-auto": {
        steps: {
          "enter-on-map": { durationMs: spread(3000, 3000, 3000) },
          explore: {
            "verdict.clickToResult.totalMs": spread(420, 400, 500),
            "verdict.clickToResult.segments.handled": spread(12, 10, 15),
            "verdict.clickToResult.segments.drawn": spread(90, 80, 130),
          },
        },
      },
    });

    expect(table.split("\n")).toEqual([
      "ms, median (min–max)",
      "",
      "### webgpu-auto",
      "",
      "| action | n | handled | sent | confirmed | applied | drawn | total |",
      "|---|---|---|---|---|---|---|---|",
      "| explore | 3 | 12 (10–15) | – | – | – | 90 (80–130) | 420 (400–500) |",
      "",
    ]);
  });

  it("is empty when no step timed an action", () => {
    expect(clickToResultTable({ "webgpu-auto": { steps: { pan: {} } } })).toBe("");
  });
});
